# IP-SAKTI Sahayak — Source Register

## Purpose

This register is the audit list for every document that may enter the project’s knowledge corpus. The assistant must retrieve from approved, traceable sources—not from unverified web pages or model memory.

Do not add a source to the corpus until the **verification status** is `verified` and a teammate has checked a sample of its text against the original document.

## Register

| ID | Title | Authority / publisher | Official URL | Jurisdiction | Document type | Publication/version date | Accessed on | SHA-256 checksum | Verification status | Owner | Notes |
|---|---|---|---|---|---|---|---|---|---|---|---|
| SRC-001 | _To be researched_ |  |  | India / International | Act / rule / treaty / guidance / registry |  |  |  | pending |  |  |

## Required checks for each source

- [ ] The URL belongs to the issuing authority or an approved official repository.
- [ ] The title, authority, document type and jurisdiction are recorded.
- [ ] Publication date, version/revision date and access date are recorded.
- [ ] The downloaded file is stored outside Git history if licensing or size requires it; record its checksum here.
- [ ] A teammate opened the original and checked representative page/section text.
- [ ] Page numbers, section numbers or stable anchors can be preserved for citations.
- [ ] The source is assigned to the correct India or International collection.
- [ ] Any licence, usage restriction or update schedule is recorded in Notes.

## Status meanings

- `pending` — identified but not checked.
- `verified` — provenance and sample text checked by a human.
- `needs-update` — an authoritative revision may exist; pause ingestion until reviewed.
- `rejected` — provenance, quality or scope is unsuitable.

## Update process

1. Add a row before downloading or parsing a new source.
2. Verify the source and update its status.
3. Record the raw-file path and checksum in the ingestion metadata.
4. Re-check changed versions before replacing an older source.
5. Update `CHANGELOG.md` and `AI_ACTIVITY_LOG.md` when the corpus changes.

## Safety boundary

This register records source provenance; it does not itself establish legal advice or interpret the law. If a source is unclear, outdated or unavailable, keep it out of the retrieval corpus and escalate it for human review.
