"""ClinicAI FastAPI application entry point."""
import structlog
from fastapi import FastAPI

logger = structlog.get_logger()

app = FastAPI(
    title="ClinicAI",
    description="AI-powered clinic management for Dr4women",
    version="0.1.0",
)


@app.get("/health")
async def health_check() -> dict:
    """Health check endpoint."""
    return {"status": "ok", "service": "clinicai"}
