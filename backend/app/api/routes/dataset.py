"""
Dataset Management API
Endpoints for browsing and searching the indexed car image dataset
"""

from fastapi import APIRouter, HTTPException, Query, BackgroundTasks
from fastapi.responses import FileResponse
from typing import Optional, List
from pathlib import Path
import logging

from app.services.dataset_indexer import DatasetIndexer, DB_PATH
from app.config import settings

logger = logging.getLogger(__name__)

router = APIRouter()

# Lazy initialization of indexer to avoid errors on module import
_indexer_instance = None

def get_indexer():
    """Get or create DatasetIndexer instance"""
    global _indexer_instance
    if _indexer_instance is None:
        try:
            _indexer_instance = DatasetIndexer(DB_PATH)
        except Exception as e:
            logger.error(f"Failed to initialize DatasetIndexer: {e}")
            raise
    return _indexer_instance


@router.post("/scan")
async def scan_dataset(background_tasks: BackgroundTasks):
    """
    Scan and index all images from configured dataset folders
    This is a long-running operation, runs in background
    """
    try:
        # Get indexer instance
        indexer = get_indexer()

        # Verify at least one dataset path exists
        existing_paths = [path for path in settings.DATASET_PATHS if Path(path).exists()]
        missing_paths = [path for path in settings.DATASET_PATHS if not Path(path).exists()]

        if not existing_paths:
            raise HTTPException(
                status_code=400,
                detail=f"None of the configured dataset paths exist. Checked: {', '.join(settings.DATASET_PATHS)}"
            )

        if missing_paths:
            logger.warning(f"Some dataset paths do not exist (will be skipped): {', '.join(missing_paths)}")

        # Run scan in background
        def run_scan():
            try:
                indexer_instance = get_indexer()
                result = indexer_instance.scan_all_folders()
                logger.info(f"Scan completed: {result}")
            except Exception as e:
                logger.error(f"Error during background scan: {e}", exc_info=True)

        background_tasks.add_task(run_scan)

        return {
            "status": "started",
            "message": "Dataset scan started in background. Check /api/dataset/status for progress.",
            "paths": settings.DATASET_PATHS
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error starting scan: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to start scan: {str(e)}")


@router.get("/status")
async def get_index_status():
    """Get current indexing status"""
    try:
        indexer = get_indexer()
        status = indexer.get_index_status()
        total_count = indexer.get_image_count()

        return {
            "status": status,
            "total_images": total_count,
            "configured_paths": settings.DATASET_PATHS
        }
    except Exception as e:
        logger.error(f"Error getting status: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/images")
async def get_images(
    page: int = Query(1, ge=1, description="Page number"),
    limit: int = Query(100, ge=1, le=500, description="Items per page"),
    search: Optional[str] = Query(None, description="Search term (filename or folder)"),
    folder: Optional[str] = Query(None, description="Filter by folder path")
):
    """
    Get paginated list of images with optional search/filter
    Returns: { images: [...], total: int, page: int, limit: int, total_pages: int }
    """
    try:
        indexer = get_indexer()
        images, total = indexer.get_images(page=page, limit=limit, search=search, folder=folder)
        total_pages = (total + limit - 1) // limit

        return {
            "images": images,
            "total": total,
            "page": page,
            "limit": limit,
            "total_pages": total_pages
        }
    except Exception as e:
        logger.error(f"Error getting images: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/images/{image_id}")
async def get_image(image_id: int):
    """Get specific image by ID"""
    try:
        indexer = get_indexer()
        image = indexer.get_image_by_id(image_id)
        if not image:
            raise HTTPException(status_code=404, detail="Image not found")
        return image
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting image {image_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/images/{image_id}/file")
async def get_image_file(image_id: int):
    """Serve the actual image file"""
    try:
        indexer = get_indexer()
        image = indexer.get_image_by_id(image_id)
        if not image:
            raise HTTPException(status_code=404, detail="Image not found")

        filepath = Path(image['filepath'])
        if not filepath.exists():
            raise HTTPException(status_code=404, detail="Image file not found on disk")

        return FileResponse(
            path=str(filepath),
            media_type="image/jpeg",
            filename=image['filename'],
            headers={
                "Cache-Control": "public, max-age=31536000, immutable",
            }
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error serving image {image_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/images/{image_id}/thumbnail")
async def get_image_thumbnail(image_id: int):
    """Serve the thumbnail for an image"""
    try:
        indexer = get_indexer()
        image = indexer.get_image_by_id(image_id)
        if not image:
            raise HTTPException(status_code=404, detail="Image not found")

        if not image.get('thumbnail_path'):
            # Fallback to full image if no thumbnail
            return await get_image_file(image_id)

        thumbnail_path = settings.ROOT_DIR / image['thumbnail_path']
        if not thumbnail_path.exists():
            raise HTTPException(status_code=404, detail="Thumbnail not found")

        return FileResponse(
            path=str(thumbnail_path),
            media_type="image/jpeg",
            headers={
                "Cache-Control": "public, max-age=31536000, immutable",
            }
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error serving thumbnail {image_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/search")
async def search_images(
    query: str = Query(..., description="Search query"),
    page: int = Query(1, ge=1),
    limit: int = Query(100, ge=1, le=500)
):
    """Search images by filename or folder path"""
    try:
        indexer = get_indexer()
        images, total = indexer.get_images(page=page, limit=limit, search=query)
        total_pages = (total + limit - 1) // limit

        return {
            "images": images,
            "total": total,
            "page": page,
            "limit": limit,
            "total_pages": total_pages,
            "query": query
        }
    except Exception as e:
        logger.error(f"Error searching images: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/random")
async def get_random_images(count: int = Query(10, ge=1, le=100)):
    """Get random images from the dataset"""
    try:
        indexer = get_indexer()
        images = indexer.get_random_images(count)
        return {
            "images": images,
            "count": len(images)
        }
    except Exception as e:
        logger.error(f"Error getting random images: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/folders")
async def get_folders():
    """Get list of all indexed folders"""
    try:
        indexer = get_indexer()
        cursor = indexer.conn.cursor()
        cursor.execute("SELECT DISTINCT folder_path FROM images ORDER BY folder_path")
        folders = [row['folder_path'] for row in cursor.fetchall()]

        return {
            "folders": folders,
            "count": len(folders)
        }
    except Exception as e:
        logger.error(f"Error getting folders: {e}")
        raise HTTPException(status_code=500, detail=str(e))
