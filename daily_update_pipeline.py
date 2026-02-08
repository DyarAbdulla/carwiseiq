"""
Daily Dataset Update Pipeline
Integrates with existing IQCarsScraper for daily price monitoring and comparison
"""

import sys
import os
from pathlib import Path
import pandas as pd
import numpy as np
from datetime import datetime, timedelta
import logging
import schedule
import time
import json

# Add Web Scraping Tool to path
scraper_path = Path(__file__).parent / "Web Scraping Tool"
sys.path.insert(0, str(scraper_path))

try:
    from webscriping import IQCarsScraper
except ImportError:
    logging.error("Could not import IQCarsScraper. Ensure Web Scraping Tool/webscriping.py exists.")
    IQCarsScraper = None

import config

# Setup logging
log_dir = Path(__file__).parent
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler(log_dir / 'daily_update.log', encoding='utf-8'),
        logging.StreamHandler()
    ]
)

logger = logging.getLogger(__name__)


class PriceComparator:
    """Compare and validate prices against historical data"""
    
    def __init__(self, historical_data: pd.DataFrame):
        self.historical_data = historical_data
        self.price_change_threshold = 0.20  # 20% change triggers alert
        
    def compare_temporal_prices(self, make, model, year, current_price):
        """
        Compare current price with historical prices for same vehicle
        Returns: price_change_pct, is_anomaly, confidence_score, historical_mean
        """
        if not all([make, model, year, current_price]):
            return None, False, 0.0, None
            
        # Filter historical data for same make/model/year
        similar_cars = self.historical_data[
            (self.historical_data['make'] == make) &
            (self.historical_data['model'] == model) &
            (self.historical_data['year'] == year)
        ]
        
        if len(similar_cars) == 0:
            return None, False, 0.0, None
        
        # Calculate statistics
        valid_prices = similar_cars['price'].dropna()
        if len(valid_prices) == 0:
            return None, False, 0.0, None
            
        historical_mean = valid_prices.mean()
        historical_std = valid_prices.std()
        historical_median = valid_prices.median()
        
        if historical_mean == 0 or pd.isna(historical_mean):
            return None, False, 0.0, None
        
        price_change_pct = ((current_price - historical_mean) / historical_mean) * 100
        
        # Detect anomalies (prices outside 2 standard deviations)
        is_anomaly = False
        if historical_std > 0 and not pd.isna(historical_std):
            z_score = abs((current_price - historical_mean) / historical_std)
            is_anomaly = z_score > 2
        
        # Also check against median (more robust to outliers)
        if historical_median > 0 and not pd.isna(historical_median):
            median_diff_pct = abs((current_price - historical_median) / historical_median) * 100
            if median_diff_pct > 30:  # More than 30% different from median
                is_anomaly = True
        
        # Confidence based on sample size
        confidence = min(1.0, len(valid_prices) / 50)  # More data = higher confidence
        
        return price_change_pct, is_anomaly, confidence, historical_mean
    
    def compare_market_average(self, car_data, days=30):
        """
        Compare individual car price with market average for similar vehicles
        """
        make = car_data.get('make')
        year = car_data.get('year')
        mileage = car_data.get('mileage', 0)
        price = car_data.get('price', 0)
        
        if not make or not year or not price:
            return None
        
        # Filter for similar cars (same make, similar year, similar mileage)
        similar = self.historical_data[
            (self.historical_data['make'] == make) &
            (self.historical_data['year'] >= year - 2) &
            (self.historical_data['year'] <= year + 2)
        ]
        
        # Filter by mileage if available
        if pd.notna(mileage) and mileage > 0:
            similar = similar[
                (similar['mileage'].notna()) &
                (abs(similar['mileage'] - mileage) <= mileage * 0.4)
            ]
        
        if len(similar) == 0:
            return None
        
        valid_prices = similar['price'].dropna()
        if len(valid_prices) == 0:
            return None
        
        market_avg = valid_prices.mean()
        market_median = valid_prices.median()
        
        if market_avg == 0 or pd.isna(market_avg):
            return None
        
        return {
            'vs_market_avg_pct': ((price - market_avg) / market_avg) * 100,
            'vs_market_median_pct': ((price - market_median) / market_median) * 100 if market_median > 0 else None,
            'market_avg': market_avg,
            'market_median': market_median,
            'sample_size': len(valid_prices)
        }
    
    def validate_price(self, new_listing):
        """
        Comprehensive price validation
        Returns: validation_result dict
        """
        result = {
            'is_valid': True,
            'confidence': 0.0,
            'warnings': [],
            'price_change_pct': 0.0,
            'market_comparison': None,
            'recommendation': 'accept'
        }
        
        make = new_listing.get('make')
        model = new_listing.get('model')
        year = new_listing.get('year')
        price = new_listing.get('price')
        
        # Basic validation
        if not price or price <= 0 or pd.isna(price):
            result['is_valid'] = False
            result['warnings'].append("Price is missing or invalid")
            result['recommendation'] = 'reject'
            return result
        
        if price < 100 or price > 500000:
            result['warnings'].append(f"Price ${price:,.0f} outside reasonable range ($100 - $500,000)")
            result['recommendation'] = 'review'
        
        # Temporal comparison
        if make and model and year:
            pct_change, is_anomaly, confidence, hist_mean = self.compare_temporal_prices(
                make, model, year, price
            )
            
            if pct_change is not None:
                result['price_change_pct'] = pct_change
                result['confidence'] = confidence
                
                if is_anomaly:
                    result['warnings'].append(
                        f"Price anomaly: {pct_change:+.1f}% different from historical average"
                    )
                    if abs(pct_change) > 40:
                        result['recommendation'] = 'reject'
                    elif abs(pct_change) > 30:
                        result['recommendation'] = 'review'
        
        # Market comparison
        market_comp = self.compare_market_average(new_listing)
        if market_comp:
            result['market_comparison'] = market_comp
            
            if abs(market_comp['vs_market_avg_pct']) > 25:
                result['warnings'].append(
                    f"Price {market_comp['vs_market_avg_pct']:+.1f}% different from market average"
                )
                if abs(market_comp['vs_market_avg_pct']) > 40:
                    result['recommendation'] = 'reject'
                elif abs(market_comp['vs_market_avg_pct']) > 30:
                    result['recommendation'] = 'review'
        
        return result


