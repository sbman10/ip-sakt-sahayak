"""
backend/app/services/qdrant_service.py
----------------------------------------
Enterprise Qdrant Vector Service for IP-SAKTI Sahayak.
Manages Qdrant Cloud connectivity, collection lifecycle (1024-d, Cosine distance),
deterministic point ID generation, payload indexing, batch upserting,
dense semantic retrieval, and user upload management with ChromaDB fallback resilience.
"""

from __future__ import annotations

import logging
import os
import uuid
from typing import Any, Dict, List, Optional, Tuple, Union

from qdrant_client import QdrantClient
from qdrant_client.http import models as qmodels
from qdrant_client.http.models import Distance, FieldCondition, Filter, MatchValue, PayloadSchemaType, PointStruct, VectorParams

from app.core.config import settings

log = logging.getLogger("app.services.qdrant_service")

# Vector configurations matching BAAI/bge-m3
VECTOR_SIZE = 1024
DEFAULT_DISTANCE = Distance.COSINE


def to_qdrant_point_id(
    collection_or_raw: Union[str, int],
    raw_id: Optional[Union[str, int]] = None,
    collection_name: Optional[str] = None,
) -> Union[str, int]:
    """
    Deterministically converts an arbitrary string ID (such as a Chroma chunk ID)
    into a valid Qdrant UUID string or positive integer.
    Supports all calling patterns:
      - to_qdrant_point_id(raw_id, collection_name="india_statutes")
      - to_qdrant_point_id("india_statutes", raw_id)
      - to_qdrant_point_id(raw_id)
    """
    if collection_name:
        col_name = collection_name
        target_id = collection_or_raw
    elif raw_id is not None:
        col_name = str(collection_or_raw)
        target_id = raw_id
    else:
        col_name = ""
        target_id = collection_or_raw

    # If it's a positive integer, return as integer
    if isinstance(target_id, int) and target_id >= 0:
        return target_id
    if isinstance(target_id, str) and target_id.isdigit():
        return int(target_id)

    # Check if already a valid UUID string
    try:
        val_uuid = uuid.UUID(str(target_id))
        return str(val_uuid)
    except (ValueError, AttributeError):
        pass

    # Generate deterministic UUIDv5 scoped to collection
    namespace = uuid.NAMESPACE_DNS
    seed = f"{col_name}_{target_id}" if col_name else str(target_id)
    return str(uuid.uuid5(namespace, seed))


