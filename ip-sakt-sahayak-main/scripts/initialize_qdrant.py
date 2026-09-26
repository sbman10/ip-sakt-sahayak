"""
scripts/initialize_qdrant.py
----------------------------
Idempotent initialization script for Qdrant Cloud vector collections.
Ensures collections exist with size=1024 and Distance=COSINE:
  - india_statutes
  - international_treaties
  - user_uploads

Usage:
  python scripts/initialize_qdrant.py
"""

from __future__ import annotations

import os
import sys
from pathlib import Path

# Setup import path for backend/app
project_root = Path(__file__).resolve().parents[1]
backend_dir = project_root / "backend"
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

from app.core.config import settings
from app.services.qdrant_service import qdrant_service


def main() -> int:
    print("=" * 60)
    print("IP-SAKTI Sahayak — Qdrant Cloud Collection Initializer")
    print("=" * 60)
    print(f"Qdrant URL: {settings.QDRANT_URL or 'In-Memory / Local'}")
    print(f"Target Collections:")
    print(f"  - India Statutes:         {settings.QDRANT_INDIA_COLLECTION}")
    print(f"  - International Treaties: {settings.QDRANT_INTERNATIONAL_COLLECTION}")
    print(f"  - User Uploads:           {settings.QDRANT_USER_UPLOADS_COLLECTION}")
    print(f"Vector Dimension: 1024 (BAAI/bge-m3)")
    print(f"Distance Metric:  Cosine")
    print("-" * 60)

    try:
        created = qdrant_service.ensure_collections()
        for col, status in created.items():
            print(f"[{status.upper()}] Collection '{col}'")

        # Verify collection status
        print("\nVerifying collection configurations:")
        all_ok = True
        for col in [
            settings.QDRANT_INDIA_COLLECTION,
            settings.QDRANT_INTERNATIONAL_COLLECTION,
            settings.QDRANT_USER_UPLOADS_COLLECTION,
        ]:
            info = qdrant_service.get_collection_info(col)
            if info:
                dim = info.get("vector_size")
                dist = info.get("distance")
                points = info.get("points_count", 0)
                status = info.get("status")
                print(f"  OK: '{col}' -> dim={dim}, distance={dist}, points={points}, status={status}")
                if dim != 1024 or dist != "Cosine":
                    print(f"  ERROR: Expected dim=1024 and distance=Cosine, got dim={dim}, dist={dist}")
                    all_ok = False
            else:
                print(f"  ERROR: Could not retrieve info for '{col}'")
                all_ok = False

        if all_ok:
            print("\nSUCCESS: All Qdrant collections initialized and verified.")
            return 0
        else:
            print("\nFAILURE: One or more collections failed verification.")
            return 1

    except Exception as exc:
        print(f"\nFATAL ERROR: Failed to initialize Qdrant collections: {exc}")
        import traceback
        traceback.print_exc()
        return 1


if __name__ == "__main__":
    sys.exit(main())
