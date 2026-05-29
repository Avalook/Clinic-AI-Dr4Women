"""Transform Notion CSV exports into staged files for schema v6 (T-TRANSFORM-01).

NHỊP 1 — TRANSFORM ONLY. This module is strictly READ-ONLY with respect to the
database: it never opens a DB connection and never emits SQL. Its sole output is
a set of staged CSV files (plus a Markdown report) written to a gitignored
directory, ready for a later LOAD task to ingest into Supabase staging.

Design notes
------------
- Source CSVs contain newlines inside quoted cells, so they MUST be read with
  ``csv.DictReader`` (never ``pandas.read_csv`` C-engine, never raw line reads).
- Patients are built from the *administrative* export using ONLY the cleaned
  identity columns ``//sdt (neat)`` and ``//họ tên (neat)`` — never by scanning
  every field, which would harvest other people's phone numbers out of link
  text and inflate the population.
- Child tables (appointment / lab / prescription / clinical) are resolved to a
  patient by extracting the first VN phone number from that row's *primary link
  field* only. Phones not already known become SKELETON (yellow) patients.
- Master FKs (doctor / service / session / channel / location) are NOT resolved
  to UUIDs here. Raw TEXT is kept and ``fk_unresolved`` is flagged.
- Lab results are emitted with ``triage_group='PENDING'`` — classification is
  the Lab Triage graph's job, never the importer's.

USAGE
    poetry run python scripts/data_migration/transform.py \
        --input-dir "../Data khách gửi" \
        --output-dir "scripts/data_migration/output"
"""

from __future__ import annotations

import argparse
import csv
import logging
import re
import sys
import unicodedata
import uuid
from collections.abc import Iterable, Mapping, Sequence
from dataclasses import dataclass, field
from datetime import date
from pathlib import Path

logger = logging.getLogger("data_migration.transform")

# --------------------------------------------------------------------------- #
# Source-file resolution                                                      #
# --------------------------------------------------------------------------- #

#: Folder-name keyword (lower-case, accent-sensitive) identifying each table's
#: subdirectory inside the input directory. The ``_all.csv`` file within is the
#: authoritative, fullest export and is always preferred.
TABLE_FOLDER_KEYWORD: dict[str, str] = {
    "admin": "hành chính",
    "appointment": "lịch hẹn",
    "lab": "xét nghiệm",
    "prescription": "kê thuốc",
    "clinical": "lâm sàng",
}

CSV_ENCODING = "utf-8-sig"

# --------------------------------------------------------------------------- #
# Pure normalisation helpers (unit-tested)                                    #
# --------------------------------------------------------------------------- #

_PHONE_RE = re.compile(r"0\d{9}")
_DATE_RE = re.compile(r"(\d{1,2})/(\d{1,2})/(\d{4})")
_DATETIME_RE = re.compile(r"(\d{1,2})/(\d{1,2})/(\d{4})(?:\s+(\d{1,2}):(\d{2}))?")


def norm_phone(raw: str | None) -> str | None:
    """Normalise a single Vietnamese phone string to E.164 (``+84…``).

    Accepts a value that is expected to *contain* one phone number (e.g. the
    cleaned ``//sdt (neat)`` column). Strips non-digits, maps a leading ``84``
    country code to the national ``0`` form, then requires a 10-digit number
    beginning with ``0``. Returns ``None`` when no valid VN number is present.

    >>> norm_phone("0988501997")
    '+84988501997'
    >>> norm_phone("84 988 501 997")
    '+84988501997'
    >>> norm_phone("not a phone") is None
    True
    """
    if not raw:
        return None
    digits = re.sub(r"\D", "", raw)
    if digits.startswith("84") and len(digits) == 11:
        digits = "0" + digits[2:]
    if len(digits) == 10 and digits.startswith("0"):
        return "+84" + digits[1:]
    return None


def extract_phone(text: str | None) -> str | None:
    """Extract the FIRST VN phone (``0\\d{9}``) from free text, normalised.

    Used to resolve a child-table row to its patient from a link field such as
    ``"[Reg 31] Vũ Thuý Phượng 0983473216 (https://…)"``. Returns ``None`` when
    no phone-shaped token is found.

    >>> extract_phone("[Reg 31] Vũ Thuý Phượng 0983473216 (https://x)")
    '+84983473216'
    >>> extract_phone("PK3350-1411-Tiến Thị Hải Yến  0917947099")
    '+84917947099'
    >>> extract_phone("no number here") is None
    True
    """
    if not text:
        return None
    match = _PHONE_RE.search(text)
    if match is None:
        return None
    return norm_phone(match.group())


