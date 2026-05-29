"""Read-only inspection of the Notion workspace data structure.

NOTION-SCHEMA-01 — output schema markdown for the data-import pipeline.

SAFETY
- ABSOLUTELY READ-ONLY: only calls notion.blocks.children.list,
  notion.databases.retrieve, notion.databases.query. Never mutates.
- The clinic's source database is marked ⚠️ (see CURRENT_PROGRESS 26/5).
  Any write here would corrupt the live source-of-truth — do not add
  create/update/delete calls to this file under any circumstances.
- Sample rows are PII-REDACTED before being written, because the output
  file lives under context/ (committed). Raw values never touch disk.

USAGE
    export NOTION_API_KEY=secret_xxx
    poetry run python scripts/data_import/inspect_notion_schema.py
"""

from __future__ import annotations

import asyncio
import logging
import os
import re
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from dotenv import load_dotenv
from notion_client import AsyncClient
from notion_client.errors import APIResponseError

logger = logging.getLogger("data_import.inspect_notion_schema")

# Default page is the cloned clinic workspace; override via LINK_NOTION_PAGE_ID.
DEFAULT_ROOT_PAGE_ID = "36eccb0eac8880d5919ff96376be1fca"

REPO_ROOT = Path(__file__).resolve().parents[2]
OUTPUT_PATH = REPO_ROOT / "context" / "notion_schema_report.md"

MAX_DEPTH = 4  # bound recursion into nested pages
SAMPLE_ROWS = 3  # rows per database rendered in the report
RELATION_SCAN_ROWS = 30  # extra rows scanned (not rendered) so we can
# resolve back-side relation targets even when
# the first 3 rows have empty relation columns.
QUERY_PAGE_SIZE = 30
CHILDREN_PAGE_SIZE = 100


# --------------------------------------------------------------------------- #
# PII redaction — output lives under context/ which is committed.
# --------------------------------------------------------------------------- #

_PHONE_RE = re.compile(r"\d")


def _mask_text(value: str, *, keep_head: int = 1) -> str:
    """Show length and first char(s) of a free-text value."""
    value = value.strip()
    if not value:
        return "''"
    head = value[:keep_head]
    return f"{head}…({len(value)} chars)"


def _mask_phone(value: str) -> str:
    digits = _PHONE_RE.findall(value)
    if len(digits) < 3:
        return "***"
    return f"***{''.join(digits[-3:])}"


def _mask_email(value: str) -> str:
    if "@" not in value:
        return "***"
    _, _, domain = value.partition("@")
    return f"***@{domain}"


def _mask_date(value: str) -> str:
    # keep year only — month/day can identify a patient combined with name
    return value[:4] + "-**-**" if len(value) >= 4 else "****"


def _redact_property_value(prop: dict[str, Any]) -> str:
    """Compress one property value into a one-line, PII-safe summary."""
    ptype = prop.get("type")
    raw = prop.get(ptype) if ptype else None

    if raw is None:
        return "∅"

    if ptype == "title":
        text = "".join(part.get("plain_text", "") for part in raw)
        return _mask_text(text, keep_head=1)
    if ptype == "rich_text":
        text = "".join(part.get("plain_text", "") for part in raw)
        return _mask_text(text, keep_head=2)
    if ptype == "number":
        return str(raw)
    if ptype == "select":
        return raw.get("name", "∅") if isinstance(raw, dict) else "∅"
    if ptype == "multi_select":
        return "[" + ", ".join(opt.get("name", "") for opt in raw) + "]"
    if ptype == "status":
        return raw.get("name", "∅") if isinstance(raw, dict) else "∅"
    if ptype == "date":
        start = raw.get("start") if isinstance(raw, dict) else None
        end = raw.get("end") if isinstance(raw, dict) else None
        if not start:
            return "∅"
        s = _mask_date(start)
        return f"{s}..{_mask_date(end)}" if end else s
    if ptype == "people":
        return f"<{len(raw)} people>"
    if ptype == "files":
        return f"<{len(raw)} file(s)>"
    if ptype == "checkbox":
        return str(bool(raw))
    if ptype == "url":
        return "<url>" if raw else "∅"
    if ptype == "email":
        return _mask_email(raw) if isinstance(raw, str) else "∅"
    if ptype == "phone_number":
        return _mask_phone(raw) if isinstance(raw, str) else "∅"
    if ptype == "formula":
        # formula nests another typed value — recurse
        inner = raw.get("type")
        return _redact_property_value({"type": inner, inner: raw.get(inner)})
    if ptype == "relation":
        return f"<rel→{len(raw)} page(s)>"
    if ptype == "rollup":
        return f"<rollup:{raw.get('type')}>"
    if ptype == "created_time":
        return _mask_date(raw) if isinstance(raw, str) else "∅"
    if ptype == "last_edited_time":
        return _mask_date(raw) if isinstance(raw, str) else "∅"
    if ptype in ("created_by", "last_edited_by"):
        return "<user>"
    if ptype == "unique_id":
        prefix = raw.get("prefix") or ""
        number = raw.get("number")
        return f"{prefix}{number}" if number is not None else "∅"

    return f"<{ptype}>"


