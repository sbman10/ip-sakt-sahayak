"""
backend/app/services/qdrant_hybrid_store.py
-------------------------------------------
Qdrant Hybrid Store Abstraction and Point Contract for IP-SAKTI Sahayak.

Enforces:
- Named dense vector: 'bge_m3' (1,024 dimensions, Cosine distance)
- Named sparse vector: 'bm25' (Modifier.IDF)
- Deterministic UUID5 point IDs from chunk identifiers (no raw strings)
- Complete payload metadata contract
- Strict validation rejecting single-vector (dense-only or sparse-only) points
- Non-destructive schema verification for the configured production collection
- Prefetch-based Reciprocal Rank Fusion (RRF) query construction
"""

from __future__ import annotations

import logging
import time
import uuid
from datetime import datetime
from typing import Any, Dict, List, Optional, Tuple, Union

from qdrant_client import QdrantClient
from qdrant_client import models as qmodels
from qdrant_client.http.exceptions import UnexpectedResponse

from app.core.config import settings

log = logging.getLogger("app.services.qdrant_hybrid_store")

DENSE_VECTOR_NAME = "bge_m3"
SPARSE_VECTOR_NAME = "bm25"
DENSE_DIMENSION = 1024
DENSE_DISTANCE = qmodels.Distance.COSINE
SPARSE_MODIFIER = qmodels.Modifier.IDF

REQUIRED_IDENTITY_FIELDS = [
    "text",
    "document_id",
    "chunk_id",
    "source",
    "jurisdiction",
    "authority",
    "document_type",
    "domain",
    "section",
    "language",
    "embedding_model",
    "embedding_dimension",
    "sparse_model",
]

OPTIONAL_TEMPORAL_FIELDS = [
    "publication_date",
    "priority_date",
]

# Backward-compatibility alias
MANDATORY_PAYLOAD_FIELDS = REQUIRED_IDENTITY_FIELDS

REQUIRED_PAYLOAD_INDEXES = [
    "jurisdiction",
    "authority",
    "document_type",
    "domain",
    "document_id",
    "section",
    "language",
    "publication_date",
    "priority_date",
]

# v1 remains available as an immutable legacy collection for rollback/shadow
# checks. v2 is the current production corpus.
PRODUCTION_COLLECTIONS = {"ragvyn_prod_v1", "ragvyn_prod_v2"}


class IncompatibleSchemaError(RuntimeError):
    """Raised when a Qdrant collection does not match the required hybrid schema."""
    pass


def generate_point_id(collection_name: str, chunk_id: str) -> str:
    """
    Generate a deterministic UUID5 point ID from chunk identifier and collection scope.
    Qdrant strictly requires either unsigned 64-bit integers or valid UUID strings.
    Raw arbitrary strings are rejected.
    """
    if not chunk_id or not chunk_id.strip():
        raise ValueError("chunk_id must be a non-empty string.")
    canonical_key = f"ragvyn:{collection_name.strip()}:{chunk_id.strip()}"
    return str(uuid.uuid5(uuid.NAMESPACE_URL, canonical_key))


