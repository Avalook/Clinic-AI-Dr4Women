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
    print(f"Applying migrations from {migrations_dir}...")
    runner = MigrationRunner(pool, str(migrations_dir))

    # Print status
    await runner.status()

    # Apply
    applied = await runner.apply()
    print("Applied migrations:", applied)

    await pool.close()
    print("Done.")


if __name__ == "__main__":
    asyncio.run(main())
