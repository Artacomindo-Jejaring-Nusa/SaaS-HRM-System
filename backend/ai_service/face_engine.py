import os
import cv2
import numpy as np
from ultralytics import YOLO
import tensorflow as tf
from keras.models import load_model

class FacePipeline:
    """
    Engine terpadu AI Pengenal Wajah Artacom HRMS
    1. Detector: Menggunakan YOLOv11 untuk lokasi wajah.
    2. Embedder: Menggunakan MobileNetV2 untuk mengekstrak Vektor 128-dimensi.
    """
    def __init__(self, detector_weights=None, embedder_path=None):
        base_dir = os.path.dirname(os.path.abspath(__file__))

        # Auto-detect trained best.pt
        if detector_weights is None:
            candidates = [
                os.path.join(base_dir, 'weights', 'best.pt'),
                os.path.join(base_dir, 'best.pt'),
                'weights/best.pt',
                'best.pt',
                'runs/detect/Artacom_Face_Model/yolov11_face_detector/weights/best.pt',
                'yolo11n.pt'
            ]
            for c in candidates:
                if os.path.exists(c):
                    detector_weights = c
                    break
            if detector_weights is None:
                detector_weights = 'yolo11n.pt'

        # Auto-detect embedder model
        if embedder_path is None:
            embedder_candidates = [
                os.path.join(base_dir, 'weights', 'artacom_embedder_base.keras'),
                os.path.join(base_dir, 'artacom_embedder_base.keras'),
                os.path.join(base_dir, 'weights', 'artacom_embedder_base.h5'),
                os.path.join(base_dir, 'artacom_embedder_base.h5'),
                'artacom_embedder_base.keras',
                'artacom_embedder_base.h5'
            ]
            for ec in embedder_candidates:
                if os.path.exists(ec):
                    embedder_path = ec
                    break

        print(f"[FacePipeline] Loading YOLOv11 Face Detector from: {detector_weights}")
        self.detector = YOLO(detector_weights)
        
        print(f"[FacePipeline] Loading Face Embedder Model from: {embedder_path}")
        if embedder_path and os.path.exists(embedder_path):
            self.embedder = load_model(embedder_path, compile=False, safe_mode=False)
        else:
            raise FileNotFoundError(f"File model embedder {embedder_path} tidak ditemukan.")

    def detect_and_crop_face(self, image_path_or_array, target_size=(160, 160)):
        """
        Mendeteksi wajah pada gambar & melakukan crop dengan penyesuaian skala target_size.
        """
        if isinstance(image_path_or_array, str):
            img = cv2.imread(image_path_or_array)
            if img is None:
                raise ValueError(f"Tidak dapat membaca gambar dari {image_path_or_array}")
        else:
            img = image_path_or_array

        results = self.detector(img, verbose=False)
        boxes = results[0].boxes

        if len(boxes) == 0:
            # Fallback jika YOLO belum mendeteksi: gunakan proporsi gambar tengah
            h, w, _ = img.shape
            cropped_face = cv2.resize(img, target_size)
            return cropped_face, (0, 0, w, h), False

        # Ambil bounding box dengan tingkat kepercayaan (confidence) tertinggi
        best_box = max(boxes, key=lambda b: float(b.conf[0]))
        x1, y1, x2, y2 = map(int, best_box.xyxy[0].tolist())

        # Padding 10% agar dahi, telinga, dan dagu ikut ter-crop dengan proporsional
        h, w, _ = img.shape
        margin_x = int((x2 - x1) * 0.1)
        margin_y = int((y2 - y1) * 0.1)
        
        crop_x1 = max(0, x1 - margin_x)
        crop_y1 = max(0, y1 - margin_y)
        crop_x2 = min(w, x2 + margin_x)
        crop_y2 = min(h, y2 + margin_y)

        cropped = img[crop_y1:crop_y2, crop_x1:crop_x2]
        if cropped.size == 0:
            cropped = img
            
        resized_face = cv2.resize(cropped, target_size)
        return resized_face, (x1, y1, x2, y2), True

    def extract_embedding(self, face_crop):
        """
        Mengubah citra wajah (160x160x3 BGR) menjadi 128-d Normalized Float Vector.
        """
        rgb_face = cv2.cvtColor(face_crop, cv2.COLOR_BGR2RGB)
        face_array = rgb_face.astype('float32') / 255.0
        face_tensor = np.expand_dims(face_array, axis=0) # Shape: (1, 160, 160, 3)

        embedding = self.embedder.predict(face_tensor, verbose=0)[0]
        # Pastikan unit-normalized
        norm = np.linalg.norm(embedding)
        if norm > 0:
            embedding = embedding / norm
        return embedding

    def process_image(self, image_input):
        """
        Fungsi shortcut: Input Gambar -> Output (Vektor 128 angka, face_crop, bbox, face_found)
        """
        face_crop, bbox, face_found = self.detect_and_crop_face(image_input)
        embedding = self.extract_embedding(face_crop)
        return embedding, face_crop, bbox, face_found


def compute_similarity(vector1, vector2):
    """
    Menghitung Cosine Similarity antara dua vektor 128-d (Skala 0.0 - 1.0).
    Nilai 1.0 berarti persis identik.
    """
    v1 = np.array(vector1, dtype=np.float32)
    v2 = np.array(vector2, dtype=np.float32)
    
    norm1 = np.linalg.norm(v1)
    norm2 = np.linalg.norm(v2)
    
    if norm1 == 0 or norm2 == 0:
        return 0.0
        
    dot_product = np.dot(v1, v2)
    similarity = dot_product / (norm1 * norm2)
    # Clamp to [0.0, 1.0]
    return float(np.clip(similarity, 0.0, 1.0))


def verify_face(registered_vector, current_vector, threshold=0.70):
    """
    Memverifikasi apakah wajah saat ini cocok dengan wajah terdaftar di Database HRMS.
    """
    score = compute_similarity(registered_vector, current_vector)
    is_match = score >= threshold
    return is_match, score
