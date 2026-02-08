"""
PDF Generator Service for CarWiseIQ Valuation Reports
Creates professional PDF reports from HTML templates using xhtml2pdf (Windows-compatible)
"""

from app.config import Settings
from jinja2 import Environment, FileSystemLoader, select_autoescape
import os
import sys
import logging
import base64
import requests
import math
import re
import time
from pathlib import Path
from typing import Dict, Optional, List
from datetime import datetime
from io import BytesIO

try:
    from xhtml2pdf import pisa
    XHTML2PDF_AVAILABLE = True
except ImportError:
    XHTML2PDF_AVAILABLE = False
    logging.warning(
        "xhtml2pdf not available. PDF generation will be disabled.")

# WeasyPrint requires GTK/Cairo and often fails on Windows with "could not import
# some external libraries". Skip importing it on Windows so startup is clean and
# we rely on xhtml2pdf (Windows-compatible).
WEASYPRINT_AVAILABLE = False
if sys.platform != "win32":
    try:
        from weasyprint import HTML, CSS
        from weasyprint.text.fonts import FontConfiguration
        WEASYPRINT_AVAILABLE = True
    except (ImportError, OSError):
        WEASYPRINT_AVAILABLE = False


logger = logging.getLogger(__name__)
settings = Settings()


class PDFGenerator:
    """Service for generating professional PDF valuation reports"""

    def __init__(self):
        if not XHTML2PDF_AVAILABLE and not WEASYPRINT_AVAILABLE:
            logger.error(
                "No PDF library available. Please install xhtml2pdf: pip install xhtml2pdf")
            raise ImportError(
                "PDF generation library is required. Install: pip install xhtml2pdf")

        # Setup Jinja2 template environment
        template_dir = Path(__file__).parent.parent / "templates"
        static_dir = Path(__file__).parent.parent / "static"

        # Background image path
        self.background_image_path = None
        # Try to find background image in multiple locations
        possible_bg_paths = [
            Path(__file__).parent.parent.parent /
            "assets" / "behind_background.jpg",
            Path(__file__).parent.parent.parent /
            "assets" / "behind_background.jpeg",
            Path(__file__).parent.parent / "static" / "behind_background.jpg",
            Path(__file__).parent.parent / "static" / "behind_background.jpeg",
        ]
        for bg_path in possible_bg_paths:
            if bg_path.exists():
                self.background_image_path = bg_path
                logger.info(f"Found background image at: {bg_path}")
                break

        self.template_dir = template_dir
        self.static_dir = static_dir

        # Create directories if they don't exist
        template_dir.mkdir(parents=True, exist_ok=True)
        static_dir.mkdir(parents=True, exist_ok=True)

        self.jinja_env = Environment(
            loader=FileSystemLoader(str(template_dir)),
            autoescape=select_autoescape(['html', 'xml'])
        )

        # Determine which PDF engine to use
        self.use_weasyprint = WEASYPRINT_AVAILABLE
        if self.use_weasyprint:
            logger.info(
                "Using WeasyPrint for PDF generation (better CSS support)")
        else:
            logger.info(
                "Using xhtml2pdf for PDF generation (Windows-compatible)")

        logger.info(
            f"PDF Generator initialized. Template dir: {template_dir}, Static dir: {static_dir}")

    def format_currency(self, value: float) -> str:
        """Format currency value with commas and dollar sign"""
        if value is None:
            return "$0"
        return f"${value:,.2f}"

    def get_confidence_percentage(self, confidence_level: Optional[str], confidence_range: Optional[float]) -> int:
        """Convert confidence level to percentage"""
        if confidence_range:
            # Map confidence range to percentage (0-100)
            if confidence_range < 5000:
                return 95
            elif confidence_range < 15000:
                return 75
            elif confidence_range < 30000:
                return 55
            else:
                return 40

        if confidence_level:
            level_map = {
                'high': 95,
                'medium': 75,
                'low': 55
            }
            return level_map.get(confidence_level.lower(), 75)

        return 75  # Default

    def get_clean_image_url(self, image_path_or_url: str) -> str:
        """Get clean image URL without watermarks"""
        if not image_path_or_url:
            return None

        # Remove watermark indicators from URL
        clean_url = image_path_or_url
        # Remove common watermark patterns
        watermark_patterns = [
            '_watermarked',
            '_wm',
            '?watermark=1',
            '&watermark=1',
            '/watermarked/',
            'watermark=true'
        ]
        for pattern in watermark_patterns:
            clean_url = clean_url.replace(pattern, '')

        return clean_url

    def image_to_base64(self, image_path_or_url: str) -> Optional[str]:
        """Convert image path or URL to base64 data URI (clean, no watermarks)"""
        try:
            # Get clean URL without watermarks
            clean_url = self.get_clean_image_url(image_path_or_url)
            if not clean_url:
                return None

            # If it's a URL, fetch it with timeout and size limit for performance
            if clean_url.startswith('http://') or clean_url.startswith('https://'):
                # Use stream=True and limit size for faster downloads
                response = requests.get(
                    clean_url, timeout=5, stream=True, allow_redirects=True)
                if response.status_code == 200:
                    # Limit image size to 5MB for performance
                    max_size = 5 * 1024 * 1024  # 5MB
                    image_data = b''
                    for chunk in response.iter_content(chunk_size=8192):
                        image_data += chunk
                        if len(image_data) > max_size:
                            logger.warning(
                                f"Image too large, skipping: {clean_url}")
                            return None

                    # Detect image type from content-type or URL
                    content_type = response.headers.get(
                        'content-type', 'image/jpeg')
                    if 'png' in content_type.lower() or clean_url.lower().endswith('.png'):
                        mime_type = 'image/png'
                    elif 'jpeg' in content_type.lower() or 'jpg' in content_type.lower() or clean_url.lower().endswith(('.jpg', '.jpeg')):
                        mime_type = 'image/jpeg'
                    else:
                        mime_type = 'image/jpeg'  # Default
                    base64_str = base64.b64encode(image_data).decode('utf-8')
                    return f"data:{mime_type};base64,{base64_str}"
            else:
                # It's a file path
                image_path = Path(clean_url)
                if not image_path.is_absolute():
                    # Try relative to dataset paths
                    for dataset_path in settings.DATASET_PATHS:
                        full_path = Path(dataset_path) / image_path
                        if full_path.exists():
                            image_path = full_path
                            break

                if image_path.exists():
                    with open(image_path, 'rb') as f:
                        image_data = f.read()
                    # Detect MIME type from extension
                    ext = image_path.suffix.lower()
                    if ext == '.png':
                        mime_type = 'image/png'
                    elif ext in ['.jpg', '.jpeg']:
                        mime_type = 'image/jpeg'
                    else:
                        mime_type = 'image/jpeg'  # Default
                    base64_str = base64.b64encode(image_data).decode('utf-8')
                    return f"data:{mime_type};base64,{base64_str}"
        except Exception as e:
            logger.warning(
                f"Failed to convert image to base64: {image_path_or_url}, error: {e}")
            return None

    def prepare_template_data(
        self,
        prediction_result: Dict,
        car_features: Dict
    ) -> Dict:
        """Prepare data for template rendering"""

        # Format dates
        now = datetime.now()
        generated_date = now.strftime("%B %d, %Y")
        generated_time = now.strftime("%I:%M %p")

        # Vehicle information
        vehicle_name = f"{car_features.get('year', 'N/A')} {car_features.get('make', '')} {car_features.get('model', '')}"
        trim = car_features.get('trim')
        if trim and trim.lower() in ['__none__', 'none', '']:
            trim = None

        # Format prices
        predicted_price = self.format_currency(
            prediction_result.get('predicted_price', 0))

        # Confidence interval
        confidence_interval = None
        if prediction_result.get('confidence_interval'):
            ci = prediction_result['confidence_interval']
            confidence_interval = {
                'lower': self.format_currency(ci.get('lower', 0)),
                'upper': self.format_currency(ci.get('upper', 0))
            }

        # Confidence percentage
        confidence_percentage = self.get_confidence_percentage(
            prediction_result.get('confidence_level'),
            prediction_result.get('confidence_range')
        )

        # Market comparison
        market_comparison = None
        if prediction_result.get('market_comparison'):
            try:
                mc = prediction_result['market_comparison']
                if not isinstance(mc, dict):
                    mc = {}
                percentage_diff = mc.get('percentage_difference', 0) or 0
                market_avg = mc.get('market_average', 0) or 0
                your_price = prediction_result.get('predicted_price', 0) or 0

                # Format percentage with sign and one decimal place
                percentage_formatted = f"{percentage_diff:+.1f}"

                # Calculate percentages for bar chart (normalize to 0-100)
                max_price = max(your_price, market_avg) if market_avg > 0 else (
                    your_price if your_price > 0 else 1)
                your_car_percentage = (
                    your_price / max_price * 100) if max_price > 0 else 0
                market_percentage = (
                    market_avg / max_price * 100) if max_price > 0 else 0

                market_comparison = {
                    'market_average': self.format_currency(market_avg),
                    'market_average_raw': market_avg,
                    'your_car_price': self.format_currency(your_price),
                    'your_car_price_raw': your_price,
                    'percentage_difference': percentage_diff,
                    'percentage_difference_formatted': percentage_formatted,
                    'your_car_percentage': min(100, max(10, your_car_percentage)),
                    'market_percentage': min(100, max(10, market_percentage))
                }
            except Exception as e:
                logger.warning(f"Error processing market comparison: {e}")
                market_comparison = None

        # Deal score
        deal_score = None
        if prediction_result.get('deal_score'):
            try:
                ds = prediction_result['deal_score']
                if isinstance(ds, dict):
                    deal_score = {
                        'score': ds.get('score', 'fair'),
                        'label': ds.get('label', 'Fair')
                    }
            except Exception as e:
                logger.warning(f"Error processing deal score: {e}")
                deal_score = None

        # Similar cars
        similar_cars = None
        if prediction_result.get('similar_cars'):
            similar_cars = []
            try:
                cars_list = prediction_result['similar_cars']
                if not isinstance(cars_list, list):
                    cars_list = []
                for car in cars_list[:6]:  # Limit to 6
                    try:
                        if not isinstance(car, dict):
                            continue
                        price_col = car.get('price') or car.get(
                            'predicted_price') or 0
                        # Get image from multiple possible fields
                        image_url = car.get('image_url') or car.get(
                            'preview_image') or car.get('image_path') or None
                        similar_cars.append({
                            'year': car.get('year', 'N/A'),
                            'make': car.get('make', ''),
                            'model': car.get('model', ''),
                            'price': self.format_currency(price_col),
                            'image_url': image_url,
                            # Keep for fallback
                            'preview_image': car.get('preview_image')
                        })
                    except Exception as e:
                        logger.warning(f"Error processing similar car: {e}")
                        continue
            except Exception as e:
                logger.warning(f"Error processing similar cars list: {e}")
                similar_cars = []

        # Car image - use processed image with background removed if available
        car_image = None
        processed_car_image = prediction_result.get('processed_car_image')
        background_image = prediction_result.get('background_image')

        # Priority 1: Use processed car image (background removed) if available
        if processed_car_image and processed_car_image.startswith('data:'):
            car_image = processed_car_image
            logger.info("✅ Using processed car image (background removed)")
        # Priority 2: Use original car image from frontend
        elif prediction_result.get('original_car_image') and prediction_result['original_car_image'].startswith('data:'):
            car_image = prediction_result['original_car_image']
            logger.info("✅ Using original car image from frontend")
        # Priority 3: prediction_result car_image_path
        elif prediction_result.get('car_image_path'):
            logger.debug(
                f"Trying car_image_path: {prediction_result.get('car_image_path')[:50]}...")
            car_image = self.image_to_base64(
                prediction_result['car_image_path'])
            if car_image:
                logger.info("✅ Car image loaded from car_image_path")
        # Priority 4: prediction_result preview_image
        elif prediction_result.get('preview_image'):
            logger.debug(
                f"Trying preview_image from prediction_result: {prediction_result.get('preview_image')[:50]}...")
            car_image = self.image_to_base64(
                prediction_result['preview_image'])
            if car_image:
                logger.info(
                    "✅ Car image loaded from prediction_result preview_image")
        # Priority 5: car_features preview_image
        elif car_features.get('preview_image'):
            logger.debug(
                f"Trying preview_image from car_features: {car_features.get('preview_image')[:50]}...")
            car_image = self.image_to_base64(car_features['preview_image'])
            if car_image:
                logger.info(
                    "✅ Car image loaded from car_features preview_image")
        # Priority 6: First similar car image (after they're processed)
        elif similar_cars and len(similar_cars) > 0:
            first_car = similar_cars[0]
            if first_car.get('image_url'):
                logger.debug("Trying first similar car image")
                # If it's already base64 (from processing above), use it directly
                if first_car['image_url'].startswith('data:'):
                    car_image = first_car['image_url']
                    logger.info(
                        "✅ Car image loaded from first similar car (already base64)")
                else:
                    car_image = self.image_to_base64(first_car['image_url'])
                    if car_image:
                        logger.info(
                            "✅ Car image loaded from first similar car")

        if not car_image:
            logger.warning("⚠️ No car image found from any source")

        # Use background image from frontend if provided, otherwise try local
        if not background_image or not background_image.startswith('data:'):
            # Fallback to local background image
            if self.background_image_path and self.background_image_path.exists():
                background_image = self.image_to_base64(
                    str(self.background_image_path))
                logger.info("✅ Using local background image")
            else:
                background_image = None
        else:
            logger.info("✅ Using background image from frontend")

        # Convert similar car images to base64 (ensure ALL images are converted)
        if similar_cars:
            logger.info(f"Processing {len(similar_cars)} similar cars for PDF")
            for idx, car in enumerate(similar_cars):
                try:
                    image_url = car.get('image_url')
                    if image_url:
                        # Convert to base64 if not already a data URI
                        if not image_url.startswith('data:'):
                            logger.debug(
                                f"Converting similar car {idx+1} image: {image_url[:50]}...")
                            converted = self.image_to_base64(image_url)
                            if converted:
                                car['image_url'] = converted
                                logger.debug(
                                    f"✅ Similar car {idx+1} image converted successfully")
                            else:
                                # If conversion fails, try preview_image as fallback
                                logger.warning(
                                    f"⚠️ Failed to convert similar car {idx+1} image_url, trying preview_image")
                                if car.get('preview_image'):
                                    preview = car.get('preview_image')
                                    if preview and not preview.startswith('data:'):
                                        converted = self.image_to_base64(
                                            preview)
                                        if converted:
                                            car['image_url'] = converted
                                            logger.debug(
                                                f"✅ Similar car {idx+1} image converted from preview_image")
                                        else:
                                            car['image_url'] = None
                                    else:
                                        car['image_url'] = None
                                else:
                                    car['image_url'] = None
                        # If already base64, keep it
                        else:
                            logger.debug(
                                f"Similar car {idx+1} image already in base64 format")
                    # Also check preview_image field if image_url is missing
                    elif car.get('preview_image'):
                        preview = car.get('preview_image')
                        if preview and not preview.startswith('data:'):
                            logger.debug(
                                f"Converting similar car {idx+1} preview_image: {preview[:50]}...")
                            converted = self.image_to_base64(preview)
                            if converted:
                                car['image_url'] = converted
                                logger.debug(
                                    f"✅ Similar car {idx+1} image converted from preview_image")
                            else:
                                car['image_url'] = None
                                logger.warning(
                                    f"⚠️ Failed to convert similar car {idx+1} preview_image")
                    else:
                        logger.warning(
                            f"⚠️ Similar car {idx+1} has no image_url or preview_image")
                        car['image_url'] = None
                except Exception as e:
                    logger.error(
                        f"Error processing similar car {idx+1} image: {e}")
                    car['image_url'] = None

        # Calculate confidence angle for semi-circle gauge (0-180 degrees)
        # Calculate SVG path coordinates for semi-circle arc
        try:
            confidence_angle_deg = 180 * (confidence_percentage / 100)
            # Convert to radians for calculation
            angle_rad = math.radians(confidence_angle_deg)
            # SVG arc coordinates (center at 100, 80, radius 80)
            # Start at (20, 80), end point based on angle
            end_x = 20 + (160 * (confidence_angle_deg / 180))
            end_y = 80 - (80 * math.sin(angle_rad))
            confidence_angle = confidence_angle_deg
            confidence_svg_end_x = round(end_x, 2)
            confidence_svg_end_y = round(end_y, 2)
        except Exception as e:
            logger.warning(
                f"Error calculating confidence SVG coordinates: {e}")
            # Default values
            confidence_angle = 90
            confidence_svg_end_x = 100
            confidence_svg_end_y = 0

        # Prepare impact data (if available from price_factors)
        price_factors = prediction_result.get('price_factors', [])
        impact_data = []
        if price_factors:
            for factor in price_factors[:4]:  # Top 4 factors
                try:
                    impact_value = factor.get(
                        'impact', 0) if isinstance(factor, dict) else 0
                    factor_name = factor.get('factor', 'Unknown') if isinstance(
                        factor, dict) else str(factor)
                    impact_data.append({
                        'label': factor_name,
                        'value': f"{impact_value:+.1f}%",
                        'class': 'positive' if impact_value > 0 else 'negative',
                        'icon': '📊'
                    })
                except Exception as e:
                    logger.warning(f"Error processing price factor: {e}")
                    continue

        # Background image already processed above

        # Generate certificate number
        import hashlib
        cert_data = f"{vehicle_name}{generated_date}{predicted_price}"
        cert_hash = hashlib.md5(cert_data.encode()).hexdigest()[:8].upper()
        certificate_number = f"CWI-{cert_hash}"

        return {
            'generated_date': generated_date,
            'generated_time': generated_time,
            'vehicle_name': vehicle_name,
            'trim': trim,
            'mileage': car_features.get('mileage', 0),
            'condition': car_features.get('condition', 'Good'),
            'location': car_features.get('location', 'N/A'),
            'fuel_type': car_features.get('fuel_type', 'N/A'),
            'car_image': car_image,
            'background_image': background_image,
            'predicted_price': predicted_price,
            'predicted_price_raw': prediction_result.get('predicted_price', 0),
            'confidence_interval': confidence_interval,
            'confidence_percentage': confidence_percentage,
            'confidence_angle': confidence_angle,
            'confidence_svg_end_x': confidence_svg_end_x,
            'confidence_svg_end_y': confidence_svg_end_y,
            'market_comparison': market_comparison,
            'deal_score': deal_score,
            'similar_cars': similar_cars,  # Not used in template but kept for compatibility
            'impact_data': impact_data,  # Not used in template but kept for compatibility
            'car_features': car_features,  # Pass full car_features for VIN and other fields
            'certificate_number': certificate_number  # Certificate number for verification
        }

    def generate_pdf_weasyprint(self, html_content: str, css_content: Optional[str]) -> BytesIO:
        """Generate PDF using WeasyPrint (better CSS support)"""
        pdf_buffer = BytesIO()
        font_config = FontConfiguration()
        base_url = str(self.template_dir)

        html_doc = HTML(string=html_content, base_url=base_url)
        stylesheets = []
        if css_content:
            stylesheets.append(
                CSS(string=css_content, font_config=font_config))

        html_doc.write_pdf(pdf_buffer, stylesheets=stylesheets,
                           font_config=font_config)
        pdf_buffer.seek(0)
        return pdf_buffer

    def preprocess_css_for_xhtml2pdf(self, css_content: str) -> str:
        """
        DEPRECATED: This function is no longer used.
        We now use pdf_styles.css which is already xhtml2pdf-safe.
        Preprocess CSS to remove features xhtml2pdf doesn't support
        """
        if not css_content:
            return ''

        # Remove unsupported features - be careful not to break CSS syntax
        processed_css = css_content

        # CRITICAL: Remove pseudo-selectors that xhtml2pdf cannot parse
        # Use more careful regex that matches complete rules
        # Match selector with pseudo-class followed by complete rule block
        processed_css = re.sub(
            r'[^{]*:last-child[^{]*\{[^}]*\}', '', processed_css, flags=re.MULTILINE)
        processed_css = re.sub(
            r'[^{]*:first-child[^{]*\{[^}]*\}', '', processed_css, flags=re.MULTILINE)
        processed_css = re.sub(
            r'[^{]*:nth-child\([^)]+\)[^{]*\{[^}]*\}', '', processed_css, flags=re.MULTILINE)

        # Remove :not() pseudo-selectors (most problematic) - remove from selector only
        processed_css = re.sub(r':not\([^)]+\)', '', processed_css)

        # Remove :before and :after pseudo-elements with their complete rule blocks
        processed_css = re.sub(
            r'[^{]*::before[^{]*\{[^}]*\}', '', processed_css, flags=re.MULTILINE)
        processed_css = re.sub(
            r'[^{]*::after[^{]*\{[^}]*\}', '', processed_css, flags=re.MULTILINE)
        processed_css = re.sub(
            r'[^{]*:before[^{]*\{[^}]*\}', '', processed_css, flags=re.MULTILINE)
        processed_css = re.sub(
            r'[^{]*:after[^{]*\{[^}]*\}', '', processed_css, flags=re.MULTILINE)

        # Remove content property (used with :before/:after) - be very careful
        # Only remove if it's a complete property declaration
        processed_css = re.sub(r'content:\s*[^;]+;', '', processed_css)

        # Remove any remaining CSS variables (shouldn't be any, but just in case)
        processed_css = re.sub(r'var\([^)]+\)', '#000000', processed_css)

        # CRITICAL: Remove calc() functions - xhtml2pdf cannot parse them
        # Replace calc() with fixed values or remove the property
        # Be careful to match complete property declarations only
        processed_css = re.sub(
            r'height:\s*calc\([^)]+\)\s*;', '', processed_css)
        processed_css = re.sub(
            r'width:\s*calc\([^)]+\)\s*;', '', processed_css)
        processed_css = re.sub(
            r'margin:\s*calc\([^)]+\)\s*;', '', processed_css)
        processed_css = re.sub(
            r'padding:\s*calc\([^)]+\)\s*;', '', processed_css)
        # Remove any remaining calc() but preserve the property name
        processed_css = re.sub(r'calc\([^)]+\)', '0', processed_css)

        # Remove backdrop-filter (not supported) - match complete property
        processed_css = re.sub(
            r'backdrop-filter:\s*[^;]+\s*;', '', processed_css)

        # Remove -webkit- prefixes that might cause issues - match complete properties
        processed_css = re.sub(
            r'-webkit-background-clip:\s*[^;]+\s*;', '', processed_css)
        processed_css = re.sub(
            r'-webkit-text-fill-color:\s*[^;]+\s*;', '', processed_css)
        processed_css = re.sub(
            r'-webkit-font-smoothing:\s*[^;]+\s*;', '', processed_css)
        processed_css = re.sub(
            r'-moz-osx-font-smoothing:\s*[^;]+\s*;', '', processed_css)

        # Simplify transitions (xhtml2pdf doesn't animate) - match complete property
        processed_css = re.sub(r'transition:\s*[^;]+\s*;', '', processed_css)

        # Remove object-fit (xhtml2pdf doesn't support it well) - match complete property
        processed_css = re.sub(r'object-fit:\s*[^;]+\s*;', '', processed_css)

        # Remove grid-template-columns and gap (use alternatives) - match complete properties
        processed_css = re.sub(
            r'grid-template-columns:\s*[^;]+\s*;', '', processed_css)
        processed_css = re.sub(r'gap:\s*[^;]+\s*;', '', processed_css)

        # Remove flexbox properties (xhtml2pdf has limited support) - match complete properties
        processed_css = re.sub(r'display:\s*flex\s*;',
                               'display: table;', processed_css)
        processed_css = re.sub(r'flex:\s*[^;]+\s*;', '', processed_css)
        processed_css = re.sub(
            r'flex-direction:\s*[^;]+\s*;', '', processed_css)
        processed_css = re.sub(r'flex-shrink:\s*[^;]+\s*;', '', processed_css)
        processed_css = re.sub(r'flex-grow:\s*[^;]+\s*;', '', processed_css)
        processed_css = re.sub(
            r'justify-content:\s*[^;]+\s*;', '', processed_css)
        processed_css = re.sub(r'align-items:\s*[^;]+\s*;', '', processed_css)
        processed_css = re.sub(r'align-self:\s*[^;]+\s*;', '', processed_css)

        # Remove grid display - match complete property
        processed_css = re.sub(r'display:\s*grid\s*;',
                               'display: table;', processed_css)

        # Remove transform properties that might cause issues - match complete properties
        processed_css = re.sub(r'transform:\s*[^;]+\s*;', '', processed_css)
        processed_css = re.sub(
            r'transform-origin:\s*[^;]+\s*;', '', processed_css)

        # Clean up: Remove empty lines and multiple consecutive newlines
        processed_css = re.sub(r'\n\s*\n\s*\n+', '\n\n', processed_css)

        # Validate: Ensure braces are balanced
        open_braces = processed_css.count('{')
        close_braces = processed_css.count('}')
        if open_braces != close_braces:
            logger.warning(
                f"CSS brace mismatch after preprocessing: {open_braces} open, {close_braces} close")
            # Try to fix by removing incomplete rules
            # This is a fallback - ideally the regex above should not break rules

        return processed_css

    def generate_pdf_xhtml2pdf(self, html_content: str) -> BytesIO:
        """Generate PDF using xhtml2pdf (Windows-compatible, limited CSS)"""
        pdf_buffer = BytesIO()

        # xhtml2pdf uses pisa to convert HTML to PDF
        # Set page size to A4 and enforce single page
        result = pisa.CreatePDF(
            src=BytesIO(html_content.encode('utf-8')),
            dest=pdf_buffer,
            encoding='utf-8',
            show_error_as_pdf=False,  # Don't generate error PDF, just raise exception
            link_callback=None  # No external links
        )

        if result.err:
            error_msg = str(result.err)
            logger.error(f"xhtml2pdf error details: {error_msg}")
            # Try to extract more details from the error
            if hasattr(result, 'warn') and result.warn:
                logger.error(f"xhtml2pdf warnings: {result.warn}")
            raise Exception(f"xhtml2pdf error: {error_msg}")

        pdf_buffer.seek(0)
        return pdf_buffer

    def generate_pdf(
        self,
        prediction_result: Dict,
        car_features: Dict
    ) -> BytesIO:
        """
        Generate PDF report from prediction result and car features

        Args:
            prediction_result: Prediction response dictionary
            car_features: Car features dictionary

        Returns:
            BytesIO object containing PDF data

        Raises:
            Exception: If PDF generation fails
        """
        try:
            logger.info("Starting PDF generation...")
            # Prepare template data
            template_data = self.prepare_template_data(
                prediction_result, car_features)

            # Load PDF-specific CSS (xhtml2pdf-safe, no preprocessing needed)
            css_path = self.static_dir / "pdf_styles.css"
            css_content = None
            if css_path.exists():
                with open(css_path, 'r', encoding='utf-8') as f:
                    css_content = f.read()
                logger.info(
                    f"Loaded PDF CSS from {css_path} ({len(css_content)} chars)")
            else:
                logger.warning(
                    f"PDF CSS file not found at {css_path}, using empty CSS")
                css_content = ''

            # NO CSS PREPROCESSING - use clean PDF CSS directly
            # Inject CSS into HTML template
            template_data['css_content'] = css_content or ''

            # Load and render HTML template
            template = self.jinja_env.get_template('valuation_report.html')
            html_content = template.render(**template_data)

            # Generate PDF using available engine
            if self.use_weasyprint:
                pdf_buffer = self.generate_pdf_weasyprint(
                    html_content, css_content)
            else:
                pdf_buffer = self.generate_pdf_xhtml2pdf(html_content)

            logger.info("PDF generated successfully")
            return pdf_buffer

        except KeyboardInterrupt:
            logger.warning("PDF generation interrupted by user")
            raise
        except Exception as e:
            logger.error(f"Error generating PDF: {e}", exc_info=True)
            error_msg = str(e)

            # Write final CSS to temp file for debugging if CSS error
            if "Declaration group closing" in error_msg or "CSSParseError" in error_msg or "CSS" in error_msg:
                try:
                    import tempfile
                    import os
                    temp_dir = tempfile.gettempdir()
                    debug_css_path = os.path.join(
                        temp_dir, f"pdf_debug_css_{int(time.time())}.css")
                    with open(debug_css_path, 'w', encoding='utf-8') as f:
                        f.write(template_data.get(
                            'css_content', 'NO CSS CONTENT'))
                    logger.error(
                        f"DEBUG: Final CSS written to {debug_css_path} for inspection")
                except Exception as debug_err:
                    logger.warning(
                        f"Could not write debug CSS file: {debug_err}")

            # Provide helpful error message
            if "Declaration group closing" in error_msg or "CSSParseError" in error_msg:
                logger.error(
                    "CSS parsing error detected. Check the debug CSS file written to temp directory.")
                raise Exception(
                    f"PDF generation failed: CSS parsing error. Debug CSS saved to temp directory. Original error: {error_msg}")
            elif "Invalid color value" in error_msg:
                raise Exception(
                    "PDF generation failed: CSS contains unsupported color values. Please check CSS compatibility.")
            elif "xhtml2pdf" in error_msg.lower() or "pisa" in error_msg.lower():
                raise Exception(f"PDF generation failed: {error_msg}")
            else:
                raise Exception(f"PDF generation failed: {error_msg}")

    def generate_pdf_to_file(
        self,
        prediction_result: Dict,
        car_features: Dict,
        output_path: str
    ) -> str:
        """
        Generate PDF and save to file

        Args:
            prediction_result: Prediction response dictionary
            car_features: Car features dictionary
            output_path: Path to save PDF file

        Returns:
            Path to saved PDF file
        """
        pdf_buffer = self.generate_pdf(prediction_result, car_features)

        with open(output_path, 'wb') as f:
            f.write(pdf_buffer.read())

        logger.info(f"PDF saved to {output_path}")
        return output_path


# Singleton instance
_pdf_generator_instance: Optional[PDFGenerator] = None


def get_pdf_generator() -> PDFGenerator:
    """Get or create PDF generator instance"""
    global _pdf_generator_instance

    if _pdf_generator_instance is None:
        if not XHTML2PDF_AVAILABLE and not WEASYPRINT_AVAILABLE:
            raise ImportError(
                "No PDF generation library is installed. "
                "Please install xhtml2pdf: pip install xhtml2pdf"
            )
        _pdf_generator_instance = PDFGenerator()

    return _pdf_generator_instance
