# Contributing to the Knowledge Base

## How to Add a New Source Package

1. **Verify Authenticity:** Obtain the official Gazette publication or sovereign portal PDF.
2. **Determine Jurisdiction & Class:**
   - India: `sources/india/<statutes|rules|treaties|pharmacopoeial-standards|registry-records|case-law>/`
   - International: `sources/international/<treaties|statutes|rules|pharmacopoeial-standards|registry-records|case-law>/`
3. **Create Package Directory:**
   ```
   sources/<jurisdiction>/<class>/<source-slug>/
   ├── source.yaml
   ├── current.yaml
   └── versions/<version-label>/
       ├── metadata.yaml
       ├── checksum.sha256
       ├── citations.yaml
       └── original/<filename>.pdf
   ```
4. **Compute Checksum:**
   ```bash
   sha256sum original/<filename>.pdf > checksum.sha256
   ```
5. **Validate:**
   ```bash
   python knowledge-base/scripts/validate-source-metadata.py
   python knowledge-base/scripts/build-source-catalog.py
   python -m pytest knowledge-base/tests/
   ```
