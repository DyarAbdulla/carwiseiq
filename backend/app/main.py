"""
FastAPI Backend for Car Price Prediction
Main application entry point
"""

# Must be set before any TensorFlow import to suppress oneDNN warnings
# and floating-point round-off messages
import asyncio
import logging
import sys
import uvicorn
from app.middleware.security import SecurityMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, Response
from fastapi import FastAPI, Request
from app.api.routes import health, predict, cars, budget, stats, auth, options, images, model_info, feedback, admin, marketplace, messaging, favorites, ai, dataset, export, services, providers
from app.config import settings
import os
from pathlib import Path
from dotenv import load_dotenv

# Load environment variables from .env file before anything else
env_path = Path(__file__).parent.parent / '.env'
if env_path.exists():
    load_dotenv(env_path)

os.environ.setdefault("TF_ENABLE_ONEDNN_OPTS", "0")
# 0=all, 1=no INFO, 2=no WARNING, 3=ERROR only
os.environ.setdefault("TF_CPP_MIN_LOG_LEVEL", "2")


# Add backend directory to path
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if BASE_DIR not in sys.path:
    sys.path.insert(0, BASE_DIR)


# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)

# Production: disable docs to avoid exposing API structure
_is_production = os.getenv("ENV", "development").lower() == "production"
app = FastAPI(
    title="Car Price Predictor API",
    description="AI-powered car price prediction API",
    version="1.0.0",
    docs_url=None if _is_production else "/docs",
    redoc_url=None if _is_production else "/redoc",
)

# Security middleware (path-specific rate limiting, HSTS, CSP)
app.add_middleware(SecurityMiddleware)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
    allow_credentials=False,
)

# Root endpoint


@app.get("/")
async def root():
    """Root endpoint - provides API information and links (docs hidden in production)."""
    endpoints = {"health": "/api/health", "predict": "/api/predict"}
    if not _is_production:
        endpoints["docs"] = "/docs"
        endpoints["redoc"] = "/redoc"
    return JSONResponse({
        "message": "Car Price Predictor API",
        "version": "1.0.0",
        "description": "AI-powered car price prediction API",
        "endpoints": endpoints,
        "status": "running"
    })

# Favicon endpoint to prevent 404 errors


@app.get("/favicon.ico")
async def favicon():
    """Favicon endpoint - returns 204 No Content"""
    return Response(status_code=204)

# Include routers
app.include_router(health.router, prefix="/api", tags=["Health"])
app.include_router(model_info.router, prefix="/api", tags=["Model Info"])
app.include_router(predict.router, prefix="/api", tags=["Prediction"])
app.include_router(cars.router, prefix="/api/cars", tags=["Cars"])
app.include_router(budget.router, prefix="/api/budget", tags=["Budget"])
app.include_router(stats.router, prefix="/api/stats", tags=["Statistics"])
app.include_router(auth.router, prefix="/api/auth", tags=["Authentication"])
app.include_router(feedback.router, prefix="/api/feedback", tags=["Feedback"])
app.include_router(admin.router, prefix="/api/admin", tags=["Admin"])
app.include_router(marketplace.router,
                   prefix="/api/marketplace", tags=["Marketplace"])
app.include_router(ai.router, prefix="/api/ai", tags=["AI"])
app.include_router(
    messaging.router, prefix="/api/messaging", tags=["Messaging"])
app.include_router(
    favorites.router, prefix="/api/favorites", tags=["Favorites"])
app.include_router(options.router, prefix="/api", tags=["Options"])
app.include_router(images.router, prefix="/api", tags=["Images"])
app.include_router(dataset.router, prefix="/api/dataset", tags=["Dataset"])
app.include_router(export.router, prefix="/api", tags=["Export"])
app.include_router(services.router, prefix="/api", tags=["Services"])
app.include_router(providers.router, prefix="/api", tags=["Providers"])

# Mount /uploads for listing images (uploads/listings/{id}/*)
UPLOADS_DIR = os.path.join(BASE_DIR, "uploads")
os.makedirs(UPLOADS_DIR, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=UPLOADS_DIR), name="uploads")


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    """Never expose stack traces or internal errors to clients. Log server-side only."""
    logging.error("Unhandled exception: %s", exc, exc_info=True)
    return JSONResponse(
        status_code=500,
        content={"detail": "An error occurred. Please try again later."},
    )


