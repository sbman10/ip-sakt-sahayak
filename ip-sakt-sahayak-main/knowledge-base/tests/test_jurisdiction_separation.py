import pytest
import yaml
from pathlib import Path

KB_DIR = Path(__file__).resolve().parent.parent
SOURCES_DIR = KB_DIR / "sources"
DERIVED_CHUNKS_DIR = KB_DIR / "derived" / "chunks"

def test_india_sources_isolation():
    india_dir = SOURCES_DIR / "india"
    for source_yaml in india_dir.glob("**/source.yaml"):
        with open(source_yaml, "r", encoding="utf-8") as f:
            data = yaml.safe_load(f)
        assert data.get("jurisdiction") == "india", f"Source at {source_yaml} must have jurisdiction 'india'"

def test_international_sources_isolation():
    intl_dir = SOURCES_DIR / "international"
    for source_yaml in intl_dir.glob("**/source.yaml"):
        with open(source_yaml, "r", encoding="utf-8") as f:
            data = yaml.safe_load(f)
        assert data.get("jurisdiction") == "international", f"Source at {source_yaml} must have jurisdiction 'international'"

def test_derived_chunks_no_cross_contamination():
    india_chunks = DERIVED_CHUNKS_DIR / "india"
    if india_chunks.is_dir():
        for chunk_file in india_chunks.glob("*.jsonl"):
            name = chunk_file.name.lower()
            assert not any(k in name for k in ["nagoya", "trips"]), f"International chunk in india dir: {chunk_file.name}"
    
    intl_chunks = DERIVED_CHUNKS_DIR / "international"
    if intl_chunks.is_dir():
        for chunk_file in intl_chunks.glob("*.jsonl"):
            name = chunk_file.name.lower()
            assert not any(k in name for k in ["patents_act_1970", "patents_rules_2003", "biological_diversity_act"]), f"India chunk in intl dir: {chunk_file.name}"
