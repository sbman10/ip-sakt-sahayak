---
description: How to develop a feature for IP-SAKTI Sahayak
---

A feature workflow goes through these stages:

1. **Verify State:**
   - Read the latest state in `docs/Memory.md`.
   - Confirm active files in the workspace.

2. **Compose Plan:**
   - Write out an implementation plan.
   - Detail the changes needed.
   - List potential issues.

3. **Get Team Authorization:**
   - Confirm with developers before editing major logic block setups.

4. **Implement:**
   - Apply edits incrementally.
   - Always add the `# ADDED:` or `# UPDATED:` comments explaining the updates.

5. **Local Validation:**
   - Test compile results. Run `npm run build` locally inside `ip-sakti/`.

6. **Documentation Update:**
   - Update `docs/Memory.md` to reflect the new feature state.
   - Log the release updates inside `docs/CHANGELOG.md`.
