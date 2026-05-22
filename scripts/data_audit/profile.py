"""Read-only profiling of raw patient-data exports (P-IMPORT-0).

Scans a user-provided directory tree for CSV / XLSX / JSON files and produces
``data_audit/PROFILE_REPORT.md`` containing per-file statistics plus a global
duplicate / quality summary.

PRIVACY GUARANTEES
- The script NEVER writes patient data into the repo (only into the gitignored
  ``data_audit/`` directory).
- Sample values for columns that look like phone numbers, ID cards (CCCD), or
  national IDs are MASKED — only the last 4 characters are shown.
- The script makes no DB calls and never mutates source files.

USAGE
    poetry run python scripts/data_audit/profile.py \
        --data-dir "/absolute/path/to/raw/data" \
        [--report data_audit/PROFILE_REPORT.md]
"""

from __future__ import annotations

import argparse
import dataclasses
import json
import logging
import re
import sys
from collections import Counter
from pathlib import Path

import pandas as pd

logger = logging.getLogger("data_audit.profile")

# ---- masking & detection -----------------------------------------------------

VN_PHONE_RE = re.compile(r"^(?:\+?84|0)(?:3|5|7|8|9)\d{8}$")
"""Vietnamese mobile number, normalised by stripping spaces/dots before match."""

CCCD_RE = re.compile(r"^\d{12}$")
"""Citizen ID (CCCD) — exactly 12 digits."""

DOB_HINTS = ("ngay sinh", "ngày sinh", "dob", "birthday", "birth_date", "date_of_birth")
NAME_HINTS = ("ho ten", "họ tên", "ho_ten", "full_name", "name", "tên", "ten")
PHONE_HINTS = (
    "sdt",
    "sđt",
    "phone",
    "mobile",
    "so dien thoai",
    "số điện thoại",
    "đt",
    "dt",
)
CCCD_HINTS = ("cccd", "cmnd", "cmt", "citizen", "id card", "id_card", "national_id")

SAMPLE_COUNT = 3
MAX_UNIQUE_BEFORE_BUCKETING = 50_000


def _normalise_phone(raw: str) -> str:
    """Strip non-digits then collapse +84/0 prefix to +84."""
    digits = re.sub(r"[^\d+]", "", raw)
    if digits.startswith("+84"):
        return "+84" + digits[3:]
    if digits.startswith("84") and len(digits) > 10:
        return "+84" + digits[2:]
    if digits.startswith("0"):
        return "+84" + digits[1:]
    return digits


def _mask(value: str) -> str:
    """Mask sensitive value, keeping only last 4 characters."""
    s = str(value)
    if len(s) <= 4:
        return "*" * len(s)
    return "*" * (len(s) - 4) + s[-4:]


def _col_matches(col_name: str, hints: tuple[str, ...]) -> bool:
    lc = col_name.lower().strip()
    return any(h in lc for h in hints)


# ---- data classes ------------------------------------------------------------


@dataclasses.dataclass(frozen=True)
class ColumnProfile:
    name: str
    dtype: str
    null_pct: float
    unique_count: int
    samples: tuple[str, ...]
    is_phone_candidate: bool
    is_cccd_candidate: bool
    is_name_candidate: bool
    is_dob_candidate: bool
    phone_valid_pct: float | None
    cccd_present_pct: float | None
    cccd_valid_pct: float | None


@dataclasses.dataclass(frozen=True)
class FileProfile:
    path: Path
    size_bytes: int
    row_count: int
    col_count: int
    full_duplicate_rows: int
    columns: tuple[ColumnProfile, ...]
    load_error: str | None = None


@dataclasses.dataclass(frozen=True)
class GlobalDupSummary:
    phone_groups: int
    phone_rows_in_groups: int
    name_dob_groups: int
    name_dob_rows_in_groups: int


# ---- file discovery ----------------------------------------------------------