def build_hybrid_point(
    collection_name: str,
    chunk_id: str,
    dense_vector: List[float],
    sparse_vector: qmodels.SparseVector,
    payload: Dict[str, Any],
) -> qmodels.PointStruct:
    """
    Constructs and strictly validates a dual-vector Qdrant PointStruct.
    Rejects dense-only or sparse-only payloads and verifies metadata completeness.
    """
    # 1. Validate dense vector
    if not isinstance(dense_vector, list):
        raise TypeError(f"dense_vector must be a Python list[float], got {type(dense_vector).__name__}")
    if len(dense_vector) != DENSE_DIMENSION:
        raise ValueError(
            f"Invalid dense vector dimension for chunk '{chunk_id}': expected {DENSE_DIMENSION}, got {len(dense_vector)}"
        )

    # 2. Validate sparse vector
    if not isinstance(sparse_vector, qmodels.SparseVector):
        raise TypeError(f"sparse_vector must be a qmodels.SparseVector, got {type(sparse_vector).__name__}")
    if len(sparse_vector.indices) == 0 or len(sparse_vector.values) == 0:
        raise ValueError(f"sparse_vector indices and values cannot be empty for chunk '{chunk_id}'")
    if len(sparse_vector.indices) != len(sparse_vector.values):
        raise ValueError(f"sparse_vector indices and values length mismatch for chunk '{chunk_id}'")

    # 3. Generate deterministic UUID5 point ID
    point_id = generate_point_id(collection_name, chunk_id)

    # 4. Construct and validate complete payload
    complete_payload = dict(payload)
    complete_payload["chunk_id"] = chunk_id
    complete_payload.setdefault("embedding_model", settings.HF_EMBEDDING_MODEL)
    complete_payload.setdefault("embedding_dimension", DENSE_DIMENSION)
    complete_payload.setdefault("sparse_model", "Qdrant/bm25")

    # Validate strictly required identity fields
    for field in REQUIRED_IDENTITY_FIELDS:
        if field not in complete_payload or complete_payload[field] is None:
            raise ValueError(f"Missing mandatory payload field '{field}' for chunk '{chunk_id}'")
        if isinstance(complete_payload[field], str) and not complete_payload[field].strip():
            raise ValueError(f"Required identity field '{field}' cannot be empty for chunk '{chunk_id}'")

    # Validate optional temporal fields:
    # If missing, None, or empty, omit from payload so Qdrant datetime index never receives empty strings.
    # If present and non-empty, must be a valid ISO-8601 date. Arbitrary strings are rejected.
    for date_field in OPTIONAL_TEMPORAL_FIELDS:
        val = complete_payload.get(date_field)
        if val is None or (isinstance(val, str) and not val.strip()):
            complete_payload.pop(date_field, None)
        else:
            s_val = str(val).strip()
            # Validate ISO-8601 format
            valid_dt = None
            for fmt in ("%Y-%m-%d", "%Y-%m-%dT%H:%M:%SZ", "%Y-%m-%dT%H:%M:%S"):
                try:
                    valid_dt = datetime.strptime(s_val, fmt)
                    break
                except ValueError:
                    pass
            if valid_dt is None:
                try:
                    valid_dt = datetime.fromisoformat(s_val)
                except (ValueError, TypeError):
                    pass
            if valid_dt is None:
                raise ValueError(
                    f"Invalid ISO-8601 date for '{date_field}': '{val}' in chunk '{chunk_id}'. "
                    f"Arbitrary date strings are rejected."
                )
            complete_payload[date_field] = valid_dt.strftime("%Y-%m-%d")

    return qmodels.PointStruct(
        id=point_id,
        vector={
            DENSE_VECTOR_NAME: dense_vector,
            SPARSE_VECTOR_NAME: sparse_vector,
        },
        payload=complete_payload,
    )


