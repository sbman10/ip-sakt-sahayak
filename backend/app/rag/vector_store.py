"""
backend/app/rag/vector_store.py
---------------------------------
ChromaDB persistence layer — collection access, upsert, retrieval, deletion.

Uses a single unified collection for all ingested documents.  Metadata per
chunk stores source filename, page range, and source path so that retrieval
results can be traced back to their origin for citations.
"""

from __future__ import annotations

import logging
import os
from typing import Optional

import chromadb
from chromadb.config import Settings as ChromaSettings

from app.rag.config import get_settings
from app.rag.models import DocumentChunk, RetrievedChunk

log = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Lazy singletons
# ---------------------------------------------------------------------------
_client: Optional[chromadb.PersistentClient] = None
_collection: Optional[chromadb.Collection] = None


def _get_client() -> chromadb.PersistentClient:
    """Return (or lazily initialise) the ChromaDB PersistentClient."""
    global _client
    if _client is None:
        settings = get_settings()
        chroma_path = str(settings.resolved_chroma_path())
        os.environ.setdefault("ANONYMIZED_TELEMETRY", "FALSE")
        log.info("Initialising ChromaDB client at: %s", chroma_path)
        _client = chromadb.PersistentClient(
            path=chroma_path,
            settings=ChromaSettings(anonymized_telemetry=False),
        )
    return _client


def get_collection() -> chromadb.Collection:
    """
    Return (or lazily initialise) the ChromaDB collection.

    Creates the collection if it does not exist (get_or_create).
    Uses cosine distance metric to match BGE normalised embeddings.
    """
    global _collection
    if _collection is None:
        client = _get_client()
        settings = get_settings()
        _collection = client.get_or_create_collection(
            name=settings.rag_collection_name,
            metadata={"hnsw:space": "cosine"},
        )
        log.info(
            "ChromaDB collection '%s' ready (%d documents).",
            settings.rag_collection_name,
            _collection.count(),
        )
    return _collection


def get_collection_count() -> int:
    """Return the number of documents in the active collection."""
    try:
        collection = get_collection()
        return collection.count()
    except Exception:
        return 0


def upsert_chunks(
    chunks: list[DocumentChunk],
    embeddings: list[list[float]],
    batch_size: int = 100,
) -> None:
    """
    Upsert chunks with their embeddings into ChromaDB.

    Uses the chunk's deterministic chunk_id as the document ID, so
    re-ingesting the same unchanged document is a no-op (idempotent).

    Parameters
    ----------
    chunks:
        List of DocumentChunk objects.
    embeddings:
        Corresponding embedding vectors (same length as chunks).
    batch_size:
        Number of documents per upsert batch.
    """
    if len(chunks) != len(embeddings):
        raise ValueError(
            f"chunks ({len(chunks)}) and embeddings ({len(embeddings)}) "
            "must have the same length."
        )

    collection = get_collection()

    ids = [c.chunk_id for c in chunks]
    documents = [c.text for c in chunks]
    metadatas = [
        {
            "source_filename": c.source_filename,
            "source_path": c.source_path,
            "page_start": c.page_start,
            "page_end": c.page_end,
            "chunk_index": c.chunk_index,
        }
        for c in chunks
    ]

    for i in range(0, len(ids), batch_size):
        end = min(i + batch_size, len(ids))
        collection.upsert(
            ids=ids[i:end],
            documents=documents[i:end],
            metadatas=metadatas[i:end],
            embeddings=embeddings[i:end],
        )

    log.info("Upserted %d chunks into ChromaDB.", len(chunks))


def delete_by_source(source_path: str) -> int:
    """
    Delete all chunks originating from a specific source file.

    This enables safe re-indexing: delete old vectors, then re-ingest
    the updated document.

    Parameters
    ----------
    source_path:
        The source_path metadata value to match against.

    Returns
    -------
    int
        Number of chunks deleted.
    """
    collection = get_collection()

    # Query to find all IDs with matching source_path
    results = collection.get(
        where={"source_path": source_path},
        include=[],
    )
    ids_to_delete = results["ids"]

    if ids_to_delete:
        collection.delete(ids=ids_to_delete)
        log.info(
            "Deleted %d chunks for source '%s'.",
            len(ids_to_delete),
            source_path,
        )
    else:
        log.info("No existing chunks found for source '%s'.", source_path)

    return len(ids_to_delete)


def query_similar(
    query_embedding: list[float],
    top_k: int = 5,
) -> list[RetrievedChunk]:
    """
    Retrieve the top-k most similar chunks from ChromaDB.

    Parameters
    ----------
    query_embedding:
        The BGE-encoded query vector.
    top_k:
        Maximum number of results to return.

    Returns
    -------
    list[RetrievedChunk]
        Ordered by ascending distance (most similar first).
    """
    collection = get_collection()
    count = collection.count()

    if count == 0:
        log.warning("ChromaDB collection is empty — no documents to search.")
        return []

    n_results = min(top_k, count)

    results = collection.query(
        query_embeddings=[query_embedding],
        n_results=n_results,
        include=["documents", "metadatas", "distances"],
    )

    docs = results["documents"][0]
    metas = results["metadatas"][0]
    distances = results["distances"][0]

    retrieved: list[RetrievedChunk] = []
    for doc, meta, dist in zip(docs, metas, distances):
        retrieved.append(
            RetrievedChunk(
                chunk_id=meta.get("chunk_id", ""),
                text=doc,
                source_filename=meta.get("source_filename", "Unknown"),
                page_start=meta.get("page_start", 0),
                page_end=meta.get("page_end", 0),
                distance=dist,
            )
        )

    return retrieved
