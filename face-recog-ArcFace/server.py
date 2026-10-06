"""
HRMS Face Recognition Service (ArcFace) - FastAPI.

Kontrak endpoint dipakai oleh backend Laravel (App\\Services\\FaceRecognitionService):
  GET  /health
  POST /api/face/extract          -> embedding 512-d dari foto pendaftaran
  POST /api/face/verify           -> cocokkan foto absen dengan embedding terdaftar
  POST /api/face/compare-vectors  -> bandingkan 2 embedding
"""
import json
import sys
from typing import List, Optional

from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from pydantic import BaseModel

from face_service import DEFAULT_THRESHOLD, EMBEDDING_DIM, FaceEngine, FaceNotFoundError, get_engine

try:
    sys.stdout.reconfigure(line_buffering=True)
except Exception:
    pass

app = FastAPI(title="HRMS ArcFace Face Recognition Service", version="2.0.0")

_load_error: Optional[str] = None


@app.on_event("startup")
def load_model():
    global _load_error
    try:
        get_engine()
        print("[ArcFace] Model loaded.")
    except Exception as e:  # service tetap hidup agar /health bisa melaporkan error
        _load_error = str(e)
        print(f"[ArcFace ERROR] {e}")


def _engine() -> FaceEngine:
    try:
        return get_engine()
    except Exception as e:
        raise HTTPException(status_code=503, detail=f"Model AI belum siap: {e}")


async def _read_image(file: Optional[UploadFile], image_base64: Optional[str]):
    if file is not None:
        return await file.read()
    if image_base64:
        return image_base64
    raise HTTPException(status_code=400, detail="Wajib menyertakan file foto atau image_base64.")


def _parse_embedding(raw: str) -> List[float]:
    try:
        vec = json.loads(raw)
        if isinstance(vec, str):
            vec = json.loads(vec)
        if isinstance(vec, dict) and "embedding" in vec:
            vec = vec["embedding"]
    except Exception:
        raise HTTPException(status_code=400, detail="registered_embedding bukan JSON yang valid.")
    if not isinstance(vec, list) or len(vec) != EMBEDDING_DIM:
        raise HTTPException(
            status_code=400,
            detail=f"registered_embedding harus list {EMBEDDING_DIM} float (data lama 128-d wajib daftar ulang).",
        )
    return vec


class CompareVectorsRequest(BaseModel):
    vector1: List[float]
    vector2: List[float]
    threshold: Optional[float] = None


@app.get("/health")
def health():
    ready = _load_error is None
    return {
        "status": "healthy" if ready else "error",
        "service": "HRMS ArcFace Face Service",
        "model": "ArcFace IR-50 (MS1M)",
        "models_ready": ready,
        "error": _load_error,
        "embedding_dimensions": EMBEDDING_DIM,
        "default_threshold": DEFAULT_THRESHOLD,
    }


@app.post("/api/face/extract")
async def extract_face(file: Optional[UploadFile] = File(None), image_base64: Optional[str] = Form(None)):
    engine = _engine()
    data = await _read_image(file, image_base64)
    try:
        emb, bbox, face_count = engine.get_embedding(data)
    except FaceNotFoundError as e:
        return {"success": False, "face_detected": False, "bbox": [], "embedding": [], "message": str(e)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Gagal memproses gambar: {e}")

    return {
        "success": True,
        "face_detected": True,
        "face_count": face_count,
        "bbox": bbox,
        "embedding": emb.tolist(),
        "message": f"Wajah terdeteksi dan vektor {EMBEDDING_DIM}-d berhasil diekstrak.",
    }


@app.post("/api/face/verify")
async def verify_face(
    file: Optional[UploadFile] = File(None),
    registered_embedding: str = Form(...),
    threshold: float = Form(DEFAULT_THRESHOLD),
    image_base64: Optional[str] = Form(None),
):
    engine = _engine()
    reg = _parse_embedding(registered_embedding)
    data = await _read_image(file, image_base64)

    try:
        emb, bbox, face_count = engine.get_embedding(data)
    except FaceNotFoundError as e:
        return {
            "success": True, "face_detected": False, "is_match": False,
            "similarity": 0.0, "similarity_percentage": 0.0, "threshold": threshold, "message": str(e),
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error saat verifikasi wajah: {e}")

    sim = engine.compare(reg, emb)
    is_match = sim >= threshold
    pct = round(sim * 100, 1)
    return {
        "success": True,
        "face_detected": True,
        "face_count": face_count,
        "bbox": bbox,
        "is_match": bool(is_match),
        "similarity": round(sim, 4),
        "similarity_percentage": pct,
        "threshold": threshold,
        "message": (f"Wajah cocok (kemiripan {pct}%)." if is_match
                    else f"Wajah tidak sesuai dengan data pendaftaran (kemiripan {pct}%)."),
    }


@app.post("/api/face/compare-vectors")
def compare_vectors(payload: CompareVectorsRequest):
    if len(payload.vector1) != EMBEDDING_DIM or len(payload.vector2) != EMBEDDING_DIM:
        raise HTTPException(status_code=400, detail=f"Kedua vektor harus {EMBEDDING_DIM} dimensi.")
    threshold = payload.threshold if payload.threshold is not None else DEFAULT_THRESHOLD
    sim = FaceEngine.compare(payload.vector1, payload.vector2)
    return {"success": True, "is_match": sim >= threshold, "similarity": round(sim, 4), "threshold": threshold}


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("server:app", host="0.0.0.0", port=8001, reload=False)