def discover_files(root: Path) -> list[Path]:
    patterns = (
        "*.csv",
        "*.CSV",
        "*.xlsx",
        "*.XLSX",
        "*.xls",
        "*.XLS",
        "*.json",
        "*.JSON",
    )
    found: list[Path] = []
    for pat in patterns:
        found.extend(root.rglob(pat))
    # Stable order, ignore hidden / __MACOSX
    return sorted(
        f
        for f in found
        if not any(part.startswith(".") or part == "__MACOSX" for part in f.parts)
    )


# ---- loading -----------------------------------------------------------------


def load_dataframe(path: Path) -> pd.DataFrame:
    suffix = path.suffix.lower()
    if suffix == ".csv":
        return pd.read_csv(path, dtype=str, keep_default_na=True, low_memory=False)
    if suffix in {".xlsx", ".xls"}:
        return pd.read_excel(path, dtype=str)
    if suffix == ".json":
        # Notion JSON exports are usually a top-level list of records.
        with path.open("r", encoding="utf-8") as fh:
            data = json.load(fh)
        if isinstance(data, list):
            return pd.DataFrame(data).astype(str)
        if isinstance(data, dict) and "results" in data:
            return pd.DataFrame(data["results"]).astype(str)
        return pd.DataFrame([data]).astype(str)
    raise ValueError(f"unsupported file type: {path.suffix}")


# ---- column profiling --------------------------------------------------------


def _phone_validity_pct(series: pd.Series) -> float:
    non_null = series.dropna().astype(str)
    non_null = non_null[non_null.str.strip() != ""]
    if non_null.empty:
        return 0.0
    valid = non_null.apply(lambda v: bool(VN_PHONE_RE.match(_normalise_phone(v))))
    return float(valid.mean() * 100)


def _cccd_present_and_valid(series: pd.Series) -> tuple[float, float]:
    total = len(series)
    if total == 0:
        return 0.0, 0.0
    non_null = series.dropna().astype(str)
    non_null = non_null[non_null.str.strip() != ""]
    present_pct = float(len(non_null) / total * 100)
    if non_null.empty:
        return present_pct, 0.0
    digits_only = non_null.str.replace(r"\D", "", regex=True)
    valid = digits_only.apply(lambda v: bool(CCCD_RE.match(v)))
    valid_pct = float(valid.mean() * 100)
    return present_pct, valid_pct


def profile_column(name: str, series: pd.Series) -> ColumnProfile:
    total = len(series)
    null_mask = series.isna() | (series.astype(str).str.strip() == "")
    null_pct = float(null_mask.mean() * 100) if total else 0.0

    non_null = series[~null_mask].astype(str)
    unique_count = (
        int(non_null.nunique()) if len(non_null) < MAX_UNIQUE_BEFORE_BUCKETING else -1
    )

    is_phone = _col_matches(name, PHONE_HINTS)
    is_cccd = _col_matches(name, CCCD_HINTS)
    is_name = _col_matches(name, NAME_HINTS)
    is_dob = _col_matches(name, DOB_HINTS)

    # Pick samples — mask if column is sensitive
    samples_raw = non_null.head(SAMPLE_COUNT).tolist()
    if is_phone or is_cccd:
        samples = tuple(_mask(s) for s in samples_raw)
    else:
        samples = tuple(s[:60] + ("…" if len(s) > 60 else "") for s in samples_raw)

    phone_valid_pct = _phone_validity_pct(series) if is_phone else None
    cccd_present_pct: float | None
    cccd_valid_pct: float | None
    if is_cccd:
        cccd_present_pct, cccd_valid_pct = _cccd_present_and_valid(series)
    else:
        cccd_present_pct = cccd_valid_pct = None

    return ColumnProfile(
        name=name,
        dtype=str(series.dtype),
        null_pct=null_pct,
        unique_count=unique_count,
        samples=samples,
        is_phone_candidate=is_phone,
        is_cccd_candidate=is_cccd,
        is_name_candidate=is_name,
        is_dob_candidate=is_dob,
        phone_valid_pct=phone_valid_pct,
        cccd_present_pct=cccd_present_pct,
        cccd_valid_pct=cccd_valid_pct,
    )


