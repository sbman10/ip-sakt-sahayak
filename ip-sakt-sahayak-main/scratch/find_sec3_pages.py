import fitz  # PyMuPDF
from pathlib import Path
import re

pdf_path = Path("knowledge-base/sources/india/statutes/patents-act-1970/versions/1970-original/original/patents-act-1970.pdf")
doc = fitz.open(str(pdf_path))

clauses = ["(a)", "(b)", "(c)", "(d)", "(e)", "(f)", "(g)", "(h)", "(i)", "(j)", "(k)", "(l)", "(m)", "(n)", "(o)", "(p)"]

for idx, page in enumerate(doc, start=1):
    txt = page.get_text()
    if "CHAPTER II" in txt or "What are not inventions" in txt or "not inventions" in txt:
        print(f"--- PDF Page {idx} ---")
        for cl in clauses:
            # Look for clause pattern e.g. "(a)", "4[(b)", etc.
            if re.search(r'(?:^|\s|\d\[)' + re.escape(cl) + r'\s', txt):
                print(f"  Clause {cl} found on Page {idx}")
        if "Clause (g)" in txt or "omitted by Act 38 of 2002" in txt:
            print(f"  Footnote on Clause (g) found on Page {idx}")