def norm_dob(raw: str | None) -> str | None:
    """Parse a ``dd/mm/yyyy`` date-of-birth into ISO ``yyyy-mm-dd``.

    The administrative export stores DOB like ``"20/06/1997 12:00 AM (GMT+7)"``;
    only the leading calendar date is significant. Returns ``None`` for missing
    or impossible dates (e.g. ``32/13/2000``).

    >>> norm_dob("20/06/1997 12:00 AM (GMT+7)")
    '1997-06-20'
    >>> norm_dob("01/01/1991")
    '1991-01-01'
    >>> norm_dob("32/13/2000") is None
    True
    """
    if not raw:
        return None
    match = _DATE_RE.search(raw)
    if match is None:
        return None
    day, month, year = (int(part) for part in match.groups())
    try:
        return date(year, month, day).isoformat()
    except ValueError:
        return None


def norm_gender(raw: str | None) -> str | None:
    """Map the Vietnamese ``Giới tính`` value to ``MALE`` / ``FEMALE`` / ``None``.

    >>> norm_gender("Nữ")
    'FEMALE'
    >>> norm_gender("Nam")
    'MALE'
    >>> norm_gender("") is None
    True
    """
    value = (raw or "").strip().lower()
    if value.startswith("nữ") or value == "nu":
        return "FEMALE"
    if value.startswith("nam"):
        return "MALE"
    return None


def parse_datetime_vn(raw: str | None) -> str | None:
    """Parse ``dd/mm/yyyy[ HH:MM]`` (GMT+7) into an ISO-8601 ``+07:00`` string.

    Used for appointment slot times like ``"14/11/2025 20:30 (GMT+7)"``. When no
    time component is present, midnight is assumed. Returns ``None`` if unparsable.
    """
    if not raw:
        return None
    match = _DATETIME_RE.search(raw)
    if match is None:
        return None
    day, month, year = int(match.group(1)), int(match.group(2)), int(match.group(3))
    hour = int(match.group(4)) if match.group(4) else 0
    minute = int(match.group(5)) if match.group(5) else 0
    try:
        date(year, month, day)  # validate calendar date
    except ValueError:
        return None
    if not (0 <= hour < 24 and 0 <= minute < 60):
        return None
    return f"{year:04d}-{month:02d}-{day:02d}T{hour:02d}:{minute:02d}:00+07:00"


def extract_name(text: str | None) -> str:
    """Best-effort patient name from a Notion link/title field.

    Strips the trailing phone, any ``(https://…)`` suffix, bracketed tags such
    as ``[Reg 31]`` / ``[XN-52]``, ``PK####-####-`` voucher prefixes, and the
    boilerplate tokens ``Notion`` / ``Reg``.

    >>> extract_name("[Reg 31] Vũ Thuý Phượng 0983473216 (https://x)")
    'Vũ Thuý Phượng'
    >>> extract_name("PK3350-1411-Tiến Thị Hải Yến  0917947099")
    'Tiến Thị Hải Yến'
    """
    if not text:
        return ""
    match = _PHONE_RE.search(text)
    head = text[: match.start()] if match else text
    head = re.sub(r"\(https?://[^)]*\)?", " ", head)
    head = re.sub(r"\[[^\]]*\]", " ", head)
    head = re.sub(r"PK\d+-\d+-", " ", head)
    head = re.sub(r"\bNotion\s*\d*\b", " ", head, flags=re.IGNORECASE)
    head = re.sub(r"\bReg\b", " ", head, flags=re.IGNORECASE)
    head = re.sub(r"\s+", " ", head)
    return head.strip(" -")


def name_key(name: str | None) -> str:
    """Normalised key for same-phone name comparison (lower, collapsed spaces)."""
    return re.sub(r"\s+", " ", (name or "").strip().lower())


# --------------------------------------------------------------------------- #
# Domain models                                                               #
# --------------------------------------------------------------------------- #


@dataclass
class Patient:
    """A staged patient record keyed by normalised phone.

    ``gender`` and ``address`` have no column in the current ``patient`` schema;
    they are retained as staging metadata only (see TRANSFORM_REPORT).
    """

    clinic_patient_id: str
    full_name: str
    phone_primary: str
    date_of_birth: str | None
    gender: str | None
    address: str | None
    profile_status: str  # COMPLETE | SKELETON
    merge_action: str  # SINGLE | AUTO_MERGE | REVIEW_CONFLICT
    source_refs: list[str] = field(default_factory=list)
    source_tables: set[str] = field(default_factory=set)
    # Raw Notion-export timestamps (English long form: "November 14, 2025
    # 8:11 AM"). The sync runner parses these and writes them as the
    # ``created_at`` / ``updated_at`` columns so the dashboard's "Tạo lúc"
    # column matches the date PK actually registered the BN — not the
    # day we imported.
    source_created_time: str | None = None
    source_updated_time: str | None = None