# --------------------------------------------------------------------------- #
# Notion traversal
# --------------------------------------------------------------------------- #


async def _list_block_children(
    notion: AsyncClient, block_id: str
) -> list[dict[str, Any]]:
    """Paginated list of children for a block."""
    results: list[dict[str, Any]] = []
    cursor: str | None = None
    while True:
        kwargs: dict[str, Any] = {"block_id": block_id, "page_size": CHILDREN_PAGE_SIZE}
        if cursor:
            kwargs["start_cursor"] = cursor
        resp = await notion.blocks.children.list(**kwargs)
        results.extend(resp.get("results", []))
        if not resp.get("has_more"):
            break
        cursor = resp.get("next_cursor")
        if not cursor:
            break
    return results


async def _walk_for_databases(
    notion: AsyncClient,
    block_id: str,
    *,
    depth: int,
    visited: set[str],
    path: list[str],
    out: list[dict[str, Any]],
) -> None:
    """DFS through pages, recording every child_database block we encounter."""
    if depth > MAX_DEPTH or block_id in visited:
        return
    visited.add(block_id)

    try:
        children = await _list_block_children(notion, block_id)
    except APIResponseError as exc:
        logger.warning("blocks.children.list failed for %s: %s", block_id, exc.code)
        return

    for child in children:
        ctype = child.get("type")
        cid = child.get("id")
        if not cid:
            continue

        if ctype == "child_database":
            title = child.get("child_database", {}).get("title") or "(untitled db)"
            out.append({"id": cid, "title": title, "parent_path": list(path)})
        elif ctype == "child_page":
            title = child.get("child_page", {}).get("title") or "(untitled page)"
            await _walk_for_databases(
                notion,
                cid,
                depth=depth + 1,
                visited=visited,
                path=path + [title],
                out=out,
            )
        # Other block types (paragraphs, callouts, …) carry no DB pointers
        # we care about for the schema-import use case; skip them.


async def _fetch_database_meta(
    notion: AsyncClient, database_id: str
) -> dict[str, Any] | None:
    """Retrieve the database envelope (title + list of data_source pointers).

    Notion API 2025-09 moved per-row schema + query to the data_source level;
    one database may now expose 1+ data sources. Common case = exactly 1.
    """
    try:
        return await notion.databases.retrieve(database_id=database_id)
    except APIResponseError as exc:
        logger.warning("databases.retrieve failed for %s: %s", database_id, exc.code)
        return None


async def _fetch_data_source(
    notion: AsyncClient, data_source_id: str
) -> dict[str, Any] | None:
    try:
        return await notion.data_sources.retrieve(data_source_id=data_source_id)
    except APIResponseError as exc:
        logger.warning(
            "data_sources.retrieve failed for %s: %s", data_source_id, exc.code
        )
        return None


async def _fetch_data_source_samples(
    notion: AsyncClient, data_source_id: str
) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    """Return (display_samples, scan_samples).

    display_samples: SAMPLE_ROWS pages shown in the report (PII-redacted).
    scan_samples: up to QUERY_PAGE_SIZE pages used internally for relation
    target inference (NOT rendered).
    """
    try:
        resp = await notion.data_sources.query(
            data_source_id=data_source_id, page_size=QUERY_PAGE_SIZE
        )
    except APIResponseError as exc:
        logger.warning("data_sources.query failed for %s: %s", data_source_id, exc.code)
        return [], []
    results = resp.get("results", [])
    return results[:SAMPLE_ROWS], results


