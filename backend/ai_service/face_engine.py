import os
import cv2
import numpy as np
from ultralytics import YOLO
import tensorflow as tf
from keras.models import load_model
from PIL import Image, ImageOps

class FacePipeline:
    """
    Engine terpadu AI Pengenal Wajah Artacom HRMS
    1. Detector: YOLOv11 (primer) + OpenCV Haar Cascade (fallback).
    2. Embedder: MobileNetV2 128-d vektor.
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

        # Inisialisasi OpenCV Haar Cascade sebagai fallback detector
        haar_path = cv2.data.haarcascades + 'haarcascade_frontalface_default.xml'
        self.haar_cascade = cv2.CascadeClassifier(haar_path)
        if self.haar_cascade.empty():
            print("[FacePipeline] WARNING: Haar Cascade gagal dimuat!")
        else:
            print(f"[FacePipeline] OpenCV Haar Cascade loaded (fallback detector)")

    def _detect_face_haar(self, img, target_size=(160, 160)):
        """
        Fallback: Deteksi wajah menggunakan OpenCV Haar Cascade.
        Lebih handal untuk foto selfie frontal dari kamera HP.
        """
        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
        gray = cv2.equalizeHist(gray)  # Perbaiki kontras untuk pencahayaan rendah

        faces = self.haar_cascade.detectMultiScale(
            gray,
            scaleFactor=1.1,
            minNeighbors=4,
            minSize=(60, 60),
            flags=cv2.CASCADE_SCALE_IMAGE
        )

        if len(faces) == 0:
            print(f"[FacePipeline] Haar Cascade juga tidak mendeteksi wajah")
            return None, (0, 0, 0, 0), False

        # Ambil wajah terbesar (biasanya yang paling dekat kamera)
        faces_sorted = sorted(faces, key=lambda f: f[2] * f[3], reverse=True)
        x, y, w_box, h_box = faces_sorted[0]

        print(f"[FacePipeline] Haar Cascade mendeteksi wajah: bbox=({x},{y},{x+w_box},{y+h_box}), size={w_box}x{h_box}")

        # Padding 15% untuk Haar (cenderung crop lebih ketat)
        h, w, _ = img.shape
        margin_x = int(w_box * 0.15)
        margin_y = int(h_box * 0.15)

        crop_x1 = max(0, x - margin_x)
        crop_y1 = max(0, y - margin_y)
        crop_x2 = min(w, x + w_box + margin_x)
        crop_y2 = min(h, y + h_box + margin_y)

        cropped = img[crop_y1:crop_y2, crop_x1:crop_x2]
        if cropped.size == 0:
            return None, (0, 0, 0, 0), False

        resized_face = cv2.resize(cropped, target_size)
        return resized_face, (x, y, x + w_box, y + h_box), True

    def detect_and_crop_face(self, image_path_or_array, target_size=(160, 160), min_conf=0.25):
        """
        Mendeteksi wajah pada gambar & melakukan crop.
        Strategi: YOLO (primer) -> Haar Cascade (fallback).
        """
        if isinstance(image_path_or_array, str):
            try:
                pil_img = Image.open(image_path_or_array)
                pil_img = ImageOps.exif_transpose(pil_img)
                pil_img = pil_img.convert("RGB")
                nparr = np.array(pil_img)
                img = cv2.cvtColor(nparr, cv2.COLOR_RGB2BGR)
            except Exception as e:
                img = cv2.imread(image_path_or_array)
            if img is None:
                raise ValueError(f"Tidak dapat membaca gambar dari {image_path_or_array}")
        else:
            img = image_path_or_array

        # === Tahap 1: Coba YOLO terlebih dahulu ===
        results = self.detector(img, verbose=False, conf=min_conf)
        boxes = results[0].boxes

        if len(boxes) == 0:
            # === Tahap 2: Fallback ke OpenCV Haar Cascade ===
            print(f"[FacePipeline] YOLO tidak mendeteksi wajah ({img.shape[1]}x{img.shape[0]}), mencoba Haar Cascade...")
            return self._detect_face_haar(img, target_size)

        # Ambil bounding box dengan tingkat kepercayaan (confidence) tertinggi
        best_box = max(boxes, key=lambda b: float(b.conf[0]))
        confidence = float(best_box.conf[0])
        x1, y1, x2, y2 = map(int, best_box.xyxy[0].tolist())
        box_w = x2 - x1
        box_h = y2 - y1

        print(f"[FacePipeline] YOLO wajah terdeteksi: confidence={confidence:.3f}, bbox=({x1},{y1},{x2},{y2}), size={box_w}x{box_h}")

        # Pastikan ukuran bounding box tidak terlalu kecil (minimal 20x20 px)
        if box_w < 20 or box_h < 20:
            print(f"[FacePipeline] YOLO bbox terlalu kecil ({box_w}x{box_h}), mencoba Haar...")
            return self._detect_face_haar(img, target_size)

        # Padding 10% agar dahi, telinga, dan dagu ikut ter-crop
        h, w, _ = img.shape
        margin_x = int(box_w * 0.1)
        margin_y = int(box_h * 0.1)
        
        crop_x1 = max(0, x1 - margin_x)
        crop_y1 = max(0, y1 - margin_y)
        crop_x2 = min(w, x2 + margin_x)
        crop_y2 = min(h, y2 + margin_y)

        cropped = img[crop_y1:crop_y2, crop_x1:crop_x2]
        if cropped.size == 0:
            print("[FacePipeline] YOLO crop kosong, mencoba Haar...")
            return self._detect_face_haar(img, target_size)
            
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
        if not face_found or face_crop is None:
            return None, None, bbox, False

        embedding = self.extract_embedding(face_crop)
        return embedding, face_crop, bbox, True


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


def verify_face(registered_vector, current_vector, threshold=0.82):
    """
    Memverifikasi apakah wajah saat ini cocok dengan wajah terdaftar di Database HRMS.
    """
    score = compute_similarity(registered_vector, current_vector)
    is_match = score >= threshold
    print(f"[FacePipeline] Verifikasi: similarity={score:.4f}, threshold={threshold}, match={is_match}")
    return is_match, score