@dataclass
class ReviewItem:
    """A same-phone / different-name collision needing manual adjudication."""

    reason: str
    phone: str
    clinic_patient_id: str
    name_existing: str
    name_incoming: str
    source_ref_existing: str
    source_ref_incoming: str


@dataclass
class RejectItem:
    """A row from which no patient phone could be extracted (not importable)."""

    source_table: str
    source_ref: str
    reason: str
    raw_identity: str


@dataclass
class TransformResult:
    """Aggregated output of a full transform run."""

    patients: list[Patient]
    appointments: list[dict[str, str]]
    lab_results: list[dict[str, str]]
    prescriptions: list[dict[str, str]]
    clinical_records: list[dict[str, str]]
    review_queue: list[ReviewItem]
    rejects: list[RejectItem]
    counters: dict[str, dict[str, int]]


def _classify(dob: str | None, gender: str | None) -> str:
    """COMPLETE (green) when both DOB and gender are known, else SKELETON."""
    return "COMPLETE" if dob and gender else "SKELETON"


# --------------------------------------------------------------------------- #
# Patient index construction                                                  #
# --------------------------------------------------------------------------- #


class PatientIndex:
    """Phone-keyed patient registry with simplified MPI dedup.

    Dedup policy (no CCCD yet): the key is the normalised phone.
      - same phone + same name  -> AUTO_MERGE (keep one, accumulate source_refs)
      - same phone + diff name   -> NO merge; first stays canonical, the incoming
        record is recorded in the review queue (prefer false-positive over
        false-merge — spouses booking on one phone).
    """

    def __init__(self) -> None:
        self._by_phone: dict[str, Patient] = {}
        self.review_queue: list[ReviewItem] = []

    def __contains__(self, phone: str) -> bool:
        return phone in self._by_phone

    def get(self, phone: str) -> Patient | None:
        return self._by_phone.get(phone)

    def patients(self) -> list[Patient]:
        return list(self._by_phone.values())

    def upsert(
        self,
        *,
        phone: str,
        name: str,
        source_ref: str,
        source_table: str,
        dob: str | None = None,
        gender: str | None = None,
        address: str | None = None,
        source_created_time: str | None = None,
        source_updated_time: str | None = None,
    ) -> Patient:
        """Insert a new patient or merge into the existing one for ``phone``."""
        existing = self._by_phone.get(phone)
        if existing is None:
            patient = Patient(
                clinic_patient_id=str(uuid.uuid4()),
                full_name=name,
                phone_primary=phone,
                date_of_birth=dob,
                gender=gender,
                address=address,
                profile_status=_classify(dob, gender),
                merge_action="SINGLE",
                source_refs=[source_ref] if source_ref else [],
                source_tables={source_table},
                source_created_time=source_created_time,
                source_updated_time=source_updated_time,
            )
            self._by_phone[phone] = patient
            return patient

        existing.source_tables.add(source_table)
        if source_ref and source_ref not in existing.source_refs:
            existing.source_refs.append(source_ref)
        # Keep the EARLIEST "Created time" we have seen for this phone —
        # that is when PK first met the patient. The latest
        # "Last edited time" wins for source_updated_time.
        if source_created_time and (
            existing.source_created_time is None
            or source_created_time < existing.source_created_time
        ):
            existing.source_created_time = source_created_time
        if source_updated_time and (
            existing.source_updated_time is None
            or source_updated_time > existing.source_updated_time
        ):
            existing.source_updated_time = source_updated_time

        incoming_key = name_key(name)
        existing_key = name_key(existing.full_name)
        if incoming_key and existing_key and incoming_key != existing_key:
            # Same phone, different person — never merge silently.
            existing.merge_action = "REVIEW_CONFLICT"
            self.review_queue.append(
                ReviewItem(
                    reason="SAME_PHONE_DIFFERENT_NAME",
                    phone=phone,
                    clinic_patient_id=existing.clinic_patient_id,
                    name_existing=existing.full_name,
                    name_incoming=name,
                    source_ref_existing=existing.source_refs[0]
                    if existing.source_refs
                    else "",
                    source_ref_incoming=source_ref,
                )
            )
            return existing

        # Same (or empty) name -> auto-merge, back-filling any missing fields.
        if existing.merge_action == "SINGLE":
            existing.merge_action = "AUTO_MERGE"
        existing.date_of_birth = existing.date_of_birth or dob
        existing.gender = existing.gender or gender
        existing.address = existing.address or address
        if not existing.full_name and name:
            existing.full_name = name
        existing.profile_status = _classify(existing.date_of_birth, existing.gender)
        return existing


