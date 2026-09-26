# Verification Workflow

## 1. Verification Criteria
A source is promoted from `pending-review` to `verified` only when the following 4 criteria are fulfilled:
1. **Official Origin:** Downloaded directly from an official sovereign portal (egazette.gov.in, ipindia.gov.in, nbaindia.org, wipo.int, wto.org).
2. **Gazette / Treaty Reference:** Specific Gazette notification number, Act number, or UN Treaty Series volume recorded.
3. **Cryptographic Integrity:** SHA-256 hash verified and checked against the source repository.
4. **Human Verification Record:** `verification_record` block in `source.yaml` completed with verifier identity, date, and evidentiary notes.

## 2. Status Transitions
- `pending-review` -> `verified` (Passed all criteria)
- `pending-review` -> `quarantined` (Missing crucial provenance or incomplete data)
- `pending-review` -> `rejected` (Unauthentic, forged, or corrupt document)
