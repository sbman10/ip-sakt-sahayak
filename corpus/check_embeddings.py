"""Quick diagnostic to check ChromaDB embeddings."""
import chromadb
from sentence_transformers import SentenceTransformer

# Connect to ChromaDB
client = chromadb.PersistentClient(path="chroma_db")
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
print("Testing query similarity...")

model = SentenceTransformer("all-MiniLM-L6-v2", local_files_only=True)
query = "What are patent fees in India?"
query_emb = model.encode(query).tolist()

results = col.query(
    query_embeddings=[query_emb],
    n_results=3,
    include=["documents", "distances", "metadatas"]
)

print(f"\nQuery: {query}")
print(f"Top 3 results:")
for i, (doc, dist, meta) in enumerate(zip(results['documents'][0], results['distances'][0], results['metadatas'][0])):
    print(f"\n{i+1}. Distance: {dist:.4f} | Source: {meta.get('source', 'N/A')}")
    print(f"   Text: {doc[:150]}...")
