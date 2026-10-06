"""
ArcFace Face Engine untuk HRMS (Mobile Attendance).

Pipeline:
  1. Deteksi wajah + 5 landmark dengan MTCNN (folder `align/`).
  2. Alignment & crop 112x112.
  3. Ekstraksi embedding 512-d dengan backbone IR-50 (ArcFace, MS1M).
  4. Pencocokan menggunakan cosine similarity.
"""
import io
import os
import base64

import numpy as np
import torch
import torch.nn.functional as F
from PIL import Image, ImageOps
from torchvision import transforms

from align.detector import detect_faces
from align.align_trans import get_reference_facial_points, warp_and_crop_face
from backbone import Backbone

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DEFAULT_MODEL_PATH = os.environ.get(
    "ARCFACE_MODEL_PATH",
    os.path.join(BASE_DIR, "checkpoint", "backbone_ir50_ms1m_epoch120.pth"),
)
EMBEDDING_DIM = 512
DEFAULT_THRESHOLD = float(os.environ.get("FACE_RECOGNITION_THRESHOLD", 0.45))
# Batas ukuran sisi terpanjang foto sebelum deteksi (mempercepat MTCNN di CPU)
MAX_IMAGE_SIDE = int(os.environ.get("FACE_MAX_IMAGE_SIDE", 800))


class FaceNotFoundError(ValueError):
    pass


class FaceEngine:
    def __init__(self, model_path: str = DEFAULT_MODEL_PATH):
        self.device = torch.device("cuda:0" if torch.cuda.is_available() else "cpu")
        self.crop_size = 112
        self.reference = get_reference_facial_points(default_square=True) * (self.crop_size / 112.0)

        if not os.path.exists(model_path):
            raise FileNotFoundError(
                f"Model ArcFace tidak ditemukan di '{model_path}'. "
                "Download backbone_ir50_ms1m_epoch120.pth (lihat README.md) dan letakkan di folder checkpoint/."
            )

        self.backbone = Backbone([112, 112])
        self.backbone.load_state_dict(torch.load(model_path, map_location="cpu"))
        self.backbone.to(self.device).eval()

        self.transform = transforms.Compose([
            transforms.Resize([128, 128]),
            transforms.CenterCrop([112, 112]),
            transforms.ToTensor(),
            transforms.Normalize(mean=[0.5, 0.5, 0.5], std=[0.5, 0.5, 0.5]),
        ])

    # ------------------------------------------------------------------ utils
    @staticmethod
    def load_image(data) -> Image.Image:
        """Terima bytes / base64 string / path file -> PIL RGB (EXIF orientation diperbaiki)."""
        if isinstance(data, (bytes, bytearray)):
            img = Image.open(io.BytesIO(data))
        elif isinstance(data, str) and os.path.exists(data):
            img = Image.open(data)
        elif isinstance(data, str):
            raw = data.split(",", 1)[1] if "," in data else data
            img = Image.open(io.BytesIO(base64.b64decode(raw)))
        else:
            raise ValueError("Format gambar tidak didukung.")

        img = ImageOps.exif_transpose(img).convert("RGB")
        w, h = img.size
        scale = MAX_IMAGE_SIDE / float(max(w, h))
        if scale < 1:
            img = img.resize((int(w * scale), int(h * scale)), Image.BILINEAR)
        return img

    # --------------------------------------------------------------- pipeline
    def _align(self, img: Image.Image):
        boxes, landmarks = detect_faces(img)
        if len(landmarks) == 0:
            raise FaceNotFoundError(
                "Wajah tidak terdeteksi. Pastikan seluruh wajah terlihat jelas dan pencahayaan cukup."
            )

        # Pilih wajah terbesar (orang yang paling dekat dengan kamera)
        areas = [(b[2] - b[0]) * (b[3] - b[1]) for b in boxes]
        idx = int(np.argmax(areas))
        points = [[landmarks[idx][j], landmarks[idx][j + 5]] for j in range(5)]
        warped = warp_and_crop_face(
            np.array(img), points, self.reference, crop_size=(self.crop_size, self.crop_size)
        )
        bbox = [int(v) for v in boxes[idx][:4]]
        return Image.fromarray(warped), bbox, len(landmarks)

    def get_embedding(self, data):
        """Return (embedding np.ndarray[512], bbox, jumlah_wajah)."""
        img = self.load_image(data)
        face, bbox, face_count = self._align(img)
        tensor = self.transform(face).unsqueeze(0).to(self.device)
        with torch.no_grad():
            emb = F.normalize(self.backbone(tensor)).cpu().numpy()[0]
        return emb, bbox, face_count

    @staticmethod
    def compare(emb1, emb2) -> float:
        a = np.asarray(emb1, dtype=np.float32)
        b = np.asarray(emb2, dtype=np.float32)
        denom = float(np.linalg.norm(a) * np.linalg.norm(b))
        return float(np.dot(a, b) / denom) if denom else 0.0


_engine = None


def get_engine() -> FaceEngine:
    global _engine
    if _engine is None:
        _engine = FaceEngine()
    return _engine
