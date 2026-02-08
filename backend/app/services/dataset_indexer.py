"""
Dataset Indexing Service
Scans external image folders and creates an index/database of all images
"""

import sqlite3
import logging
from pathlib import Path
from typing import List, Optional, Dict, Tuple
from datetime import datetime
import hashlib
import os
from PIL import Image
import io

from app.config import settings

logger = logging.getLogger(__name__)

# Database file location
DB_PATH = settings.ROOT_DIR / "dataset_index.db"
THUMBNAIL_DIR = settings.ROOT_DIR / "thumbnails"
THUMBNAIL_DIR.mkdir(exist_ok=True)

# Supported image extensions
IMAGE_EXTENSIONS = {'.jpg', '.jpeg', '.png', '.webp', '.gif', '.bmp'}


class DatasetIndexer:
    """Manages indexing of car images from external folders"""

    def __init__(self, db_path: Path = DB_PATH):
        self.db_path = db_path
        self.conn = None
        self._init_database()

    def _init_database(self):
        """Initialize SQLite database with image metadata schema"""
        self.conn = sqlite3.connect(str(self.db_path), check_same_thread=False)
        self.conn.row_factory = sqlite3.Row  # Enable column access by name

        cursor = self.conn.cursor()

        # Create images table
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS images (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                filename TEXT NOT NULL,
                filepath TEXT NOT NULL UNIQUE,
                folder_path TEXT NOT NULL,
                file_size INTEGER,
                width INTEGER,
                height INTEGER,
                file_hash TEXT,
                thumbnail_path TEXT,
                indexed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                last_modified TIMESTAMP
            )
        """)

        # Create indexes separately (SQLite doesn't allow INDEX in CREATE TABLE)
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_filename ON images(filename)")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_folder ON images(folder_path)")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_hash ON images(file_hash)")

        # Create index_status table
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS index_status (
                id INTEGER PRIMARY KEY,
                last_scan_time TIMESTAMP,
                total_images INTEGER,
                scan_duration_seconds REAL,
                status TEXT
            )
        """)

        self.conn.commit()
        logger.info(f"Database initialized at {self.db_path}")

    def _get_file_hash(self, filepath: Path) -> str:
        """Calculate MD5 hash of file"""
        hash_md5 = hashlib.md5()
        try:
            with open(filepath, "rb") as f:
                for chunk in iter(lambda: f.read(4096), b""):
                    hash_md5.update(chunk)
            return hash_md5.hexdigest()
        except Exception as e:
            logger.error(f"Error calculating hash for {filepath}: {e}")
            return ""

    def _get_image_dimensions(self, filepath: Path) -> Tuple[int, int]:
        """Get image width and height"""
        try:
            with Image.open(filepath) as img:
                return img.size  # Returns (width, height)
        except Exception as e:
            logger.warning(f"Could not get dimensions for {filepath}: {e}")
            return (0, 0)

    def _create_thumbnail(self, filepath: Path, max_size: int = 200) -> Optional[str]:
        """Create thumbnail for image"""
        try:
            with Image.open(filepath) as img:
                # Convert to RGB if necessary
                if img.mode in ('RGBA', 'LA', 'P'):
                    background = Image.new('RGB', img.size, (255, 255, 255))
                    if img.mode == 'P':
                        img = img.convert('RGBA')
                    background.paste(img, mask=img.split()[-1] if img.mode in ('RGBA', 'LA') else None)
                    img = background
                elif img.mode != 'RGB':
                    img = img.convert('RGB')

                # Calculate thumbnail size maintaining aspect ratio
                img.thumbnail((max_size, max_size), Image.Resampling.LANCZOS)

                # Save thumbnail
                thumbnail_filename = f"{filepath.stem}_thumb.jpg"
                thumbnail_path = THUMBNAIL_DIR / thumbnail_filename
                img.save(thumbnail_path, 'JPEG', quality=85, optimize=True)

                return str(thumbnail_path.relative_to(settings.ROOT_DIR))
        except Exception as e:
            logger.warning(f"Could not create thumbnail for {filepath}: {e}")
            return None

    def scan_folder(self, folder_path: str, progress_callback=None) -> int:
        """Scan a folder and index all images"""
        folder = Path(folder_path)
        if not folder.exists():
            logger.warning(f"Folder does not exist: {folder_path}")
            return 0

        logger.info(f"Scanning folder: {folder_path}")
        indexed_count = 0
        total_files = sum(1 for _ in folder.rglob('*') if _.suffix.lower() in IMAGE_EXTENSIONS)

        cursor = self.conn.cursor()

        for idx, filepath in enumerate(folder.rglob('*')):
            if filepath.suffix.lower() not in IMAGE_EXTENSIONS:
                continue

            if filepath.is_file():
                try:
                    # Check if already indexed
                    cursor.execute(
                        "SELECT id FROM images WHERE filepath = ?",
                        (str(filepath),)
                    )
                    existing = cursor.fetchone()

                    if existing:
                        # Update if file was modified
                        stat = filepath.stat()
                        cursor.execute(
                            "UPDATE images SET last_modified = ? WHERE filepath = ?",
                            (datetime.fromtimestamp(stat.st_mtime), str(filepath))
                        )
                        continue

                    # Get file metadata
                    stat = filepath.stat()
                    file_size = stat.st_size
                    file_hash = self._get_file_hash(filepath)
                    width, height = self._get_image_dimensions(filepath)
                    thumbnail_path = self._create_thumbnail(filepath)

                    # Insert into database
                    cursor.execute("""
                        INSERT INTO images
                        (filename, filepath, folder_path, file_size, width, height,
                         file_hash, thumbnail_path, last_modified)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                    """, (
                        filepath.name,
                        str(filepath),
                        str(folder_path),
                        file_size,
                        width,
                        height,
                        file_hash,
                        thumbnail_path,
                        datetime.fromtimestamp(stat.st_mtime)
                    ))

                    indexed_count += 1

                    # Progress callback
                    if progress_callback and (idx + 1) % 100 == 0:
                        progress_callback(idx + 1, total_files, filepath.name)

                except Exception as e:
                    logger.error(f"Error indexing {filepath}: {e}")
                    continue

        self.conn.commit()
        logger.info(f"Indexed {indexed_count} images from {folder_path}")
        return indexed_count

    def scan_all_folders(self, progress_callback=None) -> Dict[str, any]:
        """Scan all configured dataset folders"""
        start_time = datetime.now()
        total_indexed = 0

        for folder_path in settings.DATASET_PATHS:
            # Skip if folder doesn't exist
            if not Path(folder_path).exists():
                logger.warning(f"Skipping non-existent folder: {folder_path}")
                continue

            try:
                count = self.scan_folder(folder_path, progress_callback)
                total_indexed += count
            except Exception as e:
                logger.error(f"Error scanning folder {folder_path}: {e}", exc_info=True)

        duration = (datetime.now() - start_time).total_seconds()

        # Update index status
        cursor = self.conn.cursor()
        cursor.execute("""
            INSERT OR REPLACE INTO index_status
            (id, last_scan_time, total_images, scan_duration_seconds, status)
            VALUES (1, ?, ?, ?, 'completed')
        """, (datetime.now(), total_indexed, duration))
        self.conn.commit()

        return {
            "total_indexed": total_indexed,
            "duration_seconds": duration,
            "status": "completed"
        }

    def get_image_count(self) -> int:
        """Get total number of indexed images"""
        cursor = self.conn.cursor()
        cursor.execute("SELECT COUNT(*) as count FROM images")
        result = cursor.fetchone()
        return result['count'] if result else 0

    def get_images(
        self,
        page: int = 1,
        limit: int = 100,
        search: Optional[str] = None,
        folder: Optional[str] = None
    ) -> Tuple[List[Dict], int]:
        """Get paginated list of images with optional search/filter"""
        cursor = self.conn.cursor()
        offset = (page - 1) * limit

        # Build query
        where_clauses = []
        params = []

        if search:
            where_clauses.append("(filename LIKE ? OR folder_path LIKE ?)")
            search_term = f"%{search}%"
            params.extend([search_term, search_term])

        if folder:
            where_clauses.append("folder_path = ?")
            params.append(folder)

        where_sql = " AND ".join(where_clauses) if where_clauses else "1=1"

        # Get total count
        count_query = f"SELECT COUNT(*) as count FROM images WHERE {where_sql}"
        cursor.execute(count_query, params)
        total = cursor.fetchone()['count']

        # Get images
        query = f"""
            SELECT * FROM images
            WHERE {where_sql}
            ORDER BY indexed_at DESC
            LIMIT ? OFFSET ?
        """
        cursor.execute(query, params + [limit, offset])

        images = []
        for row in cursor.fetchall():
            images.append({
                "id": row['id'],
                "filename": row['filename'],
                "filepath": row['filepath'],
                "folder_path": row['folder_path'],
                "file_size": row['file_size'],
                "width": row['width'],
                "height": row['height'],
                "thumbnail_path": row['thumbnail_path'],
                "indexed_at": row['indexed_at'],
            })

        return images, total

    def get_random_images(self, count: int = 10) -> List[Dict]:
        """Get random images from the dataset"""
        cursor = self.conn.cursor()
        cursor.execute("""
            SELECT * FROM images
            ORDER BY RANDOM()
            LIMIT ?
        """, (count,))

        images = []
        for row in cursor.fetchall():
            images.append({
                "id": row['id'],
                "filename": row['filename'],
                "filepath": row['filepath'],
                "folder_path": row['folder_path'],
                "file_size": row['file_size'],
                "width": row['width'],
                "height": row['height'],
                "thumbnail_path": row['thumbnail_path'],
            })

        return images

    def get_image_by_id(self, image_id: int) -> Optional[Dict]:
        """Get image by ID"""
        cursor = self.conn.cursor()
        cursor.execute("SELECT * FROM images WHERE id = ?", (image_id,))
        row = cursor.fetchone()

        if row:
            return {
                "id": row['id'],
                "filename": row['filename'],
                "filepath": row['filepath'],
                "folder_path": row['folder_path'],
                "file_size": row['file_size'],
                "width": row['width'],
                "height": row['height'],
                "thumbnail_path": row['thumbnail_path'],
                "indexed_at": row['indexed_at'],
            }
        return None

    def get_index_status(self) -> Optional[Dict]:
        """Get current index status"""
        cursor = self.conn.cursor()
        cursor.execute("SELECT * FROM index_status WHERE id = 1")
        row = cursor.fetchone()

        if row:
            return {
                "last_scan_time": row['last_scan_time'],
                "total_images": row['total_images'],
                "scan_duration_seconds": row['scan_duration_seconds'],
                "status": row['status'],
            }
        return None

    def close(self):
        """Close database connection"""
        if self.conn:
            self.conn.close()