# ---- file profiling ----------------------------------------------------------


def profile_file(path: Path) -> FileProfile:
    size = path.stat().st_size
    try:
        df = load_dataframe(path)
    except Exception as exc:  # noqa: BLE001 — surface any parse failure in report
        return FileProfile(
            path=path,
            size_bytes=size,
            row_count=0,
            col_count=0,
            full_duplicate_rows=0,
            columns=(),
            load_error=f"{type(exc).__name__}: {exc}",
        )

    full_dups = int(df.duplicated().sum())
    cols = tuple(profile_column(c, df[c]) for c in df.columns)
    return FileProfile(
        path=path,
        size_bytes=size,
        row_count=int(len(df)),
        col_count=int(df.shape[1]),
        full_duplicate_rows=full_dups,
        columns=cols,
    )


# ---- cross-file duplicate detection -----------------------------------------


def cross_file_duplicates(profiles: list[FileProfile], root: Path) -> GlobalDupSummary:
    """Estimate cross-file duplicates by phone and (name+dob).

    Streams each file again rather than caching — keeps memory bounded.
    """
    phone_counter: Counter[str] = Counter()
    name_dob_counter: Counter[tuple[str, str]] = Counter()

    for fp in profiles:
        if fp.load_error or fp.row_count == 0:
            continue
        try:
            df = load_dataframe(fp.path)
        except Exception:  # noqa: BLE001
            continue

        phone_cols = [c.name for c in fp.columns if c.is_phone_candidate]
        name_cols = [c.name for c in fp.columns if c.is_name_candidate]
        dob_cols = [c.name for c in fp.columns if c.is_dob_candidate]

        if phone_cols:
            for col in phone_cols:
                series = df[col].dropna().astype(str)
                for raw in series:
                    norm = _normalise_phone(raw)
                    if VN_PHONE_RE.match(norm):
                        phone_counter[norm] += 1

        if name_cols and dob_cols:
            ncol, dcol = name_cols[0], dob_cols[0]
            for name, dob in zip(
                df[ncol].fillna("").astype(str), df[dcol].fillna("").astype(str)
            ):
                key_name = name.strip().lower()
                key_dob = dob.strip()
                if key_name and key_dob:
                    name_dob_counter[(key_name, key_dob)] += 1

    phone_groups = sum(1 for v in phone_counter.values() if v > 1)
    phone_rows = sum(v for v in phone_counter.values() if v > 1)
    nd_groups = sum(1 for v in name_dob_counter.values() if v > 1)
    nd_rows = sum(v for v in name_dob_counter.values() if v > 1)
    return GlobalDupSummary(
        phone_groups=phone_groups,
        phone_rows_in_groups=phone_rows,
        name_dob_groups=nd_groups,
        name_dob_rows_in_groups=nd_rows,
    )


# ---- report rendering --------------------------------------------------------


def _fmt_size(b: int) -> str:
    for unit in ("B", "KB", "MB", "GB"):
        if b < 1024:
            return f"{b:.1f}{unit}"
        b //= 1024
    return f"{b}TB"


