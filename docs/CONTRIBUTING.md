# CONTRIBUTING.md — Git Rules & Teammate Workflow
# IP-SAKTI Sahayak | SIH 2026

Welcome to the team contribution guide. We are a 6-student group working on IP-SAKTI Sahayak. 
To avoid code conflicts and ensure that everyone learns the details, we must strictly follow this guide.

---

## 1. Branch Strategy

Never commit directly to the `main` branch. All developments must be done in separate feature branches.

### Naming Conventions:
- **`feature/[name]`**: For additions or components (e.g., `feature/formulation-classifier`).
- **`bugfix/[name]`**: Fixing bugs or visual errors (e.g., `bugfix/citation-formatting`).
- **`research/[name]`**: For notebooks or experimental scrapers (e.g., `research/pubmed-scraper`).
- **`docs/[name]`**: For documentation tasks (e.g., `docs/contributing-guidelines`).

---

## 2. Commit Message Guidelines

Keep commit messages simple and prefix them using these tags:
- `feat`: new feature or logic block.
- `fix`: bug resolution.
- `style`: visual elements (CSS alignment, spacing).
- `docs`: documentation file changes.
- `refactor`: cleaning up code without changing what it does.
- `corpus`: updates to raw or processed dataset files.

*Example command:*
```bash
git commit -m "feat: add classification router to FastAPI"
```

---

## 3. Pull Request (PR) Requirements

Before merging any code into the `main` branch, we must:

1. **Verify Builds:** Run the workspace build commands locally to make sure validation succeeds.
   - For React code: Run `npm run build` inside `ip-sakti/`.
   - For Python: Run raw linters if any are configured.
2. **AI Action Log:** If you used an AI agent to help generate code, you must call it out in the PR, summarizing what elements the AI wrote and what adjustments you made after review.
3. **Change Comments:** Confirm that all changes follow the commenting protocol set in `docs/Rules.md` (e.g., `# ADDED:`, `# UPDATED:`).
4. **Code Ownership:** Tag at least one human teammate to look through and approve the pull request.
