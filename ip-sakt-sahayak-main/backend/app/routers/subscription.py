"""
Subscription & Premium Tier API
Free vs Premium tiers with usage limits and pricing
"""

from fastapi import APIRouter, Depends, HTTPException, status, Header
from pydantic import BaseModel, EmailStr
from typing import List, Optional, Dict, Any
from datetime import datetime, timedelta
from enum import Enum
import uuid

router = APIRouter(prefix="/api/subscription", tags=["subscription"])

# ============================================================
# TIER DEFINITIONS & PRICING
# ============================================================

class SubscriptionTier(str, Enum):
    FREE = "free"
    BASIC = "basic"
    PROFESSIONAL = "professional"
    ENTERPRISE = "enterprise"

# Pricing in INR (Indian Rupees) - Competitive with Indian market
TIER_PRICING = {
    SubscriptionTier.FREE: {
        "price_monthly": 0,
        "price_yearly": 0,
        "name": "Free",
        "description": "Get started with IP-SAKTI Sahayak",
    },
    SubscriptionTier.BASIC: {
        "price_monthly": 199,  # ~$2.40/month - affordable for students/individuals
        "price_yearly": 1999,  # ~$24/year (2 months free)
        "name": "Basic",
        "description": "For individual inventors and researchers",
    },
    SubscriptionTier.PROFESSIONAL: {
        "price_monthly": 499,  # ~$6/month - for serious users
        "price_yearly": 4999,  # ~$60/year (2 months free)
        "name": "Professional",
        "description": "For patent agents and small firms",
    },
    SubscriptionTier.ENTERPRISE: {
        "price_monthly": 1999,  # ~$24/month - for organizations
        "price_yearly": 19999,  # ~$240/year (2 months free)
        "name": "Enterprise",
        "description": "For law firms and large organizations",
    }
}

# Feature limits per tier
TIER_LIMITS = {
    SubscriptionTier.FREE: {
        "queries_per_day": 10,
        "queries_per_month": 100,
        "document_uploads": 3,
        "document_size_mb": 5,
        "drafts_per_month": 2,
        "matters": 1,
        "expert_consultations": 0,
        "priority_support": False,
        "api_access": False,
        "bulk_search": False,
        "advanced_analytics": False,
        "team_members": 1,
        "response_speed": "standard",  # standard = with ads/delays
        "citation_export": False,
        "custom_templates": False,
        "whitelabel": False,
    },
    SubscriptionTier.BASIC: {
        "queries_per_day": 50,
        "queries_per_month": 500,
        "document_uploads": 20,
        "document_size_mb": 25,
        "drafts_per_month": 10,
        "matters": 5,
        "expert_consultations": 1,
        "priority_support": False,
        "api_access": False,
        "bulk_search": True,
        "advanced_analytics": False,
        "team_members": 1,
        "response_speed": "fast",
        "citation_export": True,
        "custom_templates": False,
        "whitelabel": False,
    },
    SubscriptionTier.PROFESSIONAL: {
        "queries_per_day": 200,
        "queries_per_month": 2000,
        "document_uploads": 100,
        "document_size_mb": 50,
        "drafts_per_month": 50,
        "matters": 25,
        "expert_consultations": 5,
        "priority_support": True,
        "api_access": True,
        "bulk_search": True,
        "advanced_analytics": True,
        "team_members": 3,
        "response_speed": "priority",
        "citation_export": True,
        "custom_templates": True,
        "whitelabel": False,
    },
    SubscriptionTier.ENTERPRISE: {
        "queries_per_day": -1,  # Unlimited
        "queries_per_month": -1,
        "document_uploads": -1,
        "document_size_mb": 100,
        "drafts_per_month": -1,
        "matters": -1,
        "expert_consultations": -1,
        "priority_support": True,
        "api_access": True,
        "bulk_search": True,
        "advanced_analytics": True,
        "team_members": -1,
        "response_speed": "priority",
        "citation_export": True,
        "custom_templates": True,
        "whitelabel": True,
    }
}

# ============================================================
# SCHEMAS
# ============================================================

