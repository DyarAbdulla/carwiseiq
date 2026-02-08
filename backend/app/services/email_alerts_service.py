"""
Email alerts service for saved searches and price drops
Note: Requires SMTP configuration to actually send emails
"""
import logging
from typing import List, Dict, Optional
from datetime import datetime, timedelta
import json

from app.services.favorites_service import get_saved_searches, get_notification_settings
from app.services.marketplace_service import search_listings
from app.services.auth_service import get_user_by_id

logger = logging.getLogger(__name__)


def check_saved_search_matches(user_id: int, search_id: int) -> List[Dict]:
    """
    Check if there are new listings matching a saved search
    Returns list of new matching listings
    """
    try:
        searches = get_saved_searches(user_id)
        search = next((s for s in searches if s['id'] == search_id), None)
        
        if not search or not search.get('email_alerts'):
            return []
        
        filters = search.get('filters', {})
        
        # Convert saved search filters to marketplace search filters
        marketplace_filters = {}
        if filters.get('min_price'):
            marketplace_filters['min_price'] = filters['min_price']
        if filters.get('max_price'):
            marketplace_filters['max_price'] = filters['max_price']
        if filters.get('make'):
            marketplace_filters['makes'] = [filters['make']]
        if filters.get('model'):
            marketplace_filters['models'] = [filters['model']]
        if filters.get('min_year'):
            marketplace_filters['min_year'] = filters['min_year']
        if filters.get('max_year'):
            marketplace_filters['max_year'] = filters['max_year']
        if filters.get('max_mileage'):
            marketplace_filters['max_mileage'] = filters['max_mileage']
        if filters.get('location'):
            marketplace_filters['location_city'] = filters['location']
        
        # Search for matching listings
        listings, total = search_listings(marketplace_filters, page=1, page_size=10, sort_by='newest')
        
        # Filter to only new listings (created after last notification)
        if search.get('last_notified_at'):
            last_notified = datetime.fromisoformat(search['last_notified_at'].replace('Z', '+00:00'))
            listings = [
                l for l in listings
                if datetime.fromisoformat(l['created_at'].replace('Z', '+00:00')) > last_notified.replace(tzinfo=None)
            ]
        
        return listings[:5]  # Return top 5 matches
    except Exception as e:
        logger.error(f"Error checking saved search matches: {e}")
        return []


def check_price_drops(user_id: int) -> List[Dict]:
    """
    Check for price drops on favorited listings
    Returns list of listings with price drops
    """
    try:
        from app.services.favorites_service import get_favorites, get_price_history
        
        favorites, _ = get_favorites(user_id, page=1, page_size=100, sort_by='recently_saved')
        price_drops = []
        
        for listing in favorites:
            history = get_price_history(listing['id'], days=7)
            if len(history) >= 2:
                # Check if price dropped
                current_price = listing['price']
                previous_price = history[-2]['price']
                
                if current_price < previous_price:
                    drop_amount = previous_price - current_price
                    drop_percent = (drop_amount / previous_price) * 100
                    
                    price_drops.append({
                        'listing': listing,
                        'previous_price': previous_price,
                        'current_price': current_price,
                        'drop_amount': drop_amount,
                        'drop_percent': drop_percent
                    })
        
        return price_drops
    except Exception as e:
        logger.error(f"Error checking price drops: {e}")
        return []


