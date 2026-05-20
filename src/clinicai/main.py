"""ClinicAI FastAPI application entry point."""

from contextlib import asynccontextmanager
from typing import AsyncIterator

import structlog
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse

from clinicai.api.v1.health import router as health_router
from clinicai.core.database import close_pool, create_pool
from clinicai.core.exceptions import ClinicAIBaseException
from clinicai.core.logging import setup_logging

# Initialize structured JSON logging
setup_logging()

logger = structlog.get_logger()


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    """Manage the asyncpg pool over the application lifetime."""
    app.state.db_pool = await create_pool()
    try:
        yield
    finally:
        await close_pool(app.state.db_pool)


app = FastAPI(
    title="ClinicAI",
    description="AI-powered clinic management for Dr4women",
    version="0.1.0",
    lifespan=lifespan,
)

app.include_router(health_router)


@app.exception_handler(ClinicAIBaseException)
async def clinicai_exception_handler(
    request: Request, exc: ClinicAIBaseException
) -> JSONResponse:
    """Global handler for all custom ClinicAI exceptions."""
    logger.warning(
        "clinicai_exception",
        error_code=exc.error_code,
        message=exc.message,
        status_code=exc.status_code,
    )
    return JSONResponse(
        status_code=exc.status_code,
        content={"error": exc.error_code, "message": exc.message},
    )


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    """Global handler for all unhandled exceptions."""
    # Capture full stack trace in structured JSON logs without leaking it to clients
    logger.exception(
        "unhandled_exception",
        message=str(exc),
    )
    return JSONResponse(
        status_code=500,
        content={
            "error": "INTERNAL_SERVER_ERROR",
            "message": "An internal server error occurred.",
        },
    )
