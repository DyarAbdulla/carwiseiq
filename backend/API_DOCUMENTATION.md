# Car Price Predictor API Documentation

Complete API reference for the Car Price Predictor backend.

## Base URL

```
http://localhost:8000
```

## Authentication

Currently, no authentication is required. Rate limiting is applied (100 requests per hour per IP).

## Rate Limiting

- **Limit**: 100 requests per hour per IP address
- **Headers**: 
  - `X-RateLimit-Limit`: Maximum requests allowed
  - `X-RateLimit-Remaining`: Remaining requests
  - `X-RateLimit-Reset`: Unix timestamp when limit resets
- **Response**: `429 Too Many Requests` when limit exceeded

---

## Endpoints

### Health Check

**GET** `/api/health`

Check API health status.

**Response:**
```json
{
  "status": "ok",
  "scrapers": 12,
  "apis": 3,
  "cache_size": 0
}
```

---

### Get Supported Platforms

**GET** `/api/platforms`

Get list of supported car listing platforms.

**Response:**
```json
{
  "supported": [
    "Cars.com",
    "Autotrader",
    "Dubizzle",
    "Syarah",
    "Mobile.de",
    "CarGurus",
    "OpenSooq",
    "Hatla2ee",
    "Ksell.iq",
    "Carvana",
    "TrueCar",
    "IQCars.net"
  ],
  "count": 12
}
```

---

### Predict from URL

**POST** `/api/predict/from-url`

Predict car price from a listing URL.

**Request Body:**
```json
{
  "url": "https://www.cars.com/vehicledetail/detail/123456/overview/"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "make": "Toyota",
    "model": "Camry",
    "year": 2020,
    "mileage": 50000,
    "condition": "Good",
    "fuel_type": "Gasoline",
    "location": "California",
    "listing_price": 25000,
    "predicted_price": 24500,
    "price_range": {
      "min": 22000,
      "max": 27000
    },
    "confidence": 0.85,
    "deal_quality": "Good",
    "deal_explanation": "Price is within market range",
    "market_position": "Fair",
    "images": [],
    "platform": "Cars.com",
    "currency": "USD"
  }
}
```

**Error Responses:**
- `400`: Invalid URL format or unsupported platform
- `404`: Listing no longer available
- `408`: Timeout while scraping
- `429`: Rate limit exceeded
- `500`: Scraping failed

---

### Batch Predictions

**POST** `/api/predict/batch`

Predict prices for multiple URLs (processed in parallel).

**Request Body:**
```json
{
  "urls": [
    "https://www.cars.com/vehicledetail/detail/123/overview/",
    "https://www.autotrader.com/cars/456"
  ]
}
```

**Response:**
```json
{
  "results": [
    {
      "success": true,
      "url": "https://www.cars.com/...",
      "result": { ... }
    }
  ],
  "summary": {
    "total": 2,
    "successful": 2,
    "failed": 0
  }
}
```

**Limits:**
- Maximum 100 URLs per request
- Processed in batches of 5 concurrent requests

---

### Predict from Details

**POST** `/api/predict/from-details`

Predict price from car details (no URL scraping).

**Request Body:**
```json
{
  "make": "Toyota",
  "model": "Camry",
  "year": 2020,
  "mileage": 50000,
  "condition": "Good",
  "fuel_type": "Gasoline",
  "location": "California",
  "listing_price": 25000,
  "currency": "USD",
  "engine_size": 2.5,
  "cylinders": 4
}
```

**Response:** Same format as `/api/predict/from-url`

---

### Get Search History

**GET** `/api/history`

Get search history.

