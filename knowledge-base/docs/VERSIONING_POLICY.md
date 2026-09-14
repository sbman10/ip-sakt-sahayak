# Versioning Policy

## 1. Immutability Principle
Original source documents deposited under `versions/<version-label>/original/` are **strictly immutable**. Once a file hash is computed and recorded in `checksum.sha256`, the file must not be modified, overwritten, or re-compressed.

## 2. Version Labeling Taxonomy
Version directory names follow standardized naming conventions:
- **Original Enactments:** `<year>-original` (e.g., `1970-original`, `2002-original`)
- **Amendments:** `<year>-amendment-<act_number_or_name>` (e.g., `2005-amendment-act-15`)
- **Re-enactments:** `<year>-re-enacted`
- **Dated Registry Records:** `YYYY-MM-DD` (e.g., `2025-01-28`)
- **Consolidated Working Texts:** `<year>-consolidated-as-of-<YYYY-MM-DD>`

## 3. Active Version Pointer
Each source package maintains a `current.yaml` file pointing to the active authoritative version for semantic retrieval and querying.
