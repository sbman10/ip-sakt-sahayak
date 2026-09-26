"""
Patent Filing Checklists API
Interactive checklists for different IP filing processes
"""

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
from datetime import datetime
import json

router = APIRouter(prefix="/api/checklists", tags=["checklists"])

# ============================================================
# SCHEMAS
# ============================================================

class ChecklistItem(BaseModel):
    id: str
    text: str
    description: Optional[str] = None
    required: bool = True
    completed: bool = False
    completed_at: Optional[str] = None
    documents: Optional[List[str]] = None  # Required document types
    tips: Optional[List[str]] = None

class Checklist(BaseModel):
    id: str
    name: str
    category: str  # patent, trademark, copyright, geographical_indication, trade_secret
    description: str
    items: List[ChecklistItem]
    estimated_time: str
    fees_range: str
    jurisdiction: str = "India"

class UserChecklistProgress(BaseModel):
    checklist_id: str
    user_id: str
    completed_items: List[str]
    notes: Dict[str, str] = {}
    started_at: str
    last_updated: str

class ProgressUpdate(BaseModel):
    item_id: str
    completed: bool
    note: Optional[str] = None

# ============================================================
# PREDEFINED CHECKLISTS
# ============================================================

PATENT_FILING_CHECKLIST = Checklist(
    id="patent_india_ordinary",
    name="Patent Filing Checklist (India - Ordinary Application)",
    category="patent",
    description="Complete checklist for filing an ordinary patent application in India under the Patents Act, 1970",
    estimated_time="3-6 months for filing, 2-5 years for grant",
    fees_range="₹1,600 - ₹8,000 (filing) + examination fees",
    jurisdiction="India",
    items=[
        ChecklistItem(
            id="p1", 
            text="Conduct Prior Art Search",
            description="Search existing patents, publications, and products to ensure novelty",
            required=True,
            documents=["Search report"],
            tips=[
                "Use InPASS (Indian Patent Advanced Search System)",
                "Check USPTO, EPO, WIPO databases",
                "Search scientific publications and journals"
            ]
        ),
        ChecklistItem(
            id="p2",
            text="Determine Patentability",
            description="Verify invention meets novelty, inventive step, and industrial applicability criteria",
            required=True,
            tips=[
                "Check Section 3 & 4 of Patents Act for non-patentable subjects",
                "Traditional knowledge (Neem, Turmeric) may face Section 3(p) objections",
                "Software per se is not patentable in India"
            ]
        ),
        ChecklistItem(
            id="p3",
            text="Prepare Complete Specification",
            description="Draft detailed technical description with claims",
            required=True,
            documents=["Complete specification document", "Drawings (if applicable)"],
            tips=[
                "Include title, field of invention, background, summary",
                "Claims define the legal scope of protection",
                "Best mode of carrying out invention must be disclosed"
            ]
        ),
        ChecklistItem(
            id="p4",
            text="Fill Form-1 (Application for Grant)",
            description="Basic application form with applicant details",
            required=True,
            documents=["Form-1"],
            tips=[
                "Mention if filing as individual, startup, small entity",
                "Different fee categories apply based on applicant type"
            ]
        ),
        ChecklistItem(
            id="p5",
            text="Prepare Form-2 (Provisional/Complete Specification)",
            description="Technical specification of the invention",
            required=True,
            documents=["Form-2", "Specification document"],
            tips=[
                "Provisional gives 12 months to file complete",
                "Complete specification required for examination"
            ]
        ),
        ChecklistItem(
            id="p6",
            text="Submit Form-3 (Statement & Undertaking)",
            description="Declaration of foreign filing and corresponding applications",
            required=True,
            documents=["Form-3"],
            tips=[
                "Must disclose all foreign applications",
                "Update within 6 months of any new foreign filing"
            ]
        ),
        ChecklistItem(
            id="p7",
            text="Prepare Form-5 (Declaration of Inventorship)",
            description="Details of all inventors",
            required=True,
            documents=["Form-5"],
            tips=[
                "All true inventors must be named",
                "Inventor rights cannot be completely waived"
            ]
        ),
        ChecklistItem(
            id="p8",
            text="Power of Attorney (if using agent)",
            description="Authorization for patent agent to act on behalf",
            required=False,
            documents=["Form-26 or General Power of Attorney"],
            tips=["Required if filing through a patent agent"]
        ),
        ChecklistItem(
            id="p9",
            text="Pay Filing Fees",
            description="Submit appropriate fees based on applicant category",
            required=True,
            documents=["Fee receipt"],
            tips=[
                "Natural person: ₹1,600",
                "Startup/Small entity: ₹4,000",
                "Others: ₹8,000",
                "E-filing gets 10% discount"
            ]
        ),
        ChecklistItem(
            id="p10",
            text="File Request for Examination (Form-18)",
            description="Request examination within 48 months of filing/priority date",
            required=True,
            documents=["Form-18"],
            tips=[
                "Expedited examination available for startups",
                "Must be filed for patent to proceed to examination"
            ]
        ),
        ChecklistItem(
            id="p11",
            text="Respond to Examination Report",
            description="Address objections raised by examiner",
            required=True,
            documents=["Response to FER"],
            tips=[
                "Usually 6 months to respond",
                "May require claim amendments",
                "Can request hearing if needed"
            ]
        ),
        ChecklistItem(
            id="p12",
            text="Pay Grant Fees & Obtain Certificate",
            description="Final steps after acceptance",
            required=True,
            documents=["Grant certificate"],
            tips=[
                "Patent valid for 20 years from filing date",
                "Annual renewal fees required to maintain"
            ]
        )
    ]
)

