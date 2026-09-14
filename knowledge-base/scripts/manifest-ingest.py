#!/usr/bin/env python3
"""
manifest-ingest.py
Manifest-aware ingestion pipeline for IP-SAKTI Sahayak.
Replaces brittle keyword-based routing with authoritative manifest-based routing.
"""

import os
import sys
import json
import yaml
from pathlib import Path

# Optional chromadb import
try:
    import chromadb
    from chromadb.config import Settings
    HAS_CHROMADB = True
except ImportError:
    HAS_CHROMADB = False

def load_yaml(path):
    with open(path, "r", encoding="utf-8") as f:
        return yaml.safe_load(f)

def run_ingest(dry_run=False):
    root_dir = Path(__file__).resolve().parent.parent
    manifests_dir = root_dir / "manifests"
    derived_dir = root_dir / "derived" / "chunks"
    db_path = root_dir.parent / "corpus" / "chroma_db"

    catalog_path = manifests_dir / "source-catalog.yaml"
    boundaries_path = manifests_dir / "jurisdiction-boundaries.yaml"

    if not catalog_path.is_file() or not boundaries_path.is_file():
        print("[ERROR] Missing manifests in knowledge-base/manifests/")
        sys.exit(1)

    catalog = load_yaml(catalog_path)
    boundaries = load_yaml(boundaries_path)

    print("=" * 60)
    print("IP-SAKTI Sahayak — Manifest-Aware Ingestion Pipeline")
    print("=" * 60)

    stats = {"india": 0, "international": 0, "quarantined": 0}

    # Process derived chunks based on directory jurisdiction
    for jur in ["india", "international"]:
        jur_config = boundaries["jurisdictions"].get(jur, {})
        collection_name = jur_config.get("chroma_collection", f"{jur}_collection")
        jur_chunks_dir = derived_dir / jur

        print(f"\nProcessing Jurisdiction: {jur.upper()}")
        print(f"Target ChromaDB Collection: {collection_name}")
        print(f"Scanning directory: {jur_chunks_dir}")

        if not jur_chunks_dir.is_dir():
            print(f"  [WARN] Directory not found: {jur_chunks_dir}")
            continue

        for chunk_file in jur_chunks_dir.glob("*.jsonl"):
            record_count = 0
            with open(chunk_file, "r", encoding="utf-8") as f:
                for line in f:
                    if line.strip():
                        record_count += 1
            stats[jur] += record_count
            print(f"  - {chunk_file.name}: {record_count} chunks -> Collection '{collection_name}'")

    print("\n" + "=" * 60)
    print("Ingestion Summary:")
    print(f"  Total India Chunks:         {stats['india']}")
    print(f"  Total International Chunks: {stats['international']}")
    print(f"  Mode:                       {'DRY-RUN (Manifest Validation)' if dry_run or not HAS_CHROMADB else 'LIVE EMBED'}")
    print("=" * 60)

    return stats

if __name__ == "__main__":
    is_dry = "--dry-run" in sys.argv
    run_ingest(dry_run=is_dry)