# --------------------------------------------------------------------------- #
# Report rendering
# --------------------------------------------------------------------------- #


def _short_id(full_id: str) -> str:
    return full_id.replace("-", "")[:8]


def _db_title(db: dict[str, Any]) -> str:
    title_parts = db.get("title") or []
    text = "".join(part.get("plain_text", "") for part in title_parts).strip()
    return text or "(untitled)"


def _ds_title(ds: dict[str, Any], fallback: str) -> str:
    title_parts = ds.get("title") or []
    text = "".join(part.get("plain_text", "") for part in title_parts).strip()
    if text:
        return text
    # Some API responses embed the name under "name" rather than rich-text title.
    name = ds.get("name")
    if isinstance(name, str) and name.strip():
        return name.strip()
    return fallback


def _merge_schema_with_page_props(
    schema_props: dict[str, Any], samples: list[dict[str, Any]]
) -> dict[str, dict[str, Any]]:
    """Union schema properties with properties seen on sample pages.

    Notion's data_sources.retrieve hides the back-side of dual_property
    relations defined in other databases (the property exists on each page
    but not in the schema response). We surface them anyway by scanning
    sample page properties and tagging origin so the report flags the gap.
    """
    merged: dict[str, dict[str, Any]] = {}
    for name, prop in schema_props.items():
        merged[name] = {
            "type": prop.get("type") or "?",
            "raw": prop,
            "origin": "schema",
            "first_seen_value": None,
        }
    for page in samples:
        for name, pprop in (page.get("properties") or {}).items():
            if name in merged:
                continue
            ptype = pprop.get("type") or "?"
            merged[name] = {
                "type": ptype,
                "raw": None,
                "origin": "page-only",
                "first_seen_value": pprop,
            }
    return merged


def _render_schema_table(merged: dict[str, dict[str, Any]]) -> str:
    """One markdown table of merged (schema ∪ page) properties."""
    lines = [
        "| Property | Type | Origin | Notes |",
        "| --- | --- | --- | --- |",
    ]
    for name in sorted(merged):
        entry = merged[name]
        ptype = entry["type"]
        origin = entry["origin"]
        if entry["raw"] is not None:
            notes = _describe_property_options(entry["raw"])
        elif entry["first_seen_value"] is not None and ptype == "relation":
            # Page-only relation: infer target from first sample's relation list.
            rels = entry["first_seen_value"].get("relation") or []
            target = rels[0].get("id") if rels else None
            notes = (
                f"→ unknown target (sample page → `{_short_id(target)}`)"
                if target
                else "→ unknown target"
            )
        else:
            notes = "(back-side; see sample rows)"
        safe_name = name.replace("|", "\\|")
        lines.append(f"| `{safe_name}` | `{ptype}` | `{origin}` | {notes} |")
    return "\n".join(lines)


def _describe_property_options(prop: dict[str, Any]) -> str:
    ptype = prop.get("type")
    body = prop.get(ptype) or {}

    if ptype == "select" or ptype == "status":
        opts = body.get("options") or []
        return (
            "options: "
            + ", ".join(f"`{o.get('name')}`" for o in opts[:12])
            + (f" (+{len(opts) - 12} more)" if len(opts) > 12 else "")
            if opts
            else "(no options)"
        )
    if ptype == "multi_select":
        opts = body.get("options") or []
        return (
            "options: "
            + ", ".join(f"`{o.get('name')}`" for o in opts[:12])
            + (f" (+{len(opts) - 12} more)" if len(opts) > 12 else "")
            if opts
            else "(no options)"
        )
    if ptype == "relation":
        # API 2025-09: relation targets a data_source_id; older payloads may
        # still send database_id, so accept either.
        target = body.get("data_source_id") or body.get("database_id") or "?"
        synced = body.get("type")  # 'single_property' or 'dual_property'
        return f"→ `{_short_id(target)}` ({synced})"
    if ptype == "rollup":
        return (
            f"rollup of `{body.get('relation_property_name')}`"
            f" → `{body.get('rollup_property_name')}` ({body.get('function')})"
        )
    if ptype == "formula":
        expr = body.get("expression") or ""
        if len(expr) > 60:
            expr = expr[:60] + "…"
        return f"formula: `{expr}`"
    if ptype == "number":
        fmt = body.get("format")
        return f"format: `{fmt}`" if fmt else ""
    return ""