def build_patient_index(
    admin_rows: Iterable[Mapping[str, str]],
) -> tuple[PatientIndex, list[RejectItem]]:
    """Seed the patient index from the administrative export.

    Identity is taken ONLY from ``//sdt (neat)`` and ``//họ tên (neat)``. Rows
    without an extractable phone are rejected (cannot be keyed).
    """
    index = PatientIndex()
    rejects: list[RejectItem] = []
    for row in admin_rows:
        phone = norm_phone(row.get("//sdt (neat)")) or extract_phone(
            row.get("//sdt (neat)")
        )
        source_ref = (row.get("*ID") or "").strip()
        if phone is None:
            rejects.append(
                RejectItem(
                    source_table="admin",
                    source_ref=source_ref,
                    reason="NO_PHONE_IN_NEAT_COLUMN",
                    raw_identity=(row.get("//họ tên (neat)") or row.get("Name") or "")[
                        :80
                    ],
                )
            )
            continue
        name = (row.get("//họ tên (neat)") or "").strip() or extract_name(
            row.get("Name")
        )
        index.upsert(
            phone=phone,
            name=name,
            source_ref=source_ref,
            source_table="admin",
            dob=norm_dob(row.get("Ngày sinh")),
            gender=norm_gender(row.get("Giới tính")),
            address=(row.get("Địa chỉ") or "").strip() or None,
            source_created_time=(row.get("Created time") or "").strip() or None,
            source_updated_time=(row.get("Last edited time") or "").strip() or None,
        )
    return index, rejects


def resolve_patient(
    row: Mapping[str, str],
    *,
    link_fields: Sequence[str],
    source_ref: str,
    source_table: str,
    index: PatientIndex,
) -> str | None:
    """Resolve a child row to a ``clinic_patient_id`` via its primary link field.

    Tries each link field in order; the first VN phone found wins. An unknown
    phone creates a SKELETON (yellow) patient. Returns ``None`` when no phone is
    present in any link field (caller should reject the row).
    """
    phone: str | None = None
    link_text = ""
    for field_name in link_fields:
        link_text = row.get(field_name) or ""
        phone = extract_phone(link_text)
        if phone is not None:
            break
    if phone is None:
        return None
    patient = index.get(phone)
    if patient is None:
        patient = index.upsert(
            phone=phone,
            name=extract_name(link_text),
            source_ref=source_ref,
            source_table=source_table,
            # Skeleton patients seeded from a child row inherit that row's
            # "Created time" so the dashboard's "Tạo lúc" still shows a
            # plausible PK-registration date instead of import day.
            source_created_time=(row.get("Created time") or "").strip() or None,
            source_updated_time=(row.get("Last edited time") or "").strip() or None,
        )
    else:
        patient.source_tables.add(source_table)
    return patient.clinic_patient_id


# --------------------------------------------------------------------------- #
# Child-table mappers                                                         #
# --------------------------------------------------------------------------- #


def map_appointments(
    rows: Iterable[Mapping[str, str]], index: PatientIndex
) -> tuple[list[dict[str, str]], list[RejectItem]]:
    """Map appointment rows -> staged ``appointment`` records.

    Master FKs (doctor / location / service_type) are kept as raw TEXT with
    ``fk_unresolved=true``. ``slot_end`` has no source (flagged in report).
    """
    staged: list[dict[str, str]] = []
    rejects: list[RejectItem] = []
    for row in rows:
        source_ref = (row.get("ID") or "").strip()
        cpid = resolve_patient(
            row,
            link_fields=("🔑File hành chính", "Name", "Tóm tắt bệnh nhân"),
            source_ref=source_ref,
            source_table="appointment",
            index=index,
        )
        if cpid is None:
            rejects.append(
                RejectItem(
                    source_table="appointment",
                    source_ref=source_ref,
                    reason="NO_PATIENT_PHONE_IN_LINK",
                    raw_identity=(row.get("Name") or "")[:80],
                )
            )
            continue
        staged.append(
            {
                "clinic_patient_id": cpid,
                "source_ref": source_ref,
                "slot_start": parse_datetime_vn(row.get("Ngày giờ hẹn")) or "",
                "slot_end": "",  # no source — LOAD must derive
                "status_raw": (row.get("Tình trạng khách đến") or "").strip(),
                "doctor_raw": (row.get("Bác sĩ") or "").strip(),
                "location_raw": (row.get("Phòng khám") or "").strip(),
                "service_type_raw": (row.get("Loại dịch vụ khám") or "").strip(),
                "booking_channel_raw": (row.get("Tình trạng CSKH") or "").strip(),
                "note": (row.get("Ghi chú") or "").strip(),
                "fk_unresolved": "true",
                # Preserved for the sync runner so appointment.created_at /
                # updated_at match the Notion source instead of import day.
                "source_created_time": (row.get("Created time") or "").strip(),
                "source_updated_time": (row.get("Last edited time") or "").strip(),
            }
        )
    return staged, rejects


