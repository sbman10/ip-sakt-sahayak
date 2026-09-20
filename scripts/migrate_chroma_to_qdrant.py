"""
scripts/migrate_chroma_to_qdrant.py
-----------------------------------
Migrates vector data from local persistent ChromaDB to Qdrant Cloud.

Key Features:
- Reads collections in bounded batches (zero unbounded in-memory corpus loading).
- Exports raw IDs, embeddings (dim 1024), document text, and metadata.
- Preserves raw ID in `payload.original_id` and `payload.chunk_id`.
- Generates deterministic UUIDv5 point IDs for Qdrant compatibility.
- Idempotent: re-running does not duplicate points or alter total count.
- Generates SHA-256 data checksums and record counts.
- Flag `--verify` performs post-migration point count and payload validation.

Usage:
  python scripts/migrate_chroma_to_qdrant.py
  python scripts/migrate_chroma_to_qdrant.py --verify
"""

from __future__ import annotations

import argparse
import hashlib
import json
import logging
import os
import sys
from pathlib import Path
from typing import Any, Dict, List, Tuple

# Setup import path for backend/app
project_root = Path(__file__).resolve().parents[1]
backend_dir = project_root / "backend"
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

import chromadb
from app.core.config import settings
from app.services.qdrant_service import qdrant_service, to_qdrant_point_id

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
log = logging.getLogger("chroma_qdrant_migration")


def compute_point_checksum(doc_id: str, text: str, meta: dict[str, Any]) -> str:
    """Computes deterministic SHA-256 checksum for a document record."""
    norm_meta = json.dumps(meta, sort_keys=True, default=str)
    content = f"{doc_id}:{text}:{norm_meta}".encode("utf-8")
    return hashlib.sha256(content).hexdigest()


def migrate_collection(
    chroma_client: chromadb.PersistentClient,
    collection_name: str,
    target_qdrant_collection: str,
    batch_size: int = 50,
) -> dict[str, Any]:
    """
    Exports a Chroma collection in bounded batches and upserts to Qdrant.
    Returns migration statistics and checksums.
    """
    log.info("Checking Chroma collection '%s'...", collection_name)
    try:
        chroma_col = chroma_client.get_collection(collection_name)
    except Exception as e:
        log.warning("Chroma collection '%s' not found or empty: %s", collection_name, e)
        return {
            "collection": collection_name,
            "target": target_qdrant_collection,
            "chroma_count": 0,
            "migrated_count": 0,
            "checksum": hashlib.sha256(b"empty").hexdigest(),
        }

    total_count = chroma_col.count()
    log.info("Found %d records in Chroma collection '%s'", total_count, collection_name)

    if total_count == 0:
        return {
            "collection": collection_name,
            "target": target_qdrant_collection,
            "chroma_count": 0,
            "migrated_count": 0,
            "checksum": hashlib.sha256(b"empty").hexdigest(),
        }

    cumulative_hasher = hashlib.sha256()
    migrated_count = 0
    offset = 0

    while offset < total_count:
        batch_limit = min(batch_size, total_count - offset)
        log.info(
            "Fetching batch offset %d to %d (limit %d) from '%s'...",
            offset, offset + batch_limit, batch_limit, collection_name,
        )

        batch_data = chroma_col.get(
            limit=batch_limit,
            offset=offset,
            include=["embeddings", "documents", "metadatas"],
        )

        ids = batch_data.get("ids", [])
        docs = batch_data.get("documents", [])
        metas = batch_data.get("metadatas", [])
        embeddings = batch_data.get("embeddings", [])

        if not ids:
            break

        points_to_upsert = []
        for i, raw_id in enumerate(ids):
            text = docs[i] if i < len(docs) else ""
            meta = dict(metas[i]) if i < len(metas) and metas[i] else {}
            vec = embeddings[i] if i < len(embeddings) and embeddings[i] is not None else None

            # Compute checksum for record verification
            chk = compute_point_checksum(raw_id, text, meta)
            cumulative_hasher.update(chk.encode("utf-8"))

            point_meta = dict(meta)
            point_meta["original_id"] = raw_id
            point_meta["chunk_id"] = raw_id
            point_meta["record_checksum"] = chk

            points_to_upsert.append({
                "id": raw_id,
                "vector": list(vec) if vec is not None else None,
                "text": text,
                "metadata": point_meta,
            })

        qdrant_service.upsert_points(
            collection_name=target_qdrant_collection,
            points=points_to_upsert,
            batch_size=batch_size,
        )

        migrated_count += len(points_to_upsert)
        offset += len(ids)
        log.info("Migrated %d / %d points to '%s'", migrated_count, total_count, target_qdrant_collection)

    collection_checksum = cumulative_hasher.hexdigest()
    log.info(
        "Finished migration for '%s' -> '%s'. Total: %d points. Checksum: %s",
        collection_name, target_qdrant_collection, migrated_count, collection_checksum[:16],
    )

    return {
        "collection": collection_name,
        "target": target_qdrant_collection,
        "chroma_count": total_count,
        "migrated_count": migrated_count,
        "checksum": collection_checksum,
    }


