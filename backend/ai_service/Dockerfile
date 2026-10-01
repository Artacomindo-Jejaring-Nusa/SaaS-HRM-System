FROM python:3.11-slim

WORKDIR /app

# Install system dependencies for OpenCV and image operations
RUN apt-get update && apt-get install -y --no-install-recommends \
    libgl1 \
    libglib2.0-0 \
    libgomp1 \
    && rm -rf /var/lib/apt/lists/*

# Install Python packages (forced CPU index to prevent downloading >2.5GB of NVIDIA CUDA packages)
RUN pip install --no-cache-dir --extra-index-url https://download.pytorch.org/whl/cpu \
    torch torchvision \
    "numpy<2.0.0" tensorflow-cpu keras \
    ultralytics fastapi uvicorn python-multipart pydantic opencv-python-headless


COPY . .

EXPOSE 8001

CMD ["uvicorn", "server:app", "--host", "0.0.0.0", "--port", "8001"]