TRADEMARK_CHECKLIST = Checklist(
    id="trademark_india",
    name="Trademark Registration Checklist (India)",
    category="trademark",
    description="Complete checklist for trademark registration under Trade Marks Act, 1999",
    estimated_time="12-18 months",
    fees_range="₹4,500 - ₹9,000 per class",
    jurisdiction="India",
    items=[
        ChecklistItem(
            id="t1",
            text="Conduct Trademark Search",
            description="Search existing trademarks to avoid conflicts",
            required=True,
            documents=["Search report"],
            tips=[
                "Use IP India's public search",
                "Check phonetic and visual similarities",
                "Consider class-wise search"
            ]
        ),
        ChecklistItem(
            id="t2",
            text="Identify Nice Classification",
            description="Determine correct class(es) for goods/services",
            required=True,
            tips=[
                "45 classes total (1-34 goods, 35-45 services)",
                "Each class requires separate application",
                "Multi-class application possible"
            ]
        ),
        ChecklistItem(
            id="t3",
            text="Prepare Trademark Application (TM-A)",
            description="Complete application form with all details",
            required=True,
            documents=["Form TM-A", "Logo/Mark representation"],
            tips=[
                "Clear representation of mark required",
                "Specify goods/services precisely"
            ]
        ),
        ChecklistItem(
            id="t4",
            text="Submit User Affidavit (if claiming prior use)",
            description="Evidence of trademark use before filing",
            required=False,
            documents=["User affidavit", "Invoices", "Advertisements"],
            tips=["Strengthens application against opposition"]
        ),
        ChecklistItem(
            id="t5",
            text="Pay Application Fees",
            description="Submit fees online",
            required=True,
            documents=["Fee receipt"],
            tips=[
                "Individual/Startup: ₹4,500 per class",
                "Others: ₹9,000 per class",
                "E-filing mandatory"
            ]
        ),
        ChecklistItem(
            id="t6",
            text="Track Examination Status",
            description="Monitor application in trademark journal",
            required=True,
            tips=[
                "Examination report issued within 30 days",
                "May receive objections to respond to"
            ]
        ),
        ChecklistItem(
            id="t7",
            text="Respond to Examination Report",
            description="Address any objections raised",
            required=True,
            documents=["Response document"],
            tips=[
                "1 month deadline (extendable)",
                "Show cause hearing may be needed"
            ]
        ),
        ChecklistItem(
            id="t8",
            text="Publication in Trademark Journal",
            description="Mark published for opposition",
            required=True,
            tips=[
                "4-month opposition period",
                "Monitor for any oppositions filed"
            ]
        ),
        ChecklistItem(
            id="t9",
            text="Handle Opposition (if any)",
            description="Respond to third-party oppositions",
            required=False,
            documents=["Counter-statement", "Evidence"],
            tips=["Can negotiate settlements", "Hearing may be required"]
        ),
        ChecklistItem(
            id="t10",
            text="Obtain Registration Certificate",
            description="Final registration after successful process",
            required=True,
            documents=["Registration certificate"],
            tips=[
                "Valid for 10 years",
                "Renewable indefinitely",
                "Use ® symbol after registration"
            ]
        )
    ]
)