def send_email_alert(user_id: int, subject: str, body: str, html_body: Optional[str] = None):
    """
    Send email alert to user
    Note: This is a placeholder - requires SMTP configuration
    """
    try:
        user = get_user_by_id(user_id)
        if not user:
            logger.warning(f"User {user_id} not found for email alert")
            return False
        
        # TODO: Implement actual email sending with SMTP
        # Example using smtplib or SendGrid/Mailgun API:
        # 
        # import smtplib
        # from email.mime.text import MIMEText
        # from email.mime.multipart import MIMEMultipart
        # 
        # msg = MIMEMultipart('alternative')
        # msg['Subject'] = subject
        # msg['From'] = 'noreply@carpricepredictor.com'
        # msg['To'] = user['email']
        # 
        # msg.attach(MIMEText(body, 'plain'))
        # if html_body:
        #     msg.attach(MIMEText(html_body, 'html'))
        # 
        # server = smtplib.SMTP('smtp.example.com', 587)
        # server.starttls()
        # server.login('username', 'password')
        # server.send_message(msg)
        # server.quit()
        
        logger.info(f"Email alert would be sent to {user['email']}: {subject}")
        return True
    except Exception as e:
        logger.error(f"Error sending email alert: {e}")
        return False


def send_saved_search_alert(user_id: int, search_id: int, matches: List[Dict]):
    """Send email alert for new matches in saved search"""
    try:
        searches = get_saved_searches(user_id)
        search = next((s for s in searches if s['id'] == search_id), None)
        
        if not search or not matches:
            return False
        
        user = get_user_by_id(user_id)
        if not user:
            return False
        
        subject = f"{len(matches)} new car{'s' if len(matches) > 1 else ''} match your saved search: {search['name']}"
        
        body = f"Good news! {len(matches)} new car{'s' if len(matches) > 1 else ''} match your saved search '{search['name']}':\n\n"
        
        for match in matches:
            body += f"- {match['year']} {match['make']} {match['model']} - ${match['price']:,.0f}\n"
            body += f"  {match['mileage']:,.0f} {match.get('mileage_unit', 'km')} • {match.get('location_city', 'Unknown')}\n"
            body += f"  View: https://yourdomain.com/buy-sell/{match['id']}\n\n"
        
        body += "\nHappy car hunting!\n"
        body += "The Car Price Predictor Team"
        
        # HTML version
        html_body = f"""
        <html>
        <body style="font-family: Arial, sans-serif;">
          <h2>Good news! {len(matches)} new car{'s' if len(matches) > 1 else ''} match your saved search</h2>
          <p><strong>{search['name']}</strong></p>
          <div style="margin-top: 20px;">
        """
        
        for match in matches:
            html_body += f"""
            <div style="border: 1px solid #ddd; padding: 15px; margin-bottom: 15px; border-radius: 5px;">
              <h3>{match['year']} {match['make']} {match['model']}</h3>
              <p style="font-size: 18px; color: #5B7FFF; font-weight: bold;">${match['price']:,.0f}</p>
              <p>{match['mileage']:,.0f} {match.get('mileage_unit', 'km')} • {match.get('location_city', 'Unknown')}</p>
              <a href="https://yourdomain.com/buy-sell/{match['id']}" 
                 style="background: #5B7FFF; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block; margin-top: 10px;">
                View Listing
              </a>
            </div>
            """
        
        html_body += """
          </div>
          <p style="margin-top: 20px; color: #666;">Happy car hunting!<br>The Car Price Predictor Team</p>
          <p style="margin-top: 20px; font-size: 12px; color: #999;">
            <a href="https://yourdomain.com/settings/notifications">Manage notification settings</a> | 
            <a href="https://yourdomain.com/unsubscribe?user={user_id}">Unsubscribe</a>
          </p>
        </body>
        </html>
        """
        
        return send_email_alert(user_id, subject, body, html_body)
    except Exception as e:
        logger.error(f"Error sending saved search alert: {e}")
        return False


