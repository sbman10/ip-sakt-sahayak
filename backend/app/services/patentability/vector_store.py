"""
backend/app/services/patentability/vector_store.py
--------------------------------------------------
Phase 4: Corpus & Dual Vector Engine (Qdrant + ChromaDB).
Implements a unified vector and lexical retrieval interface:
- ChromaDB persistent collections
- Qdrant client with payload indexes for:
  jurisdiction, document_type, authority, publication_date, priority_date, document_id, language
- Identical chunk_id deduplication and mapping
- Sparse BM25 integration for exact botanical names, chemical names, ratios, and patent sections
- Reciprocal Rank Fusion (RRF k=60)
- Cross-Encoder reranking
"""

from __future__ import annotations

import logging
import os
import re
from typing import Any, Dict, List, Optional, Tuple

import chromadb
from qdrant_client import QdrantClient
from qdrant_client.http import models as qmodels

from app.core.config import settings
from app.core.models import model_registry
from app.schemas.patentability import DateCategory, PriorArtMetadata
from app.services.bm25_service import get_bm25_index

log = logging.getLogger("app.services.patentability.vector_store")

QDRANT_COLLECTION_NAME = "patentability_corpus"
EMBEDDING_DIM = 384  # all-MiniLM-L6-v2 default dim (or 1024 for bge-m3)


