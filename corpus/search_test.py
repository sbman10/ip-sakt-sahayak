"""
Local Retrieval Validator for IP-SAKTI Sahayak.
Offline CLI diagnostic tool to query local ChromaDB collections and verify
dense vector retrieval quality and citations.
"""

import sys
from pathlib import Path

import chromadb
from sentence_transformers import SentenceTransformer

# Base directory paths
BASE_DIR = Path(__file__).resolve().parent
CHROMA_DB_PATH = BASE_DIR / "chroma_db"

COLLECTIONS = {
    "1": ("india_statutes", "India Statutes (Patents, Biodiversity, Drugs & Cosmetics Acts)"),
    "2": ("international_treaties", "International Treaties (Nagoya, WIPO, TRIPS)"),
}


def print_banner():
    print("=" * 70)
    print("    IP-SAKTI Sahayak - Local Retrieval Vector Validator")
    print("=" * 70)


def main():
    print_banner()

    if not CHROMA_DB_PATH.exists():
        print(f"\n[ERROR] ChromaDB database not found at '{CHROMA_DB_PATH}'.")
        print("Please run 'corpus/parser.py' followed by 'corpus/ingest.py' first.\n")
        sys.exit(1)

    print(f"Connecting to ChromaDB at: {CHROMA_DB_PATH}")
    client = chromadb.PersistentClient(path=str(CHROMA_DB_PATH))

    print("Loading local SentenceTransformer ('all-MiniLM-L6-v2') on CPU...")
    model = SentenceTransformer("all-MiniLM-L6-v2")
    print("Model initialized successfully.\n")

    while True:
        print("\nSelect Collection to Query:")
        for key, (coll_name, description) in COLLECTIONS.items():
            print(f"  [{key}] {description}")
        print("  [q] Quit")

        choice = input("\nEnter choice (1/2/q): ").strip().lower()
        if choice in ["q", "quit", "exit"]:
            print("Exiting search validator.")
            break

        if choice not in COLLECTIONS:
            print("[WARN] Invalid option selected. Please choose 1 or 2.")
            continue

        selected_coll_name, coll_desc = COLLECTIONS[choice]

        try:
            collection = client.get_collection(name=selected_coll_name)
            count = collection.count()
            if count == 0:
                print(f"\n[WARNING] Collection '{selected_coll_name}' is currently empty (0 items).")
                continue
        except Exception as e:
            print(f"\n[ERROR] Could not access collection '{selected_coll_name}': {e}")
            continue

        print(f"\nActive Collection: [{selected_coll_name}] (Contains {count} chunks)")
        query = input("Enter search query (or 'back' to change collection): ").strip()

        if not query:
            print("[WARN] Search query cannot be empty.")
            continue

        if query.lower() == "back":
            continue

        print(f"\nEncoding query and searching top 3 most relevant passages...")
        query_embedding = model.encode([query]).tolist()

        results = collection.query(
            query_embeddings=query_embedding,
            n_results=min(3, count),
            include=["documents", "metadatas", "distances"],
        )

        docs = results.get("documents", [[]])[0]
        metas = results.get("metadatas", [[]])[0]
        distances = results.get("distances", [[]])[0]

        if not docs:
            print("\n[INFO] No matching results found for this query.")
            continue

        print("\n" + "=" * 70)
        print(f"RETRIEVAL RESULTS FOR: \"{query}\"")
        print("=" * 70)

        for rank, (doc, meta, dist) in enumerate(zip(docs, metas, distances), start=1):
            source_act = meta.get("source", "Unknown Source")
            citation = meta.get("section", "Unspecified Section")

            print(f"\n--- MATCH RANKING #{rank} ---")
            print(f"  Source Act Name   : {source_act}")
            print(f"  Citation / Range  : {citation}")
            print(f"  Cosine Distance   : {dist:.4f}")
            print(f"  Extracted Snippet :")
            print(f"    \"{doc[:350]}...\"" if len(doc) > 350 else f"    \"{doc}\"")
            print("-" * 70)


if __name__ == "__main__":
    main()
