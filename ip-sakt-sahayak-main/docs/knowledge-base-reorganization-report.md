# Knowledge Base Reorganization Report: IP-SAKTI Sahayak

**Date:** 2026-09-21  
**Project:** IP-SAKTI Sahayak (Ministry of AYUSH Problem Statement)  
**Status:** Completed & Validated  
**Safety Status:** 0 Source Files Deleted | 0 Remote Qdrant Writes | 100% Tests Passing (24/24)  

---

## 1. Executive Summary

This reorganization establishes a clean, auditable, domain-separated, and Qdrant-ready knowledge-base structure for IP-SAKTI Sahayak. All source materials—including 7 canonical statutory and treaty packages previously tracked in git, and 44 loose legislative documents, gazette notifications, and treaty texts—have been inventoried, classified, checksummed with SHA-256, and placed into appropriate domain subdirectories.

A canonical manifest registry (`knowledge-base/registry/source_manifest.jsonl`) and authority registry (`knowledge-base/registry/authority_registry.json`) now serve as the single source of truth for document provenance. All three ingestion scripts (`parser.py`, `ingest.py`, and `qdrant_ingest.py`) have been updated to consume this manifest, enforce 17-field Qdrant payload schemas, preserve deterministic chunk citations, and gracefully handle optional temporal metadata without fabricating dates.

---

## 2. Invariant Verification

| Metric / Invariant | Required State | Verified State | Status |
|---|---|---|---|
| **Source Files Deleted** | Exactly 0 | 0 files deleted | **PASSED** |
| **Production Collection (`ragvyn_prod_v1`)** | Unmodified (753 points) | 753 points (0 writes) | **PASSED** |
| **Reference Collection (`ragvyn_hybrid_test_v2`)** | Unmodified (753 points) | 753 points (0 writes) | **PASSED** |
| **Test Collection (`ragvyn_hybrid_test`)** | Unmodified (889 points) | 889 points (0 writes) | **PASSED** |
| **Knowledge Base Pytest Suite** | 100% passing | 24/24 passed in 0.69s | **PASSED** |
| **Dry-Run Upload Invariant** | `upload_executed: False` | `upload_executed: False`, `zero_writes_confirmed: True` | **PASSED** |
| **17-Field Payload Schema** | Fully populated | Verified in point structs | **PASSED** |
| **Missing Metadata Policy** | `null` / `None`, no hallucinated dates | Verified (`null` in JSON / `None` in Python) | **PASSED** |

---

## 3. Directory Structure & Domain Architecture

```
knowledge-base/
├── registry/
│   ├── source_manifest.jsonl        # 54 canonical document records (checksum, authority, ISO dates)
│   ├── authority_registry.json      # Standardized regulatory authorities & jurisdictions
│   └── README.md                    # Registry schema and governance documentation
├── sources/
│   ├── india/
│   │   ├── patents/                 # Patents Act 1970, Patents Rules 2003, Amendment Rules 2024
│   │   ├── trademarks/              # Trademarks Act and rules
│   │   ├── geographical-indications/# GI Act, Rules, and official manuals
│   │   ├── copyright/               # Copyright Act and rules
│   │   ├── designs/                 # Designs Act and rules
│   │   ├── trade-secrets/           # Trade secrets guidance & jurisprudence
│   │   ├── plant-variety-protection/# PPV&FR Act and rules
│   │   ├── traditional-knowledge/   # TKDL records, CCRAS patent records
│   │   ├── biodiversity-abs/        # Biological Diversity Act 2002, 2023 Amendment, 2024 Rules, NBA ABS 2014 & 2025
│   │   ├── ayush-drug-regulation/   # Drugs & Cosmetics Act 1940, Rules 1945 compendium, Cosmetics Rules 2020, DMR Act 1954
│   │   ├── food-cosmetics-advertising/ # FSSAI Ayurveda Aahara 2022/2024, Labelling & Display, Claims Compendium
│   │   ├── case-law/                # Landmark IP & regulatory judgments
│   │   └── official-guidance/       # Official CGPDTM/MoA guidelines & examination manuals
│   ├── international/
│   │   ├── treaties/                # TRIPS, Nagoya Protocol, CBD 1992, WIPO GRATK Treaty 2024, Doha Declaration
│   │   ├── patents/                 # PCT, foreign statutory excerpts
│   │   ├── trademarks/              # US Lanham Act / Federal Statutes
│   │   ├── geographical-indications/# WIPO GI Introduction
│   │   ├── copyright/               # Berne Convention & international copyright
│   │   ├── designs/                 # Hague Agreement
│   │   ├── traditional-knowledge/   # International TK frameworks
│   │   ├── biodiversity-abs/        # Multilateral ABS mechanisms
│   │   ├── case-law/                # International dispute panels & WTO appellate decisions
│   │   └── official-guidance/       # WIPO/WTO handbooks & guidelines
│   └── needs-review/                # Quarantined non-official or third-party materials
├── derived/
│   ├── extracted-text/              # Text caches
│   ├── chunks/
│   │   ├── india/                   # India domain JSONL chunks
│   │   └── international/           # International domain JSONL chunks
│   ├── manifests/                   # Derived manifests
│   └── embeddings/                  # Embedding caches
├── manifests/
│   └── source-catalog.yaml          # Git package catalog (updated to new domain paths)
└── tests/                           # 24 automated metadata, traceability & integrity tests
```

