FROM python:3.11-slim

WORKDIR /app

# System deps for building some Python packages
RUN apt-get update && apt-get install -y gcc libxml2-dev libxslt-dev

# Copy and install Python dependencies
COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy all backend files
COPY backend/ .

EXPOSE 8000

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
