import os
import sys
import json
import argparse
from face_engine import FacePipeline, compute_similarity, verify_face

def main():
    parser = argparse.ArgumentParser(description="CLI Bridge AI Face Pipeline HRMS")
    subparsers = parser.add_subparsers(dest="command", required=True)

    # Subcommand: extract
    extract_parser = subparsers.add_parser("extract", help="Ekstrak 128-d vektor dari file foto")
    extract_parser.add_argument("--image", required=True, help="Path ke file foto")

    # Subcommand: verify
    verify_parser = subparsers.add_parser("verify", help="Verifikasi foto saat ini terhadap vektor terdaftar")
    verify_parser.add_argument("--image", required=True, help="Path ke file foto saat ini")
    verify_parser.add_argument("--registered-embedding", required=True, help="JSON string atau path file JSON array 128 float")
    verify_parser.add_argument("--threshold", type=float, default=0.70, help="Ambang batas kemiripan (default: 0.70)")

    args = parser.parse_args()

    try:
        pipeline = FacePipeline()

        if args.command == "extract":
            if not os.path.exists(args.image):
                print(json.dumps({"success": False, "error": f"File gambar {args.image} tidak ditemukan."}))
                sys.exit(1)

            embedding, _, bbox, face_found = pipeline.process_image(args.image)
            result = {
                "success": True,
                "face_detected": face_found,
                "bbox": [int(x) for x in bbox],
                "embedding": embedding.tolist()
            }
            print(json.dumps(result))

        elif args.command == "verify":
            if not os.path.exists(args.image):
                print(json.dumps({"success": False, "error": f"File gambar {args.image} tidak ditemukan."}))
                sys.exit(1)

            # Parse embedding
            reg_input = args.registered_embedding
            if os.path.exists(reg_input):
                with open(reg_input, 'r') as f:
                    reg_vector = json.load(f)
            else:
                reg_vector = json.loads(reg_input)

            current_embedding, _, bbox, face_found = pipeline.process_image(args.image)
            is_match, similarity = verify_face(reg_vector, current_embedding, threshold=args.threshold)

            result = {
                "success": True,
                "face_detected": face_found,
                "is_match": bool(is_match),
                "similarity": round(float(similarity), 4),
                "threshold": args.threshold
            }
            print(json.dumps(result))

    except Exception as e:
        print(json.dumps({"success": False, "error": str(e)}))
        sys.exit(1)

if __name__ == "__main__":
    main()