def render_report(
    profiles: list[FileProfile],
    dup: GlobalDupSummary,
    root: Path,
) -> str:
    lines: list[str] = []
    lines.append("# Patient-Data Profile Report (P-IMPORT-0)")
    lines.append("")
    lines.append("> READ-ONLY audit — no DB inserts, no normalisation.")
    lines.append(f"> Source root: `{root}`")
    lines.append(f"> Files scanned: {len(profiles)}")
    lines.append("")

    total_rows = sum(p.row_count for p in profiles)
    total_dups = sum(p.full_duplicate_rows for p in profiles)
    lines.append("## Global summary")
    lines.append("")
    lines.append(f"- **Total rows (raw):** {total_rows}")
    lines.append(f"- **Full-duplicate rows (within file):** {total_dups}")
    lines.append(
        f"- **Cross-file duplicate phones:** {dup.phone_groups} group(s), "
        f"{dup.phone_rows_in_groups} row(s) involved"
    )
    lines.append(
        f"- **Cross-file duplicate (name + DOB):** {dup.name_dob_groups} group(s), "
        f"{dup.name_dob_rows_in_groups} row(s) involved"
    )
    lines.append("")

    # Per-file sections
    for fp in profiles:
        rel = fp.path.relative_to(root) if root in fp.path.parents else fp.path
        lines.append(f"## File: `{rel}`")
        lines.append("")
        lines.append(f"- Size: {_fmt_size(fp.size_bytes)}")
        lines.append(f"- Rows: {fp.row_count}  ·  Columns: {fp.col_count}")
        lines.append(f"- Full-duplicate rows: {fp.full_duplicate_rows}")
        if fp.load_error:
            lines.append(f"- **Load error:** {fp.load_error}")
            lines.append("")
            continue
        lines.append("")
        lines.append("| Column | Dtype | Null % | Unique | Sample(s) | Hints |")
        lines.append("|---|---|---:|---:|---|---|")
        for col in fp.columns:
            hints = []
            if col.is_phone_candidate:
                hints.append("phone")
            if col.is_cccd_candidate:
                hints.append("cccd")
            if col.is_name_candidate:
                hints.append("name")
            if col.is_dob_candidate:
                hints.append("dob")
            samples = " · ".join(col.samples) if col.samples else "—"
            samples = samples.replace("|", "\\|")
            uniq = "?" if col.unique_count < 0 else str(col.unique_count)
            lines.append(
                f"| `{col.name}` | {col.dtype} | {col.null_pct:.1f} | {uniq} | "
                f"{samples} | {', '.join(hints) or '—'} |"
            )

        # Phone / CCCD specific stats
        phone_cols = [c for c in fp.columns if c.is_phone_candidate]
        cccd_cols = [c for c in fp.columns if c.is_cccd_candidate]
        if phone_cols or cccd_cols:
            lines.append("")
            for c in phone_cols:
                pv = c.phone_valid_pct or 0.0
                lines.append(f"- Phone `{c.name}`: **{pv:.1f}%** VN format")
            for c in cccd_cols:
                pp = c.cccd_present_pct or 0.0
                vp = c.cccd_valid_pct or 0.0
                lines.append(
                    f"- CCCD `{c.name}`: **{pp:.1f}%** present, **{vp:.1f}%** valid"
                )
        lines.append("")

    # Warnings
    lines.append("## Cảnh báo (data quality issues)")
    lines.append("")
    warnings = collect_warnings(profiles, dup)
    if not warnings:
        lines.append("- _No major issues detected by automated checks._")
    else:
        for w in warnings:
            lines.append(f"- {w}")
    lines.append("")

    return "\n".join(lines) + "\n"


