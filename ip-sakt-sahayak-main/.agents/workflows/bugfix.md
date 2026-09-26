---
description: How to fix a bug in IP-SAKTI Sahayak
---

Follow this workflow to locate, debug, and resolve code errors:

1. **Bug Identification:**
   - Ask the developer for the exact error messages or screenshot logs.
   - Locate the target source lines.

2. **Isolated Verification:**
   - Trace variables or execution paths. Do not rewrite surrounding features.

3. **Coordinate Edits:**
   - Keep bug fixes narrow. Follow the comment styling protocol (`# UPDATED: [Why this fix resolved the issue]`).

4. **Compile Test:**
   - Execute builds locally. Make sure the package code is clean.

5. **Log Fixes:**
   - Update `docs/CHANGELOG.md` under the appropriate fixed status.
