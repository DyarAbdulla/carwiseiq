"""
Test script for auto-detection endpoint
Tests CLIP-based car detection from images
"""

import sys
import os
from pathlib import Path

# Add backend to path
backend_root = Path(__file__).parent.parent
sys.path.insert(0, str(backend_root))

from app.services.car_detection_service import detect_car_from_images
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


def test_auto_detect():
    """Test auto-detection with sample images"""
    
    # Example: test with listing images
    # Replace with actual listing_id or image paths
    listing_id = None
    
    if len(sys.argv) > 1:
        listing_id = int(sys.argv[1])
        logger.info(f"Testing with listing_id: {listing_id}")
        
        # Get images from listing
        from app.services.marketplace_service import get_listing, get_db
        listing = get_listing(listing_id)
        
        if not listing:
            logger.error(f"Listing {listing_id} not found")
            return
        
        # Get image paths
        from app.api.routes.marketplace import UPLOAD_DIR
        upload_dir = Path(UPLOAD_DIR)
        
        conn = get_db()
        cursor = conn.cursor()
        cursor.execute("""
            SELECT file_path, url FROM listing_images 
            WHERE listing_id = ? AND file_path IS NOT NULL
            ORDER BY display_order
        """, (listing_id,))
        image_rows = cursor.fetchall()
        conn.close()
        
        logger.info(f"Found {len(image_rows)} image records in DB")
        logger.info(f"Upload directory: {upload_dir}")
        logger.info(f"Backend root: {backend_root}")
        
        image_paths = []
        for idx, row in enumerate(image_rows):
            raw_path = row['file_path']
            logger.info(f"Image {idx+1}: raw_path={raw_path}")
            
            if raw_path:
                file_path = Path(raw_path)
                
                # Resolve path (same logic as endpoint)
                if not file_path.is_absolute():
                    resolved_path = upload_dir / file_path.name if file_path.name else upload_dir / file_path
                    if not resolved_path.exists():
                        resolved_path = backend_root / file_path
                    file_path = resolved_path
                
                exists = file_path.exists()
                logger.info(f"  -> resolved: {file_path}, exists: {exists}")
                
                if exists:
                    image_paths.append(str(file_path))
        
        logger.info(f"Resolved {len(image_paths)} valid image paths out of {len(image_rows)} records")
        
        if not image_paths:
            logger.error(f"No images found for listing {listing_id}")
            logger.error("Checked paths:")
            for row in image_rows:
                logger.error(f"  - {row['file_path']}")
            return
        
    else:
        # Test with sample image paths (if provided)
        if len(sys.argv) > 2:
            image_paths = sys.argv[2:]
        else:
            logger.error("Usage: python test_auto_detect.py <listing_id> OR python test_auto_detect.py <image_path1> <image_path2> ...")
            return
    
    logger.info(f"Testing detection with {len(image_paths)} images:")
    for img_path in image_paths:
        logger.info(f"  - {img_path}")
    
    # Check labels
    from app.services.car_detection_service import _load_labels_from_dataset
    try:
        labels = _load_labels_from_dataset()
        logger.info(f"Labels loaded: {len(labels['makes'])} makes")
        logger.info(f"Sample makes: {labels['makes'][:10]}")
    except Exception as e:
        logger.error(f"Failed to load labels: {e}", exc_info=True)
        return
    
    # Run detection
    try:
        result = detect_car_from_images(image_paths)
        
        # Print results
        print("\n" + "="*80)
        print("DETECTION RESULTS")
        print("="*80)
        
        best = result.get('best', {})
        topk = result.get('topk', {})
        meta = result.get('meta', {})
        
        print(f"\nStatus: {meta.get('status', 'unknown')}")
        print(f"Device: {meta.get('device', 'unknown')}")
        print(f"Runtime: {meta.get('runtime_ms', 0)}ms")
        print(f"Confidence Level: {meta.get('confidence_level', 'unknown')}")
        print(f"Images Used: {meta.get('num_images', 0)}")
        print(f"Labels Version: {meta.get('labels_version', 'unknown')}")
        
        print("\n--- BEST PREDICTIONS ---")
        if best.get('make'):
            print(f"Make: {best['make']['value']} (confidence: {best['make']['confidence']:.2%})")
        if best.get('model'):
            print(f"Model: {best['model']['value']} (confidence: {best['model']['confidence']:.2%})")
        if best.get('color'):
            print(f"Color: {best['color']['value']} (confidence: {best['color']['confidence']:.2%})")
        if best.get('year'):
            print(f"Year: {best['year']['value']} (confidence: {best['year']['confidence']:.2%})")
        else:
            print("Year: Not detected (low confidence)")
        
        print("\n--- TOP-5 SUGGESTIONS ---")
        print("\nMakes:")
        for item in topk.get('make', [])[:5]:
            print(f"  - {item['value']}: {item['confidence']:.2%}")
        
        print("\nModels:")
        for item in topk.get('model', [])[:5]:
            print(f"  - {item['value']}: {item['confidence']:.2%}")
        
        print("\nColors:")
        for item in topk.get('color', [])[:5]:
            print(f"  - {item['value']}: {item['confidence']:.2%}")
        
        print("\nYears:")
        for item in topk.get('year', [])[:5]:
            print(f"  - {item['value']}: {item['confidence']:.2%}")
        
        print("\n" + "="*80)
        
    except Exception as e:
        logger.error(f"Detection failed: {e}", exc_info=True)
        print(f"\nERROR: {e}")


if __name__ == "__main__":
    test_auto_detect()
