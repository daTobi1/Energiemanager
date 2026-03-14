FROM python:3.12-slim

WORKDIR /app

# Build-Abhängigkeiten für native Packages (numpy, xgboost etc.)
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential pkg-config libpq-dev \
    && rm -rf /var/lib/apt/lists/*

# Erst Abhängigkeiten installieren (Layer-Caching)
COPY pyproject.toml .
COPY app/ app/
RUN pip install --no-cache-dir .

EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
