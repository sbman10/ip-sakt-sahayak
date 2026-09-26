---
description: Code review helper workflow
---

Run this workflow to double-check code quality before making changes or proposing integrations:

1. **Verify Commits Checklist:**
   - Scan modified code for hardcoded API keys.
   - Verify no fake citations or simulated legal databases are referenced.

2. **Verify Commenting Standards:**
   - Check if changes are marked with `# ADDED:` or `# UPDATED:` comments.
   - Ensure functions have clear 1-line explanations.

3. **Check Code Length:**
   - Verify that files do not exceed 200 lines. Flag files that exceed this limit for refactoring.