_VI_LETTERS = "àáảãạăắằẳẵặâấầẩẫậèéẻẽẹêếềểễệìíỉĩịòóỏõọôốồổỗộơớờởỡợùúủũụưứừửữựỳýỷỹỵđ"
_NORMALIZE_KEEP = re.compile(rf"[^a-z0-9{_VI_LETTERS}]+")


def _normalize_for_match(text: str) -> str:
    """Strip emoji/punct/whitespace, lowercase, for fuzzy title matching."""
    return _NORMALIZE_KEEP.sub("", text.lower())


def _guess_target_by_name(prop_name: str, databases: list[dict[str, Any]]) -> str:
    """Fuzzy-match a property name against database titles.

    Used as a last-resort target hint for back-side relations whose forward
    declaration isn't accessible to the integration. Returns "" on no match.
    """
    needle = _normalize_for_match(prop_name)
    if not needle:
        return ""
    best: tuple[int, str] = (0, "")
    for db in databases:
        hay = _normalize_for_match(db["title"])
        if not hay:
            continue
        # Symmetric containment scoring: prefer longer overlap.
        if needle in hay or hay in needle:
            score = min(len(needle), len(hay))
            if score > best[0]:
                best = (score, db["id"])
    return best[1]


def _render_relations_map(databases: list[dict[str, Any]]) -> str:
    """Show every relation as source_ds.prop → target_ds, including back-sides.

    Back-side relations (dual_property defined in another DB) are recovered
    by scanning sample page properties: their first non-empty target page id
    is looked up against the page→data_source map built from samples.
    """
    id_to_title: dict[str, str] = {}
    page_to_ds: dict[str, str] = {}
    # backside_index: (target_ds_id, back_property_name) → forward_ds_id.
    # Populated from every FORWARD dual_property relation declared in a
    # schema; lets us resolve a back-side relation without ever seeing a
    # populated cell.
    backside_index: dict[tuple[str, str], str] = {}
    for db in databases:
        id_to_title[db["id"]] = db["title"]
        for ds in db.get("data_sources") or []:
            id_to_title[ds["id"]] = ds["title"]
            for page in ds.get("_scan_samples") or ds.get("samples") or []:
                if page.get("id"):
                    page_to_ds[page["id"]] = ds["id"]
            for pname, prop in (ds.get("properties") or {}).items():
                if prop.get("type") != "relation":
                    continue
                rel = prop.get("relation") or {}
                if rel.get("type") != "dual_property":
                    continue
                target_ds = rel.get("data_source_id") or rel.get("database_id")
                back_name = (rel.get("dual_property") or {}).get("synced_property_name")
                if target_ds and back_name:
                    backside_index[(target_ds, back_name)] = ds["id"]

    lines = [
        "| Source DB | Data source | Property | Origin | → | Target | Sync type |",
        "| --- | --- | --- | --- | --- | --- | --- |",
    ]
    found = 0
    for db in databases:
        for ds in db.get("data_sources") or []:
            merged = ds.get("_merged_props") or {}
            for pname in sorted(merged):
                entry = merged[pname]
                if entry["type"] != "relation":
                    continue
                if entry["raw"] is not None:
                    rel = entry["raw"].get("relation") or {}
                    target_id = (
                        rel.get("data_source_id") or rel.get("database_id") or ""
                    )
                    sync = rel.get("type") or "?"
                else:
                    # Page-only (back-side) relation. Resolve target via,
                    # in order of preference:
                    #   1) backside_index — exact match against the
                    #      forward dual_property declaration (no I/O).
                    #   2) Scanning queried rows for a populated cell and
                    #      mapping the related page id back to its DS.
                    target_id = backside_index.get((ds["id"], pname), "")
                    sync = "back-side (forward dual_property)"
                    if not target_id:
                        scan_pages = ds.get("_scan_samples") or ds.get("samples") or []
                        for page in scan_pages:
                            pprop = (page.get("properties") or {}).get(pname) or {}
                            rels = pprop.get("relation") or []
                            if rels:
                                target_page = rels[0].get("id")
                                target_id = page_to_ds.get(target_page, "") or ""
                                if target_id:
                                    sync = "back-side (page-scan)"
                                    break
                    if not target_id:
                        guess = _guess_target_by_name(pname, databases)
                        if guess:
                            target_id = guess
                            sync = "back-side (name-match guess)"
                target_title = id_to_title.get(target_id) or (
                    f"(unresolved; `{_short_id(target_id)}`)"
                    if target_id
                    else "(unknown)"
                )
                lines.append(
                    f"| {db['title']} | {ds['title']} | `{pname}` "
                    f"| `{entry['origin']}` | → | {target_title} | `{sync}` |"
                )
                found += 1
    if not found:
        return "_No relation properties found._"
    return "\n".join(lines)


