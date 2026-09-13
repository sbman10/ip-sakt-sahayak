"""
Local ChromaDB Vector Ingestor for IP-SAKTI Sahayak.
Reads processed JSONL chunks, computes dense vector embeddings using local
SentenceTransformer ('all-MiniLM-L6-v2'), and persists isolated collections to disk.
"""

import json
import logging
import os
import re
from pathlib import Path
from typing import Dict, List

import chromadb
from sentence_transformers import SentenceTransformer

# Setup structured logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
logger = logging.getLogger("VectorIngestor")

# Directory configurations
BASE_DIR = Path(__file__).resolve().parent
CHROMA_DB_PATH = BASE_DIR / "chroma_db"
PROCESSED_DATA_DIR = BASE_DIR / "data" / "processed"
CURATED_DATA_DIR = BASE_DIR / "data" / "curated"

# Collection Constants
COLLECTION_INDIA = "india_statutes"
COLLECTION_INTERNATIONAL = "international_treaties"

# Keyword Router Rules
INDIA_KEYWORDS = ["patent", "biodiversity", "drugs", "cosmetics"]
INTERNATIONAL_KEYWORDS = ["nagoya", "wipo", "trips", "treaty"]


def get_target_collection_name(file_stem: str) -> str:
    """
    Routes JSONL file chunks to the appropriate collection based on file stem keywords.
    """
    stem_lower = file_stem.lower()

    for kw in INDIA_KEYWORDS:
        if kw in stem_lower:
            return COLLECTION_INDIA

    for kw in INTERNATIONAL_KEYWORDS:
        if kw in stem_lower:
            return COLLECTION_INTERNATIONAL

    # Default fallback to india_statutes if unspecified
    return COLLECTION_INDIA


def run_ingestion() -> None:
    """
    Executes complete embedding and vector store ingestion pipeline.
    """
    if not PROCESSED_DATA_DIR.exists():
        logger.error(f"Processed data directory does not exist: {PROCESSED_DATA_DIR}")
        return

    jsonl_files = sorted(list(PROCESSED_DATA_DIR.glob("*_chunks.jsonl")))
    
    # Also include curated JSONL files (hand-crafted knowledge chunks)
    curated_files = []
    if CURATED_DATA_DIR.exists():
        curated_files = sorted(list(CURATED_DATA_DIR.glob("*.jsonl")))
        logger.info(f"Found {len(curated_files)} curated knowledge files in {CURATED_DATA_DIR}")
    
    all_jsonl_files = jsonl_files + curated_files
    
    if not all_jsonl_files:
        logger.warning(
            f"No processed JSONL chunk files found in {PROCESSED_DATA_DIR} or {CURATED_DATA_DIR}. "
            f"Please run 'parser.py' first or add curated files."
        )
        return

    logger.info(f"Initializing persistent ChromaDB client at: {CHROMA_DB_PATH}")
    client = chromadb.PersistentClient(path=str(CHROMA_DB_PATH))

    # Initialize / retrieve isolated collections
    collections: Dict[str, chromadb.Collection] = {
        COLLECTION_INDIA: client.get_or_create_collection(
            name=COLLECTION_INDIA,
            metadata={"hnsw:space": "cosine"},
        ),
        COLLECTION_INTERNATIONAL: client.get_or_create_collection(
            name=COLLECTION_INTERNATIONAL,
            metadata={"hnsw:space": "cosine"},
        ),
    }

    logger.info("Loading local SentenceTransformer model ('all-MiniLM-L6-v2')...")
    embedding_model = SentenceTransformer("all-MiniLM-L6-v2")
    logger.info("SentenceTransformer model loaded successfully on local CPU.")

    collection_counts: Dict[str, int] = {
        COLLECTION_INDIA: 0,
        COLLECTION_INTERNATIONAL: 0,
    }

    for jsonl_path in all_jsonl_files:
        stem = jsonl_path.stem.replace("_chunks", "")
        target_collection_name = get_target_collection_name(stem)
        target_collection = collections[target_collection_name]

        logger.info(f"Reading chunks from: {jsonl_path.name} -> Target Collection: [{target_collection_name}]")

        chunks: List[Dict[str, str]] = []
        with open(jsonl_path, "r", encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if line:
                    try:
                        chunks.append(json.loads(line))
                    except json.JSONDecodeError as err:
                        logger.warning(f"Skipping malformed line in {jsonl_path.name}: {err}")

        if not chunks:
            logger.warning(f"No valid chunks parsed from {jsonl_path.name}. Skipping.")
            continue

        texts = [chunk["text"] for chunk in chunks]
        metadatas = [
            {
                "source": chunk.get("source_title") or chunk.get("source", stem),
                "section": chunk.get("section", "General"),
            }
            for chunk in chunks
        ]
        ids = [f"{stem}_{i}" for i in range(len(chunks))]

        logger.info(f"Generating dense vector embeddings for {len(texts)} chunks...")
        embeddings = embedding_model.encode(
            texts,
            batch_size=32,
            show_progress_bar=True,
        ).tolist()

        # Batch upsert into ChromaDB
        batch_size = 100
        for i in range(0, len(ids), batch_size):
            end_i = min(i + batch_size, len(ids))
            target_collection.upsert(
                ids=ids[i:end_i],
                documents=texts[i:end_i],
                metadatas=metadatas[i:end_i],
                embeddings=embeddings[i:end_i],
            )

        collection_counts[target_collection_name] += len(chunks)
        print(f"Successfully ingested {len(chunks)} chunks into the [{target_collection_name}] collection!")

    print("\n" + "=" * 60)
    print("INGESTION SUMMARY:")
    for coll_name, count in collection_counts.items():
        print(f" - [{coll_name}]: {count} total chunks ingested in this session.")
    print("=" * 60 + "\n")


if __name__ == "__main__":
    run_ingestion()
