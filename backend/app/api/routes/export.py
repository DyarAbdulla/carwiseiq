"""
Export endpoints for PDF and other formats
"""

from fastapi import APIRouter, HTTPException, Depends
from fastapi.responses import Response
from app.models.schemas import PredictionResponse, CarFeatures
from app.services.pdf_generator import get_pdf_generator
from app.api.routes.auth import get_current_user, UserResponse
from typing import Optional, Dict
from pydantic import BaseModel
import logging
import asyncio
from concurrent.futures import ThreadPoolExecutor

logger = logging.getLogger(__name__)

router = APIRouter()

# Thread pool for PDF generation to avoid blocking the event loop
_executor = None


def get_executor():
    """Get or create thread pool executor"""
    global _executor
    if _executor is None:
        _executor = ThreadPoolExecutor(
            max_workers=2, thread_name_prefix="pdf_gen")
    return _executor


def shutdown_executor():
    """Shutdown thread pool executor gracefully"""
    global _executor
    if _executor is not None:
        try:
            _executor.shutdown(wait=True, timeout=10)
            logger.info("PDF generation thread pool shutdown successfully")
        except Exception as e:
            logger.warning(f"Error shutting down PDF thread pool: {e}")
        finally:
            _executor = None


class PDFExportRequest(BaseModel):
    """Request model for PDF export"""
    prediction_result: Dict  # PredictionResponse as dict
    car_features: Dict  # CarFeatures as dict


@router.post("/export/pdf")
async def export_pdf(
    request: PDFExportRequest,
    current_user: Optional[UserResponse] = Depends(get_current_user)
):
    """
    Generate and download PDF valuation report

    Request body should contain:
    {
        "prediction_result": {
            "predicted_price": 92000,
            "confidence_interval": {...},
            "market_comparison": {...},
            ...
        },
        "car_features": {
            "year": 2021,
            "make": "Rolls Royce",
            "model": "Ghost",
            ...
        }
    }

    Returns PDF file as download
    """
    try:
        logger.info("PDF export request received")

        # Get PDF generator
        pdf_generator = get_pdf_generator()

        # Generate PDF in thread pool to avoid blocking event loop
        try:
            executor = get_executor()
            loop = asyncio.get_event_loop()
            pdf_buffer = await asyncio.wait_for(
                loop.run_in_executor(
                    executor,
                    pdf_generator.generate_pdf,
                    request.prediction_result,
                    request.car_features
                ),
                timeout=60.0  # 60 second timeout for PDF generation
            )
        except asyncio.TimeoutError:
            logger.error("PDF generation timed out after 60 seconds")
            raise HTTPException(
                status_code=504,
                detail="PDF generation timed out. Please try again with fewer images or simpler data."
            )
        except asyncio.CancelledError:
            logger.warning("PDF generation was cancelled")
            raise HTTPException(
                status_code=503,
                detail="PDF generation was cancelled. Please try again."
            )
        except RuntimeError as e:
            if "Event loop is closed" in str(e) or "cannot be called from a running event loop" in str(e):
                logger.warning(f"Event loop issue during PDF generation: {e}")
                raise HTTPException(
                    status_code=503,
                    detail="Server is shutting down. Please try again in a moment."
                )
            raise

        # Generate filename
        make = request.car_features.get('make', 'Car')
        model = request.car_features.get('model', 'Model')
        filename = f"CarWiseIQ-Valuation-{make}-{model}.pdf"

        # Read PDF content
        pdf_content = pdf_buffer.read()

        # Return PDF as response
        return Response(
            content=pdf_content,
            media_type="application/pdf",
            headers={
                "Content-Disposition": f'attachment; filename="{filename}"'
            }
        )

    except ImportError as e:
        logger.error(f"PDF library not available: {e}")
        raise HTTPException(
            status_code=503,
            detail="PDF generation service is not available. Please install xhtml2pdf: pip install xhtml2pdf"
        )
    except HTTPException:
        # Re-raise HTTP exceptions as-is
        raise
    except KeyboardInterrupt:
        logger.warning("PDF export interrupted")
        raise HTTPException(
            status_code=503,
            detail="PDF generation was interrupted. Please try again."
        )
    except Exception as e:
        logger.error(f"Error generating PDF: {e}", exc_info=True)
        # Provide user-friendly error message
        error_detail = str(e)
        if "timeout" in error_detail.lower():
            status_code = 504
        elif "cancelled" in error_detail.lower() or "interrupted" in error_detail.lower():
            status_code = 503
        else:
            status_code = 500

        raise HTTPException(
            status_code=status_code,
            detail=f"Failed to generate PDF: {error_detail}"
        )
