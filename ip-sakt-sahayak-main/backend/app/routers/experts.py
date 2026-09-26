"""
Expert Consultation / Facilitator Connect API
Request expert help and track consultation requests
"""

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, EmailStr
from typing import List, Optional, Dict, Any
from datetime import datetime
from enum import Enum
import uuid

router = APIRouter(prefix="/api/experts", tags=["experts"])

# ============================================================
# SCHEMAS
# ============================================================

class ExpertiseArea(str, Enum):
    PATENT = "patent"
    TRADEMARK = "trademark"
    COPYRIGHT = "copyright"
    GI = "geographical_indication"
    BIODIVERSITY = "biodiversity"
    TRADE_SECRET = "trade_secret"
    AYUSH = "ayush_traditional"
    LITIGATION = "ip_litigation"
    LICENSING = "licensing"

class ConsultationStatus(str, Enum):
    PENDING = "pending"
    ASSIGNED = "assigned"
    SCHEDULED = "scheduled"
    COMPLETED = "completed"
    CANCELLED = "cancelled"

class Expert(BaseModel):
    id: str
    name: str
    title: str
    expertise: List[ExpertiseArea]
    experience_years: int
    languages: List[str]
    rating: float
    consultations_done: int
    availability: str
    bio: str
    verified: bool = True
    organization: Optional[str] = None
    photo_url: Optional[str] = None

class ConsultationRequest(BaseModel):
    user_name: str
    user_email: str
    user_phone: Optional[str] = None
    expertise_needed: ExpertiseArea
    subject: str
    description: str
    preferred_language: str = "English"
    urgency: str = "normal"  # normal, urgent, emergency
    preferred_time: Optional[str] = None
    matter_id: Optional[str] = None  # Link to matter workspace

class ConsultationResponse(BaseModel):
    id: str
    status: ConsultationStatus
    created_at: str
    assigned_expert: Optional[Expert] = None
    scheduled_time: Optional[str] = None
    notes: Optional[str] = None

class FAQItem(BaseModel):
    id: str
    question: str
    answer: str
    category: str
    related_topics: List[str]
    helpful_count: int = 0
    last_updated: str

# ============================================================
# SAMPLE DATA - EXPERT DIRECTORY
# ============================================================

EXPERTS_DIRECTORY: List[Expert] = [
    Expert(
        id="exp_001",
        name="Dr. Rajesh Kumar",
        title="Senior Patent Attorney",
        expertise=[ExpertiseArea.PATENT, ExpertiseArea.BIODIVERSITY],
        experience_years=15,
        languages=["English", "Hindi"],
        rating=4.8,
        consultations_done=234,
        availability="Mon-Fri, 10AM-6PM",
        bio="Specializes in pharma patents and traditional knowledge cases. Former examiner at Indian Patent Office.",
        organization="Kumar & Associates IP Law"
    ),
    Expert(
        id="exp_002",
        name="Adv. Priya Sharma",
        title="IP Litigation Specialist",
        expertise=[ExpertiseArea.TRADEMARK, ExpertiseArea.LITIGATION],
        experience_years=12,
        languages=["English", "Hindi", "Marathi"],
        rating=4.9,
        consultations_done=189,
        availability="Mon-Sat, 9AM-5PM",
        bio="Expert in trademark disputes and brand protection. Handled 50+ IPAB cases.",
        organization="Sharma Legal Partners"
    ),
    Expert(
        id="exp_003",
        name="Dr. Anand Venkatesh",
        title="AYUSH IP Consultant",
        expertise=[ExpertiseArea.AYUSH, ExpertiseArea.BIODIVERSITY, ExpertiseArea.GI],
        experience_years=20,
        languages=["English", "Tamil", "Kannada"],
        rating=4.7,
        consultations_done=312,
        availability="Tue-Sat, 11AM-7PM",
        bio="Pioneering work in Ayurvedic formulation patents. Advisor to TKDL project.",
        organization="Traditional Knowledge Research Institute"
    ),
    Expert(
        id="exp_004",
        name="Ms. Neha Agarwal",
        title="Copyright & Digital IP Expert",
        expertise=[ExpertiseArea.COPYRIGHT, ExpertiseArea.LICENSING],
        experience_years=8,
        languages=["English", "Hindi"],
        rating=4.6,
        consultations_done=145,
        availability="Mon-Fri, 10AM-8PM",
        bio="Specializes in software copyrights and digital content licensing.",
        organization="Digital Rights Consultancy"
    ),
    Expert(
        id="exp_005",
        name="Shri Balwinder Singh",
        title="GI Registration Specialist",
        expertise=[ExpertiseArea.GI, ExpertiseArea.AYUSH],
        experience_years=18,
        languages=["English", "Hindi", "Punjabi"],
        rating=4.9,
        consultations_done=98,
        availability="Mon-Fri, 9AM-5PM",
        bio="Helped register 15+ GIs including Punjab's famous products.",
        organization="GI Facilitation Centre"
    )
]

