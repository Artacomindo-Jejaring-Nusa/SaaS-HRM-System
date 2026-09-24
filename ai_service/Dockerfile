FROM python:3.11-slim

WORKDIR /app

# Install system dependencies for OpenCV and image operations
RUN apt-get update && apt-get install -y --no-install-recommends \
    libgl1 \
    libglib2.0-0 \
    libgomp1 \
    && rm -rf /var/lib/apt/lists/*

# 1. Install PyTorch CPU directly from official prebuilt wheels (instant, no backtracking)
RUN pip install --no-cache-dir --index-url https://download.pytorch.org/whl/cpu torch torchvision

# 2. Install TensorFlow CPU & Keras with compatible NumPy
RUN pip install --no-cache-dir "numpy<2.0.0" tensorflow-cpu keras

# 3. Install Ultralytics (YOLO), FastAPI server, and OpenCV
RUN pip install --no-cache-dir ultralytics fastapi uvicorn python-multipart pydantic opencv-python-headless

COPY . .

EXPOSE 8001

CMD ["uvicorn", "server:app", "--host", "0.0.0.0", "--port", "8001"]
