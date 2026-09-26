# Knowledge Base Registry & Master Manifest System

This directory contains the authoritative registry metadata for the **IP-SAKTI Sahayak** legal knowledge base.

## Components

### 1. `source_manifest.jsonl`
The canonical machine-readable inventory of all primary statutory documents, treaties, rules, and guidance in the knowledge base.
Every record follows this strict JSON schema:

```json
{
  "document_id": "string (deterministic, stable slug)",
  "source_path": "string (relative path from knowledge-base/)",
  "title": "string (official statutory or treaty title)",
  "jurisdiction": "India | International | Both | NeedsReview",
  "domain": "patents | trademarks | geographical-indications | copyright | designs | trade-secrets | plant-variety-protection | traditional-knowledge | biodiversity-abs | ayush-drug-regulation | food-cosmetics-advertising | case-law | official-guidance | treaties",
  "document_type": "statute | rule | treaty | registry-record | official-guidance | secondary-commentary | academic-journal",
  "authority": "string (issuing legislative or regulatory body)",
  "language": "en | hi | mul",
  "publication_date": "YYYY-MM-DD | null",
  "priority_date": "YYYY-MM-DD | null",
  "source_url": "string | null",
  "version": "string | null",
  "checksum": "string (SHA-256 hex digest)",
  "status": "verified | needs_review | duplicate | excluded"
}
```

### 2. `authority_registry.json`
Catalog of sovereign legislative and international regulatory authorities referenced across documents, detailing their mandate, statutory basis, and jurisdiction.

### 3. Record Status Taxonomy
- **`verified`**: Primary authoritative statutory text (Act, Rule, Treaty, Gazette Notification, or Official Compendium) with confirmed cryptographic integrity.
- **`needs_review`**: Non-authoritative, secondary, academic, or unverified documents placed in `sources/needs-review/` pending legal certification.
- **`duplicate`**: Byte-identical duplicate of an existing verified document; retained for provenance without duplicate vector ingestion.
- **`excluded`**: Non-substantive structural files (e.g. stub READMEs or empty TOC summaries) excluded from ingestion pipelines.