def map_lab_results(
    rows: Iterable[Mapping[str, str]], index: PatientIndex
) -> tuple[list[dict[str, str]], list[RejectItem]]:
    """Map lab rows -> staged ``lab_result`` records (triage_group=PENDING)."""
    staged: list[dict[str, str]] = []
    rejects: list[RejectItem] = []
    for row in rows:
        source_ref = (row.get("*ID") or "").strip()
        cpid = resolve_patient(
            row,
            link_fields=("🔑 File bệnh nhân", "Phiếu khám"),
            source_ref=source_ref,
            source_table="lab",
            index=index,
        )
        if cpid is None:
            rejects.append(
                RejectItem(
                    source_table="lab",
                    source_ref=source_ref,
                    reason="NO_PATIENT_PHONE_IN_LINK",
                    raw_identity=(row.get("Phiếu khám") or "")[:80],
                )
            )
            continue
        test_name = (row.get("Tên xét nghiệm") or "").strip() or "UNKNOWN"
        test_code = (row.get("//mã xét nghiệm") or "").strip() or source_ref
        staged.append(
            {
                "clinic_patient_id": cpid,
                "source_ref": source_ref,
                "test_code": test_code,
                "test_name": test_name,
                "panel_code": (row.get("Phân loại xét nghiệm") or "").strip(),
                "result_value": (row.get("Kết quả") or "").strip(),
                "result_unit": "",
                "triage_group": "PENDING",
                "lab_provider": (row.get("Phân loại xét nghiệm") or "").strip(),
                "external_ref": source_ref,
                "appointment_raw": (row.get("Phiếu khám") or "").strip(),
                "fk_unresolved": "true",
                # Notion source timestamps preserved for the sync runner.
                "source_created_time": (row.get("Created time") or "").strip(),
                "source_updated_time": (row.get("//ngày up notion") or "").strip(),
            }
        )
    return staged, rejects


def map_prescriptions(
    rows: Iterable[Mapping[str, str]], index: PatientIndex
) -> tuple[list[dict[str, str]], list[RejectItem]]:
    """Map prescription rows -> staged records (NO target table yet — parked)."""
    staged: list[dict[str, str]] = []
    rejects: list[RejectItem] = []
    for row in rows:
        source_ref = (row.get("*ID") or "").strip()
        cpid = resolve_patient(
            row,
            link_fields=("Phiếu khám",),
            source_ref=source_ref,
            source_table="prescription",
            index=index,
        )
        if cpid is None:
            rejects.append(
                RejectItem(
                    source_table="prescription",
                    source_ref=source_ref,
                    reason="NO_PATIENT_PHONE_IN_LINK",
                    raw_identity=(row.get("Phiếu khám") or "")[:80],
                )
            )
            continue
        staged.append(
            {
                "clinic_patient_id": cpid,
                "source_ref": source_ref,
                "drug_name": (row.get("Tên thuốc") or "").strip(),
                "drug_catalog_ref": (row.get("//Masterpage - Thuốc") or "").strip(),
                "quantity": (row.get("Số lượng") or "").strip(),
                "dosage_instructions": (row.get("Hướng dẫn dùng") or "").strip(),
                "note": (row.get("Lưu ý") or row.get("Ghi chú số lượng") or "").strip(),
                "quantity_note": (row.get("Ghi chú số lượng") or "").strip(),
                "standardized_form": (row.get("//chuẩn form") or "").strip(),
                "exam_raw": (row.get("Phiếu khám") or "").strip(),
                "no_target_table": "true",
                "fk_unresolved": "true",
                "source_created_time": (row.get("Created time") or "").strip(),
                "source_updated_time": (row.get("Last edited time") or "").strip(),
            }
        )
    return staged, rejects


