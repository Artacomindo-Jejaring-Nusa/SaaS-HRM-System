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

        # Inisialisasi OpenCV Haar Cascade sebagai fallback detector (multi-cascade untuk akurasi maksimal)
        self.haar_cascades = []
        cascade_names = [
            'haarcascade_frontalface_alt2.xml',
            'haarcascade_frontalface_default.xml',
            'haarcascade_profileface.xml'
        ]
        for cname in cascade_names:
            cpath = cv2.data.haarcascades + cname
            if os.path.exists(cpath):
                cascade = cv2.CascadeClassifier(cpath)
                if not cascade.empty():
                    self.haar_cascades.append((cname, cascade))
                    print(f"[FacePipeline] OpenCV Haar Cascade loaded: {cname}")

    def _detect_face_haar(self, img, target_size=(160, 160)):
        """
        Fallback: Deteksi wajah menggunakan OpenCV Haar Cascade (multi-cascade & multi-scale).
        Lebih handal untuk foto selfie frontal dari kamera HP.
        """
        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
        gray = cv2.equalizeHist(gray)  # Perbaiki kontras untuk pencahayaan rendah

        best_faces = ()
        for name, cascade in self.haar_cascades:
            faces = cascade.detectMultiScale(
                gray,
                scaleFactor=1.08,
                minNeighbors=3,
                minSize=(50, 50),
                flags=cv2.CASCADE_SCALE_IMAGE
            )
            if len(faces) > 0:
                print(f"[FacePipeline] Haar Cascade ({name}) mendeteksi {len(faces)} wajah")
                best_faces = faces
                break

        if len(best_faces) == 0:
            return None, (0, 0, 0, 0), False

        # Ambil wajah terbesar (biasanya yang paling dekat kamera)
        faces_sorted = sorted(best_faces, key=lambda f: f[2] * f[3], reverse=True)
        x, y, w_box, h_box = faces_sorted[0]

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

    def _detect_single_orientation(self, img, target_size=(160, 160), min_conf=0.20):
        """
        Mendeteksi wajah pada satu orientasi gambar: YOLO (primer) -> Haar Cascade (fallback).
        """
        # === Tahap 1: Coba YOLO terlebih dahulu ===
        try:
            results = self.detector(img, verbose=False, conf=min_conf)
            boxes = results[0].boxes

            if len(boxes) > 0:
                best_box = max(boxes, key=lambda b: float(b.conf[0]))
                confidence = float(best_box.conf[0])
                x1, y1, x2, y2 = map(int, best_box.xyxy[0].tolist())
                box_w = x2 - x1
                box_h = y2 - y1

                if box_w >= 20 and box_h >= 20:
                    h, w, _ = img.shape
                    margin_x = int(box_w * 0.1)
                    margin_y = int(box_h * 0.1)

                    crop_x1 = max(0, x1 - margin_x)
                    crop_y1 = max(0, y1 - margin_y)
                    crop_x2 = min(w, x2 + margin_x)
                    crop_y2 = min(h, y2 + margin_y)

                    cropped = img[crop_y1:crop_y2, crop_x1:crop_x2]
                    if cropped.size > 0:
                        resized_face = cv2.resize(cropped, target_size)
                        print(f"[FacePipeline] YOLO wajah terdeteksi: conf={confidence:.3f}, bbox=({x1},{y1},{x2},{y2})")
                        return resized_face, (x1, y1, x2, y2), True
        except Exception as e:
            print(f"[FacePipeline] YOLO detection error: {e}")

        # === Tahap 2: Fallback ke Haar Cascade ===
        return self._detect_face_haar(img, target_size)

    def detect_and_crop_face(self, image_path_or_array, target_size=(160, 160), min_conf=0.20):
        """
        Mendeteksi wajah pada gambar & melakukan crop.
        Strategi:
        1. Coba orientasi asli (0°).
        2. Jika gagal, coba rotasi 90°, 270°, 180° (mengatasi sensor orientation portrait Android).
        3. Fallback Smart Center-Crop (area selfie oval) agar kemiripan wajah tetap dapat dihitung.
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

        # 1. Coba deteksi orientasi asli (0°)
        crop, bbox, found = self._detect_single_orientation(img, target_size, min_conf)
        if found:
            return crop, bbox, True

        # 2. Jika gagal, coba rotasi (kamera selfie HP sering kali menyimpan orientasi 270° atau 90°)
        rotations = [
            (cv2.ROTATE_90_CLOCKWISE, "90° CW"),
            (cv2.ROTATE_90_COUNTERCLOCKWISE, "270° CW / 90° CCW"),
            (cv2.ROTATE_180, "180° Inverted"),
        ]
        for rot_code, rot_name in rotations:
            rotated_img = cv2.rotate(img, rot_code)
            crop, bbox, found = self._detect_single_orientation(rotated_img, target_size, min_conf)
            if found:
                print(f"[FacePipeline] Wajah berhasil ditemukan setelah rotasi {rot_name}!")
                return crop, bbox, True

        # 3. Fallback Cerdas: Smart Center-Crop
        # Pada selfie absensi, wajah pengguna diposisikan di dalam oval guide layar.
        # Jika detector tidak menemukan bbox (misal pencahayaan redup atau backlight),
        # potong area tengah atas (center 65%) agar vektor embedding tetap diekstrak dan skor kemiripan dihitung.
        print("[FacePipeline] Detector tidak menemukan bbox spesifik, menggunakan Smart Center-Crop Fallback...")
        h, w, _ = img.shape
        crop_w = int(w * 0.65)
        crop_h = int(h * 0.65)
        x1 = max(0, (w - crop_w) // 2)
        y1 = max(0, int((h - crop_h) * 0.35))
        x2 = min(w, x1 + crop_w)
        y2 = min(h, y1 + crop_h)

        center_cropped = img[y1:y2, x1:x2]
        if center_cropped.size > 0:
            resized_face = cv2.resize(center_cropped, target_size)
            return resized_face, (x1, y1, x2, y2), True

        return None, (0, 0, 0, 0), False

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
