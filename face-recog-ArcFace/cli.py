"""
CLI fallback dipanggil oleh Laravel jika HTTP service tidak dapat dijangkau.

  python cli.py extract --image foto.jpg
  python cli.py verify  --image foto.jpg --registered-embedding emb.json [--threshold 0.45]
"""
import argparse
import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from face_service import DEFAULT_THRESHOLD, EMBEDDING_DIM, FaceNotFoundError, get_engine  # noqa: E402


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("command", choices=["extract", "verify"])
    parser.add_argument("--image", required=True)
    parser.add_argument("--registered-embedding")
    parser.add_argument("--threshold", type=float, default=DEFAULT_THRESHOLD)
    args = parser.parse_args()

    try:
        engine = get_engine()
        emb, bbox, face_count = engine.get_embedding(args.image)
    except FaceNotFoundError as e:
        if args.command == "extract":
            out = {"success": False, "face_detected": False, "embedding": [], "message": str(e)}
        else:
            out = {"success": True, "face_detected": False, "is_match": False, "similarity": 0.0,
                   "similarity_percentage": 0.0, "threshold": args.threshold, "message": str(e)}
        print(json.dumps(out))
        return
    except Exception as e:
        print(json.dumps({"success": False, "is_match": False, "similarity": 0.0, "message": str(e)}))
        sys.exit(1)

    if args.command == "extract":
        print(json.dumps({"success": True, "face_detected": True, "face_count": face_count,
                          "bbox": bbox, "embedding": emb.tolist()}))
        return

    with open(args.registered_embedding, "r", encoding="utf-8") as f:
        reg = json.load(f)
    if not isinstance(reg, list) or len(reg) != EMBEDDING_DIM:
        print(json.dumps({"success": False, "is_match": False, "similarity": 0.0,
                          "message": f"Embedding terdaftar harus {EMBEDDING_DIM}-d."}))
        return

    sim = engine.compare(reg, emb)
    print(json.dumps({
        "success": True, "face_detected": True, "is_match": sim >= args.threshold,
        "similarity": round(sim, 4), "similarity_percentage": round(sim * 100, 1),
        "threshold": args.threshold,
    }))


if __name__ == "__main__":
    main()
