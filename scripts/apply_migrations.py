import argparse
import asyncio
import os
import pathlib

import asyncpg
from dotenv import load_dotenv

from clinicai.migrations.runner import MigrationRunner

# Load env
load_dotenv(os.path.join(os.getcwd(), ".env"))
if not os.getenv("DATABASE_URL"):
    load_dotenv(os.path.join(os.getcwd(), "../.env"))


def _parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Apply ClinicAI database migrations.")
    parser.add_argument(
        "--mark-applied",
        metavar="FILES",
        action="append",
        default=None,
        help=(
            "Comma-separated migration filenames to record as applied WITHOUT "
            "executing their SQL (backfill tracking for out-of-band migrations). "
            "May be passed multiple times. When set, the runner ONLY marks and "
            "does NOT apply any pending migration."
        ),
    )
    return parser.parse_args()


def _collect_mark_targets(raw: list[str] | None) -> list[str]:
    """Flatten and clean comma-separated --mark-applied values."""
    if not raw:
        return []
    names: list[str] = []
    for chunk in raw:
        for name in chunk.split(","):
            name = name.strip()
            if name:
                names.append(name)
    return names


async def main() -> None:
    args = _parse_args()
    mark_targets = _collect_mark_targets(args.mark_applied)

    dsn = os.getenv("DATABASE_URL")
    if not dsn:
        print("DATABASE_URL is not set!")
        return

    # Normalize DSN
    dsn = dsn.replace("postgresql+asyncpg://", "postgresql://", 1)

    print("Connecting to database...")
    pool = await asyncpg.create_pool(dsn)

    # Initialize MigrationRunner
    migrations_dir = pathlib.Path(os.getcwd()) / "src" / "migrations"
    runner = MigrationRunner(pool, str(migrations_dir))

    if mark_targets:
        # Mark-only mode: record the given files as applied, do NOT apply SQL.
        print(f"Marking {len(mark_targets)} migration(s) as applied (no SQL run):")
        for name in mark_targets:
            print(f"  - {name}")
        marked = await runner.mark_applied(mark_targets)
        print("Newly marked:", marked)
        already = [n for n in mark_targets if n not in marked]
        if already:
            print("Already tracked (skipped):", already)
        await pool.close()
        print("Done.")
        return

    print(f"Applying migrations from {migrations_dir}...")

    # Print status
    await runner.status()

    # Apply
    applied = await runner.apply()
    print("Applied migrations:", applied)

    await pool.close()
    print("Done.")


if __name__ == "__main__":
    asyncio.run(main())