# Facilitator FAQ Database
FACILITATOR_FAQS: List[FAQItem] = [
    FAQItem(
        id="faq_001",
        question="What documents are required for patent filing?",
        answer="For an ordinary patent application in India, you need: (1) Form-1 (Application), (2) Form-2 (Complete Specification), (3) Form-3 (Statement & Undertaking), (4) Form-5 (Declaration of Inventorship), (5) Drawings (if applicable), (6) Priority document (if claiming priority), and (7) Power of Attorney (if using an agent).",
        category="patent",
        related_topics=["patent_filing", "forms", "documentation"],
        helpful_count=156,
        last_updated="2026-01-15"
    ),
    FAQItem(
        id="faq_002",
        question="Can I patent an Ayurvedic formulation?",
        answer="Yes, Ayurvedic formulations can be patented if they meet novelty, inventive step, and industrial applicability criteria. However, you must ensure: (1) The formulation is not already documented in traditional texts (TKDL database), (2) There is a new method of preparation or enhanced efficacy, (3) Proper ABS compliance if using biological resources.",
        category="ayush",
        related_topics=["traditional_knowledge", "tkdl", "ayurveda"],
        helpful_count=234,
        last_updated="2026-02-20"
    ),
    FAQItem(
        id="faq_003",
        question="What is Section 3(p) of the Patents Act?",
        answer="Section 3(p) excludes from patentability 'an invention which, in effect, is traditional knowledge or which is an aggregation or duplication of known properties of traditionally known component or components.' This prevents biopiracy and protects India's traditional knowledge heritage.",
        category="patent",
        related_topics=["section_3p", "traditional_knowledge", "biopiracy"],
        helpful_count=312,
        last_updated="2026-01-10"
    ),
    FAQItem(
        id="faq_004",
        question="How do I check if my trademark is available?",
        answer="To check trademark availability: (1) Visit IP India's trademark public search (ipindiaservices.gov.in), (2) Search by wordmark, device, or phonetic similarity, (3) Check all relevant Nice classes, (4) Look for identical and similar marks, (5) Consider hiring a professional search service for comprehensive clearance.",
        category="trademark",
        related_topics=["trademark_search", "nice_classification", "clearance"],
        helpful_count=189,
        last_updated="2026-03-05"
    ),
    FAQItem(
        id="faq_005",
        question="What is ABS and when do I need approval?",
        answer="ABS (Access and Benefit Sharing) is required under the Biological Diversity Act, 2002 when: (1) Foreign nationals/companies access Indian biological resources, (2) Indian companies with foreign shareholding conduct research, (3) Any entity seeks IPR on inventions using biological resources. Apply to NBA (National Biodiversity Authority) for approval.",
        category="biodiversity",
        related_topics=["abs", "nba", "biological_resources"],
        helpful_count=145,
        last_updated="2026-02-28"
    ),
    FAQItem(
        id="faq_006",
        question="How long does patent grant take in India?",
        answer="Typical timeline: (1) Filing to publication: 18 months (or 1 month if early publication requested), (2) Request for Examination (RFE) must be filed within 48 months, (3) First Examination Report (FER): 1-6 months after RFE, (4) Response period: 6 months, (5) Total: 2-5 years for grant. Expedited examination available for startups.",
        category="patent",
        related_topics=["patent_timeline", "examination", "grant"],
        helpful_count=278,
        last_updated="2026-01-20"
    ),
    FAQItem(
        id="faq_007",
        question="What is the difference between ™ and ®?",
        answer="™ (Trademark symbol) can be used by anyone claiming rights to a mark, even without registration - it indicates a trademark claim. ® (Registered trademark symbol) can ONLY be used after official registration with the Trademark Registry - using it without registration is an offense under Section 107 of Trade Marks Act.",
        category="trademark",
        related_topics=["trademark_symbols", "registration", "usage"],
        helpful_count=167,
        last_updated="2026-03-01"
    ),
    FAQItem(
        id="faq_008",
        question="Can I file a patent myself without an agent?",
        answer="Yes, any person can file a patent application without an agent. However, hiring a registered patent agent is recommended because: (1) Technical drafting requires expertise, (2) Claims define protection scope, (3) Prosecution needs legal knowledge, (4) Errors can lead to rejection. For individuals, there's a fee concession category.",
        category="patent",
        related_topics=["self_filing", "patent_agent", "fees"],
        helpful_count=198,
        last_updated="2026-02-15"
    )
]

