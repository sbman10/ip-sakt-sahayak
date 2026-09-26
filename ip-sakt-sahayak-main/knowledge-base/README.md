# IP-SAKTI Sahayak — Legal & Regulatory Knowledge Base

A clean, auditable, Qdrant-ready knowledge base structure tailored for the Ministry of Ayush problem statement, intellectual property law, biodiversity compliance, and regulatory affairs.

## Architecture Overview

```
knowledge-base/
├── sources/
│   ├── india/
│   │   ├── patents/
│   │   ├── trademarks/
│   │   ├── geographical-indications/
│   │   ├── copyright/
│   │   ├── designs/
│   │   ├── trade-secrets/
│   │   ├── plant-variety-protection/
│   │   ├── traditional-knowledge/
│   │   ├── biodiversity-abs/
│   │   ├── ayush-drug-regulation/
│   │   ├── food-cosmetics-advertising/
│   │   ├── case-law/
│   │   └── official-guidance/
│   ├── international/
│   │   ├── treaties/
│   │   ├── patents/
│   │   ├── trademarks/
│   │   ├── geographical-indications/
│   │   ├── copyright/
│   │   ├── designs/
│   │   ├── traditional-knowledge/
│   │   ├── biodiversity-abs/
│   │   ├── case-law/
│   │   └── official-guidance/
│   └── needs-review/
├── curated/
├── derived/
│   ├── extracted-text/
│   ├── chunks/
│   │   ├── india/
│   │   └── international/
│   ├── manifests/
│   └── embeddings/
├── registry/
│   ├── source_manifest.jsonl
│   ├── authority_registry.json
│   └── README.md
└── README.md
```

## Key Architectural Guarantees

1. **Strict Jurisdiction Separation:** Domestic Indian law (`sources/india/`) and International treaties/rules (`sources/international/`) are segregated into dedicated namespaces with zero cross-contamination.
2. **Canonical Manifest & Registry:** `registry/source_manifest.jsonl` provides a deterministic, machine-readable catalog with verified SHA-256 checksums, statutory authority links, and ISO dates.
3. **Immutable Provenance:** Original source documents are never modified or deleted; duplicate copies are flagged as `duplicate`, and uncertified secondary materials are segregated into `sources/needs-review/`.
4. **Qdrant Cloud Hybrid Readiness:** All chunk generation and payloads are standardized for dual-vector hybrid search (1,024-d dense BAAI/bge-m3 + sparse Qdrant/bm25 with IDF).

## Running Validation & Tests

```bash
# Run pytest test suite
python -m pytest -q knowledge-base/tests

# Run dry-run ingestion validation (zero writes)
python knowledge-base/qdrant_ingest.py --mode dry-run
```