def collect_warnings(profiles: list[FileProfile], dup: GlobalDupSummary) -> list[str]:
    warnings: list[str] = []

    # Files with load errors
    for fp in profiles:
        if fp.load_error:
            warnings.append(f"❌ `{fp.path.name}` không đọc được: {fp.load_error}")

    # Files missing phone column entirely
    for fp in profiles:
        if fp.row_count == 0:
            continue
        if not any(c.is_phone_candidate for c in fp.columns):
            warnings.append(f"⚠️ `{fp.path.name}` KHÔNG có cột nào trông giống SĐT.")

    # Phone columns with high invalid rate
    for fp in profiles:
        for c in fp.columns:
            if c.is_phone_candidate and c.phone_valid_pct is not None:
                if c.phone_valid_pct < 70:
                    pct = c.phone_valid_pct
                    warnings.append(
                        f"WARN `{fp.path.name}` SĐT `{c.name}`: "
                        f"chỉ {pct:.1f}% đúng format VN."
                    )

    # CCCD almost always missing
    for fp in profiles:
        for c in fp.columns:
            if c.is_cccd_candidate and c.cccd_present_pct is not None:
                if c.cccd_present_pct < 30:
                    warnings.append(
                        f"⚠️ `{fp.path.name}` cột CCCD `{c.name}` chỉ "
                        f"{c.cccd_present_pct:.1f}% có giá trị."
                    )

    # Header drift — same logical column named differently across files
    header_groups: dict[str, set[str]] = {
        "phone": set(),
        "name": set(),
        "dob": set(),
        "cccd": set(),
    }
    for fp in profiles:
        for c in fp.columns:
            if c.is_phone_candidate:
                header_groups["phone"].add(c.name)
            if c.is_name_candidate:
                header_groups["name"].add(c.name)
            if c.is_dob_candidate:
                header_groups["dob"].add(c.name)
            if c.is_cccd_candidate:
                header_groups["cccd"].add(c.name)
    for kind, names in header_groups.items():
        if len(names) > 1:
            warnings.append(
                f"WARN Header drift `{kind}`: nhiều tên cột — {sorted(names)}"
            )

    # Cross-file duplicate alarms
    if dup.phone_groups > 0:
        warnings.append(
            f"WARN {dup.phone_groups} SĐT trùng nhiều lần "
            f"({dup.phone_rows_in_groups} dòng) — cần MPI dedup."
        )
    if dup.name_dob_groups > 0:
        warnings.append(
            f"⚠️ {dup.name_dob_groups} cặp (name+DOB) xuất hiện nhiều lần "
            f"({dup.name_dob_rows_in_groups} dòng)."
        )

    return warnings


def render_console_summary(
    profiles: list[FileProfile],
    dup: GlobalDupSummary,
) -> str:
    total_rows = sum(p.row_count for p in profiles)
    total_dups = sum(p.full_duplicate_rows for p in profiles)
    failures = [p for p in profiles if p.load_error]
    n_phone = sum(1 for p in profiles if any(c.is_phone_candidate for c in p.columns))
    n_cccd = sum(1 for p in profiles if any(c.is_cccd_candidate for c in p.columns))
    total = len(profiles)
    lines = [
        "=== DATA PROFILE SUMMARY ===",
        f"Files scanned: {total}",
        f"Load failures: {len(failures)}",
        f"Total rows:    {total_rows}",
        f"Full dups:     {total_dups}",
        f"Dup phones:   {dup.phone_groups} grp / {dup.phone_rows_in_groups} rows",
        f"Dup name+DOB: {dup.name_dob_groups} grp / {dup.name_dob_rows_in_groups} rows",
        f"Files w/ phone col: {n_phone} / {total}",
        f"Files w/ CCCD col:  {n_cccd} / {total}",
        "============================",
    ]
    return "\n".join(lines)


# ---- main --------------------------------------------------------------------


def main(argv: list[str] | None = None) -> int:
    logging.basicConfig(level=logging.INFO, format="%(message)s")
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--data-dir",
        required=True,
        type=Path,
        help="Absolute path to the directory containing raw exports.",
    )
    parser.add_argument(
        "--report",
        type=Path,
        default=Path("data_audit/PROFILE_REPORT.md"),
        help="Destination markdown report (default: data_audit/PROFILE_REPORT.md).",
    )
    args = parser.parse_args(argv)

    root: Path = args.data_dir.expanduser().resolve()
    if not root.is_dir():
        logger.error("data-dir not found: %s", root)
        return 2

    files = discover_files(root)
    if not files:
        logger.error("no CSV/XLSX/JSON files found under %s", root)
        return 2

    logger.info("scanning %d file(s) under %s", len(files), root)
    profiles = [profile_file(p) for p in files]
    dup = cross_file_duplicates(profiles, root)

    report = render_report(profiles, dup, root)
    args.report.parent.mkdir(parents=True, exist_ok=True)
    args.report.write_text(report, encoding="utf-8")
    logger.info("wrote %s (%d bytes)", args.report, len(report.encode("utf-8")))

    print(render_console_summary(profiles, dup))
    return 0


if __name__ == "__main__":
    sys.exit(main())
