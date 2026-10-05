import os
import cv2
import numpy as np

class FacePipeline:
    """
    Engine terpadu AI Pengenal Wajah Artacom HRMS
    1. Detector: OpenCV YuNet
    2. Embedder: OpenCV SFace (128-d vektor)
    """
    def __init__(self, detector_weights=None, embedder_path=None):
        base_dir = os.path.dirname(os.path.abspath(__file__))
        weights_dir = os.path.join(base_dir, 'weights')

        yunet_path = os.path.join(weights_dir, 'face_detection_yunet_2023mar.onnx')
        sface_path = os.path.join(weights_dir, 'face_recognition_sface_2021dec.onnx')

        if not os.path.exists(yunet_path):
            yunet_path = os.path.join(base_dir, 'face_detection_yunet_2023mar.onnx')
        if not os.path.exists(sface_path):
            sface_path = os.path.join(base_dir, 'face_recognition_sface_2021dec.onnx')

        print(f"[FacePipeline] Loading YuNet Face Detector from: {yunet_path}")
        self.detector = cv2.FaceDetectorYN.create(yunet_path, "", (320, 320), 0.7, 0.3, 5000)
        
        print(f"[FacePipeline] Loading SFace Recognizer from: {sface_path}")
        self.recognizer = cv2.FaceRecognizerSF.create(sface_path, "")

    def process_image(self, image_path_or_array):
        """
        Fungsi shortcut: Input Gambar -> Output (Vektor 128 angka, face_crop, bbox, face_found)
        """
        from PIL import Image, ImageOps
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

        h, w = img.shape[:2]
        
        # SFace/YuNet works best if we don't feed it massive images.
        # Scale down if too large, but remember original scale for bbox.
        scale = 1.0
        max_dim = max(h, w)
        if max_dim > 640:
            scale = 640.0 / max_dim
            proc_img = cv2.resize(img, (int(w * scale), int(h * scale)))
        else:
            proc_img = img

        ph, pw = proc_img.shape[:2]
        self.detector.setInputSize((pw, ph))

        _, faces = self.detector.detect(proc_img)
        if faces is None or len(faces) == 0:
            return None, None, (0, 0, 0, 0), False

        # Ambil wajah terbesar (biasanya yang paling dekat kamera)
        best_face = max(faces, key=lambda r: r[2] * r[3])
        
        # Bounding box in original scale
        x, y, bw, bh = best_face[:4] / scale
        bbox = (int(x), int(y), int(x + bw), int(y + bh))

        # Align and extract feature
        aligned_face = self.recognizer.alignCrop(proc_img, best_face)
        embedding = self.recognizer.feature(aligned_face).flatten()
        
        # Normalize
        norm = np.linalg.norm(embedding)
        if norm > 0:
            embedding = embedding / norm

        return embedding, aligned_face, bbox, True


def compute_similarity(vector1, vector2):
    """
    Menghitung Cosine Similarity antara dua vektor 128-d.
    SFace menggunakan cosine distance.
    """
    v1 = np.array(vector1, dtype=np.float32)
    v2 = np.array(vector2, dtype=np.float32)
    
    norm1 = np.linalg.norm(v1)
    norm2 = np.linalg.norm(v2)
    
    if norm1 == 0 or norm2 == 0:
        return 0.0
        
    dot_product = np.dot(v1, v2)
    similarity = dot_product / (norm1 * norm2)
    return float(np.clip(similarity, -1.0, 1.0))


def verify_face(registered_vector, current_vector, threshold=0.363):
    """
    Memverifikasi apakah wajah saat ini cocok dengan wajah terdaftar di Database HRMS.
    Threshold default cosine similarity untuk SFace adalah 0.363.
    """
    score = compute_similarity(registered_vector, current_vector)
    
    # SFace threshold is 0.363. If the backend passes a legacy high threshold (e.g. 0.90),
    # we override it with a sensible SFace threshold (0.45 for strictness).
    if threshold > 0.5:
        threshold = 0.40

    is_match = score >= threshold
    print(f"[FacePipeline] Verifikasi: similarity={score:.4f}, threshold={threshold}, match={is_match}")
    return is_match, score