def _render_sample_rows(samples: list[dict[str, Any]]) -> str:
    if not samples:
        return "_No rows or query failed._"
    blocks: list[str] = []
    for idx, page in enumerate(samples, start=1):
        props = page.get("properties") or {}
        rows = []
        for pname in sorted(props):
            redacted = _redact_property_value(props[pname])
            rows.append(f"  - `{pname}`: {redacted}")
        created = _mask_date(page.get("created_time", "") or "")
        edited = _mask_date(page.get("last_edited_time", "") or "")
        page_id = _short_id(page.get("id", ""))
        header = (
            f"**Sample {idx}** (page `{page_id}`, created {created}, edited {edited})"
        )
        blocks.append(header + "\n" + "\n".join(rows))
    return "\n\n".join(blocks)


def render_report(databases: list[dict[str, Any]], root_page_id: str) -> str:
    now = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")
    total_ds = sum(len(db.get("data_sources") or []) for db in databases)

    # Pre-compute merged props per data source so TL;DR + tables agree.
    # Use the wider scan_samples set (not just the 3 display rows) so
    # rarely-populated back-side relations still surface.
    for db in databases:
        for ds in db.get("data_sources") or []:
            ds["_merged_props"] = _merge_schema_with_page_props(
                ds.get("properties") or {},
                ds.get("_scan_samples") or ds.get("samples") or [],
            )

    total_schema_props = sum(
        len(ds.get("properties") or {})
        for db in databases
        for ds in (db.get("data_sources") or [])
    )
    total_page_only_props = sum(
        sum(
            1
            for e in (ds.get("_merged_props") or {}).values()
            if e["origin"] == "page-only"
        )
        for db in databases
        for ds in (db.get("data_sources") or [])
    )
    rel_schema = sum(
        1
        for db in databases
        for ds in (db.get("data_sources") or [])
        for e in (ds.get("_merged_props") or {}).values()
        if e["type"] == "relation" and e["origin"] == "schema"
    )
    rel_backside = sum(
        1
        for db in databases
        for ds in (db.get("data_sources") or [])
        for e in (ds.get("_merged_props") or {}).values()
        if e["type"] == "relation" and e["origin"] == "page-only"
    )

    parts: list[str] = []
    parts.append("# Notion schema report — NOTION-SCHEMA-01")
    parts.append(
        f"> Generated: {now} · Root page: `{root_page_id}` · Read-only inspection."
    )
    parts.append("")
    parts.append("## TL;DR")
    parts.append(f"- Databases discovered: **{len(databases)}**")
    parts.append(f"- Data sources (Notion API 2025-09 model): **{total_ds}**")
    parts.append(
        f"- Properties from schema: **{total_schema_props}** "
        f"· back-side props only on pages: **{total_page_only_props}**"
    )
    parts.append(
        f"- Relation properties: **{rel_schema}** schema-side "
        f"+ **{rel_backside}** back-side (hidden from schema; "
        f"recovered from page samples)"
    )
    if total_page_only_props:
        parts.append(
            "- ⚠️ `data_sources.retrieve` omits the back-side of dual-property "
            "relations defined in another DB. The import pipeline must read "
            "those columns from page properties (not schema)."
        )
    parts.append("")
    parts.append("## Database index")
    parts.append("| # | Title | DB ID | Parent path | Data sources | Rows fetched |")
    parts.append("| --- | --- | --- | --- | --- | --- |")
    for idx, db in enumerate(databases, start=1):
        parent = " / ".join(db.get("parent_path") or []) or "(root)"
        sources = db.get("data_sources") or []
        ds_count = len(sources)
        sample_total = sum(len(ds.get("samples") or []) for ds in sources)
        short = _short_id(db["id"])
        parts.append(
            f"| {idx} | {db['title']} | `{short}` | {parent} "
            f"| {ds_count} | {sample_total} |"
        )
    parts.append("")
    parts.append("## Cross-source relations")
    parts.append(_render_relations_map(databases))
    parts.append("")
    parts.append("## Per-database schemas")
    for db in databases:
        parts.append("")
        parts.append(f"### {db['title']}")
        parts.append(f"- DB ID: `{db['id']}`")
        parent = " / ".join(db.get("parent_path") or []) or "(root)"
        parts.append(f"- Parent path: {parent}")
        sources = db.get("data_sources") or []
        if not sources:
            parts.append("- _No accessible data sources (integration not shared?)._")
            continue
        for ds in sources:
            parts.append("")
            parts.append(f"#### Data source · {ds['title']}")
            parts.append(f"- Data source ID: `{ds['id']}`")
            desc_parts = ds.get("description") or []
            desc = "".join(p.get("plain_text", "") for p in desc_parts).strip()
            if desc:
                parts.append(f"- Description: {desc}")
            merged = ds.get("_merged_props") or {}
            schema_n = sum(1 for e in merged.values() if e["origin"] == "schema")
            page_n = sum(1 for e in merged.values() if e["origin"] == "page-only")
            parts.append(
                f"- Property count: **{len(merged)}** "
                f"(schema: {schema_n}, page-only: {page_n})"
            )
            parts.append("")
            parts.append("**Properties**")
            parts.append("")
            parts.append(_render_schema_table(merged))
            parts.append("")
            parts.append("**Sample rows (PII-redacted)**")
            parts.append("")
            parts.append(_render_sample_rows(ds.get("samples") or []))
    parts.append("")
    return "\n".join(parts)