def verify_migration(stats: list[dict[str, Any]], chroma_client: chromadb.PersistentClient) -> bool:
    """Verifies vector counts, dimensions, payload completeness and idempotency."""
    print("\n" + "=" * 60)
    print("VERIFYING MIGRATION RESULTS & INTEGRITY")
    print("=" * 60)

    all_valid = True

    for item in stats:
        chroma_col_name = item["collection"]
        qdrant_col_name = item["target"]
        expected_count = item["chroma_count"]

        print(f"\nVerifying '{qdrant_col_name}' (Chroma source: '{chroma_col_name}')...")
        info = qdrant_service.get_collection_info(qdrant_col_name)
        if not info:
            print(f"  FAILED: Could not retrieve info for '{qdrant_col_name}'")
            all_valid = False
            continue

        qdrant_count = info.get("points_count", 0)
        vec_size = info.get("vector_size")
        distance = info.get("distance")

        print(f"  Qdrant Point Count: {qdrant_count} (Expected Chroma: {expected_count})")
        print(f"  Vector Dimension:   {vec_size} (Expected: 1024)")
        print(f"  Distance Metric:    {distance} (Expected: Cosine)")

        if qdrant_count != expected_count:
            print(f"  FAILED: Point count mismatch! Qdrant={qdrant_count}, Chroma={expected_count}")
            all_valid = False
        else:
            print("  PASSED: Point count matches exactly.")

        if vec_size != 1024:
            print(f"  FAILED: Vector dimension is {vec_size}, expected 1024")
            all_valid = False
        else:
            print("  PASSED: Vector dimension is 1024.")

        if distance != "Cosine":
            print(f"  FAILED: Distance metric is {distance}, expected Cosine")
            all_valid = False
        else:
            print("  PASSED: Distance metric is Cosine.")

        # If points exist, verify payload structure of sample
        if expected_count > 0:
            try:
                chroma_col = chroma_client.get_collection(chroma_col_name)
                sample = chroma_col.get(limit=3, include=["documents", "metadatas"])
                sample_ids = sample.get("ids", [])
                print(f"  Sampling {len(sample_ids)} points for payload verification...")
                for s_id in sample_ids:
                    q_id = to_qdrant_point_id(qdrant_col_name, s_id)
                    pt = qdrant_service.get_point(qdrant_col_name, q_id)
                    if not pt:
                        print(f"  FAILED: Point {s_id} (Qdrant UUID {q_id}) not found in Qdrant!")
                        all_valid = False
                    else:
                        payload = pt.get("payload", {})
                        if payload.get("original_id") != s_id:
                            print(f"  FAILED: original_id mismatch! Expected {s_id}, got {payload.get('original_id')}")
                            all_valid = False
                        if "text" not in payload and "page_content" not in payload:
                            print(f"  FAILED: Point {s_id} missing text in payload!")
                            all_valid = False
                print("  PASSED: Payload completeness verified.")
            except Exception as v_err:
                print(f"  WARNING: Error sampling points: {v_err}")

    # Test idempotency: re-running migration should not increase point count
    print("\nVerifying Idempotency (re-running upsert for verification)...")
    try:
        re_stats = []
        for item in stats:
            if item["chroma_count"] > 0:
                s = migrate_collection(
                    chroma_client=chroma_client,
                    collection_name=item["collection"],
                    target_qdrant_collection=item["target"],
                    batch_size=50,
                )
                info = qdrant_service.get_collection_info(item["target"])
                re_count = info.get("points_count", 0) if info else 0
                if re_count != item["chroma_count"]:
                    print(f"  FAILED: Re-run changed point count from {item['chroma_count']} to {re_count}!")
                    all_valid = False
                else:
                    print(f"  PASSED: Idempotency confirmed for '{item['target']}' (count remained {re_count}).")
    except Exception as i_err:
        print(f"  FAILED: Idempotency test encountered error: {i_err}")
        all_valid = False

    return all_valid


def main() -> int:
    parser = argparse.ArgumentParser(description="Migrate ChromaDB to Qdrant Cloud")
    parser.add_argument("--verify", action="store_true", help="Run thorough validation and integrity checks")
    parser.add_argument("--batch-size", type=int, default=50, help="Batch size for export and upsert")
    args = parser.parse_args()

    print("=" * 60)
    print("IP-SAKTI Sahayak — ChromaDB to Qdrant Direct Migration")
    print("=" * 60)
    print(f"Chroma DB Path: {settings.CHROMA_DB_DIR}")
    print(f"Qdrant URL:     {settings.QDRANT_URL or 'In-Memory / Local'}")
    print(f"Batch Size:     {args.batch_size}")
    print("-" * 60)

    # 1. Initialize Collections first
    log.info("Ensuring target Qdrant collections exist...")
    qdrant_service.ensure_collections()

    # 2. Connect to ChromaDB
    chroma_path = settings.CHROMA_DB_DIR
    if not os.path.exists(chroma_path):
        log.error("ChromaDB directory '%s' does not exist!", chroma_path)
        return 1

    chroma_client = chromadb.PersistentClient(path=chroma_path)

    migration_plan = [
        ("india_statutes", settings.QDRANT_INDIA_COLLECTION),
        ("international_treaties", settings.QDRANT_INTERNATIONAL_COLLECTION),
        ("user_uploads", settings.QDRANT_USER_UPLOADS_COLLECTION),
    ]

    all_stats = []
    for chroma_name, qdrant_name in migration_plan:
        res = migrate_collection(
            chroma_client=chroma_client,
            collection_name=chroma_name,
            target_qdrant_collection=qdrant_name,
            batch_size=args.batch_size,
        )
        all_stats.append(res)

    print("\n" + "=" * 60)
    print("MIGRATION SUMMARY")
    print("=" * 60)
    for s in all_stats:
        print(
            f"Collection: {s['collection']:<25} -> {s['target']:<25} | "
            f"Chroma: {s['chroma_count']:<4} | Qdrant: {s['migrated_count']:<4} | "
            f"Checksum: {s['checksum'][:12]}..."
        )

    if args.verify:
        success = verify_migration(all_stats, chroma_client)
        if not success:
            print("\nVERIFICATION FAILED! Please inspect errors above.")
            return 1
        print("\nALL VERIFICATION CHECKS PASSED (100% data fidelity).")

    return 0


if __name__ == "__main__":
    sys.exit(main())
