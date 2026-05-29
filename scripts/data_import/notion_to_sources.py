"""Pull the 5 source databases from the cloned PK Notion workspace.

PACKET-3 (NOTION-SYNC-01) — Notion API adapter for ``transform.py``.
Produces the ``Mapping[str, list[dict[str, str]]]`` shape expected by
``scripts.data_migration.transform.transform``:

    {
      "admin":        list[row]  # 🔑 File khách hàng (hành chính)
      "clinical":     list[row]  # 🔑 File bệnh nhân (lâm sàng)
      "appointment":  list[row]  # LỊCH HẸN
      "lab":          list[row]  # Xét nghiệm
      "prescription": list[row]  # Kê thuốc
    }

Each ``row`` is ``dict[str, str]`` whose keys are the **Notion property
names verbatim** (`'//sdt (neat)'`, `'Ngày giờ hẹn'`, `'Bác sĩ'`, …) and
whose values are property-type-aware string conversions. Keep the keys
literal so ``transform.py`` (which reads by exact column name) stays the
single source of truth for the mapping rules — the adapter just delivers
strings.

SAFETY
- ABSOLUTELY READ-ONLY. Calls only ``data_sources.query``. Never mutates.
- Returns plain dicts; no PII redaction here — the *consumer*
  (``transform.py`` + ``sync_to_supabase.py``) decides where the data
  lands. **Do not log row values from this module.**
"""

from __future__ import annotations

import asyncio
import logging
import os
from datetime import datetime
from typing import Any

from dotenv import load_dotenv
from notion_client import AsyncClient
from notion_client.errors import (
    HTTPResponseError,
    RequestTimeoutError,
)

logger = logging.getLogger("data_import.notion_to_sources")

# Notion data_source IDs — pulled from context/notion_schema_report.md.
# These point at the cloned workspace (LINK_NOTION_PAGE_ID).
DATA_SOURCES: dict[str, str] = {
    "admin": "f6bccb0e-ac88-8333-8d20-07cc963a6889",  # File khách hàng
    "clinical": "ad3ccb0e-ac88-83f8-ac49-0746cf7c7e7c",  # File BN lâm sàng
    "appointment": "d1eccb0e-ac88-820e-bae1-87f9270ea036",  # LỊCH HẸN
    "lab": "fe7ccb0e-ac88-83eb-8e9e-073c802bcd03",  # Xét nghiệm
    "prescription": "75accb0e-ac88-82b0-abed-879adedf8e78",  # Kê thuốc
}

QUERY_PAGE_SIZE = 100  # Notion's max per page


# --------------------------------------------------------------------------- #
# Property converter — Notion typed value → string                            #
# --------------------------------------------------------------------------- #


def _join_rich_text(blocks: list[dict[str, Any]] | None) -> str:
    if not blocks:
        return ""
    return "".join(b.get("plain_text", "") for b in blocks)