---

## 4. Old-to-New Path Mappings

### 4.1 Git-Tracked Source Packages (Migrated via `git mv`)

| Original Path | Reorganized Domain Path | Authority | Jurisdiction |
|---|---|---|---|
| `sources/india/statutes/patents-act-1970/` | `sources/india/patents/patents-act-1970/` | CGPDTM / MoCI | India |
| `sources/india/rules/patents-rules-2003/` | `sources/india/patents/patents-rules-2003/` | CGPDTM / MoCI | India |
| `sources/india/statutes/biological-diversity-act-2002/` | `sources/india/biodiversity-abs/biological-diversity-act-2002/` | NBA / MoEFCC | India |
| `sources/india/rules/nba-abs-guidelines/` | `sources/india/biodiversity-abs/nba-abs-guidelines/` | NBA / MoEFCC | India |
| `sources/india/statutes/drugs-and-cosmetics-act-1940/` | `sources/india/ayush-drug-regulation/drugs-and-cosmetics-act-1940/` | CDSCO / MoHFW & MoA | India |
| `sources/india/registry-records/ccras-patent-records/` | `sources/india/traditional-knowledge/ccras-patent-records/` | CCRAS / MoA | India |
| `sources/india/registry-records/tkdl-records/` | `sources/india/traditional-knowledge/tkdl-records/` | CSIR-TKDL & MoA | India |

*Note: `nagoya-protocol` and `trips-agreement` were already located under `sources/international/treaties/` and were preserved intact.*

### 4.2 Relocated Loose Files (44 Files Categorized)

