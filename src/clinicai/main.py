"""ClinicAI FastAPI application entry point."""

import structlog
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse

from clinicai.core.exceptions import ClinicAIBaseException
from clinicai.core.logging import setup_logging

# Initialize structured JSON logging
setup_logging()

logger = structlog.get_logger()

app = FastAPI(
    title="ClinicAI",
    description="AI-powered clinic management for Dr4women",
    version="0.1.0",
)


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


@app.get("/health")
async def health_check() -> dict:
    """Health check endpoint."""
    return {"status": "ok", "service": "clinicai"}