GI_CHECKLIST = Checklist(
    id="gi_india",
    name="Geographical Indication Registration (India)",
    category="geographical_indication",
    description="Checklist for GI registration under Geographical Indications of Goods Act, 1999",
    estimated_time="18-24 months",
    fees_range="₹5,000 - ₹10,000",
    jurisdiction="India",
    items=[
        ChecklistItem(
            id="g1",
            text="Identify GI Eligibility",
            description="Verify product qualifies for GI protection",
            required=True,
            tips=[
                "Must have geographical origin link",
                "Quality/reputation due to origin",
                "Examples: Darjeeling Tea, Basmati Rice"
            ]
        ),
        ChecklistItem(
            id="g2",
            text="Form Producer Association",
            description="Create association of producers/makers",
            required=True,
            documents=["Association registration", "Member list"],
            tips=[
                "Any association of producers can apply",
                "Government bodies can also apply"
            ]
        ),
        ChecklistItem(
            id="g3",
            text="Prepare Statement of Case",
            description="Detailed description of GI product",
            required=True,
            documents=["Statement of case"],
            tips=[
                "History and origin details",
                "Production methods",
                "Link between geography and quality"
            ]
        ),
        ChecklistItem(
            id="g4",
            text="Submit GI Application (Form GI-1)",
            description="Main application form",
            required=True,
            documents=["Form GI-1", "Class specification"],
            tips=["Filed at GI Registry, Chennai"]
        ),
        ChecklistItem(
            id="g5",
            text="Pay Application Fees",
            description="Submit prescribed fees",
            required=True,
            documents=["Fee receipt"],
            tips=["₹5,000 for association", "₹10,000 for others"]
        ),
        ChecklistItem(
            id="g6",
            text="Examination & Publication",
            description="GI Registry examines and publishes",
            required=True,
            tips=[
                "Published in GI Journal",
                "3-month opposition period"
            ]
        ),
        ChecklistItem(
            id="g7",
            text="Obtain GI Certificate",
            description="Registration after successful examination",
            required=True,
            documents=["GI Certificate"],
            tips=[
                "Valid for 10 years",
                "Renewable",
                "All authorized users can use"
            ]
        )
    ]
)

ABS_BIODIVERSITY_CHECKLIST = Checklist(
    id="abs_india",
    name="ABS Compliance Checklist (Biodiversity Act)",
    category="biodiversity",
    description="Access and Benefit Sharing compliance under Biological Diversity Act, 2002",
    estimated_time="3-6 months",
    fees_range="Varies by purpose",
    jurisdiction="India",
    items=[
        ChecklistItem(
            id="a1",
            text="Identify Biological Resource Type",
            description="Determine if resource falls under BD Act",
            required=True,
            tips=[
                "Plants, animals, microorganisms",
                "Traditional knowledge associated",
                "Check NBA negative list"
            ]
        ),
        ChecklistItem(
            id="a2",
            text="Check Applicability",
            description="Determine if approval needed from NBA/SBB",
            required=True,
            tips=[
                "Foreign nationals: NBA approval",
                "Indian companies with foreign stake: NBA",
                "Indians for commercial: SBB intimation"
            ]
        ),
        ChecklistItem(
            id="a3",
            text="Prior Informed Consent (PIC)",
            description="Obtain consent from local communities",
            required=True,
            documents=["PIC document", "Community consent"],
            tips=[
                "Especially for traditional knowledge",
                "BMC (Biodiversity Management Committee) role"
            ]
        ),
        ChecklistItem(
            id="a4",
            text="Submit Application to NBA/SBB",
            description="Formal application for access",
            required=True,
            documents=["Application form", "Project proposal"],
            tips=[
                "Form-I for research",
                "Form-III for IPR",
                "Different forms for different purposes"
            ]
        ),
        ChecklistItem(
            id="a5",
            text="Negotiate Benefit Sharing Agreement",
            description="Agree on benefit sharing terms",
            required=True,
            documents=["Benefit sharing agreement"],
            tips=[
                "Monetary and non-monetary benefits",
                "Technology transfer",
                "Joint R&D",
                "Royalty arrangements"
            ]
        ),
        ChecklistItem(
            id="a6",
            text="Obtain Access Permit",
            description="Final approval from authority",
            required=True,
            documents=["Access permit"],
            tips=[
                "Required before collection/research",
                "Conditions must be followed"
            ]
        ),
        ChecklistItem(
            id="a7",
            text="Compliance Monitoring",
            description="Ongoing compliance with permit terms",
            required=True,
            tips=[
                "Report research outcomes",
                "Share benefits as agreed",
                "No unauthorized commercialization"
            ]
        )
    ]
)

# All available checklists
ALL_CHECKLISTS = {
    "patent_india_ordinary": PATENT_FILING_CHECKLIST,
    "trademark_india": TRADEMARK_CHECKLIST,
    "gi_india": GI_CHECKLIST,
    "abs_india": ABS_BIODIVERSITY_CHECKLIST
}