class UserSubscription(BaseModel):
    user_id: str
    tier: SubscriptionTier
    started_at: str
    expires_at: Optional[str] = None
    is_trial: bool = False
    auto_renew: bool = True

class UsageStats(BaseModel):
    queries_today: int
    queries_this_month: int
    documents_uploaded: int
    drafts_generated: int
    matters_created: int

class SubscriptionStatus(BaseModel):
    tier: SubscriptionTier
    tier_name: str
    limits: Dict[str, Any]
    usage: UsageStats
    is_limit_reached: bool
    upgrade_suggested: bool
    days_remaining: Optional[int] = None

class UpgradeRequest(BaseModel):
    target_tier: SubscriptionTier
    billing_cycle: str = "monthly"  # monthly or yearly
    payment_method: str = "upi"  # upi, card, netbanking

class PricingPlan(BaseModel):
    tier: SubscriptionTier
    name: str
    description: str
    price_monthly: int
    price_yearly: int
    features: List[str]
    limits: Dict[str, Any]
    popular: bool = False

# ============================================================
# IN-MEMORY STORAGE (Replace with DB in production)
# ============================================================

user_subscriptions: Dict[str, UserSubscription] = {}
user_usage: Dict[str, UsageStats] = {}

def get_user_subscription(user_id: str) -> UserSubscription:
    """Get or create user subscription (defaults to FREE)"""
    if user_id not in user_subscriptions:
        user_subscriptions[user_id] = UserSubscription(
            user_id=user_id,
            tier=SubscriptionTier.FREE,
            started_at=datetime.utcnow().isoformat(),
            expires_at=None,
            is_trial=False
        )
    return user_subscriptions[user_id]

def get_user_usage(user_id: str) -> UsageStats:
    """Get or create user usage stats"""
    if user_id not in user_usage:
        user_usage[user_id] = UsageStats(
            queries_today=0,
            queries_this_month=0,
            documents_uploaded=0,
            drafts_generated=0,
            matters_created=0
        )
    return user_usage[user_id]

# ============================================================
# ENDPOINTS
# ============================================================

@router.get("/plans", response_model=List[PricingPlan])
async def get_pricing_plans():
    """Get all available subscription plans with features"""
    plans = []
    
    feature_descriptions = {
        SubscriptionTier.FREE: [
            "10 queries/day",
            "3 document uploads",
            "2 draft generations/month",
            "1 matter workspace",
            "Basic RAG search",
            "Community support",
        ],
        SubscriptionTier.BASIC: [
            "50 queries/day",
            "20 document uploads",
            "10 draft generations/month",
            "5 matter workspaces",
            "Bulk search",
            "Citation export",
            "1 expert consultation/month",
            "Email support",
        ],
        SubscriptionTier.PROFESSIONAL: [
            "200 queries/day",
            "100 document uploads",
            "50 draft generations/month",
            "25 matter workspaces",
            "Priority response speed",
            "Advanced analytics",
            "API access",
            "Custom templates",
            "5 expert consultations/month",
            "3 team members",
            "Priority support",
        ],
        SubscriptionTier.ENTERPRISE: [
            "Unlimited queries",
            "Unlimited document uploads",
            "Unlimited draft generations",
            "Unlimited matter workspaces",
            "White-label option",
            "Dedicated account manager",
            "Custom integrations",
            "Unlimited team members",
            "Unlimited expert consultations",
            "24/7 priority support",
            "SLA guarantee",
        ]
    }
    
    for tier in SubscriptionTier:
        pricing = TIER_PRICING[tier]
        limits = TIER_LIMITS[tier]
        
        plans.append(PricingPlan(
            tier=tier,
            name=pricing["name"],
            description=pricing["description"],
            price_monthly=pricing["price_monthly"],
            price_yearly=pricing["price_yearly"],
            features=feature_descriptions[tier],
            limits=limits,
            popular=(tier == SubscriptionTier.PROFESSIONAL)
        ))
    
    return plans