class QdrantHybridStore:
    """
    Qdrant Cloud Hybrid Store managing schema validation, dual-vector indexing,
    and hybrid retrieval with Reciprocal Rank Fusion (RRF).
    """

    def __init__(
        self,
        url: Optional[str] = None,
        api_key: Optional[str] = None,
        default_collection: Optional[str] = None,
        timeout: float = 30.0,
    ) -> None:
        self.url = url or settings.QDRANT_URL
        self.api_key = api_key or settings.QDRANT_API_KEY
        self.default_collection = default_collection or settings.QDRANT_COLLECTION
        self.timeout = timeout
        self._client: Optional[QdrantClient] = None

    def get_client(self) -> QdrantClient:
        """Lazily initialize and return the QdrantClient."""
        if self._client is None:
            if not self.url:
                raise ValueError("QDRANT_URL is not configured.")
            self._client = QdrantClient(
                url=self.url,
                api_key=self.api_key or None,
                timeout=self.timeout,
            )
        return self._client

    def verify_collection_schema(self, collection_name: Optional[str] = None) -> Dict[str, Any]:
        """
        Validates that the target collection exists on Qdrant and strictly conforms
        to the hybrid vector schema and payload indexing contract.
        Does NOT automatically recreate or mutate the collection.
        """
        target = collection_name or self.default_collection
        client = self.get_client()

        # 1. Verify collection exists
        try:
            col_info = client.get_collection(collection_name=target)
        except Exception as exc:
            raise IncompatibleSchemaError(
                f"Collection '{target}' does not exist or is unreachable on Qdrant cluster: {exc}"
            ) from exc

        # 2. Verify named dense vector 'bge_m3'
        vectors_config = col_info.config.params.vectors
        if not isinstance(vectors_config, dict) or DENSE_VECTOR_NAME not in vectors_config:
            raise IncompatibleSchemaError(
                f"Collection '{target}' is missing required named dense vector '{DENSE_VECTOR_NAME}'. "
                f"Available vectors: {list(vectors_config.keys()) if isinstance(vectors_config, dict) else type(vectors_config)}"
            )

        dense_params = vectors_config[DENSE_VECTOR_NAME]
        if dense_params.size != DENSE_DIMENSION:
            raise IncompatibleSchemaError(
                f"Collection '{target}' dense vector '{DENSE_VECTOR_NAME}' size mismatch: "
                f"expected {DENSE_DIMENSION}, found {dense_params.size}"
            )
        if dense_params.distance != DENSE_DISTANCE:
            raise IncompatibleSchemaError(
                f"Collection '{target}' dense vector '{DENSE_VECTOR_NAME}' distance mismatch: "
                f"expected {DENSE_DISTANCE}, found {dense_params.distance}"
            )

        # 3. Verify named sparse vector 'bm25'
        sparse_config = col_info.config.params.sparse_vectors
        if not isinstance(sparse_config, dict) or SPARSE_VECTOR_NAME not in sparse_config:
            raise IncompatibleSchemaError(
                f"Collection '{target}' is missing required named sparse vector '{SPARSE_VECTOR_NAME}'."
            )

        sparse_params = sparse_config[SPARSE_VECTOR_NAME]
        if sparse_params.modifier != SPARSE_MODIFIER:
            raise IncompatibleSchemaError(
                f"Collection '{target}' sparse vector '{SPARSE_VECTOR_NAME}' modifier mismatch: "
                f"expected {SPARSE_MODIFIER}, found {sparse_params.modifier}"
            )

        # 4. Verify payload indexes
        payload_schema = col_info.payload_schema or {}
        missing_indexes = [idx for idx in REQUIRED_PAYLOAD_INDEXES if idx not in payload_schema]
        if missing_indexes:
            raise IncompatibleSchemaError(
                f"Collection '{target}' is missing required payload index(es): {missing_indexes}. "
                f"Present indexes: {list(payload_schema.keys())}"
            )

        # 5. For production collection, verify exact schema invariants
        if target.strip() in PRODUCTION_COLLECTIONS:
            if dense_params.on_disk is True:
                raise IncompatibleSchemaError(
                    f"Production collection '{target}' requires dense vector 'on_disk=False', found on_disk={dense_params.on_disk}"
                )
            for dt_field in ("publication_date", "priority_date"):
                idx_info = payload_schema.get(dt_field)
                if not idx_info:
                    raise IncompatibleSchemaError(f"Production collection '{target}' missing datetime index for '{dt_field}'")
                actual_type = getattr(idx_info, "data_type", None)
                if actual_type != qmodels.PayloadSchemaType.DATETIME:
                    # Some client representations use string 'datetime'
                    type_str = str(actual_type.value if hasattr(actual_type, "value") else actual_type).lower()
                    if "datetime" not in type_str:
                        raise IncompatibleSchemaError(
                            f"Production collection '{target}' requires DATETIME index for '{dt_field}', found {actual_type}"
                        )

        return {
            "collection_name": target,
            "status": col_info.status.value if hasattr(col_info.status, "value") else str(col_info.status),
            "points_count": col_info.points_count,
            "dense_vector": {
                "name": DENSE_VECTOR_NAME,
                "size": dense_params.size,
                "distance": dense_params.distance.value if hasattr(dense_params.distance, "value") else str(dense_params.distance),
                "on_disk": dense_params.on_disk,
            },
            "sparse_vector": {
                "name": SPARSE_VECTOR_NAME,
                "modifier": sparse_params.modifier.value if hasattr(sparse_params.modifier, "value") else str(sparse_params.modifier),
            },
            "indexed_payload_fields": list(payload_schema.keys()),
            "is_compatible": True,
        }

    def create_hybrid_collection(
        self,
        collection_name: str,
        on_disk_payload: bool = True,
        on_disk_dense: Optional[bool] = None,
        allow_production: bool = False,
    ) -> Dict[str, Any]:
        """
        Creates a new Qdrant collection configured for dual named vectors:
        - dense: 'bge_m3' (1024-d, Cosine, float32)
        - sparse: 'bm25' (Modifier.IDF, on_disk=True)
        and creates all required payload indexes.

        SAFETY: Creating a production collection requires allow_production=True.
        If a production collection already exists, it will abort immediately
        without recreation.
        """
        is_prod = collection_name.strip() in PRODUCTION_COLLECTIONS
        if is_prod and not allow_production:
            raise ValueError(
                f"Creation of production collection '{collection_name}' is strictly prohibited "
                "unless allow_production=True."
            )

        client = self.get_client()

        # Check if already exists
        collections = [c.name for c in client.get_collections().collections]
        if collection_name in collections:
            if is_prod:
                raise RuntimeError(
                    f"Production collection '{collection_name}' already exists on Qdrant cluster. "
                    f"Automatic recreation or overwrite is strictly prohibited."
                )
            log.info("Collection '%s' already exists. Verifying schema...", collection_name)
            return self.verify_collection_schema(collection_name)

        # Dense vector on_disk configuration
        if on_disk_dense is None:
            # Production requires on_disk=False for high-speed in-memory indexing
            effective_on_disk_dense = False if is_prod else True
        else:
            effective_on_disk_dense = on_disk_dense

        log.info(
            "Creating new hybrid collection '%s' on Qdrant Cloud (dense on_disk=%s)...",
            collection_name,
            effective_on_disk_dense,
        )

        client.create_collection(
            collection_name=collection_name,
            vectors_config={
                DENSE_VECTOR_NAME: qmodels.VectorParams(
                    size=DENSE_DIMENSION,
                    distance=DENSE_DISTANCE,
                    datatype=qmodels.Datatype.FLOAT32,
                    on_disk=effective_on_disk_dense,
                )
            },
            sparse_vectors_config={
                SPARSE_VECTOR_NAME: qmodels.SparseVectorParams(
                    modifier=SPARSE_MODIFIER,
                    index=qmodels.SparseIndexParams(on_disk=True),
                )
            },
            on_disk_payload=on_disk_payload,
        )

        # Create payload indexes
        indexes_to_create = list(REQUIRED_PAYLOAD_INDEXES) + ["parent_section"]
        for field in indexes_to_create:
            try:
                # Production collection uses DATETIME for publication_date and priority_date
                if is_prod and field in ("publication_date", "priority_date"):
                    schema_type = qmodels.PayloadSchemaType.DATETIME
                else:
                    schema_type = qmodels.PayloadSchemaType.KEYWORD

                client.create_payload_index(
                    collection_name=collection_name,
                    field_name=field,
                    field_schema=schema_type,
                )
                log.info("Created %s payload index for '%s' on '%s'", schema_type, field, collection_name)
            except Exception as exc:
                log.warning("Could not create payload index '%s' on '%s': %s", field, collection_name, exc)

        log.info("Successfully created collection '%s'. Verifying schema...", collection_name)
        return self.verify_collection_schema(collection_name)

    def upsert_points(
        self,
        collection_name: Optional[str] = None,
        points: List[qmodels.PointStruct] = None,
        max_retries: int = 3,
        retry_delay: float = 1.0,
    ) -> qmodels.UpdateResult:
        """
        Upserts a batch of PointStruct objects into target collection with retry logic.
        """
        if not points:
            return qmodels.UpdateResult(operation_id=0, status=qmodels.UpdateStatus.COMPLETED)

        target = collection_name or self.default_collection
        client = self.get_client()
        last_err: Optional[Exception] = None

        for attempt in range(1, max_retries + 1):
            try:
                return client.upsert(
                    collection_name=target,
                    points=points,
                    wait=True,
                )
            except Exception as exc:
                last_err = exc
                log.warning(
                    "Upsert failed on attempt %d/%d for collection '%s': %s",
                    attempt, max_retries, target, exc,
                )
                if attempt < max_retries:
                    time.sleep(retry_delay * (2 ** (attempt - 1)))
        raise last_err  # type: ignore

    def build_hybrid_prefetch(
        self,
        dense_vector: List[float],
        sparse_vector: qmodels.SparseVector,
        prefetch_limit: int = 40,
        filter_conditions: Optional[qmodels.Filter] = None,
    ) -> List[qmodels.Prefetch]:
        """Build dual-branch prefetch clauses for Qdrant RRF fusion query."""
        return [
            qmodels.Prefetch(
                query=dense_vector,
                using=DENSE_VECTOR_NAME,
                limit=prefetch_limit,
                filter=filter_conditions,
            ),
            qmodels.Prefetch(
                query=sparse_vector,
                using=SPARSE_VECTOR_NAME,
                limit=prefetch_limit,
                filter=filter_conditions,
            ),
        ]

    def build_filter(
        self,
        jurisdiction: Optional[str] = None,
        authority: Optional[str] = None,
        document_type: Optional[str] = None,
        domain: Optional[str] = None,
        language: Optional[str] = None,
        document_id: Optional[str] = None,
        document_ids: Optional[List[str]] = None,  # Support multiple document IDs
        section: Optional[str] = None,
    ) -> Optional[qmodels.Filter]:
        """Construct a Qdrant Filter from optional metadata constraints."""
        must_conditions = []
        if jurisdiction and jurisdiction.strip() and jurisdiction.strip().lower() != "both":
            must_conditions.append(
                qmodels.FieldCondition(key="jurisdiction", match=qmodels.MatchValue(value=jurisdiction.strip()))
            )
        if authority and authority.strip():
            must_conditions.append(
                qmodels.FieldCondition(key="authority", match=qmodels.MatchValue(value=authority.strip()))
            )
        if document_type and document_type.strip():
            must_conditions.append(
                qmodels.FieldCondition(key="document_type", match=qmodels.MatchValue(value=document_type.strip()))
            )
        if domain and domain.strip():
            must_conditions.append(
                qmodels.FieldCondition(key="domain", match=qmodels.MatchValue(value=domain.strip()))
            )
        if language and language.strip():
            must_conditions.append(
                qmodels.FieldCondition(key="language", match=qmodels.MatchValue(value=language.strip()))
            )
        # Support both single document_id and list of document_ids
        if document_ids and len(document_ids) > 0:
            # Use MatchAny for multiple document IDs
            must_conditions.append(
                qmodels.FieldCondition(key="document_id", match=qmodels.MatchAny(any=[str(d).strip() for d in document_ids if d]))
            )
        elif document_id and document_id.strip():
            must_conditions.append(
                qmodels.FieldCondition(key="document_id", match=qmodels.MatchValue(value=document_id.strip()))
            )
        if section and section.strip():
            must_conditions.append(
                qmodels.FieldCondition(key="section", match=qmodels.MatchValue(value=section.strip()))
            )

        if not must_conditions:
            return None
        return qmodels.Filter(must=must_conditions)

    def query_hybrid(
        self,
        query_text: str,
        collection_name: Optional[str] = None,
        top_k: int = 5,
        prefetch_limit: int = 20,
        filter_conditions: Optional[qmodels.Filter] = None,
        jurisdiction: Optional[str] = None,
        authority: Optional[str] = None,
        document_type: Optional[str] = None,
        domain: Optional[str] = None,
        language: Optional[str] = None,
        document_id: Optional[str] = None,
        document_ids: Optional[List[str]] = None,  # Support scoping to multiple docs
        section: Optional[str] = None,
    ) -> List[Dict[str, Any]]:
        """
        Executes end-to-end Qdrant Hybrid Search:
        1. Validates collection schema.
        2. Embeds query densely with canonical Hugging Face BGE-M3.
        3. Embeds query sparsely with FastEmbed BM25.
        4. Applies metadata filters across supported fields.
        5. Performs Reciprocal Rank Fusion (RRF).
        6. Returns hits preserving native Qdrant RRF scores directly.
        """
        if not query_text or not query_text.strip():
            raise ValueError("query_text must be a non-empty string.")

        target = collection_name or self.default_collection
        # 1. Validate collection schema
        self.verify_collection_schema(target)

        # 2 & 3. Embed query densely and sparsely
        from app.services.embedding_service import canonical_embedder
        from app.services.sparse_embedding_service import sparse_embedder

        dense_vec = canonical_embedder.embed_query(query_text)
        sparse_vec = sparse_embedder.embed_query(query_text)

        # 4. Resolve filters
        explicit_filter = self.build_filter(
            jurisdiction=jurisdiction,
            authority=authority,
            document_type=document_type,
            domain=domain,
            language=language,
            document_id=document_id,
            document_ids=document_ids,
            section=section,
        )

        active_filter = filter_conditions
        if explicit_filter is not None:
            if active_filter is not None:
                # Merge existing filter with explicit conditions
                existing_must = list(active_filter.must or [])
                existing_must.extend(explicit_filter.must or [])
                active_filter = qmodels.Filter(must=existing_must)
            else:
                active_filter = explicit_filter

        # 5. Build prefetch and execute RRF fusion query
        prefetch = self.build_hybrid_prefetch(
            dense_vector=dense_vec,
            sparse_vector=sparse_vec,
            prefetch_limit=prefetch_limit,
            filter_conditions=active_filter,
        )

        client = self.get_client()
        response = client.query_points(
            collection_name=target,
            prefetch=prefetch,
            query=qmodels.FusionQuery(fusion=qmodels.Fusion.RRF),
            limit=top_k,
            with_payload=True,
        )

        # 6. Format and preserve native Qdrant scores
        results: List[Dict[str, Any]] = []
        for pt in response.points:
            p = pt.payload or {}
            results.append({
                "point_id": str(pt.id),
                "id": str(pt.id),
                "score": float(pt.score),  # Native RRF score preserved directly
                "text": p.get("text", ""),
                "chunk_id": p.get("chunk_id", ""),
                "document_id": p.get("document_id", ""),
                "source": p.get("source", ""),
                "jurisdiction": p.get("jurisdiction", ""),
                "authority": p.get("authority", ""),
                "document_type": p.get("document_type", ""),
                "domain": p.get("domain", ""),
                "section": p.get("section", ""),
                "language": p.get("language", ""),
                "publication_date": p.get("publication_date", ""),
                "priority_date": p.get("priority_date", ""),
                "metadata": p,
                "payload": p,
            })

        return results


# Singleton instance export
qdrant_hybrid_store = QdrantHybridStore()
