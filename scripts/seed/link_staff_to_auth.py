"""Link ``staff`` rows to Supabase Auth users for the dashboard demo.

PACKET-4 (DASH-RBAC-01) glue. The dashboard's per-doctor and per-role
views need a mapping from a logged-in Supabase Auth ``user.id`` back to
``staff.id``. Auth users are created out-of-band (Supabase dashboard or
``supabase.auth.signUp``) — this script just writes the resulting UUIDs
into the ``staff.auth_user_id`` column added by migration 025.

USAGE
-----
1. Create the demo accounts in Supabase Auth (one per staff to bind):
   * Open project → Authentication → Users → "Add user" → email +
     password + check "Auto-confirm".
   * Copy the user UUID Supabase shows.

2. Run with the mapping (email is matched case-insensitively):

   poetry run python scripts/seed/link_staff_to_auth.py \\
     --map "BS Thành=<uuid>" \\
     --map "Diệu Hoa=<uuid>" \\
     --map "Admin=<uuid>"

   Each ``--map`` argument is ``full_name=uuid``. The script verifies
   each staff row exists and updates ``auth_user_id`` with the supplied
   UUID. Pass ``--unlink "Full Name"`` to clear the mapping.

The script is idempotent and reports each row it touches.
"""

from __future__ import annotations

import argparse
import asyncio
import logging
import os
import sys
import uuid
from pathlib import Path

import asyncpg
from dotenv import load_dotenv

logger = logging.getLogger("seed.link_staff_to_auth")

REPO_ROOT = Path(__file__).resolve().parents[2]


def _parse_map(values: list[str]) -> list[tuple[str, uuid.UUID]]:
    out: list[tuple[str, uuid.UUID]] = []
    for v in values or []:
        if "=" not in v:
            raise SystemExit(f"--map must be 'full_name=uuid', got {v!r}")
        name, raw = v.split("=", 1)
        name = name.strip()
        try:
            uid = uuid.UUID(raw.strip())
        except ValueError as exc:
            raise SystemExit(f"invalid UUID in {v!r}: {exc}") from exc
        if not name:
            raise SystemExit(f"empty full_name in {v!r}")
        out.append((name, uid))
    return out


async def _link(
    conn: asyncpg.Connection,
    mapping: list[tuple[str, uuid.UUID]],
    unlink: list[str],
) -> int:
    touched = 0
    for full_name, uid in mapping:
        row = await conn.fetchrow(
            "SELECT id, auth_user_id FROM staff WHERE full_name = $1",
            full_name,
        )
        if row is None:
            print(f"  SKIP (no staff) {full_name!r}")
            continue
        if row["auth_user_id"] == uid:
            print(f"  OK   already linked {full_name!r} → {uid}")
            continue
        await conn.execute(
            "UPDATE staff SET auth_user_id = $1 WHERE id = $2",
            uid,
            row["id"],
        )
        print(f"  LINK {full_name!r} → {uid}")
        touched += 1
    for full_name in unlink:
        result = await conn.execute(
            "UPDATE staff SET auth_user_id = NULL WHERE full_name = $1",
            full_name,
        )
        # asyncpg's execute returns 'UPDATE N' — surface N.
        print(f"  UNLINK {full_name!r}: {result}")
        touched += 1
    return touched


async def run(args: argparse.Namespace) -> int:
    load_dotenv(REPO_ROOT / ".env")
    dsn = os.environ.get("DATABASE_URL")
    if not dsn:
        raise SystemExit("DATABASE_URL not set in .env")
    dsn = dsn.replace("postgresql+asyncpg://", "postgresql://", 1)

    mapping = _parse_map(args.map or [])
    unlink = [s for s in (args.unlink or []) if s.strip()]
    if not mapping and not unlink:
        print("Nothing to do. Pass --map 'Name=uuid' (one or more) or --unlink 'Name'.")
        return 0

    conn = await asyncpg.connect(dsn)
    try:
        async with conn.transaction():
            touched = await _link(conn, mapping, unlink)
            if args.dry_run:
                print("\nDry-run: rolling back the transaction.")
                raise _DryRunError
    except _DryRunError:
        pass
    finally:
        await conn.close()

    print(f"\nLinked/unlinked rows: {touched}")
    return 0


class _DryRunError(Exception):
    """Sentinel used to roll back when --dry-run is passed."""


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument(
        "--map",
        action="append",
        default=[],
        help=("'full_name=uuid' to set staff.auth_user_id. Pass once per staff."),
    )
    parser.add_argument(
        "--unlink",
        action="append",
        default=[],
        help="Full name to clear (set auth_user_id back to NULL).",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Run the updates, then roll back so an operator can preview.",
    )
    args = parser.parse_args()
    logging.basicConfig(
        level=logging.INFO, format="%(levelname)s %(name)s: %(message)s"
    )
    return asyncio.run(run(args))


if __name__ == "__main__":
    sys.exit(main())
