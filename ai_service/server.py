import os
import io
import json
import base64
import numpy as np
import cv2
from PIL import Image, ImageOps
from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional
from face_engine import FacePipeline, compute_similarity, verify_face

app = FastAPI(
    title="Artacom HRMS Face Recognition AI Service",
    description="Microservice untuk deteksi wajah (YOLOv11) dan ekstraksi representasi vektor 128-d untuk absensi & pendaftaran karyawan.",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Global Pipeline instance (Model dimuat sekali saat startup)
pipeline: Optional[FacePipeline] = None

@app.on_event("startup")
def load_ai_models():
    global pipeline
    try:
        print("[Server] Initializing AI Face Pipeline models...")
        pipeline = FacePipeline()
        print("[Server] AI Models successfully loaded into memory!")
    except Exception as e:
        print(f"[Server ERROR] Failed to load models: {e}")

def decode_image_bytes(image_bytes: bytes) -> np.ndarray:
    try:
        img = Image.open(io.BytesIO(image_bytes))
        img = ImageOps.exif_transpose(img)
        img = img.convert("RGB")
        nparr = np.array(img)
        return cv2.cvtColor(nparr, cv2.COLOR_RGB2BGR)
    except Exception as e:
        print("PIL decode error:", e)
        nparr = np.frombuffer(image_bytes, np.uint8)
        img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        if img is None:
            raise ValueError("Format gambar tidak valid atau rusak.")
        return img

class VerifyRequest(BaseModel):
    registered_embedding: List[float]
    image_base64: Optional[str] = None
    threshold: Optional[float] = 0.40

class CompareVectorsRequest(BaseModel):
    vector1: List[float]
    vector2: List[float]
    threshold: Optional[float] = 0.40

@app.get("/health")
def health_check():
    is_ready = pipeline is not None
    return {
        "status": "healthy" if is_ready else "initializing",
        "service": "Artacom HRMS AI Face Service",
        "models_ready": is_ready,
        "embedding_dimensions": 128
    }

@app.post("/api/face/extract")
async def extract_face(
    file: Optional[UploadFile] = File(None),
    image_base64: Optional[str] = Form(None)
):
    """
    Mengekstrak 128-d feature vector dari foto pendaftaran/selfie.
    Dapat menerima file multipart atau string base64.
    """
    if pipeline is None:
        raise HTTPException(status_code=503, detail="Model AI belum siap.")

    try:
        if file is not None:
            contents = await file.read()
            img = decode_image_bytes(contents)
        elif image_base64:
            if "," in image_base64:
                image_base64 = image_base64.split(",")[1]
            contents = base64.b64decode(image_base64)
            img = decode_image_bytes(contents)
        else:
            raise HTTPException(status_code=400, detail="Wajib menyertakan file foto atau image_base64.")

        embedding, _, bbox, face_found = pipeline.process_image(img)
        if not face_found or embedding is None:
            return {
                "success": False,
                "face_detected": False,
                "bbox": [],
                "embedding": [],
                "message": "Wajah tidak terdeteksi pada foto. Harap pastikan seluruh wajah Anda terlihat jelas dan terang di dalam kamera."
            }
        
        return {
            "success": True,
            "face_detected": True,
            "bbox": [int(x) for x in bbox],
            "embedding": embedding.tolist(),
            "message": "Wajah terdeteksi dan vektor 128-d berhasil diekstrak."
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Gagal memproses gambar: {str(e)}")

@app.post("/api/face/verify")
async def verify_face_endpoint(
    file: Optional[UploadFile] = File(None),
    registered_embedding: str = Form(...), # JSON string array 128 float
    threshold: float = Form(0.40),
    image_base64: Optional[str] = Form(None)
):
    """
    Verifikasi wajah saat presensi/absen masuk/pulang terhadap vektor terdaftar di DB karyawan.
    """
    if pipeline is None:
        raise HTTPException(status_code=503, detail="Model AI belum siap.")

    try:
        # Parse registered embedding
        try:
            reg_vector = json.loads(registered_embedding)
            if not isinstance(reg_vector, list) or len(reg_vector) != 128:
                raise ValueError("Format registered_embedding harus berupa list 128 float.")
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Invalid registered_embedding: {str(e)}")

        if file is not None:
            contents = await file.read()
            img = decode_image_bytes(contents)
        elif image_base64:
            if "," in image_base64:
                image_base64 = image_base64.split(",")[1]
            contents = base64.b64decode(image_base64)
            img = decode_image_bytes(contents)
        else:
            raise HTTPException(status_code=400, detail="Wajib menyertakan file foto selfie atau image_base64.")

        current_embedding, _, bbox, face_found = pipeline.process_image(img)
        if not face_found or current_embedding is None:
            return {
                "success": True,
                "face_detected": False,
                "is_match": False,
                "similarity": 0.0,
                "threshold": threshold,
                "message": "Wajah tidak terdeteksi pada foto selfie. Harap posisikan seluruh wajah Anda di depan kamera (bukan benda / tidak terpotong)."
            }

        is_match, similarity = verify_face(reg_vector, current_embedding, threshold=threshold)

        return {
            "success": True,
            "face_detected": True,
            "is_match": bool(is_match),
            "similarity": round(float(similarity), 4),
            "threshold": threshold,
            "message": "Verifikasi wajah berhasil cocok." if is_match else "Wajah tidak cocok dengan data pendaftaran Anda."
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error saat verifikasi wajah: {str(e)}")

@app.post("/api/face/compare-vectors")
def compare_vectors_endpoint(payload: CompareVectorsRequest):
    """
    Membandingkan dua vektor embedding 128-d secara langsung tanpa memproses gambar.
    """
    if len(payload.vector1) != 128 or len(payload.vector2) != 128:
        raise HTTPException(status_code=400, detail="Kedua vektor harus memiliki panjang 128 dimensi.")

    similarity = compute_similarity(payload.vector1, payload.vector2)
    is_match = similarity >= (payload.threshold or 0.40)

    return {
        "success": True,
        "is_match": bool(is_match),
        "similarity": round(float(similarity), 4),
        "threshold": payload.threshold or 0.40
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("server:app", host="0.0.0.0", port=8001, reload=False)