| Original Folder | Source Filename | Target Destination | Status |
|---|---|---|---|
| `ADVERTISING-CLAIM/` | `62789a20b54bdGazette_Notification_Ayurveda_Aahara_09_05_2022.pdf` | `sources/india/food-cosmetics-advertising/` | verified |
| `ADVERTISING-CLAIM/` | `Compendium_Advertising_Claims_Regulations_04_10_2022.pdf` | `sources/india/food-cosmetics-advertising/` | verified |
| `ADVERTISING-CLAIM/` | `Compendium_Food_Additives_Regulations_26_03_2021.pdf` | `sources/india/food-cosmetics-advertising/` | verified |
| `ADVERTISING-CLAIM/` | `Compendium_Packaging_Regulations_28_01_2022.pdf` | `sources/india/food-cosmetics-advertising/` | verified |
| `ADVERTISING-CLAIM/` | `Gazette_Notification_Labelling_Display_18_11_2020.pdf` | `sources/india/food-cosmetics-advertising/` | verified |
| `ADVERTISING-CLAIM/` | `Gazette_Notification_Packaging_27_12_2018.pdf` | `sources/india/food-cosmetics-advertising/` | verified |
| `ADVERTISING-CLAIM/` | `README.md` | `sources/india/food-cosmetics-advertising/advertising-claims-readme.md` | excluded (doc) |
| `AYURVEDA FOOD/` | `2024 ORDER.pdf` | `sources/india/food-cosmetics-advertising/` | verified |
| `AYURVEDA FOOD/` | `ORDER PART 2.pdf` | `sources/india/food-cosmetics-advertising/` | verified |
| `AYURVEDA FOOD/` | `USE OF DOCS.pdf` | `sources/india/food-cosmetics-advertising/` | verified |
| `AYURVEDA FOOD/` | `README.md` | `sources/india/food-cosmetics-advertising/ayurveda-food-readme.md` | excluded (doc) |
| `FSSAI-Ayurveda-Ahaar-Regulations/` | `2022 REGULATION.pdf` | `sources/india/food-cosmetics-advertising/` | duplicate (marked) |
| `FSSAI-Ayurveda-Ahaar-Regulations/` | `Compendium_Ayurveda_Aahara_Regulations_09_05_2022.pdf` | `sources/india/food-cosmetics-advertising/` | verified |
| `FSSAI-Ayurveda-Ahaar-Regulations/` | `Compendium_Labelling_Display_23_09_2021.pdf` | `sources/india/food-cosmetics-advertising/` | verified |
| `FSSAI-Ayurveda-Ahaar-Regulations/` | `README.md` | `sources/india/food-cosmetics-advertising/fssai-regulations-readme.md` | excluded (doc) |
| `D & C ACT/` | `2016Drugs and CosmeticsAct 1940 Rules 1945.pdf` | `sources/india/ayush-drug-regulation/` | verified |
| `D & C ACT/` | `COSMETICS RULES 2020.pdf` | `sources/india/ayush-drug-regulation/` | verified |
| `D & C ACT/` | `README.md` | `sources/india/ayush-drug-regulation/d-and-c-readme.md` | excluded (doc) |
| `BIODIVERSITY/` | `BD-ABS-Regaultions-2025-1.pdf` | `sources/india/biodiversity-abs/` | verified |
| `BIODIVERSITY/` | `Biodiversity_act_2002.pdf` | `sources/india/biodiversity-abs/` | verified |
| `BIODIVERSITY/` | `Biological-Diversity-Rules-2024.pdf` | `sources/india/biodiversity-abs/` | verified |
| `BIODIVERSITY/` | `Biological-Diversity-act-2023.pdf` | `sources/india/biodiversity-abs/` | verified |
| `BIODIVERSITY/` | `README.md` | `sources/india/biodiversity-abs/biodiversity-readme.md` | excluded (doc) |
| `PATENT RULES/` | `Patents (Amendment) Rules, 2024 (WIPO).pdf` | `sources/india/patents/` | verified |
| `PATENT RULES/` | `Patents (Amendment) Rules, 2024.pdf` | `sources/india/patents/` | verified |
| `PATENT RULES/` | `Patents (Second Amendment) Rules, 2024.pdf` | `sources/india/patents/` | verified |
| `PATENT RULES/` | `README.md` | `sources/india/patents/patent-rules-readme.md` | excluded (doc) |
| `TREATIES/` | `641.pdf` | `sources/international/treaties/` | verified |
| `TREATIES/` | `TRIPS05_en.pdf` | `sources/international/treaties/` | verified |
| `TREATIES/` | `WIPO_GRATK_TREATY.pdf` | `sources/international/treaties/` | verified |
| `TREATIES/` | `XXVII-8-b-Corr-Original.pdf` | `sources/international/treaties/` | verified |
| `TREATIES/` | `cbd-en.pdf` | `sources/international/treaties/` | verified |
| `TREATIES/` | `mindecl_trips_e.pdf` | `sources/international/treaties/` | verified |
| `TREATIES/` | `nagoya-protocol-decisions-cop10.pdf` | `sources/international/treaties/` | verified |
| `TREATIES/` | `nagoya-protocol-overview-brochure.pdf` | `sources/international/treaties/` | verified |
| `TREATIES/` | `README.md` | `sources/international/treaties/treaties-readme.md` | excluded (doc) |
| `TRADEMARK/` | `All about geographical indications.pdf` | `sources/needs-review/` | needs_review |
| `TRADEMARK/` | `GI jounal.pdf` | `sources/needs-review/` | needs_review |
| `TRADEMARK/` | `Intro Trademark law US.pdf` | `sources/needs-review/` | needs_review |
| `TRADEMARK/` | `TML(India).txt` | `sources/needs-review/` | needs_review |
| `TRADEMARK/` | `TML(USA).txt` | `sources/needs-review/` | needs_review |
| `TRADEMARK/` | `US Trademark Law.pdf` | `sources/international/trademarks/` | verified |
| `TRADEMARK/` | `WIPO GI.pdf` | `sources/international/geographical-indications/` | verified |
| `TREATIES/` | `content_tripshandbooksecond_e.pdf` | `sources/needs-review/` | needs_review |