@router.get("/status")
async def get_subscription_status(user_id: str = "anonymous"):
    """Get current subscription status and usage"""
    subscription = get_user_subscription(user_id)
    usage = get_user_usage(user_id)
    limits = TIER_LIMITS[subscription.tier]
    pricing = TIER_PRICING[subscription.tier]
    
    # Check if any limit is reached
    is_limit_reached = False
    if limits["queries_per_day"] > 0 and usage.queries_today >= limits["queries_per_day"]:
        is_limit_reached = True
    if limits["queries_per_month"] > 0 and usage.queries_this_month >= limits["queries_per_month"]:
        is_limit_reached = True
    
    # Suggest upgrade if usage > 80% of limit
    upgrade_suggested = False
    if limits["queries_per_day"] > 0:
        if usage.queries_today >= limits["queries_per_day"] * 0.8:
            upgrade_suggested = True
    
    # Calculate days remaining
    days_remaining = None
    if subscription.expires_at:
        expires = datetime.fromisoformat(subscription.expires_at)
        days_remaining = max(0, (expires - datetime.utcnow()).days)
    
    return SubscriptionStatus(
        tier=subscription.tier,
        tier_name=pricing["name"],
        limits=limits,
        usage=usage,
        is_limit_reached=is_limit_reached,
        upgrade_suggested=upgrade_suggested,
        days_remaining=days_remaining
    )

@router.post("/check-limit")
async def check_usage_limit(
    feature: str,  # queries, documents, drafts, matters
    user_id: str = "anonymous"
):
    """Check if user can perform an action based on their tier limits"""
    subscription = get_user_subscription(user_id)
    usage = get_user_usage(user_id)
    limits = TIER_LIMITS[subscription.tier]
    
    can_proceed = True
    remaining = -1
    limit_message = None
    
    if feature == "queries":
        daily_limit = limits["queries_per_day"]
        if daily_limit > 0:
            remaining = daily_limit - usage.queries_today
            if remaining <= 0:
                can_proceed = False
                limit_message = f"Daily query limit reached ({daily_limit}/day). Upgrade for more queries."
    
    elif feature == "documents":
        doc_limit = limits["document_uploads"]
        if doc_limit > 0:
            remaining = doc_limit - usage.documents_uploaded
            if remaining <= 0:
                can_proceed = False
                limit_message = f"Document upload limit reached ({doc_limit}). Upgrade for more uploads."
    
    elif feature == "drafts":
        draft_limit = limits["drafts_per_month"]
        if draft_limit > 0:
            remaining = draft_limit - usage.drafts_generated
            if remaining <= 0:
                can_proceed = False
                limit_message = f"Monthly draft limit reached ({draft_limit}/month). Upgrade to generate more drafts."
    
    elif feature == "matters":
        matter_limit = limits["matters"]
        if matter_limit > 0:
            remaining = matter_limit - usage.matters_created
            if remaining <= 0:
                can_proceed = False
                limit_message = f"Matter workspace limit reached ({matter_limit}). Upgrade for more workspaces."
    
    return {
        "can_proceed": can_proceed,
        "remaining": remaining if remaining >= 0 else "unlimited",
        "limit_message": limit_message,
        "current_tier": subscription.tier,
        "upgrade_url": "/pricing" if not can_proceed else None
    }

@router.post("/track-usage")
async def track_usage(
    feature: str,
    user_id: str = "anonymous"
):
    """Track usage of a feature (called after successful action)"""
    usage = get_user_usage(user_id)
    
    if feature == "queries":
        usage.queries_today += 1
        usage.queries_this_month += 1
    elif feature == "documents":
        usage.documents_uploaded += 1
    elif feature == "drafts":
        usage.drafts_generated += 1
    elif feature == "matters":
        usage.matters_created += 1
    
    user_usage[user_id] = usage
    
    return {"success": True, "usage": usage}

