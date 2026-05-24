"""Asynchronous database migrations runner for ClinicAI."""

import pathlib
from typing import Any, Dict, List, Optional

import asyncpg
import structlog

logger = structlog.get_logger()


class MigrationRunner:
    """Manages applying, rolling back, and checking status of database migrations."""

    def __init__(self, pool: asyncpg.Pool, migrations_dir: str) -> None:
        """Initialize migration runner with db connection pool and migrations folder."""
        self.pool = pool
        self.migrations_dir = pathlib.Path(migrations_dir)

    async def ensure_table(self, conn: asyncpg.Connection) -> None:
        """Ensure that the schema_migrations table exists."""
        await conn.execute(
            """
            CREATE TABLE IF NOT EXISTS schema_migrations (
                filename TEXT PRIMARY KEY,
                applied_at TIMESTAMPTZ DEFAULT NOW()
            );
            """
        )

    async def apply(self) -> List[str]:
        """Scan target directory, execute pending migrations, and record outcomes."""
        # Find and sort all UP migration scripts (.sql, but not .down.sql)
        sql_files = [
            f
            for f in self.migrations_dir.glob("*.sql")
            if not f.name.endswith(".down.sql")
        ]
        sql_files.sort(key=lambda x: x.name)

        applied_list: List[str] = []

        async with self.pool.acquire() as conn:
            await self.ensure_table(conn)

            # Retrieve all already applied migrations
            rows = await conn.fetch("SELECT filename FROM schema_migrations;")
            applied_set = {row["filename"] for row in rows}

            for file_path in sql_files:
                filename = file_path.name
                if filename in applied_set:
                    logger.info(
                        "migration_skipped",
                        filename=filename,
                        reason="already_applied",
                    )
                    continue

                # Read SQL script content
                with open(file_path, "r", encoding="utf-8") as f:
                    sql_content = f.read()

                # Run each migration script within its own transaction
                async with conn.transaction():
                    await conn.execute(sql_content)
                    await conn.execute(
                        "INSERT INTO schema_migrations (filename) VALUES ($1);",
                        filename,
                    )

                logger.info("migration_applied", filename=filename)
                applied_list.append(filename)

        return applied_list

    async def mark_applied(self, filenames: List[str]) -> List[str]:
        """Record migrations as applied WITHOUT executing their SQL.

        Inserts each given filename into ``schema_migrations`` so the runner
        treats it as already applied. Used to backfill tracking for migrations
        that were applied out-of-band (e.g. via the SQL editor). Idempotent:
        filenames already present are skipped. No ``.sql`` content is ever read
        or executed.

        Returns the list of filenames that were newly inserted.
        """
        marked_list: List[str] = []

        async with self.pool.acquire() as conn:
            await self.ensure_table(conn)

            # Retrieve all already tracked migrations for idempotency
            rows = await conn.fetch("SELECT filename FROM schema_migrations;")
            applied_set = {row["filename"] for row in rows}

            for filename in filenames:
                if filename in applied_set:
                    logger.info(
                        "migration_mark_skipped",
                        filename=filename,
                        reason="already_tracked",
                    )
                    continue

                await conn.execute(
                    "INSERT INTO schema_migrations (filename) VALUES ($1);",
                    filename,
                )
                logger.info("migration_marked_applied", filename=filename)
                marked_list.append(filename)

        return marked_list

    async def rollback(self) -> Optional[str]:
        """Rollback latest applied migration using its down counterpart."""
        async with self.pool.acquire() as conn:
            await self.ensure_table(conn)

            # Retrieve the latest applied migration sorted alphabetically
            row = await conn.fetchrow(
                "SELECT filename FROM schema_migrations ORDER BY filename DESC LIMIT 1;"
            )
            if not row:
                logger.info("rollback_skipped", reason="no_migrations_applied")
                return None

            filename: str = row["filename"]

            # Construct corresponding down script filename
            p = pathlib.Path(filename)
            down_filename = f"{p.stem}.down.sql"
            down_file_path = self.migrations_dir / down_filename

            if not down_file_path.is_file():
                raise FileNotFoundError(
                    f"Corresponding down migration file not found: {down_filename}"
                )

            # Read SQL down script content
            with open(down_file_path, "r", encoding="utf-8") as f:
                sql_content = f.read()

            # Execute rollback within a transaction
            async with conn.transaction():
                await conn.execute(sql_content)
                await conn.execute(
                    "DELETE FROM schema_migrations WHERE filename = $1;",
                    filename,
                )

            logger.info("migration_rolled_back", filename=filename)
            return filename

    async def status(self) -> Dict[str, Any]:
        """Retrieve applied and pending migration status and print details."""
        # Find all UP migration files
        sql_files = [
            f
            for f in self.migrations_dir.glob("*.sql")
            if not f.name.endswith(".down.sql")
        ]
        sql_files.sort(key=lambda x: x.name)
        all_migrations = [f.name for f in sql_files]

        async with self.pool.acquire() as conn:
            await self.ensure_table(conn)
            rows = await conn.fetch(
                "SELECT filename FROM schema_migrations ORDER BY filename ASC;"
            )
            applied = [row["filename"] for row in rows]

        applied_set = set(applied)
        pending = [f for f in all_migrations if f not in applied_set]

        # Print status to stdout
        print("Migration Status:")
        print(f"Applied ({len(applied)}):")
        for filename in applied:
            print(f"  [x] {filename}")
        print(f"Pending ({len(pending)}):")
        for filename in pending:
            print(f"  [ ] {filename}")

        return {
            "applied": applied,
            "pending": pending,
        }
