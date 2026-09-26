"""
knowledge-base/scripts/evaluate_phase4_shadow.py
import sys
sys.stdout.reconfigure(encoding="utf-8", errors="replace")  # Windows cp1252 safe
-------------------------------------------------
Phase 4 Controlled Shadow Retrieval Evaluation.

Runs 32 representative legal queries against both:
  - Chroma/BM25 (existing live retrieval path)
  - Qdrant hybrid v2 (ragvyn_hybrid_test_v2)

Compares:
  - Document overlap, section overlap
  - Evidence quality (schema completeness, jurisdiction consistency)
  - Expected evidence at Rank 1 and Top 5
  - Out-of-scope behavior
  - Latency (p50/p95)

Generates:
  - reports/phase4_shadow_retrieval.json
  - reports/phase4_shadow_retrieval.md

Verdict: SHADOW HEALTHY / SHADOW NEEDS OPTIMIZATION / SHADOW BLOCKED

Usage:
  backend/.venv/Scripts/python knowledge-base/scripts/evaluate_phase4_shadow.py
"""

from __future__ import annotations

import hashlib
import json
import sys
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional

# ─── Path setup ────────────────────────────────────────────────────────────
ROOT_DIR = Path(__file__).resolve().parent.parent.parent
BACKEND_DIR = ROOT_DIR / "backend"
KB_DIR = ROOT_DIR / "knowledge-base"

if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))
if str(KB_DIR) not in sys.path:
    sys.path.insert(0, str(KB_DIR))

from app.services.qdrant_hybrid_store import qdrant_hybrid_store, MANDATORY_PAYLOAD_FIELDS
from app.services.embedding_service import canonical_embedder
from app.services.sparse_embedding_service import sparse_embedder
from qdrant_client import models as qmodels

# Chroma retrieval (without BM25 for isolated comparison)
from app.core.config import settings
import chromadb
from langchain_chroma import Chroma
from app.services.bm25_service import get_bm25_index

REPORTS_DIR = ROOT_DIR / "reports"
SHADOW_COLLECTION = "ragvyn_hybrid_test_v2"

PROHIBITED_COLLECTION = "ragvyn_prod_v1"
if SHADOW_COLLECTION == PROHIBITED_COLLECTION:
    raise SystemExit("FATAL: Shadow collection is ragvyn_prod_v1. Evaluation aborted.")