@router.post("/upgrade")
async def request_upgrade(request: UpgradeRequest, user_id: str = "anonymous"):
    """Request subscription upgrade (simulated - would integrate with payment gateway)"""
    current = get_user_subscription(user_id)
    target_pricing = TIER_PRICING[request.target_tier]
    
    price = target_pricing["price_yearly"] if request.billing_cycle == "yearly" else target_pricing["price_monthly"]
    
    # In production, this would create a payment order with Razorpay/Stripe
    order_id = f"order_{uuid.uuid4().hex[:12]}"
    
    return {
        "order_id": order_id,
        "amount": price,
        "currency": "INR",
        "tier": request.target_tier,
        "billing_cycle": request.billing_cycle,
        "payment_method": request.payment_method,
        "status": "pending",
        "message": "Payment gateway integration pending. This is a demo.",
        "payment_options": {
            "upi": "ip-sakti@upi",
            "razorpay_key": "rzp_test_xxxxx",  # Would be real key in production
        }
    }

@router.post("/activate")
async def activate_subscription(
    order_id: str,
    payment_id: str,
    tier: SubscriptionTier,
    billing_cycle: str = "monthly",
    user_id: str = "anonymous"
):
    """Activate subscription after successful payment"""
    now = datetime.utcnow()
    
    if billing_cycle == "yearly":
        expires = now + timedelta(days=365)
    else:
        expires = now + timedelta(days=30)
    
    user_subscriptions[user_id] = UserSubscription(
        user_id=user_id,
        tier=tier,
        started_at=now.isoformat(),
        expires_at=expires.isoformat(),
        is_trial=False,
        auto_renew=True
    )
    
    return {
        "success": True,
        "tier": tier,
        "tier_name": TIER_PRICING[tier]["name"],
        "expires_at": expires.isoformat(),
        "message": f"Successfully upgraded to {TIER_PRICING[tier]['name']} plan!"
    }

@router.post("/start-trial")
async def start_free_trial(user_id: str = "anonymous"):
    """Start a 7-day free trial of Professional tier"""
    existing = get_user_subscription(user_id)
    
    # Check if user already had a trial
    if existing.tier != SubscriptionTier.FREE:
        raise HTTPException(
            status_code=400,
            detail="You already have an active subscription"
        )
    
    now = datetime.utcnow()
    trial_end = now + timedelta(days=7)
    
    user_subscriptions[user_id] = UserSubscription(
        user_id=user_id,
        tier=SubscriptionTier.PROFESSIONAL,
        started_at=now.isoformat(),
        expires_at=trial_end.isoformat(),
        is_trial=True,
        auto_renew=False
    )
    
    return {
        "success": True,
        "tier": SubscriptionTier.PROFESSIONAL,
        "trial_days": 7,
        "expires_at": trial_end.isoformat(),
        "message": "Your 7-day Professional trial has started! Enjoy all premium features."
    }

@router.get("/compare")
async def compare_tiers():
    """Compare all tier features side by side"""
    features = [
        {"name": "Daily Queries", "key": "queries_per_day"},
        {"name": "Monthly Queries", "key": "queries_per_month"},
        {"name": "Document Uploads", "key": "document_uploads"},
        {"name": "Max Document Size", "key": "document_size_mb", "suffix": " MB"},
        {"name": "Drafts/Month", "key": "drafts_per_month"},
        {"name": "Matter Workspaces", "key": "matters"},
        {"name": "Expert Consultations", "key": "expert_consultations"},
        {"name": "Team Members", "key": "team_members"},
        {"name": "Priority Support", "key": "priority_support", "boolean": True},
        {"name": "API Access", "key": "api_access", "boolean": True},
        {"name": "Advanced Analytics", "key": "advanced_analytics", "boolean": True},
        {"name": "Citation Export", "key": "citation_export", "boolean": True},
        {"name": "Custom Templates", "key": "custom_templates", "boolean": True},
    ]
    
    comparison = []
    for feature in features:
        row = {"feature": feature["name"]}
        for tier in SubscriptionTier:
            value = TIER_LIMITS[tier][feature["key"]]
            if value == -1:
                row[tier.value] = "Unlimited"
            elif feature.get("boolean"):
                row[tier.value] = "✓" if value else "✗"
            elif feature.get("suffix"):
                row[tier.value] = f"{value}{feature['suffix']}"
            else:
                row[tier.value] = str(value)
        comparison.append(row)
    
    return {"comparison": comparison, "tiers": [t.value for t in SubscriptionTier]}
