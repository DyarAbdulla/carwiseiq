# Car Price Predictor API

AI-powered car price prediction system with multi-platform URL scraping support.

## Features

- 🚗 **Multi-Platform Scraping**: Supports 8 major car listing platforms
- 🤖 **ML-Powered Predictions**: Uses scikit-learn RandomForest model
- 💰 **Price Analysis**: Deal quality analysis and market positioning
- 🌍 **International Support**: Multiple currencies and locations
- ⚡ **Caching**: 24-hour cache for improved performance
- 📊 **Batch Processing**: Process multiple URLs at once

## Supported Platforms

1. **Cars.com** (USA)
2. **Autotrader** (USA/UK)
3. **Dubizzle** (UAE, Egypt, Iraq, Lebanon)
4. **Syarah** (Saudi Arabia)
5. **Mobile.de** (Germany/Europe)
6. **CarGurus** (USA/Canada/UK)
7. **OpenSooq** (Jordan, Iraq, Kuwait)
8. **Hatla2ee** (Egypt)

## Setup

### Prerequisites

- Python 3.8 or higher
- pip

### Installation

1. **Navigate to backend directory:**
   ```bash
   cd backend
   ```

2. **Create virtual environment:**
   ```bash
   python -m venv venv
   ```

3. **Activate virtual environment:**

   **Windows:**
   ```bash
   venv\Scripts\activate
   ```

   **Linux/Mac:**
   ```bash
   source venv/bin/activate
   ```

4. **Install dependencies:**
   ```bash
   pip install -r requirements_new.txt
   ```

5. **Set up environment variables (optional):**
   ```bash
   cp .env.example .env
   # Edit .env with your settings
   ```

   **For sell-flow AI car detection (make/model from photos):** add to `.env`:
   ```
   ANTHROPIC_API_KEY=your_key_from_console.anthropic.com
   # optional: ANTHROPIC_MODEL=claude-3-5-sonnet-20241022
   ```

## Running the API

### Development Mode

**IMPORTANT: Must run from backend directory!**

```bash
cd backend
python -m app.main
```

Or using uvicorn directly:

```bash
cd backend
python -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```

The API will be available at: `http://localhost:8000`

### Database reset (development)

Full reset: deletes `users.db`, `car_predictions.db`, and `uploads/listings/`, then re-creates empty tables. Requires `RESET_DB_CONFIRM=YES`.

**Windows PowerShell:**
```powershell
cd backend
$env:RESET_DB_CONFIRM="YES"; python scripts/reset_database.py
```

**Bash (Mac/Linux):**
```bash
cd backend
RESET_DB_CONFIRM=YES python scripts/reset_database.py
```

### Production Mode

```bash
uvicorn main:app --host 0.0.0.0 --port 8000 --workers 4
```

## API Endpoints

### Health Check

```bash
GET /api/health
```

Returns API status and statistics.

### Get Supported Platforms

```bash
GET /api/platforms
```

Returns list of supported car listing platforms.

### Predict from URL

```bash
POST /api/predict/from-url
Content-Type: application/json

{
  "url": "https://www.cars.com/vehicledetail/..."
}
```

Scrapes the URL, extracts car data, and predicts price.

### Batch Predict from URLs

```bash
POST /api/predict/batch
Content-Type: application/json

{
  "urls": [
    "https://www.cars.com/vehicledetail/...",
    "https://www.dubizzle.com/motors/..."
  ]
}
```

Processes multiple URLs (up to 100).

### Predict from Car Details

```bash
POST /api/predict/from-details
Content-Type: application/json

{
  "make": "Toyota",
  "model": "Camry",
  "year": 2020,
  "mileage": 30000,
  "condition": "Excellent",
  "fuel_type": "Hybrid",
  "location": "Dubai"
}
```

Predicts price from car specifications (no URL scraping).

## Response Format

```json
{
  "success": true,
  "data": {
    "make": "Toyota",
    "model": "Camry",
    "year": 2020,
    "mileage": 30000,
    "condition": "Excellent",
    "fuel_type": "Hybrid",
    "location": "Dubai",
    "listing_price": 75000,
    "predicted_price": 72000,
    "price_range": {
      "min": 68000,
      "max": 76000
    },
    "confidence": 85,
    "deal_quality": "Fair",
    "deal_explanation": "Price is 4% above predicted value",
    "market_position": "Above Average",
    "images": ["url1", "url2"],
    "platform": "Dubizzle",
    "currency": "USD"
  }
}
```

## Testing

Run tests:
```bash
cd backend
python -m pytest tests/ -v
```

Or run individual test files:
```bash
python -m pytest tests/test_scrapers.py -v
python -m pytest tests/test_api.py -v
```

## Deployment

See [DEPLOYMENT.md](./DEPLOYMENT.md) for complete deployment instructions.

Quick Docker deployment:
```bash
docker-compose up -d
```

## Testing (Legacy)

### Test Health Endpoint

```bash
curl http://localhost:8000/api/health
```

### Test URL Prediction

```bash
curl -X POST http://localhost:8000/api/predict/from-url \
  -H "Content-Type: application/json" \
  -d '{"url": "https://www.cars.com/vehicledetail/..."}'
```

## Architecture

```
backend/
├── main.py                 # FastAPI application
├── scrapers/              # Platform scrapers
│   ├── base_scraper.py   # Base scraper class
│   ├── cars_com.py       # Cars.com scraper
│   └── ...               # Other scrapers
├── apis/                 # External API integrations
│   ├── nhtsa.py         # NHTSA API (VIN decoding)
│   ├── carquery.py      # CarQuery API
│   └── edmunds.py       # Edmunds API (optional)
├── models/              # Data models
│   ├── car.py          # Car data model
│   └── prediction.py   # Prediction response model
├── services/           # Business logic services
│   ├── platform_detector.py  # Platform detection
│   ├── data_normalizer.py    # Data normalization
│   ├── price_predictor.py    # ML price prediction
│   └── cache_service.py      # Caching service
└── utils/             # Utilities
    ├── currency_converter.py  # Currency conversion
    ├── validators.py          # Data validation
    └── error_handler.py       # Error handling
```

## Configuration

Environment variables (see `.env.example`):

- `API_HOST`: API host (default: 0.0.0.0)
- `API_PORT`: API port (default: 8000)
- `DEBUG`: Debug mode (default: False)
- `EDMUNDS_API_KEY`: Optional Edmunds API key
- `MODEL_PATH`: Path to custom trained model (optional)

## Notes

- The ML model is trained on sample data by default. For production, train on real data.
- Exchange rates are approximate. For production, use a live API like exchangerate-api.com.
- Scrapers include rate limiting (1-3 second delays) to be respectful to websites.
- Cache TTL is 24 hours by default. Adjust in `CacheService` if needed.

## License

MIT License

## Support

For issues or questions, please open an issue on GitHub.