@app.on_event("startup")
async def startup_event():
    """Initialize database and model on startup. Fail if critical env missing in production."""
    from app.config import check_required_env_production
    try:
        check_required_env_production()
    except RuntimeError as e:
        logging.error(str(e))
        raise

    # Log asyncio task exceptions; treat CancelledError as normal shutdown (no traceback)
    def _asyncio_exception_handler(loop, context):
        msg = context.get("message", "Unknown")
        exc = context.get("exception")
        if isinstance(exc, asyncio.CancelledError):
            logging.debug("Task cancelled during shutdown: %s", msg)
            return
        if exc:
            logging.error("Asyncio exception: %s - %s",
                          msg, exc, exc_info=True)
        else:
            logging.error("Asyncio exception: %s", msg)

    try:
        asyncio.get_running_loop().set_exception_handler(_asyncio_exception_handler)
    except Exception as e:
        logging.warning("Could not set asyncio exception handler: %s", e)

    # Initialize database
    try:
        from app.services.auth_service import init_db
        init_db()
        logging.info("Database initialized successfully")
    except Exception as e:
        logging.error(f"Failed to initialize database: {e}")
        # Database initialization should not fail startup, but log the error

    # Initialize feedback database
    try:
        from app.services.feedback_service import init_feedback_db
        init_feedback_db()
        logging.info("Feedback database initialized successfully")
    except Exception as e:
        logging.error(f"Failed to initialize feedback database: {e}")
        # Non-critical, continue startup

    # Initialize admin database
    try:
        from app.services.admin_service import init_admin_db
        init_admin_db()
        logging.info("Admin database initialized successfully")
    except Exception as e:
        logging.error(f"Failed to initialize admin database: {e}")
        # Non-critical, continue startup

    # Initialize marketplace database
    try:
        from app.services.marketplace_service import init_marketplace_db
        init_marketplace_db()
        logging.info("Marketplace database initialized successfully")
    except Exception as e:
        logging.error(f"Failed to initialize marketplace database: {e}")
        # Non-critical, continue startup

    # Initialize messaging database
    try:
        from app.services.messaging_service import init_messaging_db
        init_messaging_db()
        logging.info("Messaging database initialized successfully")
    except Exception as e:
        logging.error(f"Failed to initialize messaging database: {e}")
        # Non-critical, continue startup

    # Initialize favorites database
    try:
        from app.services.favorites_service import init_favorites_db
        init_favorites_db()
        logging.info("Favorites database initialized successfully")
    except Exception as e:
        logging.error(f"Failed to initialize favorites database: {e}")
        # Non-critical, continue startup

    # Initialize services database
    try:
        from app.services.services_service import init_services_db
        init_services_db()
        logging.info("Services database initialized successfully")
    except Exception as e:
        logging.error(f"Failed to initialize services database: {e}")
        # Non-critical, continue startup

    # Try to load predictor to verify model is available
    try:
        from app.services.predictor import Predictor
        predictor = Predictor()
        logging.info("Model loaded successfully at startup")
    except Exception as e:
        logging.error(f"Failed to load model at startup: {e}")

    # Pre-load CLIP model for auto-detection (warmup)
    try:
        from app.services.car_detection_service import warmup_clip_model
        warmup_clip_model()
        logging.info("CLIP model pre-loaded successfully at startup")
    except Exception as e:
        logging.warning(f"Failed to pre-load CLIP model at startup: {e}")
        # Non-critical - model will load on first request instead
        # This is just an optimization to avoid first-request delay

    # Start retraining scheduler (runs in background)
    try:
        from app.services.retrain_scheduler import start_scheduler
        await start_scheduler()
        logging.info("Retraining scheduler started successfully")
    except Exception as e:
        logging.error(f"Failed to start retraining scheduler: {e}")
        # Non-critical, continue startup
        # Don't fail startup, but log the error
        # The health endpoint will report the issue

    logging.info("Application startup complete.")


@app.on_event("shutdown")
async def shutdown_event():
    """Clean up resources on shutdown. Handles CancelledError so Ctrl+C doesn't print tracebacks."""
    try:
        logging.info("Application shutdown initiated...")

        # Stop retraining scheduler
        try:
            from app.services.retrain_scheduler import stop_scheduler
            await stop_scheduler()
            logging.info("Retraining scheduler stopped successfully")
        except asyncio.CancelledError:
            logging.info("Shutdown: scheduler task cancelled")
        except Exception as e:
            logging.warning("Error stopping retraining scheduler: %s", e)

        # Shutdown thread pool executor for PDF generation
        try:
            from app.api.routes.export import shutdown_executor
            shutdown_executor()
        except Exception as e:
            logging.warning("Error shutting down PDF thread pool: %s", e)

        logging.info("Application shutdown complete.")
    except asyncio.CancelledError:
        logging.info("Application shutdown complete (cancelled).")


# Patterns to exclude from reload watcher to prevent restarts from cache, logs,
# DB writes, uploads, model retrain output, etc.
RELOAD_EXCLUDES = [
    "__pycache__",
    "*.pyc",
    "*.pyo",
    "*.log",
    "logs",
    "uploads",
    "data",
    "models",
    "*.db",
    ".git",
    "venv",
    ".venv",
    ".env",
    ".env.*",
]

if __name__ == "__main__":
    # Run with: python -m app.main
    # Or use: python -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
    print(f"Starting server on {settings.HOST}:{settings.PORT}")
    print(f"API will be available at: http://{settings.HOST}:{settings.PORT}")
    print(f"API docs at: http://{settings.HOST}:{settings.PORT}/docs")
    print("Press Ctrl+C to stop the server")
    uvicorn.run(
        "app.main:app",
        host=settings.HOST,
        port=settings.PORT,
        reload=settings.DEBUG,
        reload_excludes=RELOAD_EXCLUDES if settings.DEBUG else None,
        log_level="info",
    )
