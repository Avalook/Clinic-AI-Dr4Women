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


async def main():
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
    print(f"Rolling back migrations from {migrations_dir}...")
    runner = MigrationRunner(pool, str(migrations_dir))

    # Rollback
    rolled_back = await runner.rollback()
    print("Rolled back migration:", rolled_back)

    await pool.close()
    print("Done.")


if __name__ == "__main__":
    asyncio.run(main())