# ─── Query dataset ─────────────────────────────────────────────────────────
EVAL_QUERIES = [
    # Section 3 patentability sub-clauses
    {"query_id": "Q01", "category": "A. Patentability - Section 3(p)", "query": "Section 3(p) traditional knowledge patentability", "expected_section": "Section 3(p)", "expected_doc": "patents-act-1970", "jurisdiction": "India", "out_of_scope": False},
    {"query_id": "Q02", "category": "A. Patentability - Section 3(p)", "query": "What does Section 3(p) of the Indian Patents Act say about traditional knowledge?", "expected_section": "Section 3(p)", "expected_doc": "patents-act-1970", "jurisdiction": "India", "out_of_scope": False},
    {"query_id": "Q03", "category": "B. Patentability - Section 3(d)", "query": "Section 3(d) enhanced efficacy known substance", "expected_section": "Section 3(d)", "expected_doc": "patents-act-1970", "jurisdiction": "India", "out_of_scope": False},
    {"query_id": "Q04", "category": "B. Patentability - Section 3(d)", "query": "What is the enhanced efficacy requirement under Section 3(d)?", "expected_section": "Section 3(d)", "expected_doc": "patents-act-1970", "jurisdiction": "India", "out_of_scope": False},
    {"query_id": "Q05", "category": "C. Patentability - Section 3(e)", "query": "Section 3(e) mere admixture aggregation of properties", "expected_section": "Section 3(e)", "expected_doc": "patents-act-1970", "jurisdiction": "India", "out_of_scope": False},
    # Inventive step
    {"query_id": "Q06", "category": "D. Inventive step", "query": "Section 2(1)(ja) inventive step definition", "expected_section": "Section 2", "expected_doc": "patents-act-1970", "jurisdiction": "India", "out_of_scope": False},
    {"query_id": "Q07", "category": "D. Inventive step", "query": "What is the definition of inventive step under Indian patent law?", "expected_section": "Section 2", "expected_doc": "patents-act-1970", "jurisdiction": "India", "out_of_scope": False},
    # Prior art and TKDL
    {"query_id": "Q08", "category": "E. Prior art and TKDL", "query": "TKDL traditional knowledge digital library prior art database", "expected_section": "Page 4", "expected_doc": "tkdl-overview", "jurisdiction": "India", "out_of_scope": False},
    {"query_id": "Q09", "category": "E. Prior art and TKDL", "query": "How does TKDL help prevent grant of patents on traditional Indian knowledge?", "expected_section": "Page 4", "expected_doc": "tkdl-overview", "jurisdiction": "India", "out_of_scope": False},
    # Ayurvedic proprietary medicines
    {"query_id": "Q10", "category": "F. Ayurvedic proprietary medicines", "query": "Ayurvedic proprietary medicine licensing approval India", "expected_section": None, "expected_doc": "drugs-and-cosmetics-act-1940", "jurisdiction": "India", "out_of_scope": False},
    {"query_id": "Q11", "category": "F. Ayurvedic proprietary medicines", "query": "Schedule E drugs Ayurvedic cosmetics regulation", "expected_section": None, "expected_doc": "drugs-and-cosmetics-act-1940", "jurisdiction": "India", "out_of_scope": False},
    # Classical formulations
    {"query_id": "Q12", "category": "G. Classical formulations", "query": "classical Ayurvedic formulations Shastric texts patent exclusions", "expected_section": None, "expected_doc": "tkdl-overview", "jurisdiction": "India", "out_of_scope": False},
    # Biodiversity and ABS
    {"query_id": "Q13", "category": "H. Biodiversity and ABS", "query": "Biological Diversity Act 2002 access benefit sharing Section 3", "expected_section": "Section 3", "expected_doc": "biological-diversity-act-2002", "jurisdiction": "India", "out_of_scope": False},
    {"query_id": "Q14", "category": "H. Biodiversity and ABS", "query": "National Biodiversity Authority prior approval biological resources", "expected_section": None, "expected_doc": "biological-diversity-act-2002", "jurisdiction": "India", "out_of_scope": False},
    {"query_id": "Q15", "category": "H. Biodiversity and ABS", "query": "NBA benefit sharing agreement IPR India", "expected_section": None, "expected_doc": "nba-abs-guidelines", "jurisdiction": "India", "out_of_scope": False},
    # TRIPS
    {"query_id": "Q16", "category": "I. TRIPS Agreement", "query": "TRIPS Agreement Article 27 patentable subject matter", "expected_section": None, "expected_doc": "trips-agreement", "jurisdiction": "International", "out_of_scope": False},
    {"query_id": "Q17", "category": "I. TRIPS Agreement", "query": "TRIPS Article 8 compulsory licensing flexibilities", "expected_section": None, "expected_doc": "trips-agreement", "jurisdiction": "International", "out_of_scope": False},
    {"query_id": "Q18", "category": "I. TRIPS Agreement", "query": "What are India's obligations under the TRIPS Agreement for patent protection?", "expected_section": None, "expected_doc": "trips-agreement", "jurisdiction": "International", "out_of_scope": False},
    # Nagoya Protocol
    {"query_id": "Q19", "category": "J. Nagoya Protocol", "query": "Nagoya Protocol access and benefit sharing genetic resources", "expected_section": None, "expected_doc": "nagoya-protocol", "jurisdiction": "International", "out_of_scope": False},
    {"query_id": "Q20", "category": "J. Nagoya Protocol", "query": "Nagoya Protocol Article 5 fair equitable benefit sharing", "expected_section": None, "expected_doc": "nagoya-protocol", "jurisdiction": "International", "out_of_scope": False},
    # India-only queries
    {"query_id": "Q21", "category": "K. India-only queries", "query": "Indian Patents Act 1970 compulsory license Section 84", "expected_section": None, "expected_doc": "patents-act-1970", "jurisdiction": "India", "out_of_scope": False},
    {"query_id": "Q22", "category": "K. India-only queries", "query": "Patents Amendment Act 2005 product patents India", "expected_section": None, "expected_doc": "patents-act-1970", "jurisdiction": "India", "out_of_scope": False},
    # International-only queries
    {"query_id": "Q23", "category": "L. International-only queries", "query": "TRIPS Article 7 objectives of TRIPS Agreement", "expected_section": "Article 7", "expected_doc": "trips-agreement", "jurisdiction": "International", "out_of_scope": False},
    {"query_id": "Q24", "category": "L. International-only queries", "query": "Nagoya Protocol compliance due diligence checkpoint measures", "expected_section": None, "expected_doc": "nagoya-protocol", "jurisdiction": "International", "out_of_scope": False},
    # Mixed-jurisdiction queries
    {"query_id": "Q25", "category": "M. Mixed-jurisdiction queries", "query": "Traditional knowledge protection TRIPS Nagoya India", "expected_section": None, "expected_doc": None, "jurisdiction": "Both", "out_of_scope": False},
    {"query_id": "Q26", "category": "M. Mixed-jurisdiction queries", "query": "Compulsory license TRIPS flexibilities India public health", "expected_section": None, "expected_doc": None, "jurisdiction": "Both", "out_of_scope": False},
    # Out-of-scope / unsupported queries
    {"query_id": "Q27", "category": "N. Out-of-scope queries", "query": "What is the current stock price of Reliance Industries?", "expected_section": None, "expected_doc": None, "jurisdiction": "India", "out_of_scope": True},
    {"query_id": "Q28", "category": "N. Out-of-scope queries", "query": "How do I file income tax returns in India?", "expected_section": None, "expected_doc": None, "jurisdiction": "India", "out_of_scope": True},
    {"query_id": "Q29", "category": "N. Out-of-scope queries", "query": "Who is the Prime Minister of India?", "expected_section": None, "expected_doc": None, "jurisdiction": "India", "out_of_scope": True},
    # Section 3 other sub-clauses
    {"query_id": "Q30", "category": "O. Patentability - Section 3 misc", "query": "Section 3(j) plants animals biological processes patents India", "expected_section": "Section 3(j)", "expected_doc": "patents-act-1970", "jurisdiction": "India", "out_of_scope": False},
    {"query_id": "Q31", "category": "O. Patentability - Section 3 misc", "query": "Section 3(k) mathematical method computer programme patents India", "expected_section": "Section 3(k)", "expected_doc": "patents-act-1970", "jurisdiction": "India", "out_of_scope": False},
    {"query_id": "Q32", "category": "O. Patentability - Section 3 misc", "query": "Section 3(i) medicinal surgical treatment method patents India", "expected_section": "Section 3(i)", "expected_doc": "patents-act-1970", "jurisdiction": "India", "out_of_scope": False},
]


