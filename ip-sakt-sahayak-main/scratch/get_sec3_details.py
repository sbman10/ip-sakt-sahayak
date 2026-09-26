import sys
from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parent.parent
BACKEND_DIR = ROOT_DIR / "backend"
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from app.services.qdrant_hybrid_store import qdrant_hybrid_store

client = qdrant_hybrid_store.get_client()
filt = qdrant_hybrid_store.build_filter(document_id='patents-act-1970')
res = client.scroll(
    collection_name='ragvyn_hybrid_test_v2',
    scroll_filter=filt,
    limit=250,
    with_payload=True
)[0]

sec3_points = [p.payload for p in res if p.payload.get('parent_section') == '3' or p.payload.get('section', '').startswith('Section 3(')]
sec3_points.sort(key=lambda x: x.get('section', ''))

for p in sec3_points:
    sec = p.get('section')
    cid = p.get('chunk_id')
    pg = p.get('page')
    txt = p.get('text', '').replace('\n', ' ')
    print(f"SECTION: {sec}")
    print(f"  CHUNK_ID: {cid}")
    print(f"  PAGE: {pg}")
    print(f"  PREVIEW: {txt[:120]}...")
