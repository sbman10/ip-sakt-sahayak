# IP-SAKTI Sahayak — Knowledge Base Inventory & Gap Analysis

> **Generated on:** September 19, 2026  
> **Knowledge Base Root:** `knowledge-base/`  
> **Total Files Cataloged:** 228 files  
> **Total Primary Raw Document Weight:** ~7.28 MB (sources) + ~1.82 MB (quarantine) + ~1.02 MB (derived)  
> **Sovereign Isolation:** Enforced (Strict separation between `india/` and `international/` jurisdictions)

---

## 1. Executive Summary & File Distribution

The knowledge base implements a tiered legal repository architecture designed for regulatory compliance, patent prosecution, and AYUSH traditional knowledge defense.

### 1.1 High-Level Distribution by Layer

| Layer Directory | Description / Role | File Count | Total Size (Bytes) | Operational Status |
| :--- | :--- | :---: | :---: | :--- |
| [`sources/`](file:///c:/Users/thaku/Desktop/26045/knowledge-base/sources) | Primary authoritative legal texts (PDFs, metadata, citations) | **76** | 7,284,226 | Active (9 packages) + 22 Stubs |
| [`derived/`](file:///c:/Users/thaku/Desktop/26045/knowledge-base/derived) | Extracted chunk files for vectorization and BM25 indexing | **16** | 1,023,876 | 10 JSONL chunk files + 6 Stubs |
| [`curated/`](file:///c:/Users/thaku/Desktop/26045/knowledge-base/curated) | Domain-synthesized knowledge sets (Q&A, prosecution tips, FAQs) | **47** | 379,786 | 47 JSONL files (Secondary) |
| [`quarantine/`](file:///c:/Users/thaku/Desktop/26045/knowledge-base/quarantine) | Staging area for secondary/unverified or incomplete materials | **53** | 1,815,112 | 47 secondary + 3 case-law + 2 pending + 1 README |
| [`manifests/`](file:///c:/Users/thaku/Desktop/26045/knowledge-base/manifests) | Master catalogs, checksums, jurisdiction boundaries & versions | **6** | 13,572 | Complete & Machine-Validated |
| [`schemas/`](file:///c:/Users/thaku/Desktop/26045/knowledge-base/schemas) | YAML Schema definitions enforcing structural legal integrity | **5** | 15,259 | Complete & Machine-Validated |
| [`scripts/`](file:///c:/Users/thaku/Desktop/26045/knowledge-base/scripts) | Validation, checksum, catalog compilation & diagnostic tooling | **8** | 26,537 | Production Ready |
| [`tests/`](file:///c:/Users/thaku/Desktop/26045/knowledge-base/tests) | Pytest automated test suite for jurisdiction & integrity | **6** | 6,046 | Passing (100% assertion coverage) |
| [`docs/`](file:///c:/Users/thaku/Desktop/26045/knowledge-base/docs) | Governance policies (Case law, OCR, versioning, verification) | **6** | 5,468 | Official Governance Rules |
| **Root Files** | Pipelines, parsers, and governance entrypoints | **5** | 18,123 | `ingest.py`, `parser.py`, editorial policies |
| **TOTAL** | | **228** | **10,588,005** | **Full System Cataloged** |

### 1.2 Breakdown by File Extension

| File Extension | Count | Description / Role |
| :---: | :---: | :--- |
| `.jsonl` | **107** | Extracted chunks (10), curated packs (47), quarantined secondary (47), incomplete case law (3) |
| `.yaml` | **46** | Source metadata, versions, citations, schemas, and master manifests |
| `.md` | **38** | Documentation, governance policies, and placeholder / stub READMEs |
| `.py` | **16** | Automation scripts, ingest pipelines, parser, and pytest unit tests |
| `.sha256` | **11** | Cryptographic SHA-256 validation manifests for authoritative binaries |
| `.pdf` | **10** | Gazette and treaty original documents (9 authoritative in `sources/`, 1 in `quarantine/`) |

---

## 2. Layer 1: Primary Authoritative Legal Sources (`sources/`)

Primary sources are organized by jurisdiction (`india` vs `international`) and subdivided into official categories:
`statutes`, `rules`, `registry-records`, `case-law`, `pharmacopoeial-standards`, and `treaties`.

### 2.1 Fully Packaged Authoritative Sources (9 Packages, 54 Files)

Each authoritative source contains 6 mandatory components:
1. `source.yaml` (Canonical source metadata)
2. `current.yaml` (Pointer to current version)
3. `versions/<version>/original/<file>.pdf` (Original Gazette or Official PDF)
4. `versions/<version>/checksum.sha256` (Cryptographic SHA-256 hash)
5. `versions/<version>/metadata.yaml` (Version details, official URL, gazette notification)
6. `versions/<version>/citations.yaml` (Citation conventions and statutory references)

| Package Path | Jurisdiction | Category | Title & Issuing Authority | Version Tag | PDF Size | Status |
| :--- | :--- | :--- | :--- | :--- | :---: | :--- |
| `india/statutes/patents-act-1970` | India | Statute | **The Patents Act, 1970**<br>*(Parliament of India)* | `1970-original` | 666 KB | Authoritative |
| `india/statutes/biological-diversity-act-2002` | India | Statute | **The Biological Diversity Act, 2002**<br>*(Parliament of India)* | `2002-original` | 568 KB | Authoritative |
| `india/statutes/drugs-and-cosmetics-act-1940` | India | Statute | **The Drugs and Cosmetics Act, 1940**<br>*(Parliament of India)* | `1940-original` | 256 KB | Authoritative |
| `india/rules/patents-rules-2003` | India | Rule | **The Patents Rules, 2003**<br>*(Ministry of Commerce & Industry)* | `2003-original` | 3.68 MB | Authoritative |
| `india/rules/nba-abs-guidelines` | India | Rule | **NBA Guidelines on Access and Benefit Sharing**<br>*(National Biodiversity Authority)* | `current` | 285 KB | Authoritative |
| `india/registry-records/ccras-patent-records` | India | Registry | **CCRAS Patent Granted — 28 Jan 2025**<br>*(CCRAS / Ministry of AYUSH)* | `2025-01-28` | 593 KB | Authoritative |
| `india/registry-records/tkdl-records` | India | Registry | **Traditional Knowledge Digital Library — Overview**<br>*(CSIR / Ministry of AYUSH)* | `current` | 515 KB | Authoritative |
| `international/treaties/trips-agreement` | International | Treaty | **TRIPS Agreement (1994)**<br>*(World Trade Organization)* | `1994-original` | 198 KB | Authoritative |
| `international/treaties/nagoya-protocol` | International | Treaty | **Nagoya Protocol on ABS (2010)**<br>*(UNEP / CBD Secretariat)* | `2010-original` | 502 KB | Authoritative |

### 2.2 Placeholder / Stub Directories in `sources/` (22 README Files)

These directories represent established architectural slots where primary documents have not yet been placed:

| Directory Path | Jurisdiction | Category | Purpose / Intended Content |
| :--- | :--- | :--- | :--- |
| `sources/india/case-law/` | India | Case Law | Top-level Indian case law directory |
| `sources/india/case-law/supreme-court-of-india/` | India | Case Law | Supreme Court judgments (e.g. Novartis, Bayer) |
| `sources/india/case-law/high-courts/` | India | Case Law | High Court decisions (Delhi HC, Madras HC, Uttarakhand HC) |
| `sources/india/case-law/intellectual-property-tribunals/` | India | Case Law | IPAB / High Court Commercial IP Division orders |
| `sources/india/pharmacopoeial-standards/` | India | Standards | Top-level Indian pharmacopoeia directory |
| `sources/india/pharmacopoeial-standards/ayurvedic-pharmacopoeia-of-india/` | India | Standards | Official API monographs (plant/mineral standards) |
| `sources/india/pharmacopoeial-standards/homoeopathic-pharmacopoeia-of-india/` | India | Standards | Official HPI monographs |
| `sources/india/pharmacopoeial-standards/indian-pharmacopoeia/` | India | Standards | IP Monographs (chemical/pharmaceutical standards) |
| `sources/india/registry-records/nba-records/` | India | Registry | Official NBA approval registers, Form I/II/III approvals |
| `sources/india/treaties/` | India | Treaties | Domestic bilateral agreements / treaty acts |
| `sources/international/case-law/` | International | Case Law | Top-level international case law directory |
| `sources/international/case-law/foreign-courts/` | International | Case Law | Foreign landmark decisions (US Fed Cir, EPO Boards of Appeal) |
| `sources/international/case-law/international-courts/` | International | Case Law | ICJ / WTO Dispute Settlement Body panels |
| `sources/international/case-law/wipo-panels/` | International | Case Law | WIPO Arbitration and Mediation Center rulings |
| `sources/international/pharmacopoeial-standards/` | International | Standards | Top-level international pharmacopoeial directory |
| `sources/international/pharmacopoeial-standards/european-pharmacopoeia/` | International | Standards | Ph. Eur. herbal drug monographs |
| `sources/international/pharmacopoeial-standards/who-international-pharmacopoeia/` | International | Standards | WHO International Pharmacopoeia standards |
| `sources/international/registry-records/` | International | Registry | Top-level international registry records directory |
| `sources/international/registry-records/international-patent-records/` | International | Registry | WIPO PCT Gazette notices, USPTO/EPO herbal patent grants |
| `sources/international/registry-records/wipo-records/` | International | Registry | WIPO Traditional Knowledge & Genetic Resources records |
| `sources/international/rules/` | International | Rules | International procedural rules (e.g. PCT Regulations) |
| `sources/international/statutes/` | International | Statutes | Foreign sovereign acts (e.g. Bayh-Dole Act, EPC) |

> **Note on `sources/international/treaties/wipo-gratk-treaty/`:** An empty directory exists here awaiting the official WIPO GRATK Treaty (adopted May 24, 2024).

---

## 3. Layer 2: Derived Chunks & Indexes (`derived/`)

Derived materials are parsed outputs extracted from primary authoritative PDFs for vector embedding and keyword retrieval.

### 3.1 Active Chunks Files (`derived/chunks/`)

| File Relative Path | Jurisdiction | Derived From Document | Chunks Count | Size | Status |
| :--- | :--- | :--- | :---: | :---: | :--- |
| `chunks/india/patents_act_1970_chunks.jsonl` | India | The Patents Act, 1970 | **92** | 276.7 KB | Vectorized / Active |
| `chunks/india/patents_rules_2003_chunks.jsonl` | India | The Patents Rules, 2003 | **60** | 184.8 KB | Vectorized / Active |
| `chunks/india/drugs_and_cosmetics_act_1940_chunks.jsonl` | India | Drugs and Cosmetics Act, 1940 | **41** | 125.9 KB | Vectorized / Active |
| `chunks/india/biological_diversity_act_2002_chunks.jsonl` | India | Biological Diversity Act, 2002 | **38** | 121.8 KB | Vectorized / Active |
| `chunks/india/nba_abs_guidelines_chunks.jsonl` | India | NBA ABS Guidelines | **14** | 45.2 KB | Vectorized / Active |
| `chunks/india/tkdl_overview_chunks.jsonl` | India | TKDL Overview PDF | **2** | 6.3 KB | Vectorized / Active |
| `chunks/india/28012025-CCRAS-Patent-Granted_chunks.jsonl` | India | CCRAS Patent Grant PDF | **2** | 4.1 KB | Vectorized / Active |
| `chunks/international/wipo_patent_basics_chunks.jsonl` | International | WIPO Patent Basics (Quarantine) | **31** | 98.2 KB | Vectorized / Active |
| `chunks/international/trips_agreement_chunks.jsonl` | International | TRIPS Agreement (1994) | **30** | 96.1 KB | Vectorized / Active |
| `chunks/international/nagoya_protocol_chunks.jsonl` | International | Nagoya Protocol (2010) | **19** | 63.4 KB | Vectorized / Active |
| **Total Chunks** | | **10 Primary Source Documents** | **329 Chunks** | **1,022.5 KB** | **Ready for Search** |

### 3.2 Placeholder Directories in `derived/` (6 README Files)

| Directory Path | Intended Purpose | Current Status |
| :--- | :--- | :--- |
| `derived/extracted-text/` | Raw text extracted from original PDFs (`.txt` files) prior to chunking | Placeholder (README only) |
| `derived/embeddings/` | Pre-computed dense vector embeddings (`.npy` / parquet) | Placeholder (README only) |
| `derived/citation-index/` | Pre-computed statutory citation graph and cross-reference table | Placeholder (README only) |
| `derived/normalized-records/` | Canonical JSON/YAML normalized versions of gazette entries | Placeholder (README only) |
| `derived/chunks/` | Root directory for jurisdiction-segregated chunks | Contains 10 active `.jsonl` files |
| `derived/` | Root derived folder documentation | Contains top-level `README.md` |

---

## 4. Layer 3: Curated Domain Datasets (`curated/`)

The `curated/` folder contains **47 specialized JSONL files** (379.8 KB total) synthesized for immediate AI conversational grounding, compliance assistance, and patent drafting advice.

### 4.1 Categorized Overview of Curated Packs

| Category / Domain Cluster | Files Included | Record Count | Total Size | Primary Focus & Coverage |
| :--- | :--- | :---: | :---: | :--- |
| **AYUSH & Traditional Knowledge** | `ayush_digital_innovation.jsonl`<br>`ayush_export_regulations.jsonl`<br>`ayush_faq.jsonl`<br>`ayush_formulation_ip.jsonl`<br>`ayush_licensing.jsonl`<br>`ayush_ministry_guidelines.jsonl`<br>`ayush_quality_standards.jsonl`<br>`ayush_research_funding.jsonl`<br>`common_ayush_herbs.jsonl`<br>`tkdl.jsonl`<br>`tkdl_case_studies.jsonl` | **121 records** | ~89.1 KB | AYUSH formulations, Good Manufacturing Practices (Schedule T), Ministry of AYUSH schemes, herb monographs (Ashwagandha, Tulsi, Turmeric), TKDL defensive publication victories (Turmeric, Neem, Basmati). |
| **Biodiversity & ABS (NBA)** | `biodiversity_abs.jsonl`<br>`biopiracy_prevention.jsonl`<br>`indian_biodiversity_detailed.jsonl`<br>`plant_variety_protection.jsonl` | **45 records** | ~32.5 KB | Access & Benefit Sharing mechanisms, Form I–IV approvals under Biological Diversity Act, State Biodiversity Boards (SBB), PPV&FR Act rights. |
| **Patent Law & Prosecution** | `patent_claims_drafting.jsonl`<br>`patent_exclusions.jsonl`<br>`patent_fees.jsonl`<br>`patent_glossary.jsonl`<br>`patent_opposition_guide.jsonl`<br>`patent_prosecution.jsonl`<br>`patent_renewal_maintenance.jsonl`<br>`patent_search_strategies.jsonl`<br>`section3_exclusions_detailed.jsonl`<br>`compulsory_licensing.jsonl` | **130 records** | ~84.5 KB | Section 3(d), 3(e), 3(h), 3(j), 3(p) statutory patent exclusions; drafting Swiss-type and formulation claims; Pre-grant & Post-grant oppositions; Form 27 working statement; fee schedules. |
| **Case Law & Precedents** | `case_studies.jsonl`<br>`ip_case_law.jsonl`<br>`tkdl_case_studies.jsonl` | **36 records** | ~25.3 KB | Landmark Indian judgments (Novartis v. UOI, Bayer Compulsory License, CSIR turmeric patent revocation). |
| **Trademarks, Copyright, GI, Designs** | `trademark_registration.jsonl`<br>`copyright_protection.jsonl`<br>`design_registration.jsonl`<br>`gi_registration_guide.jsonl`<br>`trade_secrets.jsonl` | **54 records** | ~41.8 KB | Non-patent IP mechanisms: Geographical Indications for traditional products, Madrid Protocol trademarks, Industrial Designs Act, Copyright for ancient texts. |
| **International IP & Treaties** | `international_filing.jsonl`<br>`international_treaties.jsonl`<br>`pct_international_filing.jsonl` | **31 records** | ~23.3 KB | PCT Chapter I & II timelines, Paris Convention 12-month priority, TRIPS Article 27 patentability, Budapest Treaty deposits. |
| **Regulatory Intersections** | `drugs_cosmetics_act.jsonl`<br>`fssai_regulations.jsonl`<br>`clinical_trials_ip.jsonl`<br>`ip_regulatory_intersection.jsonl` | **45 records** | ~29.8 KB | Interplay between Patent Law and CDSCO/D&C Act, FSSAI nutraceutical standards vs proprietary medicines, clinical trial data exclusivity. |
| **Practical Practice & Timelines** | `deadlines.jsonl`<br>`ip_timelines.jsonl`<br>`startup_ip_guide.jsonl`<br>`ip_commercialization.jsonl`<br>`ip_enforcement.jsonl`<br>`ip_faq_comprehensive.jsonl`<br>`ip_professional_practice.jsonl`<br>`ip_quick_tips.jsonl` | **117 records** | ~53.5 KB | Statutory deadlines (FER response within 6 months, PCT national phase 31 months in India), Start-up India patent fee discounts (80%), patent agent exam & powers of attorney. |
| **TOTAL** | **47 Files** | **579 records** | **379.8 KB** | **Comprehensive Domain Coverage** |

---

## 5. Layer 4: Quarantine Directory (`quarantine/`)

The `quarantine/` directory holds candidate sources, secondary materials, and unverified records until they satisfy strict provenance and gazette criteria.

| Subdirectory / File | File Count | Content Details | Quarantine Reason & Required Action |
| :--- | :---: | :--- | :--- |
| `quarantine/pending-verification/` | **2** | `wipo-patent-basics.pdf` (1.41 MB)<br>`wipo-patent-basics.sha256` | Awaiting formal confirmation of official WIPO publication ID before moving to `sources/international/`. |
| `quarantine/incomplete-case-law/` | **3** | `case_studies.jsonl`<br>`ip_case_law.jsonl`<br>`tkdl_case_studies.jsonl` | Curated summaries of court cases lacking certified court judgment copies and docket records. |
| `quarantine/secondary-material/` | **47** | Mirror of all 47 JSONL files from `curated/` | Curated summaries lack attached primary gazette PDFs; held in quarantine to prevent contamination of authoritative corpus. |
| `quarantine/README.md` | **1** | Architecture rules for quarantine | Explains promotion criteria from quarantine to `sources/`. |
| **TOTAL** | **53** | | **Fully Isolated from Authoritative Sources** |

---

## 6. Layer 5: Schemas, Manifests & Governance Policies

### 6.1 Schemas (`schemas/` — 5 Files)

| File Name | Schema Subject | Validated Constraints |
| :--- | :--- | :--- |
| `source.schema.yaml` | Primary Legal Sources | Requires `source_id`, `jurisdiction`, `source_type`, `issuing_authority`, `official_url`, `checksum_sha256` |
| `version.schema.yaml` | Version Lineages | Enforces semantic version tags, gazette notification date, effective date, and amendments |
| `case-law.schema.yaml` | Judicial Precedents | Requires court name, bench, neutral citation, petition number, judgment date, ratio decidendi |
| `citation.schema.yaml` | Statutory Cross-References | Enforces standard Bluebook/Indian citation formatting and pin-point section identifiers |
| `registry-record.schema.yaml` | Administrative Records | Validates patent numbers, applicant details, application dates, and registry journal volumes |

### 6.2 Manifests (`manifests/` — 6 Files)

| Manifest File | Format | Key Content |
| :--- | :---: | :--- |
| `source-catalog.yaml` | YAML | Master catalog listing all 9 registered authoritative sources and paths |
| `source-type-catalog.yaml` | YAML | Taxonomy definitions for statute, rule, treaty, registry-record, pharmacopoeial-standard, case-law |
| `jurisdiction-boundaries.yaml` | YAML | Sovereign boundary rules strictly barring cross-jurisdiction referencing |
| `current-versions.yaml` | YAML | Authoritative registry mapping each source ID to its current active version |
| `verification-status.yaml` | YAML | Audit record of source verification checks and review timestamps |
| `checksums.sha256` | Text | Master cryptographic SHA-256 hash list of all raw source binaries |

### 6.3 Governance Policies (`docs/` — 6 Files)

| Document | Purpose |
| :--- | :--- |
| `SOURCE_LIFECYCLE.md` | Governs the 5 lifecycle stages: Discovery → Staging → Verification → Extraction → Archival |
| `VERIFICATION_WORKFLOW.md` | Protocols for verifying gazette notifications and cryptographic integrity |
| `VERSIONING_POLICY.md` | Rules for tracking legislative amendments and version retirement |
| `CASE_LAW_POLICY.md` | Strict requirements for accepting judicial decisions into authoritative sources |
| `REGISTRY_RECORD_POLICY.md` | Guidelines for ingesting patent office journals and TKDL records |
| `OCR_POLICY.md` | Standards for character error rate (CER < 1%) and text fidelity in scanned gazettes |

---

## 7. Layer 6: Scripts, Tests & Ingestion Engine

### 7.1 Automated Tooling & Scripts (`scripts/` — 8 Files)

| Script Path | Execution Command | Functionality |
| :--- | :--- | :--- |
| `scripts/verify-checksums.py` | `python scripts/verify-checksums.py` | Compares live PDF files against recorded SHA-256 hashes |
| `scripts/validate-source-metadata.py` | `python scripts/validate-source-metadata.py` | Validates all `source.yaml` and `metadata.yaml` against schema |
| `scripts/validate-jurisdiction-separation.py` | `python scripts/validate-jurisdiction-separation.py` | Ensures zero cross-contamination between Indian and International files |
| `scripts/build-source-catalog.py` | `python scripts/build-source-catalog.py` | Rebuilds `manifests/source-catalog.yaml` by scanning sources |
| `scripts/detect-duplicate-versions.py` | `python scripts/detect-duplicate-versions.py` | Flags duplicate or conflicting version numbers |
| `scripts/manifest-ingest.py` | `python scripts/manifest-ingest.py` | Ingests manifest data into database models |
| `scripts/check_embeddings.py` | `python scripts/check_embeddings.py` | Inspects status and dimensionality of ChromaDB embeddings |
| `scripts/search_diagnostic.py` | `python scripts/search_diagnostic.py` | Tests hybrid BM25 + dense retrieval on knowledge base chunks |

### 7.2 Automated Test Suite (`tests/` — 6 Files)

| Test File | Test Scope |
| :--- | :--- |
| `tests/test_jurisdiction_separation.py` | Asserts directory structure and metadata strictly adhere to sovereign boundary limits |
| `tests/test_metadata_schema.py` | Validates YAML syntax and mandatory fields for all sources |
| `tests/test_version_integrity.py` | Checks that version tags, effective dates, and lineage pointers are consistent |
| `tests/test_source_traceability.py` | Verifies that all derived chunks trace back to a valid authoritative source ID |
| `tests/test_case_law_completeness.py` | Tests that quarantined case law items are correctly flagged for missing docket info |
| `tests/__init__.py` | Test package initialization |

### 7.3 Root Processing Pipelines (5 Files)

| File Name | Role |
| :--- | :--- |
| [`ingest.py`](file:///c:/Users/thaku/Desktop/26045/knowledge-base/ingest.py) | End-to-end vector indexing: extracts text from PDFs, computes SentenceTransformer (`BAAI/bge-m3`) embeddings, and saves into ChromaDB + serialized BM25 index |
| [`parser.py`](file:///c:/Users/thaku/Desktop/26045/knowledge-base/parser.py) | Legal document parser: splits statutes into sections, subsections, and schedules |
| [`README.md`](file:///c:/Users/thaku/Desktop/26045/knowledge-base/README.md) | Knowledge base architecture overview and quick-start instructions |
| [`EDITORIAL_POLICY.md`](file:///c:/Users/thaku/Desktop/26045/knowledge-base/EDITORIAL_POLICY.md) | Quality standards and guidelines for contributing curated text |
| [`CONTRIBUTING.md`](file:///c:/Users/thaku/Desktop/26045/knowledge-base/CONTRIBUTING.md) | Pull request and package structure guide for contributors |

---

## 8. Gap Analysis & What Is Needed to Be There

Based on the architectural structure and existing stubs, here is the prioritized inventory of **what is needed to complete the knowledge base**:

```
========================================================================================
                          KNOWLEDGE BASE GAP RADAR
========================================================================================
[CRITICAL GAPS]
 ├── Indian Case Law (Novartis, Bayer, Divya Pharmacy, Monsanto)   ──> 0 Certified Judgments
 ├── Pharmacopoeial Monographs (Ayurvedic API, Indian IP)          ──> 0 Official Standards
 ├── Statutory Updates (Biological Diversity 2023, Patent Rules 24)──> Missing Latest Amendments
 └── WIPO GRATK Treaty (Adopted May 2024)                          ──> Folder exists, empty
========================================================================================
```

### 8.1 Priority P0 (Immediate Legal Gaps in Authoritative Sources)

| Item Needed | Proposed Package Path | Reason & Legal Importance | Action Required |
| :--- | :--- | :--- | :--- |
| **Biological Diversity (Amendment) Act, 2023** | `sources/india/statutes/biological-diversity-act-2023/` | Significantly amended the 2002 Act: decriminalized offenses, exempted AYUSH practitioners from ABS, streamlined commercial approvals. | Add official Gazette PDF, `source.yaml`, `metadata.yaml`, SHA-256. |
| **The Patents (Amendment) Rules, 2024** | `sources/india/rules/patents-rules-2024/` | Radical overhaul of Indian patent prosecution: Form 27 (statement of working) now filed triennially; examination request period reduced from 48 to 31 months; pre-grant opposition fees introduced. | Add official Gazette notification PDF, metadata, and chunk extraction. |
| **WIPO GRATK Treaty (2024)** | `sources/international/treaties/wipo-gratk-treaty/` | Historical treaty adopted May 24, 2024 on Intellectual Property, Genetic Resources and Traditional Knowledge; mandates patent applicants to disclose origin. | Place official WIPO text PDF into existing empty folder, generate YAML metadata and checksum. |
| **Landmark Supreme Court Case Law** | `sources/india/case-law/supreme-court-of-india/` | Currently has only a stub README. Needs certified judgment PDFs: <br>1. *Novartis AG v. Union of India (2013)* — Section 3(d) enhanced efficacy doctrine.<br>2. *Bayer Corporation v. Union of India (2014)* — Compulsory Licensing under Section 84.<br>3. *Monsanto Technology LLC v. Nuziveedu Seeds (2019)* — Section 3(j) plant variety patentability. | Populate packages with official court judgments, `case-law.schema.yaml` metadata. |
| **Landmark High Court Case Law** | `sources/india/case-law/high-courts/` | Needs certified judgments: <br>1. *Divya Pharmacy v. Union of India (Uttarakhand HC 2018)* — Indian companies are subject to Fair and Equitable Benefit Sharing (ABS) with NBA.<br>2. *F. Hoffmann-La Roche v. Cipla (Delhi HC)* — Public interest and patent injunctions. | Add court orders and certified ratio decidendi records. |

### 8.2 Priority P1 (AYUSH & Pharmacopoeial Standards)

| Item Needed | Proposed Package Path | Reason & Legal Importance | Action Required |
| :--- | :--- | :--- | :--- |
| **Ayurvedic Pharmacopoeia of India (API) Extracts** | `sources/india/pharmacopoeial-standards/ayurvedic-pharmacopoeia-of-india/` | The API provides statutory standards recognized under Second Schedule of Drugs & Cosmetics Act 1940. Essential for defending formulation claims against novelty/obviousness objections. | Add official Monographs for high-frequency patent herbs: *Withania somnifera* (Ashwagandha), *Curcuma longa* (Turmeric), *Azadirachta indica* (Neem), *Ocimum sanctum* (Tulsi). |
| **Drugs and Cosmetics Rules, 1945 (Part XVI & XVII)** | `sources/india/rules/drugs-and-cosmetics-rules-1945/` | Specific rules governing manufacturing, labeling, and licensing of Ayurvedic, Siddha, and Unani drugs. | Add official Gazette text and chunking. |
| **Biological Diversity Rules, 2004** | `sources/india/rules/biological-diversity-rules-2004/` | Subordinate rules defining NBA fee structures, Form I–IV application processes, and ABS calculation methodologies. | Add official Gazette text. |
| **NBA Official Records & Approvals** | `sources/india/registry-records/nba-records/` | Examples of approved ABS agreements and gazetted approvals for commercial AYUSH utilization. | Add sample official approvals with scrubbed PII. |

### 8.3 Priority P2 (Derived Assets & Vector Infrastructure)

| Asset Needed | Location | Current State | Required Work |
| :--- | :--- | :--- | :--- |
| **Raw Text Cache (`.txt`)** | `derived/extracted-text/` | Only `README.md` | Run `parser.py` to extract and store cleaned `.txt` copies alongside chunk files for rapid keyword regex scanning. |
| **Precomputed Embeddings** | `derived/embeddings/` | Only `README.md` | Serialize BAAI/bge-m3 dense vector arrays to disk so offline restarts don't require re-embedding 7MB+ of PDFs. |
| **Statutory Cross-Citation Graph** | `derived/citation-index/` | Only `README.md` | Generate bi-directional cross-reference index (e.g. Patents Act Section 3(p) $\leftrightarrow$ Biological Diversity Act Section 6 $\leftrightarrow$ TKDL). |
| **Promote Quarantined Materials** | `quarantine/` $\rightarrow$ `sources/` | 1 PDF pending, 3 case law JSONLs | 1. Verify and promote `wipo-patent-basics.pdf` to `sources/international/`.<br>2. Format `ip_case_law.jsonl` entries into certified case law packages. |

---

## 9. Actionable Checklist for Knowledge Base Expansion

- [ ] **Step 1:** Download official Gazette copy of **The Biological Diversity (Amendment) Act, 2023** and package in `sources/india/statutes/`.
- [ ] **Step 2:** Download official Gazette notification of **The Patents (Amendment) Rules, 2024** and package in `sources/india/rules/`.
- [ ] **Step 3:** Populate `sources/international/treaties/wipo-gratk-treaty/` with the authentic May 2024 WIPO Treaty text and metadata.
- [ ] **Step 4:** Add full judgment text and case metadata for *Novartis (2013)*, *Bayer (2014)*, and *Divya Pharmacy (2018)* into `sources/india/case-law/`.
- [ ] **Step 5:** Add first batch of Ayurvedic Pharmacopoeia of India (API) monographs into `sources/india/pharmacopoeial-standards/`.
- [ ] **Step 6:** Run `python knowledge-base/ingest.py` to re-chunk, compute dense vector embeddings, and refresh ChromaDB and BM25 search indices.
