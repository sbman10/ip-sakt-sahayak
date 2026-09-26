"""
backend/tests/test_qdrant_sparse_compatibility.py
---------------------------------------------------
Phase 0 Compatibility Verification: FastEmbed Qdrant/bm25 Sparse Encoder.
Verifies:
1. Document encoding via SparseTextEmbedding("Qdrant/bm25").
2. Query encoding via SparseTextEmbedding("Qdrant/bm25").
3. Production of valid qdrant_client.models.SparseVector with integer indices and float values.
4. Deterministic output for identical inputs.
5. Exact preservation of legal terms (Section 3(p), TKDL, Patent numbers).
6. Multilingual support (English and Hindi queries).
7. Zero custom hashing (pure native Qdrant BM25 sparse model).
"""

import sys
from pathlib import Path
import numpy as np
import pytest

# Ensure backend root is in sys.path
BACKEND_ROOT = Path(__file__).resolve().parent.parent
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

from fastembed import SparseTextEmbedding
from qdrant_client import models


@pytest.fixture(scope="module")
def sparse_bm25_model():
    """Initializes the verified Qdrant BM25 sparse model singleton."""
    return SparseTextEmbedding(model_name="Qdrant/bm25")


def test_01_encode_document_and_query_produces_sparse_vector(sparse_bm25_model):
    """Verify document and query encoding into valid models.SparseVector."""
    doc_text = (
        "Section 3(p) of the Patents Act, 1970 excludes inventions relating to "
        "Traditional Knowledge (TKDL). Patent No. 138350."
    )
    query_text = "What are the rules regarding Section 3(p) and TKDL for Patent No. 138350?"

    # 1. Encode document using passage_embed / embed
    doc_embeddings = list(sparse_bm25_model.passage_embed([doc_text]))
    assert len(doc_embeddings) == 1, "Expected 1 document sparse embedding"
    doc_emb = doc_embeddings[0]

    # Convert to qdrant_client.models.SparseVector
    doc_sparse_vector = models.SparseVector(
        indices=doc_emb.indices.tolist(),
        values=doc_emb.values.tolist(),
    )
    assert len(doc_sparse_vector.indices) > 0, "Sparse vector indices must not be empty"
    assert len(doc_sparse_vector.indices) == len(doc_sparse_vector.values), "Indices and values count must match"
    assert all(isinstance(idx, (int, np.integer)) for idx in doc_sparse_vector.indices)
    assert all(isinstance(val, (float, np.floating)) for val in doc_sparse_vector.values)
    assert all(val > 0.0 for val in doc_sparse_vector.values), "All BM25 weights must be positive"

    # 2. Encode query using query_embed
    query_embeddings = list(sparse_bm25_model.query_embed([query_text]))
    assert len(query_embeddings) == 1, "Expected 1 query sparse embedding"
    query_emb = query_embeddings[0]

    query_sparse_vector = models.SparseVector(
        indices=query_emb.indices.tolist(),
        values=query_emb.values.tolist(),
    )
    assert len(query_sparse_vector.indices) > 0
    assert len(query_sparse_vector.indices) == len(query_sparse_vector.values)


def test_02_deterministic_sparse_encoding(sparse_bm25_model):
    """Verify deterministic output for identical input text."""
    text = "Section 3(p) patent eligibility under Indian Biological Diversity Act 2002."

    run1 = list(sparse_bm25_model.embed([text]))[0]
    run2 = list(sparse_bm25_model.embed([text]))[0]

    assert np.array_equal(run1.indices, run2.indices), "Sparse indices must be strictly deterministic"
    assert np.allclose(run1.values, run2.values, atol=1e-6), "Sparse values must be strictly deterministic"


def test_03_exact_legal_terms_preserved(sparse_bm25_model):
    """Verify preservation and token matching of Section 3(p), TKDL, and Patent numbers."""
    doc_text = "Section 3(p) excludes Traditional Knowledge (TKDL) and Patent No 138350."
    query_text = "Can I patent Section 3(p) traditional knowledge with TKDL reference 138350?"

    doc_emb = list(sparse_bm25_model.embed([doc_text]))[0]
    query_emb = list(sparse_bm25_model.embed([query_text]))[0]

    doc_indices = set(doc_emb.indices.tolist())
    query_indices = set(query_emb.indices.tolist())

    # Shared vocabulary terms must overlap exactly between query and document
    common_indices = doc_indices.intersection(query_indices)
    assert len(common_indices) >= 3, (
        f"Expected at least 3 exact term overlaps between doc and query, got {len(common_indices)}"
    )

    # Isolated legal term verification
    e_3p = list(sparse_bm25_model.embed(["3(p)"]))[0]
    e_tkdl = list(sparse_bm25_model.embed(["TKDL"]))[0]
    e_patent_no = list(sparse_bm25_model.embed(["138350"]))[0]

    assert len(e_3p.indices) > 0, "3(p) must produce valid token index"
    assert len(e_tkdl.indices) > 0, "TKDL must produce valid token index"
    assert len(e_patent_no.indices) > 0, "138350 must produce valid token index"

    # Confirm the isolated indices exist in the document encoding
    assert set(e_3p.indices.tolist()).issubset(doc_indices), "Document must contain 3(p) index"
    assert set(e_tkdl.indices.tolist()).issubset(doc_indices), "Document must contain TKDL index"
    assert set(e_patent_no.indices.tolist()).issubset(doc_indices), "Document must contain 138350 index"


def test_04_multilingual_english_and_hindi_queries(sparse_bm25_model):
    """Verify English and multilingual (Hindi) queries produce valid sparse vectors."""
    query_en = "Section 3(p) Traditional Knowledge Digital Library Ayurvedic formulation"
    query_hi = "पारंपरिक ज्ञान डिजिटल लाइब्रेरी और पेटेंट अधिनियम धारा 3(p)"

    en_emb = list(sparse_bm25_model.query_embed([query_en]))[0]
    hi_emb = list(sparse_bm25_model.query_embed([query_hi]))[0]

    en_vec = models.SparseVector(indices=en_emb.indices.tolist(), values=en_emb.values.tolist())
    hi_vec = models.SparseVector(indices=hi_emb.indices.tolist(), values=hi_emb.values.tolist())

    assert len(en_vec.indices) > 0, "English query must produce sparse indices"
    assert len(hi_vec.indices) > 0, "Hindi query must produce sparse indices"

    # Cross-lingual exact term: '3(p)' appears in both queries and must share its index
    e_3p = list(sparse_bm25_model.embed(["3(p)"]))[0]
    idx_3p = set(e_3p.indices.tolist())
    assert idx_3p.intersection(set(en_vec.indices)), "English query must include 3(p) index"
    assert idx_3p.intersection(set(hi_vec.indices)), "Hindi query must include 3(p) index"


def test_05_no_custom_hashing_verified(sparse_bm25_model):
    """Verify encoder is the native Qdrant/bm25 model, not custom ad-hoc hash."""
    assert sparse_bm25_model.model_name == "Qdrant/bm25"
    assert hasattr(sparse_bm25_model, "embed")
    assert hasattr(sparse_bm25_model, "query_embed")
    assert hasattr(sparse_bm25_model, "passage_embed")