class DailyUpdatePipeline:
    """Main pipeline for daily dataset updates"""
    
    def __init__(self):
        self.scraper = None
        self.comparator = None
        self.existing_data = None
        self.new_listings = []
        self.price_changes = []
        self.anomalies_detected = []
        
    def load_existing_dataset(self):
        """Load current dataset"""
        try:
            data_path = config.CLEANED_DATA_FILE
            if os.path.exists(data_path):
                self.existing_data = pd.read_csv(data_path)
                logger.info(f"Loaded {len(self.existing_data)} existing records")
                
                # Initialize price comparator
                self.comparator = PriceComparator(self.existing_data)
                return True
            else:
                logger.warning(f"Dataset not found at {data_path}")
                return False
        except Exception as e:
            logger.error(f"Error loading dataset: {e}")
            return False
    
    def scrape_new_listings(self, mode='incremental', max_listings=100):
        """
        Scrape new listings from website
        
        Args:
            mode: 'incremental' (new IDs) or 'recent' (recent listings)
            max_listings: Maximum number of listings to scrape
        """
        if IQCarsScraper is None:
            logger.error("IQCarsScraper not available")
            return False
            
        logger.info(f"Starting scrape in {mode} mode (max: {max_listings})")
        
        # Initialize scraper with rate-limiting protection
        # Note: If you get HTTP 429 errors, wait 10-15 minutes before retrying
        # The website may have temporarily rate-limited your IP address
        scraper_config = {
            'delay_between_requests': 10,  # Base delay: 10 seconds (increased for rate limiting)
            'retries': 5,  # More retries for rate limiting
            'delay_on_error': 5,
            'random_delay_min': 8,  # Random delay: 8-20 seconds (increased)
            'random_delay_max': 20,
            'exponential_backoff_base': 2,
            'save_interval': 20  # Save more frequently
        }
        self.scraper = IQCarsScraper(scraper_config)
        
        if mode == 'incremental':
            # Find highest existing listing ID
            if self.existing_data is not None and 'listing_id' in self.existing_data.columns:
                existing_ids = pd.to_numeric(
                    self.existing_data['listing_id'], 
                    errors='coerce'
                ).dropna()
                if len(existing_ids) > 0:
                    start_id = int(existing_ids.max()) + 1
                else:
                    start_id = 850000  # Default start
            else:
                start_id = 850000
            
            end_id = start_id + max_listings
            
            logger.info(f"Scraping IDs {start_id} to {end_id}")
            self.scraper.scrape_by_id_range(start_id, end_id)
        
        elif mode == 'recent':
            # Scrape recent listings
            current_id = 900000  # Adjust based on current website state
            start_id = current_id - max_listings
            end_id = current_id
            
            logger.info(f"Scraping recent IDs {start_id} to {end_id}")
            self.scraper.scrape_by_id_range(start_id, end_id)
        
        self.new_listings = self.scraper.cars_data
        logger.info(f"Scraped {len(self.new_listings)} new listings")
        
        return len(self.new_listings) > 0
    
    def validate_and_compare_prices(self):
        """Validate new listings and compare prices"""
        if not self.comparator:
            logger.error("Price comparator not initialized")
            return [], []
        
        validated_listings = []
        rejected_listings = []
        
        for listing in self.new_listings:
            validation = self.comparator.validate_price(listing)
            
            listing['validation'] = validation
            listing['validation_date'] = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
            
            if validation['recommendation'] == 'reject':
                rejected_listings.append(listing)
                logger.warning(
                    f"Rejected: {listing.get('title', 'Unknown')} - "
                    f"${listing.get('price', 0):,.0f} - "
                    f"Reasons: {', '.join(validation['warnings'])}"
                )
            else:
                validated_listings.append(listing)
                
                # Track anomalies
                if validation['warnings']:
                    self.anomalies_detected.append({
                        'listing': listing,
                        'validation': validation
                    })
                    logger.info(
                        f"Accepted with warnings: {listing.get('title', 'Unknown')} - "
                        f"${listing.get('price', 0):,.0f} - "
                        f"Warnings: {', '.join(validation['warnings'])}"
                    )
        
        logger.info(
            f"Validation complete: {len(validated_listings)} accepted, "
            f"{len(rejected_listings)} rejected, "
            f"{len(self.anomalies_detected)} anomalies detected"
        )
        
        self.new_listings = validated_listings
        return validated_listings, rejected_listings
    
    def merge_with_existing_data(self):
        """Merge new validated listings with existing dataset"""
        if len(self.new_listings) == 0:
            logger.warning("No new listings to merge")
            return self.existing_data
        
        # Convert to DataFrame
        new_df = pd.DataFrame(self.new_listings)
        
        # Ensure scraped_date is set
        if 'scraped_date' not in new_df.columns:
            new_df['scraped_date'] = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
        
        # Extract validation info before removing validation objects
        if 'validation' in new_df.columns:
            new_df['price_change_pct'] = new_df['validation'].apply(
                lambda x: x.get('price_change_pct', None) if isinstance(x, dict) else None
            )
            new_df['validation_confidence'] = new_df['validation'].apply(
                lambda x: x.get('confidence', 0) if isinstance(x, dict) else 0
            )
            new_df = new_df.drop('validation', axis=1)
        
        # Merge with existing data
        if self.existing_data is not None:
            # Remove duplicates based on listing_id or make/model/year/mileage
            if 'listing_id' in new_df.columns and 'listing_id' in self.existing_data.columns:
                # Remove existing listings with same ID
                existing_ids = set(self.existing_data['listing_id'].astype(str))
                new_df = new_df[~new_df['listing_id'].astype(str).isin(existing_ids)]
            
            # Combine datasets
            combined = pd.concat([self.existing_data, new_df], ignore_index=True)
        else:
            combined = new_df
        
        # Remove exact duplicates
        duplicate_cols = ['make', 'model', 'year', 'mileage', 'price']
        if all(col in combined.columns for col in duplicate_cols):
            combined = combined.drop_duplicates(subset=duplicate_cols, keep='last')
        
        logger.info(f"Merged dataset: {len(combined)} total records ({len(new_df)} new)")
        
        return combined
    
    def save_updated_dataset(self, combined_data, backup=True):
        """Save updated dataset"""
        try:
            # Backup existing data
            if backup and self.existing_data is not None and os.path.exists(config.CLEANED_DATA_FILE):
                backup_path = config.CLEANED_DATA_FILE.replace(
                    '.csv', 
                    f'_backup_{datetime.now().strftime("%Y%m%d_%H%M%S")}.csv'
                )
                self.existing_data.to_csv(backup_path, index=False)
                logger.info(f"Backup saved to {backup_path}")
            
            # Save updated dataset
            combined_data.to_csv(config.CLEANED_DATA_FILE, index=False)
            logger.info(f"Updated dataset saved: {len(combined_data)} records")
            
            return True
        except Exception as e:
            logger.error(f"Error saving dataset: {e}")
            return False
    
    def should_retrain_model(self, new_data, old_data):
        """Determine if model should be retrained"""
        if old_data is None or len(old_data) == 0:
            return True
        
        # Retrain if:
        # 1. More than 10% new data
        growth_pct = (len(new_data) - len(old_data)) / len(old_data) * 100
        if growth_pct > 10:
            logger.info(f"Dataset grew by {growth_pct:.1f}% - retraining recommended")
            return True
        
        # 2. Significant price distribution changes
        if 'price' in new_data.columns and 'price' in old_data.columns:
            new_median = new_data['price'].median()
            old_median = old_data['price'].median()
            if old_median > 0:
                median_change = abs((new_median - old_median) / old_median) * 100
                if median_change > 15:
                    logger.info(f"Price median changed by {median_change:.1f}% - retraining recommended")
                    return True
        
        return False
    
    def run_daily_update(self, scrape_mode='incremental', max_listings=100):
        """Main update function"""
        logger.info("="*60)
        logger.info("DAILY DATASET UPDATE STARTED")
        logger.info("="*60)
        
        try:
            # 1. Load existing dataset
            if not self.load_existing_dataset():
                logger.error("Failed to load existing dataset")
                return False
            
            # 2. Scrape new listings
            if not self.scrape_new_listings(mode=scrape_mode, max_listings=max_listings):
                logger.warning("No new listings scraped")
                # Send email notification about failure
                try:
                    from email_alerts import EmailAlertService
                    email_service = EmailAlertService()
                    if email_service.enabled:
                        email_service.send_update_status(
                            'error',
                            "Daily update completed but no new listings were scraped. "
                            "This may be due to rate limiting or no new listings available."
                        )
                        logger.info("Failure notification email sent")
                except Exception as e:
                    logger.warning(f"Could not send failure email: {e}")
                
                # Commit failure status to GitHub if enabled
                if getattr(config, 'AUTO_COMMIT_TO_GITHUB', True):
                    try:
                        from git_auto_commit import git_commit_dataset_update
                        logger.info("Committing failure status to GitHub...")
                        failure_result = {
                            'success': False,
                            'error': 'No new listings scraped',
                            'new_listings': 0,
                            'accepted': 0,
                            'rejected': 0,
                            'anomalies': 0,
                            'total_records': len(self.existing_data) if self.existing_data is not None else 0
                        }
                        git_success = git_commit_dataset_update(failure_result)
                        if git_success:
                            logger.info("Successfully committed failure status to GitHub")
                        else:
                            logger.warning("Git commit/push failed for failure status")
                    except Exception as e:
                        logger.warning(f"Could not commit failure status to GitHub: {e}")
                
                return False
            
            # 3. Validate and compare prices
            validated, rejected = self.validate_and_compare_prices()
            
            # 4. Merge with existing data
            combined_data = self.merge_with_existing_data()
            
            # 5. Save updated dataset
            if not self.save_updated_dataset(combined_data):
                logger.error("Failed to save updated dataset")
                return False
            
            # 6. Check if model retraining is needed
            retrain_needed = self.should_retrain_model(combined_data, self.existing_data)
            if retrain_needed:
                logger.info("Model retraining recommended - run: python model_training.py")
            
            # 7. Summary
            logger.info(f"Update Summary:")
            logger.info(f"  - New listings scraped: {len(self.scraper.cars_data)}")
            logger.info(f"  - Validated and accepted: {len(validated)}")
            logger.info(f"  - Rejected: {len(rejected)}")
            logger.info(f"  - Anomalies detected: {len(self.anomalies_detected)}")
            logger.info(f"  - Total records in dataset: {len(combined_data)}")
            logger.info(f"  - Retrain needed: {retrain_needed}")
            
            logger.info("="*60)
            logger.info("DAILY UPDATE COMPLETED SUCCESSFULLY")
            logger.info("="*60)
            
            result = {
                'success': True,
                'new_listings': len(self.scraper.cars_data),
                'accepted': len(validated),
                'rejected': len(rejected),
                'anomalies': len(self.anomalies_detected),
                'total_records': len(combined_data),
                'retrain_needed': retrain_needed,
                'anomalies_list': self.anomalies_detected
            }
            
            # Send email alerts if enabled (always send, even if no new listings)
            try:
                from email_alerts import send_alerts_for_update
                logger.info("Sending email alerts...")
                send_alerts_for_update(result)
                logger.info("Email alerts sent successfully")
            except Exception as e:
                logger.error(f"Could not send email alerts: {e}", exc_info=True)
                # Try to send a simple status email if the main alert fails
                try:
                    from email_alerts import EmailAlertService
                    email_service = EmailAlertService()
                    if email_service.enabled:
                        email_service.send_update_status(
                            'success' if result.get('success') else 'error',
                            f"Daily update completed. New listings: {result.get('new_listings', 0)}, Accepted: {result.get('accepted', 0)}"
                        )
                except:
                    pass
            
            # Commit and push to GitHub if enabled
            if getattr(config, 'AUTO_COMMIT_TO_GITHUB', True):
                try:
                    from git_auto_commit import git_commit_dataset_update
                    logger.info("Committing and pushing to GitHub...")
                    git_success = git_commit_dataset_update(result)
                    if git_success:
                        logger.info("Successfully pushed updates to GitHub")
                    else:
                        logger.warning("Git commit/push failed, but update completed successfully")
                except ImportError:
                    logger.warning("git_auto_commit module not found. Skipping GitHub push.")
                except Exception as e:
                    logger.error(f"Could not commit/push to GitHub: {e}", exc_info=True)
            
            return result
            
        except Exception as e:
            logger.error(f"Daily update failed: {e}", exc_info=True)
            return {
                'success': False,
                'error': str(e)
            }


