"""
backend/app/rag/__init__.py
----------------------------
Modular RAG (Retrieval-Augmented Generation) package for IP-SAKTI Sahayak.

Submodules
----------
config          – Typed environment / configuration loading.
models          – Internal RAG data models (DocumentChunk, RetrievedChunk, etc.).
document_loader – PDF text extraction with PyMuPDF.
chunking        – Page-aware overlapping chunk generation.
embeddings      – Shared lazy-singleton BGE embedding loader.
vector_store    – ChromaDB persistence, upsert, collection access, retrieval.
ingestion       – PDF-to-chunks-to-embeddings ingestion workflow.
retrieval       – Query embedding, top-k retrieval, relevance evaluation.
service         – Orchestration boundary between retrieval and Gemini generation.
"""
