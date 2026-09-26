"""
Analytics Dashboard API
Usage statistics, trends, and insights for IP-SAKTI Sahayak
"""

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
from datetime import datetime, timedelta
import random

router = APIRouter(prefix="/api/analytics", tags=["analytics"])

# ============================================================
# SCHEMAS
# ============================================================

class DashboardStats(BaseModel):
    total_queries: int
    total_users: int
    total_documents: int
    total_matters: int
    avg_confidence_score: float
    queries_today: int
    queries_this_week: int
    top_topics: List[Dict[str, Any]]

class QueryTrend(BaseModel):
    date: str
    count: int
    avg_confidence: float

class TopicStat(BaseModel):
    topic: str
    count: int
    percentage: float

class UserActivityStat(BaseModel):
    user_id: str
    queries: int
    documents: int
    matters: int
    last_active: str

# ============================================================
# SIMULATED ANALYTICS DATA
# (In production, these would come from actual database queries)
# ============================================================

def generate_mock_trends(days: int = 30) -> List[QueryTrend]:
    """Generate mock query trends for visualization"""
    trends = []
    base_date = datetime.utcnow()
    
    for i in range(days, 0, -1):
        date = base_date - timedelta(days=i)
        # Simulate realistic patterns (weekdays higher, weekends lower)
        weekday = date.weekday()
        base_count = 45 if weekday < 5 else 20
        count = base_count + random.randint(-10, 15)
        
        trends.append(QueryTrend(
            date=date.strftime("%Y-%m-%d"),
            count=max(5, count),
            avg_confidence=round(random.uniform(0.65, 0.92), 2)
        ))
    
    return trends

TOPIC_DISTRIBUTION = [
    {"topic": "Patent Filing Process", "count": 1234, "category": "patent"},
    {"topic": "Section 3(p) Traditional Knowledge", "count": 987, "category": "patent"},
    {"topic": "Trademark Registration", "count": 876, "category": "trademark"},
    {"topic": "ABS Compliance", "count": 654, "category": "biodiversity"},
    {"topic": "Patent Fees", "count": 543, "category": "patent"},
    {"topic": "AYUSH Formulation IP", "count": 432, "category": "ayush"},
    {"topic": "GI Registration", "count": 321, "category": "gi"},
    {"topic": "Copyright Basics", "count": 234, "category": "copyright"},
    {"topic": "Patent Deadlines", "count": 198, "category": "patent"},
    {"topic": "Biodiversity Act", "count": 156, "category": "biodiversity"},
]

LANGUAGE_DISTRIBUTION = [
    {"language": "English", "count": 4532, "percentage": 45.3},
    {"language": "Hindi", "count": 2876, "percentage": 28.8},
    {"language": "Tamil", "count": 654, "percentage": 6.5},
    {"language": "Kannada", "count": 543, "percentage": 5.4},
    {"language": "Telugu", "count": 432, "percentage": 4.3},
    {"language": "Bengali", "count": 321, "percentage": 3.2},
    {"language": "Marathi", "count": 276, "percentage": 2.8},
    {"language": "Gujarati", "count": 198, "percentage": 2.0},
    {"language": "Malayalam", "count": 112, "percentage": 1.1},
    {"language": "Punjabi", "count": 56, "percentage": 0.6},
]

FEATURE_USAGE = [
    {"feature": "Chat Assistant", "usage_count": 8765, "avg_session_time": "4m 32s"},
    {"feature": "Document Upload", "usage_count": 2345, "avg_session_time": "2m 15s"},
    {"feature": "Fee Calculator", "usage_count": 1987, "avg_session_time": "1m 45s"},
    {"feature": "Deadline Calculator", "usage_count": 1654, "avg_session_time": "1m 20s"},
    {"feature": "Draft Generator", "usage_count": 1234, "avg_session_time": "5m 10s"},
    {"feature": "Matter Workspace", "usage_count": 876, "avg_session_time": "8m 45s"},
    {"feature": "Checklists", "usage_count": 654, "avg_session_time": "3m 30s"},
    {"feature": "Expert Connect", "usage_count": 234, "avg_session_time": "6m 15s"},
]

# ============================================================
# ENDPOINTS
# ============================================================

@router.get("/dashboard", response_model=DashboardStats)
async def get_dashboard_stats():
    """Get main dashboard statistics"""
    total = sum(t["count"] for t in TOPIC_DISTRIBUTION)
    
    return DashboardStats(
        total_queries=10000,
        total_users=2543,
        total_documents=876,
        total_matters=234,
        avg_confidence_score=0.78,
        queries_today=random.randint(40, 80),
        queries_this_week=random.randint(300, 500),
        top_topics=[
            {"topic": t["topic"], "count": t["count"], "percentage": round(t["count"]/total*100, 1)}
            for t in TOPIC_DISTRIBUTION[:5]
        ]
    )

@router.get("/trends")
async def get_query_trends(days: int = 30):
    """Get query trends over time"""
    return {
        "period": f"Last {days} days",
        "trends": generate_mock_trends(days),
        "total_queries": sum(t.count for t in generate_mock_trends(days)),
        "avg_daily": round(sum(t.count for t in generate_mock_trends(days)) / days, 1)
    }