# In-memory storage for consultation requests
consultation_requests: Dict[str, Dict[str, Any]] = {}

# ============================================================
# ENDPOINTS
# ============================================================

@router.get("/directory", response_model=List[Expert])
async def list_experts(
    expertise: Optional[ExpertiseArea] = None,
    language: Optional[str] = None,
    min_rating: float = 0.0
):
    """List all available experts with optional filters"""
    experts = EXPERTS_DIRECTORY
    
    if expertise:
        experts = [e for e in experts if expertise in e.expertise]
    
    if language:
        experts = [e for e in experts if language.lower() in [l.lower() for l in e.languages]]
    
    if min_rating > 0:
        experts = [e for e in experts if e.rating >= min_rating]
    
    return experts

@router.get("/directory/{expert_id}", response_model=Expert)
async def get_expert(expert_id: str):
    """Get detailed profile of a specific expert"""
    for expert in EXPERTS_DIRECTORY:
        if expert.id == expert_id:
            return expert
    raise HTTPException(status_code=404, detail="Expert not found")

@router.post("/consultation/request", response_model=ConsultationResponse)
async def request_consultation(request: ConsultationRequest):
    """Submit a consultation request"""
    request_id = f"cons_{uuid.uuid4().hex[:8]}"
    now = datetime.utcnow().isoformat()
    
    # Find matching experts
    matching_experts = [
        e for e in EXPERTS_DIRECTORY 
        if request.expertise_needed in e.expertise
    ]
    
    # Auto-assign if available (in production, this would be more sophisticated)
    assigned_expert = matching_experts[0] if matching_experts else None
    
    consultation = {
        "id": request_id,
        "request": request.dict(),
        "status": ConsultationStatus.ASSIGNED if assigned_expert else ConsultationStatus.PENDING,
        "created_at": now,
        "assigned_expert_id": assigned_expert.id if assigned_expert else None,
        "assigned_expert": assigned_expert,
        "scheduled_time": None,
        "notes": None
    }
    
    consultation_requests[request_id] = consultation
    
    return ConsultationResponse(
        id=request_id,
        status=consultation["status"],
        created_at=now,
        assigned_expert=assigned_expert,
        scheduled_time=None,
        notes="Your request has been received. An expert will contact you within 24 hours." if assigned_expert else "Your request is being processed."
    )

@router.get("/consultation/{request_id}", response_model=ConsultationResponse)
async def get_consultation_status(request_id: str):
    """Check status of a consultation request"""
    if request_id not in consultation_requests:
        raise HTTPException(status_code=404, detail="Consultation request not found")
    
    c = consultation_requests[request_id]
    return ConsultationResponse(
        id=c["id"],
        status=c["status"],
        created_at=c["created_at"],
        assigned_expert=c["assigned_expert"],
        scheduled_time=c.get("scheduled_time"),
        notes=c.get("notes")
    )

