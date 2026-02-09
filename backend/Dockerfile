FROM python:3.11-slim

WORKDIR /app

# System deps for building some Python packages
RUN apt-get update && apt-get install -y gcc libxml2-dev libxslt-dev

# Copy and install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy all backend files
COPY . .

EXPOSE 8000

CMD ["sh", "-c", "uvicorn main:app --host 0.0.0.0 --port ${PORT:-8000}"]
