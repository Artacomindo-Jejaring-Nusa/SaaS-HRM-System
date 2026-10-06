# HRMS Face Recognition Service (ArcFace)

Microservice pengenalan wajah untuk **absensi Mobile App (Flutter)**. Absensi web tidak memakai service ini.

- Deteksi & alignment: MTCNN (`align/`)
- Embedding: ArcFace IR-50 trained on MS1M → vektor **512-d**
- Pencocokan: cosine similarity (default threshold `0.45`, atur via `FACE_RECOGNITION_THRESHOLD`)

Kode & model berasal dari [face.evoLVe](https://github.com/ZhaoJ9014/face.evoLVe.PyTorch) (MIT License).

## Model (WAJIB)

Download `backbone_ir50_ms1m_epoch120.pth` dari
[Google Drive](https://drive.google.com/drive/folders/1omzvXV_djVIW2A7I09DWMe9JR-9o_MYh) lalu simpan ke:

```
face-recog-ArcFace/checkpoint/backbone_ir50_ms1m_epoch120.pth
```

Path dapat diubah dengan env `ARCFACE_MODEL_PATH`.

## Menjalankan

```bash
python -m venv venv
venv\Scripts\pip install -r requirements.txt   # Linux: venv/bin/pip
venv\Scripts\python server.py                  # http://localhost:8001
```

Docker: service `ai-service` di `docker-compose.yml` sudah menunjuk ke folder ini.

## Endpoint

| Method | Path | Keterangan |
|---|---|---|
| GET | `/health` | Status model |
| POST | `/api/face/extract` | `file` / `image_base64` → `embedding` 512-d |
| POST | `/api/face/verify` | `file` / `image_base64` + `registered_embedding` (JSON) + `threshold` |
| POST | `/api/face/compare-vectors` | Bandingkan 2 vektor |

CLI fallback (dipakai Laravel jika HTTP tidak tersedia): `python cli.py extract|verify ...`