@router.get("/consultation/user/{user_email}")
async def get_user_consultations(user_email: str):
    """Get all consultations for a user"""
    user_consultations = [
        c for c in consultation_requests.values()
        if c["request"]["user_email"].lower() == user_email.lower()
    ]
    return {"consultations": user_consultations, "total": len(user_consultations)}

# ============================================================
# FAQ ENDPOINTS (Facilitator FAQ Loop)
# ============================================================

@router.get("/faqs", response_model=List[FAQItem])
async def list_faqs(
    category: Optional[str] = None,
    search: Optional[str] = None,
    limit: int = 20
):
    """List FAQs with optional filters"""
    faqs = FACILITATOR_FAQS
    
    if category:
        faqs = [f for f in faqs if f.category == category]
    
    if search:
        search_lower = search.lower()
        faqs = [
            f for f in faqs 
            if search_lower in f.question.lower() or search_lower in f.answer.lower()
        ]
    
    # Sort by helpfulness
    faqs = sorted(faqs, key=lambda x: x.helpful_count, reverse=True)
    
    return faqs[:limit]

@router.get("/faqs/{faq_id}", response_model=FAQItem)
async def get_faq(faq_id: str):
    """Get a specific FAQ"""
    for faq in FACILITATOR_FAQS:
        if faq.id == faq_id:
            return faq
    raise HTTPException(status_code=404, detail="FAQ not found")

@router.post("/faqs/{faq_id}/helpful")
async def mark_faq_helpful(faq_id: str, helpful: bool = True):
    """Mark an FAQ as helpful/not helpful"""
    for faq in FACILITATOR_FAQS:
        if faq.id == faq_id:
            if helpful:
                faq.helpful_count += 1
            else:
                faq.helpful_count = max(0, faq.helpful_count - 1)
            return {"success": True, "new_count": faq.helpful_count}
    raise HTTPException(status_code=404, detail="FAQ not found")

@router.get("/faqs/categories")
async def list_faq_categories():
    """List all FAQ categories"""
    categories = list(set(f.category for f in FACILITATOR_FAQS))
    return {
        "categories": [
            {"id": "patent", "name": "Patents", "count": len([f for f in FACILITATOR_FAQS if f.category == "patent"])},
            {"id": "trademark", "name": "Trademarks", "count": len([f for f in FACILITATOR_FAQS if f.category == "trademark"])},
            {"id": "ayush", "name": "AYUSH/Traditional", "count": len([f for f in FACILITATOR_FAQS if f.category == "ayush"])},
            {"id": "biodiversity", "name": "Biodiversity", "count": len([f for f in FACILITATOR_FAQS if f.category == "biodiversity"])},
            {"id": "gi", "name": "GI Registration", "count": len([f for f in FACILITATOR_FAQS if f.category == "gi"])},
        ]
    }

# ============================================================
# EXPERTISE AREAS INFO
# ============================================================

@router.get("/expertise-areas")
async def list_expertise_areas():
    """List all expertise areas with descriptions"""
    return {
        "areas": [
            {
                "id": "patent",
                "name": "Patent Filing & Prosecution",
                "description": "Help with drafting, filing, and prosecuting patent applications"
            },
            {
                "id": "trademark",
                "name": "Trademark Registration",
                "description": "Brand protection through trademark registration and enforcement"
            },
            {
                "id": "copyright",
                "name": "Copyright Registration",
                "description": "Protection of creative works, software, and artistic content"
            },
            {
                "id": "geographical_indication",
                "name": "GI Registration",
                "description": "Registration of geographically unique products"
            },
            {
                "id": "biodiversity",
                "name": "Biodiversity & ABS",
                "description": "Access and benefit sharing compliance for biological resources"
            },
            {
                "id": "ayush_traditional",
                "name": "AYUSH & Traditional Knowledge",
                "description": "IP protection for Ayurveda, Yoga, Unani, Siddha, Homeopathy"
            },
            {
                "id": "ip_litigation",
                "name": "IP Litigation",
                "description": "Dispute resolution and enforcement of IP rights"
            },
            {
                "id": "licensing",
                "name": "IP Licensing",
                "description": "Technology transfer and IP licensing agreements"
            }
        ]
    }