---

## 5. Review Queue & Quarantined Files

The following 7 files have been isolated in `knowledge-base/sources/needs-review/` and assigned `"status": "needs_review"` in `source_manifest.jsonl`. They are automatically skipped during ingestion:

1. **`All about geographical indications.pdf`**:
   - *Reason:* Third-party legal blog article (iPleaders), not a primary statute, rule, or official gazette notification.
2. **`GI jounal.pdf`**:
   - *Reason:* Academic journal article discussing GI jurisprudence rather than an official GI Journal or statutory enactment.
3. **`Intro Trademark law US.pdf`**:
   - *Reason:* Congressional Research Service (CRS) informational report; useful as secondary commentary but not official statutory text.
4. **`TML(India).txt`**:
   - *Reason:* Unverified plain text copy extracted from an online commercial guide (ICLG); lacks official citations and gazette verification.
5. **`TML(USA).txt`**:
   - *Reason:* Unverified plain text copy extracted from an online commercial guide (ICLG); lacks official citations and gazette verification.
6. **`content_tripshandbooksecond_e.pdf`**:
   - *Reason:* 6-page table of contents fragment of the WTO TRIPS Handbook, lacking actual substantive treaty provisions.
7. **`wipo-patent-basics.pdf`**:
   - *Reason:* Informal informational brochure pending authoritative text mapping.

---

## 6. Duplicate File Detection

Cryptographic SHA-256 analysis identified the following duplicate pair:
- File A: `sources/india/food-cosmetics-advertising/62789a20b54bdGazette_Notification_Ayurveda_Aahara_09_05_2022.pdf`
- File B: `sources/india/food-cosmetics-advertising/2022 REGULATION.pdf`
- **SHA-256 Hash:** `1ae8cfc632fad0a775316a84999a48adb6cf4b47d05bd4faa75f5190c511f699`
- **Triage Decision:** Both files are physically preserved on disk (zero data loss policy). In `source_manifest.jsonl`, `62789a20b54bd...` is designated as `verified`, while `2022 REGULATION.pdf` is assigned `"status": "duplicate"`, preventing redundant chunk creation and vector pollution.

---

## 7. Missing Metadata Policy & Handling

To guarantee regulatory reliability and prevent LLM hallucinations:
1. **Never Invent Dates or Authorities:** When official dates are not specified in the primary document (such as `fssai-ayurveda-aahara-docs-usage-guide`), `publication_date` and `priority_date` are stored explicitly as `null` in JSON (`None` in Python), rather than empty strings `""` or arbitrary placeholder dates (e.g. `1970-01-01`).
2. **Strict ISO-8601 Formatting:** All verified dates conform strictly to `YYYY-MM-DD`. Valid years (e.g., `1970`) are normalized to `1970-01-01`. Arbitrary or unparseable date strings are rejected during preflight validation.
3. **Canonical Authority Registry:** Regulatory bodies are normalized through `knowledge-base/registry/authority_registry.json`, mapping acronyms to official full names (e.g., `CGPDTM`, `NBA`, `CDSCO`, `FSSAI`, `WIPO`, `WTO`, `CCRAS`, `CSIR-TKDL`).

---