@router.get("/topics")
async def get_topic_distribution():
    """Get distribution of queries by topic"""
    total = sum(t["count"] for t in TOPIC_DISTRIBUTION)
    return {
        "topics": [
            {**t, "percentage": round(t["count"]/total*100, 1)}
            for t in TOPIC_DISTRIBUTION
        ],
        "total_queries": total
    }

@router.get("/languages")
async def get_language_distribution():
    """Get distribution of queries by language"""
    return {
        "languages": LANGUAGE_DISTRIBUTION,
        "total_languages": len(LANGUAGE_DISTRIBUTION)
    }

@router.get("/features")
async def get_feature_usage():
    """Get usage statistics for each feature"""
    return {
        "features": FEATURE_USAGE,
        "most_used": FEATURE_USAGE[0]["feature"],
        "total_interactions": sum(f["usage_count"] for f in FEATURE_USAGE)
    }

@router.get("/confidence")
async def get_confidence_distribution():
    """Get distribution of confidence scores"""
    return {
        "distribution": [
            {"range": "90-100%", "count": 2345, "percentage": 23.5},
            {"range": "80-89%", "count": 3456, "percentage": 34.6},
            {"range": "70-79%", "count": 2234, "percentage": 22.3},
            {"range": "60-69%", "count": 1234, "percentage": 12.3},
            {"range": "Below 60%", "count": 731, "percentage": 7.3},
        ],
        "average": 78.4,
        "median": 81.2
    }

@router.get("/response-times")
async def get_response_time_stats():
    """Get response time statistics"""
    return {
        "avg_response_time_ms": 1850,
        "p50_ms": 1200,
        "p90_ms": 3500,
        "p99_ms": 5200,
        "by_complexity": [
            {"type": "Simple greeting", "avg_ms": 200},
            {"type": "Out-of-scope filter", "avg_ms": 150},
            {"type": "Cached response", "avg_ms": 350},
            {"type": "RAG with 1-2 sources", "avg_ms": 1800},
            {"type": "RAG with 3+ sources", "avg_ms": 3200},
            {"type": "Complex analysis", "avg_ms": 4500},
        ]
    }

@router.get("/user-stats/{user_id}")
async def get_user_stats(user_id: str):
    """Get statistics for a specific user"""
    # In production, this would query the database
    return {
        "user_id": user_id,
        "queries_total": random.randint(10, 100),
        "documents_uploaded": random.randint(0, 20),
        "matters_created": random.randint(0, 5),
        "drafts_generated": random.randint(0, 10),
        "consultations_requested": random.randint(0, 3),
        "favorite_topics": ["Patent Filing", "ABS Compliance"],
        "last_active": datetime.utcnow().isoformat(),
        "member_since": (datetime.utcnow() - timedelta(days=random.randint(1, 365))).isoformat()
    }

@router.get("/source-citations")
async def get_source_citation_stats():
    """Get statistics on source citations"""
    return {
        "most_cited_sources": [
            {"source": "Patents Act, 1970", "citations": 3456, "sections": ["Section 3", "Section 3(p)", "Section 10"]},
            {"source": "Biological Diversity Act, 2002", "citations": 1234, "sections": ["Section 3", "Section 6", "Section 7"]},
            {"source": "Trade Marks Act, 1999", "citations": 987, "sections": ["Section 9", "Section 11", "Section 29"]},
            {"source": "TKDL Guidelines", "citations": 765, "sections": []},
            {"source": "Nagoya Protocol", "citations": 543, "sections": ["Article 5", "Article 6"]},
            {"source": "GI Act, 1999", "citations": 432, "sections": ["Section 11", "Section 22"]},
        ],
        "citation_rate": 0.87,  # 87% of responses include citations
        "avg_sources_per_response": 2.3
    }

@router.get("/satisfaction")
async def get_satisfaction_metrics():
    """Get user satisfaction metrics from feedback"""
    return {
        "overall_rating": 4.2,
        "ratings_breakdown": [
            {"stars": 5, "count": 1234, "percentage": 45.2},
            {"stars": 4, "count": 876, "percentage": 32.1},
            {"stars": 3, "count": 432, "percentage": 15.8},
            {"stars": 2, "count": 123, "percentage": 4.5},
            {"stars": 1, "count": 65, "percentage": 2.4},
        ],
        "thumbs_up_rate": 0.82,
        "common_feedback": [
            {"type": "positive", "comment": "Accurate legal information"},
            {"type": "positive", "comment": "Helpful for understanding patent process"},
            {"type": "improvement", "comment": "Could be faster"},
            {"type": "improvement", "comment": "More regional language support"},
        ]
    }

@router.get("/export")
async def export_analytics(format: str = "json", period: str = "month"):
    """Export analytics data (for admin use)"""
    return {
        "message": f"Analytics export requested for {period} period in {format} format",
        "download_url": f"/api/analytics/download/{period}_{datetime.utcnow().strftime('%Y%m%d')}.{format}",
        "expires_in": "24 hours",
        "note": "This endpoint would generate actual export files in production"
    }

@router.get("/realtime")
async def get_realtime_stats():
    """Get real-time statistics (for live dashboard)"""
    return {
        "active_users": random.randint(5, 25),
        "queries_last_hour": random.randint(10, 50),
        "avg_response_time_last_hour_ms": random.randint(1500, 2500),
        "system_status": "healthy",
        "api_latency_ms": random.randint(50, 150),
        "cache_hit_rate": round(random.uniform(0.7, 0.9), 2),
        "timestamp": datetime.utcnow().isoformat()
    }