def schedule_daily_updates():
    """Schedule daily updates"""
    pipeline = DailyUpdatePipeline()
    
    # Get update time from config or default to 2 AM
    update_time = getattr(config, 'DAILY_UPDATE_TIME', '02:00')
    max_listings = getattr(config, 'DAILY_UPDATE_MAX_LISTINGS', 200)
    update_mode = getattr(config, 'DAILY_UPDATE_MODE', 'incremental')
    
    # Schedule daily
    schedule.every().day.at(update_time).do(
        pipeline.run_daily_update,
        scrape_mode=update_mode,
        max_listings=max_listings
    )
    
    logger.info(f"Daily update scheduler started (runs at {update_time})")
    
    # Keep running
    while True:
        schedule.run_pending()
        time.sleep(60)


if __name__ == "__main__":
    import argparse
    
    parser = argparse.ArgumentParser(description='Daily Dataset Update Pipeline')
    parser.add_argument('--mode', choices=['once', 'schedule'], default='once',
                       help='Run once or schedule daily updates')
    parser.add_argument('--scrape-mode', choices=['incremental', 'recent'], 
                       default='incremental',
                       help='Scraping mode')
    parser.add_argument('--max-listings', type=int, default=100,
                       help='Maximum listings to scrape')
    
    args = parser.parse_args()
    
    if args.mode == 'once':
        pipeline = DailyUpdatePipeline()
        result = pipeline.run_daily_update(
            scrape_mode=args.scrape_mode,
            max_listings=args.max_listings
        )
        if result and isinstance(result, dict) and result.get('success'):
            print(f"\n[SUCCESS] Update successful!")
            print(f"  Accepted: {result['accepted']}")
            print(f"  Rejected: {result['rejected']}")
            print(f"  Anomalies: {result['anomalies']}")
        else:
            error_msg = result.get('error', 'Unknown error') if isinstance(result, dict) else 'No new listings scraped or scraping failed'
            print(f"\n[FAILED] Update failed: {error_msg}")
    else:
        schedule_daily_updates()

