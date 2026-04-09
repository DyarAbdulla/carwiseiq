FROM python:3.11-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# Fail fast if production model artifacts are missing from the image
RUN test -f models/price_prediction_pipeline.joblib && test -f models/inference_meta.json

CMD ["python", "start.py"]