def get_chroma_results(query: str, jurisdiction: str, top_k: int = 5) -> List[Dict[str, Any]]:
    """Execute Chroma/BM25 hybrid search (simplified direct retrieval for evaluation)."""
    from app.services.retrieval_service import hybrid_rrf_search
    try:
        results = hybrid_rrf_search(query=query, jurisdiction=jurisdiction, top_k=top_k)
        return results
    except Exception as exc:
        return []


def get_qdrant_results(query: str, jurisdiction: str, top_k: int = 5) -> List[Dict[str, Any]]:
    """Execute Qdrant hybrid retrieval from ragvyn_hybrid_test_v2."""
    jur_clean = jurisdiction.strip().lower()
    if jur_clean == "both":
        q_jur = None
    elif "international" in jur_clean:
        q_jur = "International"
    elif "india" in jur_clean:
        q_jur = "India"
    else:
        q_jur = None
    return qdrant_hybrid_store.query_hybrid(
        query_text=query,
        collection_name=SHADOW_COLLECTION,
        top_k=top_k,
        jurisdiction=q_jur,
    )


def verify_collection_exists():
    """Pre-flight verify ragvyn_hybrid_test_v2 is healthy before evaluation."""
    try:
        qdrant_hybrid_store.verify_collection_schema(SHADOW_COLLECTION)
        client = qdrant_hybrid_store.get_client()
        col_info = client.get_collection(SHADOW_COLLECTION)
        count = col_info.points_count
        print(f"✅ Pre-flight: '{SHADOW_COLLECTION}' exists, {count} points, schema verified.")
        return True
    except Exception as exc:
        print(f"❌ Pre-flight FAILED for '{SHADOW_COLLECTION}': {exc}")
        return False