def map_clinical_records(
    rows: Iterable[Mapping[str, str]], index: PatientIndex
) -> tuple[list[dict[str, str]], list[RejectItem]]:
    """Map clinical rows -> staged records.

    ``clinical_record`` has no ``clinic_patient_id`` — it links via ``visit_id``
    (NOT NULL). The resolved patient is carried here so the LOAD task can create
    the parent ``visit`` first; ``visit_unresolved=true`` marks that obligation.
    """
    staged: list[dict[str, str]] = []
    rejects: list[RejectItem] = []
    for row in rows:
        source_ref = (row.get("*ID") or "").strip()
        cpid = resolve_patient(
            row,
            link_fields=("Họ tên", "File hành chính", "//file phiếu khám"),
            source_ref=source_ref,
            source_table="clinical",
            index=index,
        )
        if cpid is None:
            rejects.append(
                RejectItem(
                    source_table="clinical",
                    source_ref=source_ref,
                    reason="NO_PATIENT_PHONE_IN_LINK",
                    raw_identity=(row.get("Họ tên") or "")[:80],
                )
            )
            continue
        staged.append(
            {
                "clinic_patient_id": cpid,
                "source_ref": source_ref,
                "chief_complaint": (row.get("Tóm tắt thông tin") or "").strip()[:2000],
                "service_type_raw": (row.get("Loại dịch vụ khám") or "").strip(),
                "expected_delivery_date": (row.get("Dự kiến sinh") or "").strip(),
                "gestational_age": (row.get("Tuổi thai") or "").strip(),
                "drive_link": (row.get("Link drive") or "").strip(),
                "visit_unresolved": "true",
                "fk_unresolved": "true",
                # Notion source timestamps preserved for sync. ``Created time``
                # on File BN lâm sàng = lúc lượt khám lần đầu vào Notion =
                # gần nhất với ngày khám thật.
                "source_created_time": (row.get("Created time") or "").strip(),
                "source_updated_time": (row.get("Last edited time") or "").strip(),
            }
        )
    return staged, rejects


# --------------------------------------------------------------------------- #
# Orchestration                                                               #
# --------------------------------------------------------------------------- #


def transform(sources: Mapping[str, list[dict[str, str]]]) -> TransformResult:
    """Run the full transform over already-loaded source rows (pure-ish core)."""
    index, admin_rejects = build_patient_index(sources["admin"])

    appointments, appt_rej = map_appointments(sources["appointment"], index)
    lab_results, lab_rej = map_lab_results(sources["lab"], index)
    prescriptions, rx_rej = map_prescriptions(sources["prescription"], index)
    clinical_records, clin_rej = map_clinical_records(sources["clinical"], index)

    patients = index.patients()
    rejects = admin_rejects + appt_rej + lab_rej + rx_rej + clin_rej

    green = sum(1 for p in patients if p.profile_status == "COMPLETE")
    yellow = len(patients) - green
    counters: dict[str, dict[str, int]] = {
        "patient": {
            "input_admin_rows": len(sources["admin"]),
            "total": len(patients),
            "green_complete": green,
            "yellow_skeleton": yellow,
            "admin_rejects": len(admin_rejects),
            "auto_merge": sum(1 for p in patients if p.merge_action == "AUTO_MERGE"),
            "review_conflict": sum(
                1 for p in patients if p.merge_action == "REVIEW_CONFLICT"
            ),
        },
        "appointment": {
            "input_rows": len(sources["appointment"]),
            "staged": len(appointments),
            "rejected": len(appt_rej),
        },
        "lab": {
            "input_rows": len(sources["lab"]),
            "staged": len(lab_results),
            "rejected": len(lab_rej),
        },
        "prescription": {
            "input_rows": len(sources["prescription"]),
            "staged": len(prescriptions),
            "rejected": len(rx_rej),
        },
        "clinical": {
            "input_rows": len(sources["clinical"]),
            "staged": len(clinical_records),
            "rejected": len(clin_rej),
        },
    }

    return TransformResult(
        patients=patients,
        appointments=appointments,
        lab_results=lab_results,
        prescriptions=prescriptions,
        clinical_records=clinical_records,
        review_queue=index.review_queue,
        rejects=rejects,
        counters=counters,
    )


# --------------------------------------------------------------------------- #
# I/O boundary                                                                #
# --------------------------------------------------------------------------- #


def resolve_source_files(input_dir: Path) -> dict[str, Path]:
    """Locate each table's ``_all.csv`` by folder keyword (robust to emoji/hash)."""
    resolved: dict[str, Path] = {}
    for table, keyword in TABLE_FOLDER_KEYWORD.items():
        folder = next(
            (
                d
                for d in sorted(input_dir.iterdir())
                if d.is_dir()
                and keyword in unicodedata.normalize("NFC", d.name).lower()
            ),
            None,
        )
        if folder is None:
            raise FileNotFoundError(f"No folder matching {keyword!r} in {input_dir}")
        all_csvs = sorted(folder.glob("*_all.csv"))
        if not all_csvs:
            raise FileNotFoundError(f"No *_all.csv in {folder}")
        resolved[table] = all_csvs[0]
    return resolved


def read_csv_records(path: Path) -> list[dict[str, str]]:
    """Read a Notion CSV into logical records, tolerating newlines in cells."""
    with path.open(encoding=CSV_ENCODING, newline="") as handle:
        reader = csv.DictReader(handle)
        return [{k: (v or "") for k, v in row.items()} for row in reader]


