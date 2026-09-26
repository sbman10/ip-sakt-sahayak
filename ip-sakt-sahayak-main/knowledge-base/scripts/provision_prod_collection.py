"""
knowledge-base/scripts/provision_prod_collection.py
-----------------------------------------------------
Provisions the official production collection 'ragvyn_prod_v1' on Qdrant Cloud.

Schema Specifications:
  Dense Vector:
    - name: bge_m3
    - size: 1024
    - distance: Cosine
    - datatype: float32
    - on_disk: false

  Sparse Vector:
    - name: bm25
    - modifier: IDF
    - on_disk: true

  Payload Indexes:
    - jurisdiction: keyword
    - authority: keyword
    - document_type: keyword
    - domain: keyword
    - document_id: keyword
    - section: keyword
    - language: keyword
    - parent_section: keyword
    - publication_date: datetime
    - priority_date: datetime

Safety Rules:
  - If ragvyn_prod_v1 already exists, abort immediately.
  - Do not overwrite or recreate automatically.
  - Requires explicit --confirm flag.
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path
from typing import Any, Dict

ROOT_DIR = Path(__file__).resolve().parent.parent.parent
BACKEND_DIR = ROOT_DIR / "backend"
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from qdrant_client import models as qmodels
from app.services.qdrant_hybrid_store import (
    DENSE_DIMENSION,
    DENSE_DISTANCE,
    DENSE_VECTOR_NAME,
    SPARSE_MODIFIER,
    SPARSE_VECTOR_NAME,
    qdrant_hybrid_store,
)

TARGET_COLLECTION = "ragvyn_prod_v1"

REQUIRED_KEYWORD_INDEXES = [
    "jurisdiction",
    "authority",
    "document_type",
    "domain",
    "document_id",
    "section",
    "language",
    "parent_section",
]

REQUIRED_DATETIME_INDEXES = [
    "publication_date",
    "priority_date",
]


def provision_production_collection(confirm: bool = False) -> Dict[str, Any]:
    if not confirm:
        raise ValueError(
            "Provisioning the production collection requires explicit confirmation (--confirm flag). "
            "Aborting."
        )

    print("=" * 80)
    print(f"  PROVISIONING PRODUCTION QDRANT COLLECTION: '{TARGET_COLLECTION}'")
    print("=" * 80)

    client = qdrant_hybrid_store.get_client()

    # 1. Existence check - abort immediately if already exists
    existing = [c.name for c in client.get_collections().collections]
    if TARGET_COLLECTION in existing:
        raise RuntimeError(
            f"FATAL: Collection '{TARGET_COLLECTION}' already exists on Qdrant cluster. "
            f"Overwriting or recreation is strictly prohibited. Aborting."
        )

    print(f"[1/4] Verified '{TARGET_COLLECTION}' does not exist on cluster.")

    # 2. Create collection with exact production schema
    print(f"[2/4] Creating collection with dense on_disk=False and sparse on_disk=True...")
    client.create_collection(
        collection_name=TARGET_COLLECTION,
        vectors_config={
            DENSE_VECTOR_NAME: qmodels.VectorParams(
                size=DENSE_DIMENSION,
                distance=DENSE_DISTANCE,
                datatype=qmodels.Datatype.FLOAT32,
                on_disk=False,  # In-memory for production performance
            )
        },
        sparse_vectors_config={
            SPARSE_VECTOR_NAME: qmodels.SparseVectorParams(
                modifier=SPARSE_MODIFIER,
                index=qmodels.SparseIndexParams(on_disk=True),
            )
        },
        on_disk_payload=True,
    )
    print(f"  [OK] Collection '{TARGET_COLLECTION}' created.")

    # 3. Create payload indexes
    print(f"[3/4] Creating payload indexes...")
    for field in REQUIRED_KEYWORD_INDEXES:
        client.create_payload_index(
            collection_name=TARGET_COLLECTION,
            field_name=field,
            field_schema=qmodels.PayloadSchemaType.KEYWORD,
        )
        print(f"  [OK] Keyword index: '{field}'")

    for field in REQUIRED_DATETIME_INDEXES:
        client.create_payload_index(
            collection_name=TARGET_COLLECTION,
            field_name=field,
            field_schema=qmodels.PayloadSchemaType.DATETIME,
        )
        print(f"  [OK] Datetime index: '{field}'")

    # 4. Rigorous schema verification
    print(f"[4/4] Verifying production collection schema...")
    schema = qdrant_hybrid_store.verify_collection_schema(TARGET_COLLECTION)
    col_info = client.get_collection(TARGET_COLLECTION)

    dense_params = col_info.config.params.vectors[DENSE_VECTOR_NAME]
    sparse_params = col_info.config.params.sparse_vectors[SPARSE_VECTOR_NAME]
    payload_schema = col_info.payload_schema or {}

    # Strict invariant validation
    if dense_params.size != 1024:
        raise RuntimeError(f"Dense dimension mismatch: expected 1024, got {dense_params.size}")
    if dense_params.distance != qmodels.Distance.COSINE:
        raise RuntimeError(f"Dense distance mismatch: expected Cosine, got {dense_params.distance}")
    if dense_params.on_disk is not False:
        raise RuntimeError(f"Dense on_disk mismatch: expected False, got {dense_params.on_disk}")
    if sparse_params.modifier != qmodels.Modifier.IDF:
        raise RuntimeError(f"Sparse modifier mismatch: expected IDF, got {sparse_params.modifier}")

    for k in REQUIRED_KEYWORD_INDEXES:
        if k not in payload_schema:
            raise RuntimeError(f"Missing required keyword index: {k}")

    for dt in REQUIRED_DATETIME_INDEXES:
        if dt not in payload_schema:
            raise RuntimeError(f"Missing required datetime index: {dt}")
        dt_type = str(getattr(payload_schema[dt], "data_type", "")).lower()
        if "datetime" not in dt_type:
            raise RuntimeError(f"Expected DATETIME index for {dt}, got {payload_schema[dt].data_type}")

    print("\n" + "=" * 80)
    print(f"  SUCCESS: '{TARGET_COLLECTION}' PROVISIONED AND VERIFIED.")
    print(f"  Status: {col_info.status.value if hasattr(col_info.status, 'value') else col_info.status}")
    print(f"  Dense: {DENSE_VECTOR_NAME} (size=1024, Cosine, float32, on_disk=False)")
    print(f"  Sparse: {SPARSE_VECTOR_NAME} (IDF, on_disk=True)")
    print(f"  Payload indexes ({len(payload_schema)}): {list(payload_schema.keys())}")
    print("=" * 80 + "\n")

    return schema


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Provision ragvyn_prod_v1 production collection")
    parser.add_argument("--confirm", action="store_true", help="Explicit confirmation to create production collection")
    args = parser.parse_args()

    if not args.confirm:
        print("ERROR: --confirm flag is required to provision ragvyn_prod_v1.")
        sys.exit(1)

    provision_production_collection(confirm=True)