# --------------------------------------------------------------------------- #
# Orchestrator
# --------------------------------------------------------------------------- #


async def inspect() -> None:
    load_dotenv(REPO_ROOT / ".env")
    api_key = os.environ.get("NOTION_API_KEY")
    if not api_key:
        raise SystemExit("NOTION_API_KEY not set. Add it to .env or export it.")
    root_page_id = os.environ.get("LINK_NOTION_PAGE_ID") or DEFAULT_ROOT_PAGE_ID
    print(f"Inspecting root page: {root_page_id}")

    notion = AsyncClient(auth=api_key)

    # Step 1 — fetch root page children and Step 2 — walk for child_database blocks.
    found: list[dict[str, Any]] = []
    await _walk_for_databases(
        notion,
        root_page_id,
        depth=0,
        visited=set(),
        path=[],
        out=found,
    )

    # Deduplicate (a database may be referenced from multiple parents).
    seen: dict[str, dict[str, Any]] = {}
    for entry in found:
        seen.setdefault(entry["id"], entry)
    databases = list(seen.values())
    print(f"Discovered {len(databases)} databases under root.")

    # Step 3 — schema (via data_sources) + Step 4 (relations inferred from
    # data_source properties) + Step 5 (3 sample rows per data source).
    for db in databases:
        meta = await _fetch_database_meta(notion, db["id"])
        if meta is None:
            db["title"] = f"{db['title']} (no access)"
            db["data_sources"] = []
            continue
        # Prefer the database's own title over the block-recorded one
        # because the database object carries the canonical rich-text title.
        db["title"] = _db_title(meta) or db["title"]
        ds_refs = meta.get("data_sources") or []
        sources: list[dict[str, Any]] = []
        for ref in ds_refs:
            ds_id = ref.get("id")
            if not ds_id:
                continue
            full = await _fetch_data_source(notion, ds_id)
            if full is None:
                # Couldn't load — record id + name only.
                sources.append(
                    {
                        "id": ds_id,
                        "title": ref.get("name") or "(no access)",
                        "properties": {},
                        "samples": [],
                    }
                )
                continue
            full["id"] = full.get("id") or ds_id
            full["title"] = _ds_title(full, ref.get("name") or db["title"])
            display, scan = await _fetch_data_source_samples(notion, ds_id)
            full["samples"] = display
            full["_scan_samples"] = scan
            sources.append(full)
        db["data_sources"] = sources

    # Step 6 — render markdown to context/notion_schema_report.md
    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT_PATH.write_text(render_report(databases, root_page_id), encoding="utf-8")
    print(f"Wrote schema report → {OUTPUT_PATH}")


if __name__ == "__main__":
    logging.basicConfig(
        level=logging.INFO, format="%(levelname)s %(name)s: %(message)s"
    )
    asyncio.run(inspect())