def write_csv(
    path: Path,
    fieldnames: Sequence[str],
    rows: Iterable[Mapping[str, str]],
) -> None:
    """Write staged rows to ``path`` with a fixed header order."""
    with path.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(
            handle, fieldnames=list(fieldnames), extrasaction="ignore"
        )
        writer.writeheader()
        for row in rows:
            writer.writerow(row)


PATIENT_FIELDS: tuple[str, ...] = (
    "clinic_patient_id",
    "patient_code",
    "national_id_number",
    "full_name",
    "date_of_birth",
    "phone_primary",
    "phone_secondary",
    "location_id",
    "is_active",
    "profile_status",
    "gender_staging",
    "address_staging",
    "merge_action",
    "source_tables",
    "source_ref",
)


def _patient_to_row(patient: Patient) -> dict[str, str]:
    return {
        "clinic_patient_id": patient.clinic_patient_id,
        "patient_code": "",  # DB generates on LOAD (BN-YYYY-XXXXXX)
        "national_id_number": "",  # CCCD not collected yet
        "full_name": patient.full_name,
        "date_of_birth": patient.date_of_birth or "",
        "phone_primary": patient.phone_primary,
        "phone_secondary": "",
        "location_id": "",  # NOT NULL in schema, no source — LOAD must supply
        "is_active": "true",
        "profile_status": patient.profile_status,
        "gender_staging": patient.gender or "",
        "address_staging": patient.address or "",
        "merge_action": patient.merge_action,
        "source_tables": ";".join(sorted(patient.source_tables)),
        "source_ref": ";".join(patient.source_refs),
    }


def write_outputs(result: TransformResult, output_dir: Path) -> None:
    """Persist all eight artifacts into ``output_dir``."""
    output_dir.mkdir(parents=True, exist_ok=True)

    write_csv(
        output_dir / "patient_staged.csv",
        PATIENT_FIELDS,
        (_patient_to_row(p) for p in result.patients),
    )
    write_csv(
        output_dir / "appointment_staged.csv",
        (
            "clinic_patient_id",
            "source_ref",
            "slot_start",
            "slot_end",
            "status_raw",
            "doctor_raw",
            "location_raw",
            "service_type_raw",
            "booking_channel_raw",
            "note",
            "fk_unresolved",
        ),
        result.appointments,
    )
    write_csv(
        output_dir / "lab_result_staged.csv",
        (
            "clinic_patient_id",
            "source_ref",
            "test_code",
            "test_name",
            "panel_code",
            "result_value",
            "result_unit",
            "triage_group",
            "lab_provider",
            "external_ref",
            "appointment_raw",
            "fk_unresolved",
        ),
        result.lab_results,
    )
    write_csv(
        output_dir / "prescription_staged.csv",
        (
            "clinic_patient_id",
            "source_ref",
            "drug_name",
            "quantity",
            "dosage_instructions",
            "note",
            "exam_raw",
            "no_target_table",
            "fk_unresolved",
        ),
        result.prescriptions,
    )
    write_csv(
        output_dir / "clinical_record_staged.csv",
        (
            "clinic_patient_id",
            "source_ref",
            "chief_complaint",
            "service_type_raw",
            "expected_delivery_date",
            "gestational_age",
            "drive_link",
            "visit_unresolved",
            "fk_unresolved",
        ),
        result.clinical_records,
    )
    write_csv(
        output_dir / "review_queue.csv",
        (
            "reason",
            "phone",
            "clinic_patient_id",
            "name_existing",
            "name_incoming",
            "source_ref_existing",
            "source_ref_incoming",
        ),
        (
            {
                "reason": item.reason,
                "phone": item.phone,
                "clinic_patient_id": item.clinic_patient_id,
                "name_existing": item.name_existing,
                "name_incoming": item.name_incoming,
                "source_ref_existing": item.source_ref_existing,
                "source_ref_incoming": item.source_ref_incoming,
            }
            for item in result.review_queue
        ),
    )
    write_csv(
        output_dir / "rejects.csv",
        ("source_table", "source_ref", "reason", "raw_identity"),
        (
            {
                "source_table": item.source_table,
                "source_ref": item.source_ref,
                "reason": item.reason,
                "raw_identity": item.raw_identity,
            }
            for item in result.rejects
        ),
    )
    (output_dir / "TRANSFORM_REPORT.md").write_text(
        render_report(result), encoding="utf-8"
    )


