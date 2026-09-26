import json
import sys
from pathlib import Path

WORKSPACE_ROOT = Path(__file__).resolve().parents[1]
BACKEND_DIR = WORKSPACE_ROOT / "backend"
sys.path.insert(0, str(BACKEND_DIR))

from app.services.qdrant_hybrid_store import qdrant_hybrid_store
from qdrant_client import models as qmodels

client = qdrant_hybrid_store.get_client()

points, _ = client.scroll(
    collection_name="ragvyn_hybrid_test_v2",
    scroll_filter=qmodels.Filter(
        must=[
            qmodels.FieldCondition(key="document_id", match=qmodels.MatchValue(value="patents-act-1970")),
            qmodels.FieldCondition(key="parent_section", match=qmodels.MatchValue(value="Section 3")),
        ]
    ),
    limit=50,
    with_payload=True,
)

clauses_to_check = [f"Section 3({ch})" for ch in "abcdefghijklmnop"]

clause_map = {}
duplicates = []

for p in points:
    sec = p.payload.get("section")
    cid = p.payload.get("chunk_id")
    pg = p.payload.get("page_number")
    txt = p.payload.get("text", "")
    
    # Text preview without breadcrumb
    lines = [l.strip() for l in txt.split("\n") if l.strip() and not l.strip().startswith("[")]
    preview = " ".join(lines)[:140]
    
    if sec in clause_map:
        duplicates.append((sec, cid))
    else:
        clause_map[sec] = {
            "chunk_id": cid,
            "page_number": pg,
            "text_preview": preview,
            "full_text": txt,
        }

inventory = []
for c in clauses_to_check:
    if c in clause_map:
        entry = clause_map[c]
        inventory.append({
            "clause": c,
            "status": "PRESENT",
            "chunk_id": entry["chunk_id"],
            "page_number": entry["page_number"],
            "text_preview": entry["text_preview"]
        })
    else:
        inventory.append({
            "clause": c,
            "status": "MISSING FROM CORPUS (OMITTED BY LEGISLATURE)",
            "chunk_id": None,
            "page_number": None,
            "text_preview": None,
            "statutory_note": "Clause (g) omitted by Act 38 of 2002, s. 4 (w.e.f. 20-5-2003) as explicitly recorded on page 10 footnote 1 of patents-act-1970.pdf" if c == "Section 3(g)" else "Unexpectedly missing"
        })

print(json.dumps(inventory, indent=2))