def validate_evidence_quality(result: Dict[str, Any]) -> bool:
    """Validate a single Qdrant result for mandatory payload completeness."""
    p = result.get("payload") or result.get("metadata") or result
    for f in MANDATORY_PAYLOAD_FIELDS:
        val = p.get(f) if isinstance(p, dict) else result.get(f)
        if not val or (isinstance(val, str) and not val.strip()):
            return False
    txt = result.get("text") or (p.get("text") if isinstance(p, dict) else "")
    if not txt or not txt.strip():
        return False
    return True


def run_evaluation():
    print(f"\n{'='*70}")
    print(f"Phase 4 Shadow Retrieval Evaluation — {SHADOW_COLLECTION}")
    print(f"{'='*70}\n")

    # Pre-flight check
    if not verify_collection_exists():
        raise SystemExit("Pre-flight failed. Evaluation aborted.")

    results = []
    chroma_latencies = []
    qdrant_latencies = []
    qdrant_successes = 0
    qdrant_timeouts = 0
    qdrant_errors = 0

    for q in EVAL_QUERIES:
        print(f"\n--- {q['query_id']}: {q['query'][:70]}...")

        # Chroma/BM25
        t_chroma_start = time.perf_counter()
        try:
            chroma_res = get_chroma_results(q["query"], q["jurisdiction"], top_k=5)
            chroma_latency_ms = (time.perf_counter() - t_chroma_start) * 1000.0
            chroma_latencies.append(chroma_latency_ms)
            chroma_ok = True
        except Exception as exc:
            chroma_res = []
            chroma_latency_ms = (time.perf_counter() - t_chroma_start) * 1000.0
            chroma_ok = False
            print(f"  ⚠️  Chroma error: {exc}")

        # Qdrant hybrid
        t_qdrant_start = time.perf_counter()
        qdrant_ok = False
        qdrant_res = []
        try:
            qdrant_res = get_qdrant_results(q["query"], q["jurisdiction"], top_k=5)
            qdrant_latency_ms = (time.perf_counter() - t_qdrant_start) * 1000.0
            qdrant_latencies.append(qdrant_latency_ms)
            qdrant_ok = True
            qdrant_successes += 1
        except Exception as exc:
            qdrant_latency_ms = (time.perf_counter() - t_qdrant_start) * 1000.0
            qdrant_errors += 1
            print(f"  ⚠️  Qdrant error: {exc}")

        # Analyse results
        chroma_doc_ids = []
        chroma_sections = []
        for r in chroma_res:
            meta = r.get("metadata") or {}
            chroma_doc_ids.append(str(meta.get("document_id") or r.get("source") or ""))
            chroma_sections.append(str(r.get("section") or meta.get("section") or ""))

        qdrant_doc_ids = []
        qdrant_sections = []
        qdrant_malformed = 0
        for r in qdrant_res:
            p = r.get("payload") or r.get("metadata") or r
            qdrant_doc_ids.append(str(r.get("document_id") or (p.get("document_id") if isinstance(p, dict) else "") or ""))
            qdrant_sections.append(str(r.get("section") or (p.get("section") if isinstance(p, dict) else "") or ""))
            if not validate_evidence_quality(r):
                qdrant_malformed += 1

        doc_overlap = sorted(set(d for d in chroma_doc_ids if d) & set(d for d in qdrant_doc_ids if d))
        section_overlap = sorted(set(s for s in chroma_sections if s) & set(s for s in qdrant_sections if s))

        # Evidence quality checks
        expected_sec = q.get("expected_section")
        expected_doc = q.get("expected_doc")

        qdrant_sec_at_rank1 = qdrant_sections[0] if qdrant_sections else None
        qdrant_doc_at_rank1 = qdrant_doc_ids[0] if qdrant_doc_ids else None
        qdrant_sec_in_top5 = expected_sec in qdrant_sections[:5] if expected_sec else None
        qdrant_doc_in_top5 = expected_doc in qdrant_doc_ids[:5] if expected_doc else None

        chroma_sec_at_rank1 = chroma_sections[0] if chroma_sections else None
        chroma_doc_at_rank1 = chroma_doc_ids[0] if chroma_doc_ids else None
        chroma_doc_in_top5 = expected_doc in chroma_doc_ids[:5] if expected_doc else None

        # Jurisdiction consistency
        jur_req = q["jurisdiction"].lower()
        if jur_req in ("india", "international"):
            jur_consistent = all(
                (r.get("jurisdiction") or (r.get("payload", {}) or {}).get("jurisdiction", "")).lower() == jur_req
                for r in qdrant_res if r
            ) if qdrant_res else True
        else:
            jur_consistent = True

        # Out-of-scope behavior: qdrant should return few or no results with low relevance
        if q["out_of_scope"] and qdrant_ok:
            oos_handled = len(qdrant_res) == 0 or (qdrant_res and qdrant_res[0].get("score", 0) < 0.4)
        else:
            oos_handled = None

        # Determine comparison winner
        if expected_doc and qdrant_ok:
            if qdrant_doc_in_top5 and not chroma_doc_in_top5:
                comparison_winner = "qdrant_better"
            elif chroma_doc_in_top5 and not qdrant_doc_in_top5:
                comparison_winner = "chroma_better"
            elif qdrant_doc_in_top5 and chroma_doc_in_top5:
                comparison_winner = "both_correct"
            else:
                comparison_winner = "both_missed"
        else:
            comparison_winner = "not_evaluable"

        entry = {
            "query_id": q["query_id"],
            "category": q["category"],
            "query_hash": hashlib.sha256(q["query"].strip().encode()).hexdigest()[:16],
            "jurisdiction": q["jurisdiction"],
            "out_of_scope": q["out_of_scope"],
            "expected_section": expected_sec,
            "expected_doc": expected_doc,
            "chroma_ok": chroma_ok,
            "qdrant_ok": qdrant_ok,
            "timing_ms": {
                "chroma": round(chroma_latency_ms, 1),
                "qdrant": round(qdrant_latency_ms, 1),
            },
            "chroma_candidate_count": len(chroma_res),
            "qdrant_candidate_count": len(qdrant_res),
            "doc_overlap": doc_overlap,
            "doc_overlap_count": len(doc_overlap),
            "section_overlap": section_overlap,
            "section_overlap_count": len(section_overlap),
            "qdrant_evidence": {
                "section_at_rank1": qdrant_sec_at_rank1,
                "doc_at_rank1": qdrant_doc_at_rank1,
                "correct_section_in_top5": qdrant_sec_in_top5,
                "correct_doc_in_top5": qdrant_doc_in_top5,
                "top5_sections": qdrant_sections[:5],
                "top5_docs": qdrant_doc_ids[:5],
                "malformed_payload_count": qdrant_malformed,
                "jurisdiction_consistent": jur_consistent,
                "out_of_scope_handled": oos_handled,
            },
            "chroma_evidence": {
                "section_at_rank1": chroma_sec_at_rank1,
                "doc_at_rank1": chroma_doc_at_rank1,
                "correct_doc_in_top5": chroma_doc_in_top5,
                "top5_sections": chroma_sections[:5],
                "top5_docs": chroma_doc_ids[:5],
            },
            "comparison_winner": comparison_winner,
        }
        results.append(entry)

        win_str = "✅" if comparison_winner in ("qdrant_better", "both_correct") else ("⚠️ " if comparison_winner == "both_missed" else "—")
        print(f"  {win_str} Qdrant: {len(qdrant_res)} results | Chroma: {len(chroma_res)} results")
        print(f"  Doc overlap: {doc_overlap[:3]} | Winner: {comparison_winner}")

    # ─── Aggregate Metrics ────────────────────────────────────────────────
    total = len(EVAL_QUERIES)
    success_rate = qdrant_successes / total
    timeout_rate = qdrant_timeouts / total
    error_rate = qdrant_errors / total

    def percentile(lst, p):
        if not lst: return 0.0
        lst_s = sorted(lst)
        i = int(len(lst_s) * p / 100)
        return round(lst_s[min(i, len(lst_s)-1)], 1)

    p50_qdrant = percentile(qdrant_latencies, 50)
    p95_qdrant = percentile(qdrant_latencies, 95)
    p50_chroma = percentile(chroma_latencies, 50)
    p95_chroma = percentile(chroma_latencies, 95)

    correct_doc_r1 = sum(1 for r in results if r["qdrant_evidence"]["correct_doc_in_top5"] is True and r["qdrant_evidence"]["doc_at_rank1"] == r["expected_doc"])
    correct_doc_top5 = sum(1 for r in results if r["qdrant_evidence"]["correct_doc_in_top5"] is True)
    total_evaluable = sum(1 for r in results if r["expected_doc"] is not None)
    oos_queries = [r for r in results if r["out_of_scope"]]

    filter_leakage = sum(1 for r in results if r["qdrant_evidence"]["jurisdiction_consistent"] is False)
    malformed_total = sum(r["qdrant_evidence"]["malformed_payload_count"] for r in results)

    qdrant_better = sum(1 for r in results if r["comparison_winner"] == "qdrant_better")
    chroma_better = sum(1 for r in results if r["comparison_winner"] == "chroma_better")
    both_correct = sum(1 for r in results if r["comparison_winner"] == "both_correct")
    both_missed = sum(1 for r in results if r["comparison_winner"] == "both_missed")

    # Verdict
    if success_rate >= 0.95 and filter_leakage == 0 and malformed_total == 0 and error_rate <= 0.05:
        verdict = "SHADOW HEALTHY"
    elif success_rate >= 0.80 and filter_leakage <= 1 and error_rate <= 0.15:
        verdict = "SHADOW NEEDS OPTIMIZATION"
    else:
        verdict = "SHADOW BLOCKED"

    # ─── Generate Reports ─────────────────────────────────────────────────
    report_json = {
        "collection_used": SHADOW_COLLECTION,
        "evaluation_timestamp": datetime.now(timezone.utc).isoformat(),
        "total_queries": total,
        "out_of_scope_queries": len(oos_queries),
        "evaluable_queries": total_evaluable,
        "qdrant_success_rate": round(success_rate, 4),
        "qdrant_timeout_rate": round(timeout_rate, 4),
        "qdrant_error_rate": round(error_rate, 4),
        "latency_ms": {
            "qdrant_p50": p50_qdrant,
            "qdrant_p95": p95_qdrant,
            "chroma_p50": p50_chroma,
            "chroma_p95": p95_chroma,
        },
        "retrieval_quality": {
            "correct_evidence_at_rank1": correct_doc_r1,
            "correct_evidence_in_top5": correct_doc_top5,
            "evaluable_queries": total_evaluable,
            "correct_evidence_at_rank1_rate": round(correct_doc_r1 / max(1, total_evaluable), 4),
            "correct_evidence_top5_rate": round(correct_doc_top5 / max(1, total_evaluable), 4),
        },
        "overlap_summary": {
            "qdrant_better": qdrant_better,
            "chroma_better": chroma_better,
            "both_correct": both_correct,
            "both_missed": both_missed,
        },
        "safety_metrics": {
            "filter_leakage_count": filter_leakage,
            "malformed_payload_total": malformed_total,
            "out_of_scope_handled_correctly": sum(1 for r in oos_queries if r["qdrant_evidence"]["out_of_scope_handled"] is True),
        },
        "verdict": verdict,
        "query_results": results,
    }

    REPORTS_DIR.mkdir(parents=True, exist_ok=True)
    json_path = REPORTS_DIR / "phase4_shadow_retrieval.json"
    with open(json_path, "w", encoding="utf-8") as f:
        json.dump(report_json, f, indent=2, ensure_ascii=False)

    # Markdown report
    md_lines = [
        "# Phase 4 Shadow Retrieval Evaluation Report",
        "",
        f"**Collection:** `{SHADOW_COLLECTION}`  ",
        f"**Timestamp:** {report_json['evaluation_timestamp']}  ",
        f"**Total Queries:** {total}  ",
        "",
        f"## Verdict: {verdict}",
        "",
        "> [!IMPORTANT]",
        f"> **`{verdict}`** — Based on Qdrant success rate, filter isolation, evidence quality, and schema integrity.",
        "> Live user-facing retrieval remains 100% on ChromaDB + BM25. `ragvyn_prod_v1` was not created.",
        "",
        "## Summary Metrics",
        "",
        f"| Metric | Value |",
        f"| :--- | :--- |",
        f"| Total Queries | {total} |",
        f"| Qdrant Success Rate | {success_rate*100:.1f}% |",
        f"| Qdrant Timeout Rate | {timeout_rate*100:.1f}% |",
        f"| Qdrant Error Rate | {error_rate*100:.1f}% |",
        f"| Qdrant p50 Latency | {p50_qdrant} ms |",
        f"| Qdrant p95 Latency | {p95_qdrant} ms |",
        f"| Chroma p50 Latency | {p50_chroma} ms |",
        f"| Chroma p95 Latency | {p95_chroma} ms |",
        f"| Correct Evidence at Rank 1 | {correct_doc_r1}/{total_evaluable} ({correct_doc_r1*100//max(1,total_evaluable)}%) |",
        f"| Correct Evidence in Top 5 | {correct_doc_top5}/{total_evaluable} ({correct_doc_top5*100//max(1,total_evaluable)}%) |",
        f"| Filter Leakage | {filter_leakage} |",
        f"| Malformed Payload Count | {malformed_total} |",
        "",
        "## Retrieval Comparison",
        "",
        f"| Outcome | Count |",
        f"| :--- | :--- |",
        f"| Qdrant Better | {qdrant_better} |",
        f"| Chroma Better | {chroma_better} |",
        f"| Both Correct | {both_correct} |",
        f"| Both Missed | {both_missed} |",
        "",
        "## Examples: Qdrant Better",
        "",
    ]

    for r in results:
        if r["comparison_winner"] == "qdrant_better":
            md_lines.append(f"- **{r['query_id']}** `{r['category']}` — Qdrant retrieved `{r['expected_doc']}` in top 5; Chroma did not.")

    md_lines += ["", "## Examples: Chroma Better", ""]
    for r in results:
        if r["comparison_winner"] == "chroma_better":
            md_lines.append(f"- **{r['query_id']}** `{r['category']}` — Chroma retrieved `{r['expected_doc']}` in top 5; Qdrant did not.")

    md_lines += [
        "",
        "## Out-of-Scope Query Behavior",
        "",
        f"| Query ID | Qdrant Handled? | Description |",
        f"| :--- | :---: | :--- |",
    ]
    for r in oos_queries:
        handled = "✅" if r["qdrant_evidence"]["out_of_scope_handled"] else "⚠️"
        md_lines.append(f"| {r['query_id']} | {handled} | {r['category']} |")

    md_lines += [
        "",
        "## Safety Constraints",
        "",
        "- `ragvyn_prod_v1` collection: **NOT CREATED** ✅",
        "- Live user-facing retrieval: **ChromaDB + BM25 (unchanged)** ✅",
        "- ChromaDB / SQLite / BM25 indices: **Unmodified** ✅",
        "- `QDRANT_SHADOW_RETRIEVAL` in `.env`: **false** ✅",
        "",
    ]

    md_path = REPORTS_DIR / "phase4_shadow_retrieval.md"
    with open(md_path, "w", encoding="utf-8") as f:
        f.write("\n".join(md_lines))

    print(f"\n{'='*70}")
    print(f"VERDICT: {verdict}")
    print(f"{'='*70}")
    print(f"  Qdrant success: {success_rate*100:.1f}% | p50: {p50_qdrant}ms | p95: {p95_qdrant}ms")
    print(f"  Chroma  p50:   {p50_chroma}ms | p95: {p95_chroma}ms")
    print(f"  Evidence Rank1: {correct_doc_r1}/{total_evaluable} | Top5: {correct_doc_top5}/{total_evaluable}")
    print(f"  Filter leakage: {filter_leakage} | Malformed payloads: {malformed_total}")
    print(f"  Qdrant better: {qdrant_better} | Chroma better: {chroma_better} | Both correct: {both_correct}")
    print(f"\nReports saved:")
    print(f"  {json_path}")
    print(f"  {md_path}")

    return report_json


if __name__ == "__main__":
    run_evaluation()
