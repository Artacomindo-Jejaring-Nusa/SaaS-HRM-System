# ==============================================================================
# Artacom HRMS AI Face Recognition Service - Optimized Dockerfile
# ==============================================================================
# Multi-stage build to minimize final image size (~3GB vs ~5GB)
# Stack: Python 3.11 + PyTorch CPU + TensorFlow CPU + YOLO + FastAPI
# ==============================================================================

# ── Stage 1: Builder ─────────────────────────────────────────
FROM python:3.11-slim AS builder

WORKDIR /app

# Install system build dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    g++ \
    && rm -rf /var/lib/apt/lists/*

# Install PyTorch CPU (minimal, tanpa CUDA)
RUN pip install --no-cache-dir --target=/install \
    --index-url https://download.pytorch.org/whl/cpu \
    torch torchvision

# Install TensorFlow CPU + Keras (untuk load .keras embedder model)
RUN pip install --no-cache-dir --target=/install \
    "numpy<2.0.0" tensorflow-cpu keras

# Install Ultralytics (YOLO), FastAPI, dan OpenCV
RUN pip install --no-cache-dir --target=/install \
    ultralytics fastapi uvicorn python-multipart pydantic opencv-python-headless

# ── Stage 2: Runtime (Lean) ──────────────────────────────────
FROM python:3.11-slim

WORKDIR /app

# Install runtime-only system dependencies (no compilers)
RUN apt-get update && apt-get install -y --no-install-recommends \
    libgl1 \
    libglib2.0-0 \
    libgomp1 \
    && rm -rf /var/lib/apt/lists/* \
    && apt-get clean

# Copy installed Python packages from builder
COPY --from=builder /install /usr/local/lib/python3.11/site-packages

# Copy application code
COPY . .

# Cleanup: remove __pycache__ and .pyc files to save space
RUN find /usr/local/lib/python3.11/site-packages -type d -name "__pycache__" -exec rm -rf {} + 2>/dev/null; \
    find /usr/local/lib/python3.11/site-packages -name "*.pyc" -delete 2>/dev/null; \
    find /app -type d -name "__pycache__" -exec rm -rf {} + 2>/dev/null; \
    true

EXPOSE 8001

HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:8001/health')" || exit 1

CMD ["uvicorn", "server:app", "--host", "0.0.0.0", "--port", "8001"]