def prop_to_str(prop: dict[str, Any]) -> str:
    """Reduce one Notion property value to a plain string.

    Handles every property type ``transform.py`` reads off the live
    clone. Unknown types collapse to ``""`` rather than failing — the
    adapter prefers a quiet "empty" over a noisy crash mid-sync.
    """
    ptype = prop.get("type")
    raw = prop.get(ptype) if ptype else None
    if raw is None:
        return ""

    if ptype == "title" or ptype == "rich_text":
        return _join_rich_text(raw)
    if ptype == "number":
        return "" if raw is None else str(raw)
    if ptype == "string":
        # Notion's formula sub-types ("string"/"number"/"boolean"/"date")
        # show up here when prop_to_str recurses on a formula payload.
        return raw if isinstance(raw, str) else ""
    if ptype == "boolean":
        return "true" if raw else "false"
    if ptype == "select":
        return raw.get("name", "") if isinstance(raw, dict) else ""
    if ptype == "multi_select":
        return ", ".join(o.get("name", "") for o in raw)
    if ptype == "status":
        return raw.get("name", "") if isinstance(raw, dict) else ""
    if ptype == "date":
        start = raw.get("start") if isinstance(raw, dict) else None
        if not start:
            return ""
        # transform.py's parsers (norm_dob / parse_datetime_vn) were written
        # for the CSV export shape — "dd/mm/yyyy" or
        # "dd/mm/yyyy HH:MM (GMT+7)". Notion's API hands back ISO-8601
        # instead; convert so the canon transform does not have to learn
        # a second date dialect.
        try:
            # ``fromisoformat`` accepts both date-only ("1986-06-26") and
            # full timestamps with offset ("2026-05-28T18:00:00+07:00").
            dt = datetime.fromisoformat(start)
        except ValueError:
            return start  # let the downstream regex try its luck
        has_time = dt.hour or dt.minute or dt.second
        if has_time:
            return (
                f"{dt.day:02d}/{dt.month:02d}/{dt.year:04d} "
                f"{dt.hour:02d}:{dt.minute:02d} (GMT+7)"
            )
        return f"{dt.day:02d}/{dt.month:02d}/{dt.year:04d}"
    if ptype == "url":
        return raw if isinstance(raw, str) else ""
    if ptype == "email":
        return raw if isinstance(raw, str) else ""
    if ptype == "phone_number":
        return raw if isinstance(raw, str) else ""
    if ptype == "checkbox":
        return "true" if raw else "false"
    if ptype == "formula":
        # Notion formula is typed; unwrap and re-dispatch so callers see
        # the underlying string/number/date instead of "<formula>".
        inner = raw.get("type") if isinstance(raw, dict) else None
        if inner is None:
            return ""
        return prop_to_str({"type": inner, inner: raw.get(inner)})
    if ptype == "relation":
        # Surface a comma-joined list of related page IDs so dirty-text
        # fallbacks in transform.py (e.g. ``extract_phone``) get nothing
        # useful but a *fingerprint* survives in the staged row, which
        # helps post-load auditing.
        if isinstance(raw, list):
            return ", ".join(r.get("id", "") for r in raw)
        return ""
    if ptype == "rollup":
        # Rollups are pre-aggregated; recurse on the inner typed value.
        inner = raw.get("type") if isinstance(raw, dict) else None
        if inner is None:
            return ""
        return prop_to_str({"type": inner, inner: raw.get(inner)})
    if ptype == "created_time":
        return raw if isinstance(raw, str) else ""
    if ptype == "last_edited_time":
        return raw if isinstance(raw, str) else ""
    if ptype == "unique_id":
        if not isinstance(raw, dict):
            return ""
        prefix = raw.get("prefix") or ""
        number = raw.get("number")
        return f"{prefix}{number}" if number is not None else ""
    if ptype == "place":
        # Notion Address blocks. Live PK data has Bắc Ninh / Hà Nội values.
        if not isinstance(raw, dict):
            return ""
        addr = raw.get("address")
        if isinstance(addr, str) and addr:
            return addr
        name = raw.get("name")
        return name if isinstance(name, str) else ""
    if ptype == "verification":
        if not isinstance(raw, dict):
            return ""
        state = raw.get("state")
        return state if isinstance(state, str) else ""
    if ptype in ("people", "files", "created_by", "last_edited_by", "button"):
        return ""
    if ptype == "array":
        # Rollup/formula sub-type — Notion wraps the inner typed items
        # in an array. Recurse on each and comma-join the non-empty
        # string projections.
        if not isinstance(raw, list):
            return ""
        parts = [prop_to_str(item) for item in raw if isinstance(item, dict)]
        return ", ".join(p for p in parts if p)

    # Unknown type — first time only, so a runaway Notion schema change
    # cannot drown the log (we used to emit one entry per row). Format
    # the ptype into the message string so it actually shows up under
    # the default logging.basicConfig.
    if ptype not in _UNKNOWN_SEEN:
        _UNKNOWN_SEEN.add(ptype or "")
        logger.warning("unknown_property_type_first_seen ptype=%s", ptype)
    return ""


_UNKNOWN_SEEN: set[str] = set()


def page_to_row(page: dict[str, Any]) -> dict[str, str]:
    """Project one Notion page object into a flat ``{prop_name: str}`` dict.

    Adds two synthetic columns that transform.py / sync_to_supabase do
    not read but that are useful for downstream debugging:

    * ``_notion_page_id``    — the Notion UUID of the row (stable join key)
    * ``_notion_last_edited`` — ISO timestamp, for incremental sync windows
    """
    props = page.get("properties") or {}
    row: dict[str, str] = {}
    for name, prop in props.items():
        row[name] = prop_to_str(prop)
    row["_notion_page_id"] = page.get("id", "")
    row["_notion_last_edited"] = page.get("last_edited_time", "")
    return row


# --------------------------------------------------------------------------- #
# Notion pulls                                                                #
# --------------------------------------------------------------------------- #


