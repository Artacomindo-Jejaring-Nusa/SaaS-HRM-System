FROM python:3.11-slim

WORKDIR /app
ENV PYTHONUNBUFFERED=1

RUN apt-get update && apt-get install -y --no-install-recommends libgl1 libglib2.0-0 libgomp1 \
    && rm -rf /var/lib/apt/lists/*

# CPU-only torch (hindari unduhan CUDA > 2GB)
RUN pip install --no-cache-dir --extra-index-url https://download.pytorch.org/whl/cpu \
    torch torchvision "numpy<2.0.0" opencv-python-headless pillow fastapi uvicorn python-multipart pydantic

COPY . .

EXPOSE 8001

HEALTHCHECK --interval=30s --timeout=10s --start-period=90s --retries=3 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:8001/health')" || exit 1

CMD ["python", "-m", "uvicorn", "server:app", "--host", "0.0.0.0", "--port", "8001"]
