import os
import sys
from pathlib import Path
import chromadb
from sentence_transformers import SentenceTransformer

# Connect to ChromaDB (bge-m3 directory)
BACKEND_DIR = Path(__file__).resolve().parent.parent.parent / "backend"
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

try:
    from app.core.config import settings
    CHROMA_PATH = Path(settings.CHROMA_DB_DIR)
    EMBEDDING_MODEL_NAME = settings.EMBEDDING_MODEL_NAME
except ImportError:
    CHROMA_PATH = BACKEND_DIR / os.getenv("CHROMA_DB_DIR", "chroma_db_bge_m3")
    EMBEDDING_MODEL_NAME = os.getenv("EMBEDDING_MODEL_NAME", "BAAI/bge-m3")

print(f"Connecting to ChromaDB at: {CHROMA_PATH}")
client = chromadb.PersistentClient(path=str(CHROMA_PATH))
col = client.get_collection("india_statutes")

print(f"Collection count: {col.count()}")

# Peek at one document with embeddings
result = col.get(limit=1, include=["documents", "embeddings", "metadatas"])
print(f"\nSample document: {result['documents'][0][:200]}...")
print(f"\nMetadata: {result['metadatas'][0]}")

emb = result['embeddings'][0] if result['embeddings'] is not None and len(result['embeddings']) > 0 else None
if emb is not None:
    print(f"\nEmbedding dimension: {len(emb)}")
    print(f"First 5 values: {emb[:5]}")
else:
    print("\n⚠️ NO EMBEDDINGS STORED!")

# Now test a query
print("\n" + "="*60)
print(f"Testing query similarity using {EMBEDDING_MODEL_NAME}...")

model = SentenceTransformer(EMBEDDING_MODEL_NAME)
query = "What are patent fees in India?"
query_emb = model.encode([query], normalize_embeddings=True).tolist()

results = col.query(
    query_embeddings=query_emb,
    n_results=3,
    include=["documents", "distances", "metadatas"]
)

print(f"\nQuery: {query}")
print(f"Top 3 results:")
for i, (doc, dist, meta) in enumerate(zip(results['documents'][0], results['distances'][0], results['metadatas'][0])):
    print(f"\n{i+1}. Distance: {dist:.4f} | Source: {meta.get('source', 'N/A')}")
    print(f"   Text: {doc[:150]}...")
