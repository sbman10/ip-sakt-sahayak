# Derived Artifacts Directory

This directory contains processed, transformed, or computed artifacts generated from authoritative sources in `sources/`.

## Directory Layout
- `extracted-text/` — Extracted plain text and markdown from original PDFs
- `normalized-records/` — Normalized JSON representations of statutes and regulations
- `chunks/` — Chunked JSONL datasets for vector embedding (separated by jurisdiction)
- `embeddings/` — Precomputed vector indexes and metadata caches
- `citation-index/` — Cross-reference indexes linking derived chunks back to source sections