class UnifiedVectorStore:
    """
    Dual vector store managing ChromaDB and Qdrant with synchronized chunk IDs,
    payload metadata indexing, BM25 sparse search, and Reciprocal Rank Fusion.
    """

    def __init__(self, use_in_memory_qdrant: bool = True):
        # 1. Initialize Qdrant Client (in-memory or persistent)
        try:
            if use_in_memory_qdrant:
                self.qdrant = QdrantClient(":memory:")
            else:
                qdrant_path = os.path.join(settings.CHROMA_DB_DIR, "qdrant_data")
                os.makedirs(qdrant_path, exist_ok=True)
                self.qdrant = QdrantClient(path=qdrant_path)
            self._init_qdrant_collection()
        except Exception as e:
            log.warning("Qdrant initialization fallback to in-memory: %s", e)
            self.qdrant = QdrantClient(":memory:")
            self._init_qdrant_collection()

        # 2. ChromaDB Client
        self.chroma_path = settings.CHROMA_DB_DIR
        os.makedirs(self.chroma_path, exist_ok=True)
        self.chroma = chromadb.PersistentClient(path=self.chroma_path)

        # Pre-seed essential statutory documents (Patents Act Section 3(p), 3(d), 3(e), BD Act Sec 6, TKDL)
        self._seed_authoritative_statutes()

    def _init_qdrant_collection(self):
        """Creates Qdrant collection with payload indexes."""
        collections = [c.name for c in self.qdrant.get_collections().collections]
        if QDRANT_COLLECTION_NAME not in collections:
            self.qdrant.create_collection(
                collection_name=QDRANT_COLLECTION_NAME,
                vectors_config=qmodels.VectorParams(
                    size=EMBEDDING_DIM,
                    distance=qmodels.Distance.COSINE,
                ),
            )
            # Create payload indexes per Phase 4 requirements
            index_fields = [
                "jurisdiction",
                "document_type",
                "authority",
                "publication_date",
                "priority_date",
                "document_id",
                "language",
            ]
            for field in index_fields:
                try:
                    self.qdrant.create_payload_index(
                        collection_name=QDRANT_COLLECTION_NAME,
                        field_name=field,
                        field_schema=qmodels.PayloadSchemaType.KEYWORD,
                    )
                except Exception as ex:
                    log.debug("Payload index creation note for %s: %s", field, ex)

    def _get_embedding(self, text: str) -> List[float]:
        model = model_registry.get_embedding_model()
        emb = model.encode([text], show_progress_bar=False, normalize_embeddings=True)
        return emb[0].tolist()

    def _seed_authoritative_statutes(self):
        """Seed foundational Indian Patents Act 1970 sections and TKDL prior-art anchors."""
        seeds = [
            {
                "chunk_id": "IN-PAT-1970-SEC-03P",
                "document_id": "DOC-IN-PAT-1970",
                "title": "The Patents Act, 1970 — Section 3(p) Traditional Knowledge Bar",
                "document_type": "statute",
                "publication_date": "1970-09-19",
                "authority": "Indian Patent Office",
                "jurisdiction": "India",
                "section": "Section 3(p)",
                "page": "14",
                "text": "Section 3(p): What are not inventions. An invention which in effect, is traditional knowledge or which is an aggregation or duplication of known properties of traditionally known component or components is not patentable.",
            },
            {
                "chunk_id": "IN-PAT-1970-SEC-03E",
                "document_id": "DOC-IN-PAT-1970",
                "title": "The Patents Act, 1970 — Section 3(e) Mere Admixture",
                "document_type": "statute",
                "publication_date": "1970-09-19",
                "authority": "Indian Patent Office",
                "jurisdiction": "India",
                "section": "Section 3(e)",
                "page": "12",
                "text": "Section 3(e): A substance obtained by a mere admixture resulting only in the aggregation of the properties of the components thereof or a process for producing such substance is not an invention.",
            },
            {
                "chunk_id": "IN-PAT-1970-SEC-03D",
                "document_id": "DOC-IN-PAT-1970",
                "title": "The Patents Act, 1970 — Section 3(d) Known Substance and Enhanced Efficacy",
                "document_type": "statute",
                "publication_date": "1970-09-19",
                "authority": "Indian Patent Office",
                "jurisdiction": "India",
                "section": "Section 3(d)",
                "page": "11",
                "text": "Section 3(d): The mere discovery of a new form of a known substance which does not result in the enhancement of the known efficacy of that substance or the mere discovery of any new property or new use for a known substance is not patentable.",
            },
            {
                "chunk_id": "IN-BDA-2002-SEC-06",
                "document_id": "DOC-IN-BDA-2002",
                "title": "The Biological Diversity Act, 2002 — Section 6 Mandatory NBA Approval",
                "document_type": "statute",
                "publication_date": "2002-12-11",
                "authority": "National Biodiversity Authority",
                "jurisdiction": "India",
                "section": "Section 6",
                "page": "8",
                "text": "Section 6(1): Application for intellectual property rights based on biological resources or associated knowledge obtained from India requires prior approval of the National Biodiversity Authority (NBA) before grant of patent (Form III).",
            },
            {
                "chunk_id": "TKDL-REF-ASHWA-001",
                "document_id": "DOC-TKDL-ASHWA",
                "title": "TKDL Classical Citation — Withania somnifera (Ashwagandha) Preparations",
                "document_type": "traditional_knowledge",
                "publication_date": "1980-01-01",
                "authority": "CSIR / Ministry of AYUSH",
                "jurisdiction": "India",
                "section": "Charaka Samhita / Bhavaprakasha",
                "page": "128",
                "text": "Withania somnifera (Ashwagandha) root powder, decoction (Kwatha), and clarified butter preparations (Ghrita) are classically documented for rasayana (rejuvenation), balya (strength), and vata-vyadhi disorders. Individual use of root extract for stress and debility is in the public domain.",
            },
            {
                "chunk_id": "TKDL-REF-CURC-002",
                "document_id": "DOC-TKDL-CURC",
                "title": "TKDL Classical Citation — Curcuma longa (Haridra / Turmeric) Wound Healing",
                "document_type": "traditional_knowledge",
                "publication_date": "1980-01-01",
                "authority": "CSIR / Ministry of AYUSH",
                "jurisdiction": "India",
                "section": "Sushruta Samhita",
                "page": "74",
                "text": "Curcuma longa (Haridra) rhizome paste and decoction are classically documented for vrana-ropana (wound healing), kushta (dermatological conditions), and inflammation. Use of turmeric extract as a wound healer or topical agent is documented prior art.",
            },
            {
                "chunk_id": "PAT-IN-2018-09912",
                "document_id": "DOC-IN-PAT-2018-09912",
                "title": "Patent Publication IN 2018/09912 — Sustained Release Herbal Matrix",
                "document_type": "patent",
                "publication_date": "2018-05-14",
                "priority_date": "2016-11-10",
                "authority": "Indian Patent Office",
                "jurisdiction": "India",
                "section": "Claims 1-5",
                "page": "4",
                "text": "Discloses a sustained release matrix formulation comprising herbal extracts blended with microcrystalline cellulose (MCC) and sodium alginate exhibiting release over 6 to 8 hours for oral delivery.",
            },
            {
                "chunk_id": "LATER-PUB-2025-014",
                "document_id": "DOC-LATER-PUB-2025",
                "title": "Recent Advances in Ashwagandha Nano-Emulsions (2025)",
                "document_type": "scientific_article",
                "publication_date": "2025-02-15",
                "priority_date": "2025-02-15",
                "authority": "Journal of Herbal Medicine",
                "jurisdiction": "International",
                "section": "Results & Discussion",
                "page": "112",
                "text": "Recent 2025 study examining lipid nano-emulsion delivery of Withanolides demonstrating enhanced cellular uptake in murine models. Published after early 2024 priority baselines.",
            },
        ]

        for s in seeds:
            self.index_chunk(
                chunk_id=s["chunk_id"],
                document_id=s["document_id"],
                title=s["title"],
                document_type=s["document_type"],
                publication_date=s["publication_date"],
                priority_date=s.get("priority_date"),
                authority=s["authority"],
                jurisdiction=s["jurisdiction"],
                section=s["section"],
                page=s["page"],
                text=s["text"],
            )

    def index_chunk(
        self,
        chunk_id: str,
        document_id: str,
        title: str,
        document_type: str,
        text: str,
        authority: str = "Indian Patent Office",
        jurisdiction: str = "India",
        publication_date: Optional[str] = None,
        priority_date: Optional[str] = None,
        filing_date: Optional[str] = None,
        source_url: Optional[str] = None,
        page: Optional[Union[int, str]] = None,
        section: Optional[str] = None,
        language: str = "en",
        source_access_type: str = "public_statute",
    ) -> None:
        """Indexes a chunk synchronously in both Qdrant and ChromaDB with identical chunk_id."""
        emb = self._get_embedding(text)

        # 1. Upsert into Qdrant
        payload = {
            "chunk_id": chunk_id,
            "document_id": document_id,
            "title": title,
            "document_type": document_type,
            "authority": authority,
            "jurisdiction": jurisdiction,
            "publication_date": publication_date or "",
            "priority_date": priority_date or "",
            "filing_date": filing_date or "",
            "section": section or "",
            "page": str(page or ""),
            "language": language,
            "text": text,
            "source_url": source_url or "",
            "source_access_type": source_access_type,
        }

        # Convert chunk_id to positive int hash for Qdrant integer point IDs
        point_id = abs(hash(chunk_id)) % (2**63 - 1)
        self.qdrant.upsert(
            collection_name=QDRANT_COLLECTION_NAME,
            points=[
                qmodels.PointStruct(
                    id=point_id,
                    vector=emb,
                    payload=payload,
                )
            ],
        )

        # 2. Upsert into ChromaDB
        coll_name = "india_statutes" if "india" in jurisdiction.lower() else "international_treaties"
        try:
            coll = self.chroma.get_or_create_collection(
                name=coll_name,
                metadata={"hnsw:space": "cosine"},
            )
            coll.upsert(
                ids=[chunk_id],
                documents=[text],
                embeddings=[emb],
                metadatas=[{
                    "chunk_id": chunk_id,
                    "document_id": document_id,
                    "title": title,
                    "document_type": document_type,
                    "authority": authority,
                    "jurisdiction": jurisdiction,
                    "publication_date": publication_date or "",
                    "priority_date": priority_date or "",
                    "section": section or "",
                    "page": str(page or ""),
                }],
            )
        except Exception as e:
            log.warning("Chroma upsert error for %s: %s", chunk_id, e)

    def search_qdrant(
        self,
        query: str,
        jurisdiction: Optional[str] = None,
        document_type: Optional[str] = None,
        top_k: int = 10,
    ) -> List[Dict[str, Any]]:
        """Dense vector search in Qdrant with payload filtering."""
        emb = self._get_embedding(query)
        must_filters = []
        if jurisdiction and jurisdiction.lower() != "both":
            must_filters.append(
                qmodels.FieldCondition(
                    key="jurisdiction",
                    match=qmodels.MatchValue(value=jurisdiction),
                )
            )
        if document_type:
            must_filters.append(
                qmodels.FieldCondition(
                    key="document_type",
                    match=qmodels.MatchValue(value=document_type),
                )
            )

            q_filter = qmodels.Filter(must=must_filters) if must_filters else None
        else:
            q_filter = qmodels.Filter(must=must_filters) if must_filters else None

        results = self.qdrant.query_points(
            collection_name=QDRANT_COLLECTION_NAME,
            query=emb,
            query_filter=q_filter,
            limit=top_k,
        ).points

        out = []
        for p in results:
            payload = p.payload or {}
            out.append({
                "chunk_id": payload.get("chunk_id", str(p.id)),
                "document_id": payload.get("document_id", ""),
                "title": payload.get("title", "Prior Art Document"),
                "document_type": payload.get("document_type", "patent"),
                "authority": payload.get("authority", "Patent Authority"),
                "jurisdiction": payload.get("jurisdiction", "India"),
                "publication_date": payload.get("publication_date") or None,
                "priority_date": payload.get("priority_date") or None,
                "section": payload.get("section", ""),
                "page": payload.get("page", ""),
                "text": payload.get("text", ""),
                "score": float(p.score),
                "distance": max(0.0, 1.0 - float(p.score)),
            })
        return out

    def search_chroma(
        self,
        query: str,
        jurisdiction: str = "India",
        top_k: int = 10,
    ) -> List[Dict[str, Any]]:
        """Dense vector search in ChromaDB."""
        emb = self._get_embedding(query)
        colls_to_search = []
        jur_clean = (jurisdiction or "India").lower()
        if jur_clean == "both":
            colls_to_search = ["india_statutes", "international_treaties"]
        elif "international" in jur_clean:
            colls_to_search = ["international_treaties"]
        else:
            colls_to_search = ["india_statutes"]

        candidates: List[Dict[str, Any]] = []
        for cname in colls_to_search:
            try:
                coll = self.chroma.get_collection(cname)
                res = coll.query(
                    query_embeddings=[emb],
                    n_results=top_k,
                    include=["documents", "metadatas", "distances"],
                )
                if res and res["ids"] and len(res["ids"][0]) > 0:
                    for i in range(len(res["ids"][0])):
                        cid = res["ids"][0][i]
                        doc = res["documents"][0][i]
                        meta = res["metadatas"][0][i] if res["metadatas"] else {}
                        dist = res["distances"][0][i] if res["distances"] else 0.5
                        candidates.append({
                            "chunk_id": cid,
                            "document_id": meta.get("document_id", cid),
                            "title": meta.get("title", meta.get("source", "Legal Source")),
                            "document_type": meta.get("document_type", "statute"),
                            "authority": meta.get("authority", "Indian Patent Office"),
                            "jurisdiction": meta.get("jurisdiction", "India"),
                            "publication_date": meta.get("publication_date") or None,
                            "priority_date": meta.get("priority_date") or None,
                            "section": meta.get("section", ""),
                            "page": str(meta.get("page_number", meta.get("page", ""))),
                            "text": doc,
                            "score": max(0.0, 1.0 - float(dist)),
                            "distance": float(dist),
                        })
            except Exception as e:
                log.debug("Chroma query notice for collection %s: %s", cname, e)

        candidates.sort(key=lambda x: x["distance"])
        return candidates[:top_k]

    def search_bm25(
        self,
        query: str,
        top_k: int = 10,
    ) -> List[Dict[str, Any]]:
        """Sparse lexical matching using PersistedBM25Index."""
        bm25_idx = get_bm25_index()
        if not bm25_idx or not getattr(bm25_idx, "is_loaded", False):
            return []

        scored_docs = bm25_idx.search(query, top_k=top_k)
        out = []
        for doc, score in scored_docs:
            cid = doc.get("chunk_id") or doc.get("source", "BM25-DOC")
            out.append({
                "chunk_id": cid,
                "document_id": doc.get("document_id", cid),
                "title": doc.get("title", doc.get("source", "Statute")),
                "document_type": doc.get("document_type", "statute"),
                "authority": doc.get("authority", "Indian Patent Office"),
                "jurisdiction": doc.get("jurisdiction", "India"),
                "publication_date": doc.get("publication_date") or None,
                "priority_date": doc.get("priority_date") or None,
                "section": doc.get("section", ""),
                "page": str(doc.get("page_number", doc.get("page", ""))),
                "text": doc.get("text", ""),
                "bm25_score": float(score),
            })
        return out

    def hybrid_rrf_search(
        self,
        query: str,
        jurisdiction: str = "India",
        document_type: Optional[str] = None,
        top_k: int = 8,
        rrf_k: int = 60,
    ) -> List[Dict[str, Any]]:
        """
        Combines Qdrant dense vector search with sparse BM25 search via Reciprocal Rank Fusion (RRF).
        """
        # 1. Fetch dense candidates from Qdrant
        vector_candidates = self.search_qdrant(
            query=query,
            jurisdiction=jurisdiction,
            document_type=document_type,
            top_k=top_k * 2,
        )

        # 2. Fetch sparse lexical candidates from BM25
        sparse_candidates = self.search_bm25(query=query, top_k=top_k * 2)

        # 3. Reciprocal Rank Fusion
        rrf_scores: Dict[str, float] = {}
        doc_store: Dict[str, Dict[str, Any]] = {}

        for rank, c in enumerate(vector_candidates, start=1):
            cid = c["chunk_id"]
            rrf_scores[cid] = rrf_scores.get(cid, 0.0) + (1.0 / (rrf_k + rank))
            doc_store[cid] = c

        for rank, c in enumerate(sparse_candidates, start=1):
            cid = c["chunk_id"]
            rrf_scores[cid] = rrf_scores.get(cid, 0.0) + (1.0 / (rrf_k + rank))
            if cid not in doc_store:
                doc_store[cid] = c

        # Sort by fused score
        sorted_cids = sorted(rrf_scores.keys(), key=lambda k: rrf_scores[k], reverse=True)

        fused: List[Dict[str, Any]] = []
        for cid in sorted_cids[:top_k]:
            item = dict(doc_store[cid])
            item["rrf_score"] = rrf_scores[cid]
            fused.append(item)

        return fused

    def rerank_candidates(
        self,
        query: str,
        candidates: List[Dict[str, Any]],
        final_k: int = 4,
    ) -> List[Dict[str, Any]]:
        """Applies Cross-Encoder reranking to candidates."""
        if not candidates:
            return []

        reranker = model_registry.get_reranker_model()
        pairs = [(query, c.get("text", "")) for c in candidates]
        try:
            scores = reranker.predict(pairs)
            for c, s in zip(candidates, scores):
                c["reranker_score"] = float(s)
            candidates.sort(key=lambda x: x.get("reranker_score", 0.0), reverse=True)
        except Exception as e:
            log.warning("Reranker failed, keeping RRF order: %s", e)

        return candidates[:final_k]


unified_vector_store = UnifiedVectorStore()
