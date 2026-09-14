# IP-SAKTI Sahayak — Legal & Regulatory Knowledge Base

A curated, version-tracked, sovereign-separated knowledge base for AYUSH, Intellectual Property, Biodiversity, and regulatory compliance.

## Architecture Overview

```
knowledge-base/
├── schemas/          <- YAML schemas for sources, versions, case-law, citations
├── manifests/        <- Master source catalogs, current version indexes, boundaries
├── sources/          <- Primary authoritative sources (PDFs, metadata)
│   ├── india/        <- Domestic Indian statutes, rules, standards, records
│   └── international/<- International treaties, conventions, standards
├── derived/          <- Extracted text, normalized records, and chunk embeddings
├── quarantine/       <- Unverified, incomplete, and secondary materials
├── scripts/          <- Integrity validation, checksum verification, catalog builders
├── tests/            <- Pytest automated integrity test suite
└── docs/             <- Governance policies and operational guidelines
```

## Key Architectural Guarantees
1. **Strict Jurisdiction Isolation:** Indian law and International conventions are segregated into dedicated namespaces with zero cross-contamination.
2. **Immutable Provenance:** Original PDFs are preserved with SHA-256 cryptographic checksums.
3. **Clear Authoritative vs Secondary Boundaries:** Primary gazette copies reside in `sources/`, while secondary summaries and unverified narratives reside in `quarantine/` or `derived/`.

## Running Integrity Checks
```bash
# Run pytest test suite
python -m pytest knowledge-base/tests/ -v

# Run metadata validation
python knowledge-base/scripts/validate-source-metadata.py

# Verify SHA-256 checksums
python knowledge-base/scripts/verify-checksums.py

# Verify jurisdiction separation
python knowledge-base/scripts/validate-jurisdiction-separation.py
```