async def _query_page_with_backoff(
    notion: AsyncClient, **kwargs: Any
) -> dict[str, Any]:
    """Single ``data_sources.query`` call with exponential backoff.

    Notion's hosted query backend occasionally returns
    ``Public API data source query is temporarily unavailable due to
    backend datastore timeouts.`` notion-client v3 has its own retry but
    those are exhausted on long pulls. Add an outer 5-step backoff
    capped at ~60 s so a flaky window does not torpedo a 15-minute sync.
    """
    delay = 2.0
    last_exc: Exception | None = None
    for attempt in range(8):
        try:
            return await notion.data_sources.query(**kwargs)
        except (HTTPResponseError, RequestTimeoutError) as exc:
            # HTTPResponseError covers BOTH APIResponseError (4xx with a
            # structured Notion body) and UnknownHTTPResponseError (the
            # 502/503/504 gateway errors that arrive without a body and
            # are NOT subclasses of APIResponseError). Earlier code only
            # caught APIResponseError → 502s torpedoed the whole sync.
            last_exc = exc
            msg = str(exc)
            status = getattr(exc, "status", 0)
            transient = (
                status in (408, 429, 500, 502, 503, 504, 522, 524)
                or isinstance(exc, RequestTimeoutError)
                or "temporarily unavailable" in msg
                or "datastore timeouts" in msg
                or "Bad Gateway" in msg
            )
            if not transient:
                raise
            logger.warning(
                "notion_query_transient_retry attempt=%d delay=%.1fs status=%s err=%s",
                attempt + 1,
                delay,
                status,
                msg[:120],
            )
            await asyncio.sleep(delay)
            delay = min(delay * 2, 60.0)
    raise RuntimeError(f"notion_query failed after 8 retries: {last_exc}") from last_exc


async def _query_all(
    notion: AsyncClient,
    data_source_id: str,
    *,
    filter_obj: dict[str, Any] | None = None,
    limit: int | None = None,
) -> list[dict[str, Any]]:
    """Paginated query — returns every page in the data source.

    ``limit`` (optional) stops the pagination as soon as that many rows
    have been collected. Used by the ``--limit`` smoke-test path in the
    sync runner; ``None`` means "pull everything".
    """
    rows: list[dict[str, Any]] = []
    cursor: str | None = None
    while True:
        kw: dict[str, Any] = {
            "data_source_id": data_source_id,
            "page_size": QUERY_PAGE_SIZE,
        }
        if cursor:
            kw["start_cursor"] = cursor
        if filter_obj:
            kw["filter"] = filter_obj
        resp = await _query_page_with_backoff(notion, **kw)
        rows.extend(resp.get("results", []))
        if limit is not None and len(rows) >= limit:
            return rows[:limit]
        if not resp.get("has_more"):
            break
        cursor = resp.get("next_cursor")
        if not cursor:
            break
    return rows


async def pull_source(
    notion: AsyncClient,
    key: str,
    *,
    since: str | None = None,
    limit: int | None = None,
) -> list[dict[str, str]]:
    """Pull one source and project each page to a flat row dict.

    ``since`` (ISO timestamp) caps the query to rows whose
    ``last_edited_time`` is *after* the value — used by the incremental
    sync. Pass ``None`` for a full pull. ``limit`` clamps the row count
    for the ``--limit`` smoke-test path.
    """
    if key not in DATA_SOURCES:
        raise KeyError(f"unknown source key {key!r}")
    filter_obj: dict[str, Any] | None = None
    if since:
        filter_obj = {
            "timestamp": "last_edited_time",
            "last_edited_time": {"after": since},
        }
    pages = await _query_all(
        notion, DATA_SOURCES[key], filter_obj=filter_obj, limit=limit
    )
    return [page_to_row(p) for p in pages]


async def notion_to_sources(
    notion: AsyncClient,
    *,
    since: str | None = None,
    limit_per_source: int | None = None,
) -> dict[str, list[dict[str, str]]]:
    """Build the full ``sources`` mapping for ``transform.transform``.

    Sources are pulled sequentially (not in parallel) on purpose: Notion's
    rate limit is 3 req/s per integration and the *patient index* in
    transform.py is seeded from ``admin`` — pulling it first keeps the
    intent obvious and the order matches what's printed in the report.
    """
    sources: dict[str, list[dict[str, str]]] = {}
    for key in ("admin", "clinical", "appointment", "lab", "prescription"):
        logger.info("notion_pull_start source=%s", key)
        rows = await pull_source(notion, key, since=since, limit=limit_per_source)
        sources[key] = rows
        logger.info("notion_pull_done source=%s rows=%d", key, len(rows))
    return sources


# --------------------------------------------------------------------------- #
# CLI — useful for one-shot pulls and adapter verification.                   #
# --------------------------------------------------------------------------- #


async def _main() -> None:
    load_dotenv()
    token = os.environ.get("NOTION_API_KEY")
    if not token:
        raise SystemExit("NOTION_API_KEY not set.")
    notion = AsyncClient(auth=token)
    sources = await notion_to_sources(notion)
    print("\nPulled source counts (no transform applied):")
    for k, rows in sources.items():
        print(f"  {k:<14s} {len(rows)} rows")
    if sources["admin"]:
        sample = sources["admin"][0]
        sample_keys = [k for k in sample if not k.startswith("_")][:8]
        print("\nSample admin row — first 8 property names:")
        for k in sample_keys:
            v = sample[k]
            preview = v[:40] + "…" if len(v) > 40 else v
            print(f"  {k!r:35s} = {preview!r}")


if __name__ == "__main__":
    logging.basicConfig(
        level=logging.INFO, format="%(levelname)s %(name)s: %(message)s"
    )
    asyncio.run(_main())