**Query Parameters:**
- `limit` (int, default: 50): Maximum number of results
- `offset` (int, default: 0): Offset for pagination

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "url": "https://www.cars.com/...",
      "timestamp": "2024-01-01T12:00:00",
      "success": true,
      "platform": "Cars.com",
      "error_message": null,
      "car": {
        "make": "Toyota",
        "model": "Camry",
        "year": 2020,
        "predicted_price": 24500,
        "listing_price": 25000,
        "condition": "Good",
        "fuel_type": "Gasoline",
        "location": "California",
        "confidence": 0.85
      }
    }
  ],
  "count": 1
}
```

---

### Get Price Trends

**GET** `/api/trends`

Get price trends for a specific make/model/year.

**Query Parameters:**
- `make` (string, required): Car make
- `model` (string, required): Car model
- `year` (int, optional): Car year

**Response:**
```json
{
  "success": true,
  "data": {
    "make": "Toyota",
    "model": "Camry",
    "year": 2020,
    "avg_price": 24500,
    "min_price": 22000,
    "max_price": 27000,
    "count": 15
  }
}
```

---

### Decode VIN

**POST** `/api/decode-vin`

Decode Vehicle Identification Number to get car specifications.

**Request Body:**
```json
{
  "vin": "1HGBH41JXMN109186"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "success": true,
    "vin": "1HGBH41JXMN109186",
    "data": {
      "make": "Honda",
      "model": "Accord",
      "year": 2021,
      "fuel_type": "Gasoline",
      "engine_size": 1.5,
      "cylinders": 4,
      "engine": "1.5L I4"
    }
  }
}
```

**Error Responses:**
- `400`: Invalid VIN format
- `500`: VIN decoding failed

---

### Get Similar Cars

**GET** `/api/similar`

Get similar cars from database.

**Query Parameters:**
- `make` (string, required): Car make
- `model` (string, required): Car model
- `year` (int, optional): Car year
- `limit` (int, default: 10, max: 50): Maximum number of results

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "make": "Toyota",
      "model": "Camry",
      "year": 2020,
      "mileage": 50000,
      "predicted_price": 24500,
      "listing_price": 25000,
      "condition": "Good",
      "fuel_type": "Gasoline",
      "location": "California",
      "confidence": 0.85,
      "platform": "Cars.com"
    }
  ],
  "count": 1
}
```

---

### Create Price Alert

**POST** `/api/price-alert`

Create a price alert for a specific car.

**Request Body:**
```json
{
  "make": "Toyota",
  "model": "Camry",
  "year": 2020,
  "target_price": 20000,
  "alert_type": "below",
  "email": "user@example.com"
}
```

**Parameters:**
- `make` (string, required): Car make
- `model` (string, required): Car model
- `year` (int, optional): Car year
- `target_price` (float, required): Target price
- `alert_type` (string, required): "below" or "above"
- `email` (string, optional): Email for notifications

**Response:**
```json
{
  "success": true,
  "message": "Price alert created successfully",
  "alert_id": 1
}
```

---

## Error Responses

All errors follow this format:

```json
{
  "detail": "Error message here"
}
```

**HTTP Status Codes:**
- `200`: Success
- `400`: Bad Request (invalid input)
- `404`: Not Found
- `408`: Request Timeout
- `429`: Too Many Requests (rate limit)
- `500`: Internal Server Error
- `502`: Bad Gateway
- `503`: Service Unavailable

---

## Example Usage

### Python

```python
import requests

# Predict from URL
response = requests.post("http://localhost:8000/api/predict/from-url", json={
    "url": "https://www.cars.com/vehicledetail/detail/123/overview/"
})
data = response.json()
print(f"Predicted price: ${data['data']['predicted_price']}")
```

### JavaScript/TypeScript

```javascript
// Predict from URL
const response = await fetch('http://localhost:8000/api/predict/from-url', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    url: 'https://www.cars.com/vehicledetail/detail/123/overview/'
  })
});
const data = await response.json();
console.log(`Predicted price: $${data.data.predicted_price}`);
```

### cURL

```bash
curl -X POST "http://localhost:8000/api/predict/from-url" \
  -H "Content-Type: application/json" \
  -d '{"url": "https://www.cars.com/vehicledetail/detail/123/overview/"}'
```

---

## Supported Platforms

1. Cars.com (USA)
2. Autotrader (USA/UK)
3. Dubizzle (UAE, Egypt, Iraq, Lebanon)
4. Syarah (Saudi Arabia)
5. Mobile.de (Germany/Europe)
6. CarGurus (USA/Canada/UK)
7. OpenSooq (Jordan, Iraq, Kuwait)
8. Hatla2ee (Egypt)
9. Ksell.iq (Iraq)
10. Carvana (USA)
11. TrueCar (USA)
12. IQCars.net (Iraq)

---

## Notes

- All prices are returned in USD
- Currency conversion is automatic for supported currencies (AED, IQD, EUR, etc.)
- Cache TTL: 24 hours for scraped results
- Database automatically stores all successful predictions
- VIN decoder uses NHTSA API (free, no API key required)