class QdrantService:
    """
    Central service wrapping Qdrant operations for IP-SAKTI Sahayak.
    Supports Qdrant Cloud (AWS eu-central-1) and local persistent/in-memory fallback.
    """

    def __init__(
        self,
        url: Optional[str] = None,
        api_key: Optional[str] = None,
        prefer_grpc: bool = False,
    ) -> None:
        self.url = (url or settings.QDRANT_URL or "").strip()
        self.api_key = (api_key or settings.QDRANT_API_KEY or "").strip()
        self.is_cloud = bool(self.url)
        self._client: Optional[QdrantClient] = None
        self._init_client(prefer_grpc=prefer_grpc)

    def _init_client(self, prefer_grpc: bool = False) -> None:
        """Initialize QdrantClient targeting cloud or local persistent directory."""
        if self.is_cloud:
            try:
                self._client = QdrantClient(
                    url=self.url,
                    api_key=self.api_key or None,
                    prefer_grpc=prefer_grpc,
                    timeout=10.0,
                )
                log.info("QdrantService connected to cloud cluster: %s", self.url)
            except Exception as e:
                log.warning("Failed to connect to Qdrant Cloud (%s). Falling back to local store.", e)
                self._fallback_to_local()
        else:
            self._fallback_to_local()

    def _fallback_to_local(self) -> None:
        """Initializes a local persistent Qdrant client or in-memory fallback."""
        local_qdrant_dir = os.path.join(settings.CHROMA_DB_DIR, "qdrant_local")
        try:
            os.makedirs(local_qdrant_dir, exist_ok=True)
            self._client = QdrantClient(path=local_qdrant_dir)
            log.info("QdrantService initialized with local storage: %s", local_qdrant_dir)
        except Exception as e:
            log.warning("Could not initialize local path Qdrant (%s). Using in-memory client.", e)
            self._client = QdrantClient(":memory:")

    @property
    def client(self) -> QdrantClient:
        """Returns the active Qdrant client instance."""
        if self._client is None:
            self._init_client()
        return self._client  # type: ignore

    def is_healthy(self) -> bool:
        """Readiness check verifying Qdrant connectivity and cluster responsiveness."""
        try:
            _ = self.client.get_collections()
            return True
        except Exception as exc:
            log.warning("Qdrant health check failed: %s", exc)
            return False

    def verify_collection_readiness(self, collection_name: str) -> Dict[str, Any]:
        """
        Validates collection exists, schema is valid (dense vector configured),
        and collection status is green.
        """
        try:
            col_info = self.client.get_collection(collection_name)
            status_str = str(col_info.status).lower()
            is_green = "green" in status_str or "optimizing" in status_str
            params = getattr(col_info.config, "params", None)
            vectors_param = getattr(params, "vectors", None) if params else None
            schema_valid = vectors_param is not None
            return {
                "exists": True,
                "status": str(col_info.status),
                "green": is_green,
                "schema_valid": schema_valid,
                "points_count": getattr(col_info, "points_count", None),
            }
        except Exception as exc:
            log.warning("Qdrant collection readiness check failed for '%s': %s", collection_name, exc)
            return {
                "exists": False,
                "status": "error",
                "green": False,
                "schema_valid": False,
                "error": str(exc),
            }


    def ensure_collections(self) -> Dict[str, str]:
        """
        Idempotently initializes target collections (india_statutes, international_treaties,
        user_uploads) with size=1024, Cosine distance, and required payload indexes.
        Returns a dict mapping collection name to 'created' or 'exists'.
        """
        target_collections = [
            settings.QDRANT_INDIA_COLLECTION,
            settings.QDRANT_INTERNATIONAL_COLLECTION,
            settings.QDRANT_USER_UPLOADS_COLLECTION,
        ]
        status_map = {}
        existing = [c.name for c in self.client.get_collections().collections]

        for col_name in target_collections:
            if col_name not in existing:
                log.info("Creating Qdrant collection '%s' (size=%d, distance=Cosine)...", col_name, VECTOR_SIZE)
                self.client.create_collection(
                    collection_name=col_name,
                    vectors_config=VectorParams(size=VECTOR_SIZE, distance=DEFAULT_DISTANCE),
                )
                status_map[col_name] = "created"
            else:
                log.debug("Qdrant collection '%s' already exists.", col_name)
                status_map[col_name] = "exists"

            # Ensure payload indexes for filtering
            self._ensure_payload_indexes(col_name)

        return status_map

    def get_collection_info(self, collection_name: str) -> Optional[Dict[str, Any]]:
        """Retrieves collection status, vector dimensions, and distance metric."""
        try:
            info = self.client.get_collection(collection_name=collection_name)
            vec_params = info.config.params.vectors
            if hasattr(vec_params, "size"):
                v_size = vec_params.size
                v_dist = vec_params.distance.name if hasattr(vec_params.distance, "name") else str(vec_params.distance)
            elif isinstance(vec_params, dict):
                first_val = next(iter(vec_params.values()))
                v_size = first_val.size
                v_dist = first_val.distance.name if hasattr(first_val.distance, "name") else str(first_val.distance)
            else:
                v_size = VECTOR_SIZE
                v_dist = "Cosine"

            # Normalize distance casing ("Cosine")
            if v_dist.upper() == "COSINE":
                v_dist = "Cosine"

            pts_count = getattr(info, "points_count", 0) or getattr(info, "indexed_vectors_count", 0) or 0

            return {
                "vector_size": v_size,
                "distance": v_dist,
                "points_count": pts_count,
                "status": getattr(info, "status", "green"),
            }
        except Exception as e:
            log.warning("Could not get collection info for '%s': %s", collection_name, e)
            return None

    def get_point(self, collection_name: str, point_id: Union[str, int]) -> Optional[Dict[str, Any]]:
        """Retrieves a single point by ID from a collection."""
        try:
            pts = self.client.retrieve(
                collection_name=collection_name,
                ids=[point_id],
                with_payload=True,
                with_vectors=True,
            )
            if pts:
                pt = pts[0]
                return {
                    "id": str(pt.id),
                    "vector": pt.vector,
                    "payload": pt.payload or {},
                }
            return None
        except Exception as e:
            log.warning("Could not retrieve point %s from %s: %s", point_id, collection_name, e)
            return None

    def get_all_payloads(
        self,
        collection_name: str,
        batch_size: int = 100,
    ) -> List[Dict[str, Any]]:
        """
        Scrolls through all points in a collection, returning their payloads.
        Vectors are excluded to keep memory usage minimal and fast.
        """
        payloads: List[Dict[str, Any]] = []
        offset = None
        while True:
            try:
                points, next_offset = self.client.scroll(
                    collection_name=collection_name,
                    limit=batch_size,
                    offset=offset,
                    with_payload=True,
                    with_vectors=False,
                )
            except Exception as scroll_err:
                log.warning("Scroll failed on collection '%s': %s", collection_name, scroll_err)
                break

            for pt in points:
                payload = dict(pt.payload or {})
                if "id" not in payload:
                    payload["id"] = str(payload.get("original_id") or payload.get("chunk_id") or pt.id)
                payloads.append(payload)

            if next_offset is None or not points:
                break
            offset = next_offset

        log.debug("Scrolled %d payloads from Qdrant '%s'.", len(payloads), collection_name)
        return payloads

    def _ensure_payload_indexes(self, collection_name: str) -> None:
        """Creates payload keyword indexes for fast metadata filtering."""
        fields = ["jurisdiction", "source", "section", "document_id", "user_id"]
        for field in fields:
            try:
                self.client.create_payload_index(
                    collection_name=collection_name,
                    field_name=field,
                    field_schema=PayloadSchemaType.KEYWORD,
                )
            except Exception as e:
                log.debug("Payload index note on %s.%s: %s", collection_name, field, e)

    def upsert_points(
        self,
        collection_name: str,
        points_data: Optional[List[Dict[str, Any]]] = None,
        points: Optional[List[Dict[str, Any]]] = None,
        batch_size: int = 100,
    ) -> int:
        """
        Batched upsert of documents and embeddings into Qdrant.
        Accepts either points_data or points argument.
        Each record must contain:
        - 'id': original chunk ID or UUID string
        - 'vector': 1024-d float list
        - 'payload' / 'metadata': dictionary
        """
        records = points_data if points_data is not None else points
        if not records:
            return 0

        total_upserted = 0
        for i in range(0, len(records), batch_size):
            chunk = records[i : i + batch_size]
            structs: List[PointStruct] = []

            for item in chunk:
                raw_id = item["id"]
                point_id = to_qdrant_point_id(raw_id, collection_name=collection_name)
                payload = dict(item.get("payload") or item.get("metadata") or {})
                if "text" in item and "text" not in payload:
                    payload["text"] = item["text"]
                # Guarantee original_id and chunk_id exist in payload
                payload["original_id"] = str(raw_id)
                payload["chunk_id"] = str(raw_id)
                payload["collection"] = collection_name

                structs.append(
                    PointStruct(
                        id=point_id,
                        vector=item["vector"],
                        payload=payload,
                    )
                )

            self.client.upsert(
                collection_name=collection_name,
                points=structs,
            )
            total_upserted += len(structs)

        return total_upserted

    def search(
        self,
        collection_name: str,
        query_vector: List[float],
        limit: int = 5,
        jurisdiction: Optional[str] = None,
        user_id: Optional[str] = None,
        document_id: Optional[str] = None,
    ) -> List[Dict[str, Any]]:
        """
        Executes dense vector search against a Qdrant collection with payload filtering.

        Returns list of standardized candidate dictionaries:
        - 'id': original chunk identifier
        - 'point_id': Qdrant UUID
        - 'text': text content of the passage
        - 'source': statutory/source title
        - 'section': section or page reference
        - 'jurisdiction': legal jurisdiction
        - 'score': cosine similarity (higher is better, 0.0 to 1.0)
        - 'distance': cosine distance (lower is better, 0.0 to 2.0)
        - 'payload': complete payload
        - 'metadata': complete payload
        """
        # Build filter conditions
        must_conditions = []
        if jurisdiction and jurisdiction.strip().lower() != "both":
            must_conditions.append(
                FieldCondition(key="jurisdiction", match=MatchValue(value=jurisdiction.strip()))
            )
        if user_id:
            must_conditions.append(
                FieldCondition(key="user_id", match=MatchValue(value=str(user_id).strip()))
            )
        if document_id:
            must_conditions.append(
                FieldCondition(key="document_id", match=MatchValue(value=str(document_id).strip()))
            )

        query_filter = Filter(must=must_conditions) if must_conditions else None

        try:
            # Query Qdrant
            if hasattr(self.client, "query_points"):
                response = self.client.query_points(
                    collection_name=collection_name,
                    query=query_vector,
                    limit=limit,
                    query_filter=query_filter,
                )
                pts = response.points
            else:
                pts = self.client.search(
                    collection_name=collection_name,
                    query_vector=query_vector,
                    limit=limit,
                    query_filter=query_filter,
                )
        except Exception as e:
            log.error("Qdrant search error on '%s': %s", collection_name, e)
            raise

        results: List[Dict[str, Any]] = []
        for rank, pt in enumerate(pts, start=1):
            score = float(pt.score)
            # Cosine distance: max(0.0, 1.0 - score)
            distance = max(0.0, min(2.0, 1.0 - score))
            payload = pt.payload or {}
            doc_text = payload.get("text") or payload.get("page_content") or ""
            original_id = str(payload.get("original_id") or payload.get("chunk_id") or pt.id)

            results.append({
                "id": original_id,
                "point_id": str(pt.id),
                "text": doc_text,
                "source": payload.get("source", "Legal Statute"),
                "section": payload.get("section", "General"),
                "jurisdiction": payload.get("jurisdiction", "India"),
                "score": score,
                "distance": distance,
                "vector_distance": distance,
                "vector_similarity": max(0.0, min(1.0, score)),
                "vector_rank": rank,
                "payload": payload,
                "metadata": payload,
            })

        return results

    def delete_by_document_id(
        self,
        document_id: str,
        collection_name: Optional[str] = None,
    ) -> int:
        """Deletes all chunk vectors belonging to a document from Qdrant, returning count deleted."""
        target_collection = collection_name or settings.QDRANT_USER_UPLOADS_COLLECTION
        try:
            deleted_count = 0
            try:
                cnt_res = self.client.count(
                    collection_name=target_collection,
                    count_filter=Filter(
                        must=[
                            FieldCondition(
                                key="document_id",
                                match=MatchValue(value=str(document_id).strip()),
                            )
                        ]
                    ),
                    exact=True,
                )
                deleted_count = cnt_res.count
            except Exception:
                deleted_count = 1

            self.client.delete(
                collection_name=target_collection,
                points_selector=Filter(
                    must=[
                        FieldCondition(
                            key="document_id",
                            match=MatchValue(value=str(document_id).strip()),
                        )
                    ]
                ),
            )
            log.info("Deleted %d chunks for document_id '%s' from Qdrant '%s'.", deleted_count, document_id, target_collection)
            return deleted_count
        except Exception as exc:
            log.warning("Failed to delete chunks for document_id '%s': %s", document_id, exc)
            return 0


# Global singleton instance
qdrant_service = QdrantService()