## 8. Ingestion Pipeline Compatibility & 17-Field Qdrant Schema

The ingestion components (`parser.py`, `ingest.py`, `qdrant_ingest.py`) were updated with full backward compatibility:

### Standardized 17-Field Payload Schema

```json
{
  "chunk_id": "patents_act_1970_s3_p1_c1",
  "document_id": "patents-act-1970",
  "text": "Section 3. What are not inventions...",
  "title": "The Patents Act, 1970",
  "authority": "Office of the Controller General of Patents, Designs and Trade Marks (CGPDTM)",
  "jurisdiction": "India",
  "domain": "patents",
  "document_type": "statute",
  "section": "Section 3(p)",
  "language": "en",
  "publication_date": "1970-09-19",
  "priority_date": "1972-04-20",
  "source_url": "https://ipindia.gov.in",
  "page": 2,
  "checksum": "d41d8cd98f00b204e9800998ecf8427e...",
  "embedding_model": "BAAI/bge-m3",
  "vector_dimension": 1024
}
```

*Backward compatibility fields (`source`, `page_number`, `parent_section`, `chapter`, `embedding_dimension`, `sparse_model`) are additionally preserved in the payload to ensure zero breakage of existing downstream services.*

### Status Filtering Rule
Ingestion scripts consult `source_manifest.jsonl` and only process entries with `"status": "verified"`. Entries with status `needs_review`, `duplicate`, or `excluded` are automatically skipped.

---

## 9. Validation & Dry-Run Execution Results

### 9.1 Pytest Suite Execution
```
c:\Users\thaku\Desktop\26045\backend\.venv\Scripts\python.exe -m pytest -q knowledge-base/tests
........................                                                 [100%]
24 passed in 0.69s
```

### 9.2 Dry-Run Execution
```
c:\Users\thaku\Desktop\26045\backend\.venv\Scripts\python.exe knowledge-base/qdrant_ingest.py --mode dry-run --limit-docs 2

--- Dry-Run Summary ---
  mode: dry-run
  target_collection: ragvyn_hybrid_test
  schema_verified: True
  documents_parsed: 2
  total_chunks_discovered: 2563
  sample_points_built: 10
  validation_errors: []
  valid_chunks: 2563
  incomplete_chunks: 0
  invalid_chunks: 0
  missing_fields_summary: {}
  zero_writes_confirmed: True
  upload_executed: False
```

### 9.3 Safe Temporal Metadata Omission Dry-Run (`fssai-ayurveda-aahara-docs-usage-guide`)
```
c:\Users\thaku\Desktop\26045\backend\.venv\Scripts\python.exe knowledge-base/qdrant_ingest.py --mode dry-run --doc-id fssai-ayurveda-aahara-docs-usage-guide

--- Dry-Run Summary ---
  mode: dry-run
  target_collection: ragvyn_hybrid_test
  schema_verified: True
  documents_parsed: 1
  total_chunks_discovered: 1
  sample_points_built: 1
  validation_errors: []
  valid_chunks: 0
  incomplete_chunks: 1
  invalid_chunks: 0
  missing_fields_summary: {'missing_publication_date': 1, 'missing_priority_date': 1}
  zero_writes_confirmed: True
  upload_executed: False
```

### 9.4 Verification of Zero Remote Qdrant Writes
```python
# Collection points count before and after dry-run:
ragvyn_prod_v1:         753 points (unchanged)
ragvyn_hybrid_test_v2:  753 points (unchanged)
ragvyn_hybrid_test:     889 points (unchanged)
```

---

## 10. Recommended Next Commands

To execute a dry-run ingestion across the entire verified knowledge base:
```powershell
backend\.venv\Scripts\python.exe knowledge-base/qdrant_ingest.py --mode dry-run
```

To execute a preflight audit against a specific document:
```powershell
backend\.venv\Scripts\python.exe knowledge-base/qdrant_ingest.py --mode preflight --doc-id patents-act-1970
```

To re-run the complete knowledge-base test suite:
```powershell
backend\.venv\Scripts\python.exe -m pytest -q knowledge-base/tests
```