def send_price_drop_alert(user_id: int, price_drop: Dict):
    """Send email alert for price drop"""
    try:
        user = get_user_by_id(user_id)
        if not user:
            return False
        
        listing = price_drop['listing']
        subject = f"Price Drop Alert: {listing['year']} {listing['make']} {listing['model']} is now ${price_drop['drop_amount']:,.0f} cheaper!"
        
        body = f"Good news! The {listing['year']} {listing['make']} {listing['model']} you saved is now ${price_drop['drop_amount']:,.0f} cheaper!\n\n"
        body += f"Previous price: ${price_drop['previous_price']:,.0f}\n"
        body += f"Current price: ${price_drop['current_price']:,.0f}\n"
        body += f"Savings: ${price_drop['drop_amount']:,.0f} ({price_drop['drop_percent']:.1f}% off)\n\n"
        body += f"View listing: https://yourdomain.com/buy-sell/{listing['id']}\n\n"
        body += "Happy car hunting!\n"
        body += "The Car Price Predictor Team"
        
        html_body = f"""
        <html>
        <body style="font-family: Arial, sans-serif;">
          <h2>Price Drop Alert! 🎉</h2>
          <p>The <strong>{listing['year']} {listing['make']} {listing['model']}</strong> you saved is now <strong style="color: green;">${price_drop['drop_amount']:,.0f} cheaper</strong>!</p>
          <div style="background: #f0f0f0; padding: 15px; border-radius: 5px; margin: 20px 0;">
            <p><strong>Previous price:</strong> <span style="text-decoration: line-through;">${price_drop['previous_price']:,.0f}</span></p>
            <p><strong>Current price:</strong> <span style="font-size: 24px; color: #5B7FFF; font-weight: bold;">${price_drop['current_price']:,.0f}</span></p>
            <p><strong>You save:</strong> <span style="color: green; font-weight: bold;">${price_drop['drop_amount']:,.0f} ({price_drop['drop_percent']:.1f}% off)</span></p>
          </div>
          <a href="https://yourdomain.com/buy-sell/{listing['id']}" 
             style="background: #5B7FFF; color: white; padding: 15px 30px; text-decoration: none; border-radius: 5px; display: inline-block; margin-top: 10px;">
            View Listing
          </a>
          <p style="margin-top: 20px; color: #666;">Happy car hunting!<br>The Car Price Predictor Team</p>
          <p style="margin-top: 20px; font-size: 12px; color: #999;">
            <a href="https://yourdomain.com/settings/notifications">Manage notification settings</a> | 
            <a href="https://yourdomain.com/unsubscribe?user={user_id}">Unsubscribe</a>
          </p>
        </body>
        </html>
        """
        
        return send_email_alert(user_id, subject, body, html_body)
    except Exception as e:
        logger.error(f"Error sending price drop alert: {e}")
        return False


def process_all_alerts():
    """
    Process all alerts for all users
    This should be called periodically (e.g., via cron job or scheduled task)
    """
    try:
        from app.services.auth_service import get_db
        
        conn = get_db()
        cursor = conn.cursor()
        
        # Get all users with saved searches or favorites
        cursor.execute("""
            SELECT DISTINCT user_id FROM saved_searches
            WHERE email_alerts = 1
            UNION
            SELECT DISTINCT user_id FROM favorites
        """)
        
        user_ids = [row['user_id'] for row in cursor.fetchall()]
        conn.close()
        
        for user_id in user_ids:
            try:
                # Check notification settings
                settings = get_notification_settings(user_id)
                if not settings:
                    continue
                
                # Process saved search alerts
                if settings.get('email_new_matches'):
                    searches = get_saved_searches(user_id)
                    for search in searches:
                        if search.get('email_alerts'):
                            matches = check_saved_search_matches(user_id, search['id'])
                            if matches:
                                send_saved_search_alert(user_id, search['id'], matches)
                                # Update last_notified_at (would need to add this to favorites_service)
                
                # Process price drop alerts
                if settings.get('email_price_drops'):
                    price_drops = check_price_drops(user_id)
                    for drop in price_drops:
                        send_price_drop_alert(user_id, drop)
                        
            except Exception as e:
                logger.error(f"Error processing alerts for user {user_id}: {e}")
                continue
                
    except Exception as e:
        logger.error(f"Error processing all alerts: {e}")