# In-memory storage for user progress (replace with DB in production)
user_progress: Dict[str, Dict[str, UserChecklistProgress]] = {}

# ============================================================
# ENDPOINTS
# ============================================================

@router.get("/", response_model=List[Dict[str, Any]])
async def list_checklists():
    """List all available checklists with summary info"""
    return [
        {
            "id": c.id,
            "name": c.name,
            "category": c.category,
            "description": c.description,
            "item_count": len(c.items),
            "estimated_time": c.estimated_time,
            "fees_range": c.fees_range
        }
        for c in ALL_CHECKLISTS.values()
    ]

@router.get("/categories")
async def list_categories():
    """List checklist categories"""
    return {
        "categories": [
            {"id": "patent", "name": "Patents", "icon": "certificate"},
            {"id": "trademark", "name": "Trademarks", "icon": "tag"},
            {"id": "geographical_indication", "name": "Geographical Indications", "icon": "map-pin"},
            {"id": "biodiversity", "name": "Biodiversity/ABS", "icon": "leaf"},
            {"id": "copyright", "name": "Copyright", "icon": "file-text"},
            {"id": "trade_secret", "name": "Trade Secrets", "icon": "lock"}
        ]
    }

@router.get("/{checklist_id}", response_model=Checklist)
async def get_checklist(checklist_id: str):
    """Get complete checklist with all items"""
    if checklist_id not in ALL_CHECKLISTS:
        raise HTTPException(status_code=404, detail="Checklist not found")
    return ALL_CHECKLISTS[checklist_id]

@router.get("/{checklist_id}/progress")
async def get_user_progress(checklist_id: str, user_id: str = "anonymous"):
    """Get user's progress on a checklist"""
    if checklist_id not in ALL_CHECKLISTS:
        raise HTTPException(status_code=404, detail="Checklist not found")
    
    if user_id not in user_progress or checklist_id not in user_progress[user_id]:
        # Return default empty progress
        return {
            "checklist_id": checklist_id,
            "user_id": user_id,
            "completed_items": [],
            "notes": {},
            "started_at": None,
            "last_updated": None,
            "progress_percent": 0
        }
    
    progress = user_progress[user_id][checklist_id]
    checklist = ALL_CHECKLISTS[checklist_id]
    total_items = len(checklist.items)
    completed = len(progress.completed_items)
    
    return {
        **progress.dict(),
        "progress_percent": round((completed / total_items) * 100) if total_items > 0 else 0
    }

@router.post("/{checklist_id}/progress")
async def update_progress(checklist_id: str, update: ProgressUpdate, user_id: str = "anonymous"):
    """Update user's progress on a checklist item"""
    if checklist_id not in ALL_CHECKLISTS:
        raise HTTPException(status_code=404, detail="Checklist not found")
    
    now = datetime.utcnow().isoformat()
    
    # Initialize user progress if needed
    if user_id not in user_progress:
        user_progress[user_id] = {}
    
    if checklist_id not in user_progress[user_id]:
        user_progress[user_id][checklist_id] = UserChecklistProgress(
            checklist_id=checklist_id,
            user_id=user_id,
            completed_items=[],
            notes={},
            started_at=now,
            last_updated=now
        )
    
    progress = user_progress[user_id][checklist_id]
    
    # Update completion status
    if update.completed and update.item_id not in progress.completed_items:
        progress.completed_items.append(update.item_id)
    elif not update.completed and update.item_id in progress.completed_items:
        progress.completed_items.remove(update.item_id)
    
    # Update note if provided
    if update.note is not None:
        progress.notes[update.item_id] = update.note
    
    progress.last_updated = now
    
    # Calculate progress
    checklist = ALL_CHECKLISTS[checklist_id]
    total_items = len(checklist.items)
    completed = len(progress.completed_items)
    
    return {
        "success": True,
        "progress_percent": round((completed / total_items) * 100) if total_items > 0 else 0,
        "completed_count": completed,
        "total_count": total_items
    }

@router.delete("/{checklist_id}/progress")
async def reset_progress(checklist_id: str, user_id: str = "anonymous"):
    """Reset user's progress on a checklist"""
    if user_id in user_progress and checklist_id in user_progress[user_id]:
        del user_progress[user_id][checklist_id]
    
    return {"success": True, "message": "Progress reset"}

@router.get("/by-category/{category}")
async def get_checklists_by_category(category: str):
    """Get all checklists for a specific category"""
    matching = [c for c in ALL_CHECKLISTS.values() if c.category == category]
    if not matching:
        return {"checklists": [], "message": f"No checklists found for category: {category}"}
    return {"checklists": matching}