_STATIC_REPORT_SECTIONS = """
## NOT NULL columns with NO data source (LOAD must supply)
- `patient.location_id` (FK clinic_location) — needs single-clinic default.
- `patient.patient_code` — DB-generated on LOAD (advisory lock).
- `appointment.location_id`, `appointment.service_type_id` — FK; raw TEXT kept.
- `appointment.slot_start` — parsed where present; blanks need review.
- `appointment.slot_end` — NO source; LOAD derives from slot_start + duration.
- `lab_result.test_code` / `test_name` — fall back to source ID / 'UNKNOWN'.

## Schema gaps (decided with planning)
- **prescription**: NO target table in schema v6. `prescription_staged.csv` is
  PARKED (`no_target_table=true`); LOAD blocked until a table exists.
- **clinical_record**: NO `clinic_patient_id`; links via `visit_id`
  (NOT NULL UNIQUE). LOAD must create parent `visit` first
  (`visit_unresolved=true`).
- **lab_result**: classification column is `triage_group` (default `PENDING`),
  NOT `result_classification`. Triage left to the Lab Triage graph.
- **patient.gender / address**: no column in schema — carried only as
  `gender_staging` / `address_staging`.

## Master FK resolution (out of scope NHỊP 1)
- doctor / service_type / location / booking_channel kept as raw TEXT with
  `fk_unresolved=true`. Resolve in a later task.

## Method notes
- Source read via `csv.DictReader` (utf-8-sig); newlines-in-cells tolerated.
- Patient identity from `//sdt (neat)` + `//họ tên (neat)` ONLY (no all-field
  phone scan).
- Child rows resolved via the first VN phone in the primary link field only.
- No DB connection opened; no SQL emitted.
"""


def render_report(result: TransformResult) -> str:
    """Render the human-facing transform report (PII-free: counts only)."""
    c = result.counters
    lines: list[str] = []
    lines.append("# TRANSFORM_REPORT — T-TRANSFORM-01 (NHỊP 1, no DB write)\n")
    lines.append("## Patient")
    lines.append(f"- Admin input rows: {c['patient']['input_admin_rows']}")
    lines.append(f"- Total patients: {c['patient']['total']}")
    green_n = c["patient"]["green_complete"]
    yellow_n = c["patient"]["yellow_skeleton"]
    lines.append(f"  - 🟢 COMPLETE (DOB+gender): {green_n}")
    lines.append(f"  - 🟡 SKELETON (name+phone only): {yellow_n}")
    lines.append(f"- AUTO_MERGE (same phone+name): {c['patient']['auto_merge']}")
    lines.append(
        f"- REVIEW_CONFLICT (same phone, diff name): {c['patient']['review_conflict']}"
    )
    lines.append(f"- Admin rows rejected (no phone): {c['patient']['admin_rejects']}\n")

    lines.append("## Child tables (input → staged / rejected)")
    for tbl in ("appointment", "lab", "prescription", "clinical"):
        lines.append(
            f"- {tbl}: {c[tbl]['input_rows']} → staged {c[tbl]['staged']}, "
            f"rejected {c[tbl]['rejected']}"
        )
    lines.append(f"\n- review_queue rows: {len(result.review_queue)}")
    lines.append(f"- rejects rows total: {len(result.rejects)}\n")

    lines.append(_STATIC_REPORT_SECTIONS)
    return "\n".join(lines) + "\n"


def run(input_dir: Path, output_dir: Path) -> TransformResult:
    """Top-level pipeline: locate, read, transform, write."""
    files = resolve_source_files(input_dir)
    for table, path in files.items():
        logger.info("resolved %s -> %s", table, path.name)
    sources = {table: read_csv_records(path) for table, path in files.items()}
    result = transform(sources)
    write_outputs(result, output_dir)
    return result


def parse_args(argv: Sequence[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--input-dir",
        required=True,
        type=Path,
        help="Directory holding the Notion export subfolders (READ-ONLY).",
    )
    parser.add_argument(
        "--output-dir",
        required=True,
        type=Path,
        help="Directory for staged outputs (gitignored).",
    )
    return parser.parse_args(argv)


def main(argv: Sequence[str] | None = None) -> int:
    logging.basicConfig(
        level=logging.INFO, format="%(levelname)s %(name)s: %(message)s"
    )
    args = parse_args(argv)
    if not args.input_dir.is_dir():
        logger.error("input dir not found: %s", args.input_dir)
        return 2
    result = run(args.input_dir, args.output_dir)
    counts = result.counters
    logger.info(
        "done: patients=%d (green=%d yellow=%d) appt=%d lab=%d rx=%d clin=%d",
        counts["patient"]["total"],
        counts["patient"]["green_complete"],
        counts["patient"]["yellow_skeleton"],
        counts["appointment"]["staged"],
        counts["lab"]["staged"],
        counts["prescription"]["staged"],
        counts["clinical"]["staged"],
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
