#!/usr/bin/env python3
"""
migrate-existing-corpus.py
Idempotent migration utility to synchronize existing corpus files with knowledge-base layout
WITHOUT deleting or modifying originals in corpus/data/.
"""

import os
import shutil
import hashlib
from pathlib import Path

def compute_sha256(p):
    s = hashlib.sha256()
    with open(p, "rb") as f:
        while chunk := f.read(65536):
            s.update(chunk)
    return s.hexdigest()

def copy_if_needed(src, dst):
    dst.parent.mkdir(parents=True, exist_ok=True)
    if not dst.exists() or compute_sha256(src) != compute_sha256(dst):
        shutil.copy2(src, dst)
        return True
    return False

def main():
    root = Path(__file__).resolve().parent.parent.parent
    corpus_dir = root / "corpus" / "data"
    kb_dir = root / "knowledge-base"

    print("Running idempotent corpus synchronization...")
    copied_count = 0

    # 1. Raw PDFs to original/
    pdf_mappings = {
        corpus_dir / "raw" / "india" / "patents_act_1970.pdf": kb_dir / "sources" / "india" / "statutes" / "patents-act-1970" / "versions" / "1970-original" / "original" / "patents-act-1970.pdf",
        corpus_dir / "raw" / "india" / "biological_diversity_act_2002.pdf": kb_dir / "sources" / "india" / "statutes" / "biological-diversity-act-2002" / "versions" / "2002-original" / "original" / "biological-diversity-act-2002.pdf",
        corpus_dir / "raw" / "india" / "drugs_and_cosmetics_act_1940.pdf": kb_dir / "sources" / "india" / "statutes" / "drugs-and-cosmetics-act-1940" / "versions" / "1940-original" / "original" / "drugs-and-cosmetics-act-1940.pdf",
        corpus_dir / "raw" / "india" / "patents_rules_2003.pdf": kb_dir / "sources" / "india" / "rules" / "patents-rules-2003" / "versions" / "2003-original" / "original" / "patents-rules-2003.pdf",
        corpus_dir / "raw" / "india" / "nba_abs_guidelines.pdf": kb_dir / "sources" / "india" / "rules" / "nba-abs-guidelines" / "versions" / "current" / "original" / "nba-abs-guidelines.pdf",
        corpus_dir / "raw" / "india" / "28012025-CCRAS-Patent-Granted.pdf": kb_dir / "sources" / "india" / "registry-records" / "ccras-patent-records" / "versions" / "2025-01-28" / "original" / "28012025-CCRAS-Patent-Granted.pdf",
        corpus_dir / "raw" / "india" / "tkdl_overview.pdf": kb_dir / "sources" / "india" / "registry-records" / "tkdl-records" / "versions" / "current" / "original" / "tkdl_overview.pdf",
        corpus_dir / "raw" / "international" / "nagoya_protocol.pdf": kb_dir / "sources" / "international" / "treaties" / "nagoya-protocol" / "versions" / "2010-original" / "original" / "nagoya_protocol.pdf",
        corpus_dir / "raw" / "international" / "trips_agreement.pdf": kb_dir / "sources" / "international" / "treaties" / "trips-agreement" / "versions" / "1994-original" / "original" / "trips_agreement.pdf",
        corpus_dir / "raw" / "international" / "wipo_patent_basics.pdf": kb_dir / "quarantine" / "pending-verification" / "wipo-patent-basics.pdf",
    }

    for src, dst in pdf_mappings.items():
        if src.exists():
            if copy_if_needed(src, dst):
                copied_count += 1
                print(f"Copied: {src.name} -> {dst.relative_to(kb_dir)}")

    # 2. Processed chunks to derived/chunks/
    processed_dir = corpus_dir / "processed"
    if processed_dir.is_dir():
        for chunk_file in processed_dir.glob("*.jsonl"):
            name = chunk_file.name.lower()
            if any(k in name for k in ["nagoya", "trips", "wipo"]):
                dst = kb_dir / "derived" / "chunks" / "international" / chunk_file.name
            else:
                dst = kb_dir / "derived" / "chunks" / "india" / chunk_file.name
            if copy_if_needed(chunk_file, dst):
                copied_count += 1
                print(f"Copied chunk: {chunk_file.name} -> {dst.relative_to(kb_dir)}")

    # 3. Curated to quarantine/secondary-material/
    curated_dir = corpus_dir / "curated"
    if curated_dir.is_dir():
        for cur_file in curated_dir.glob("*.jsonl"):
            dst = kb_dir / "quarantine" / "secondary-material" / cur_file.name
            if copy_if_needed(cur_file, dst):
                copied_count += 1

    print(f"Corpus migration check complete. Total new copies/updates: {copied_count}")

if __name__ == "__main__":
    main()
