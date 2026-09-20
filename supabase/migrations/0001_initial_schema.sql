-- ==============================================================================
-- Migration 0001: Initial Core Schema
-- Database: Supabase PostgreSQL (Public Schema)
-- Project: RAGVYN AI / IP-SAKTI Sahayak
-- ==============================================================================
-- Creates core tables: users, conversations, messages, matter_workspace,
-- matter_events, audit_logs, sources, feedback, patentability_assessments,
-- and document_records. Preserves compatibility with existing FastAPI JWT
-- authentication (bcrypt password_hash).
-- ==============================================================================

-- Enable UUID extension if not already available
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1. Users Table (UUID string primary key matching existing SQLite accounts)
CREATE TABLE IF NOT EXISTS public.users (
    id VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid()::text,
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(255) NOT NULL,
    organization VARCHAR(255),
    role VARCHAR(50) NOT NULL DEFAULT 'user',
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    is_verified BOOLEAN NOT NULL DEFAULT FALSE,
    avatar_url VARCHAR(500),
    phone VARCHAR(20),
    preferences_json TEXT,
    last_login TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 2. Conversations Table (Multi-turn chat sessions)
CREATE TABLE IF NOT EXISTS public.conversations (
    id VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid()::text,
    user_id VARCHAR(36) REFERENCES public.users(id) ON DELETE SET NULL,
    title VARCHAR(255),
    jurisdiction VARCHAR(50) DEFAULT 'India',
    language VARCHAR(10) DEFAULT 'en',
    is_pinned BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 3. Messages Table (Discrete conversational turns with composite confidence)
CREATE TABLE IF NOT EXISTS public.messages (
    id SERIAL PRIMARY KEY,
    conversation_id VARCHAR(36) NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
    role VARCHAR(20) NOT NULL,
    content TEXT NOT NULL,
    confidence VARCHAR(20),
    citations_json TEXT,
    latency_ms DOUBLE PRECISION,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 4. Matter Workspace Table (IP case management workspace)
CREATE TABLE IF NOT EXISTS public.matter_workspace (
    id VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid()::text,
    user_id VARCHAR(36) NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    case_type VARCHAR(50) NOT NULL,
    application_number VARCHAR(100),
    filing_date TIMESTAMPTZ,
    status VARCHAR(50) NOT NULL DEFAULT 'draft',
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 5. Matter Events Table (Deadlines, timeline events, and reminders)
CREATE TABLE IF NOT EXISTS public.matter_events (
    id SERIAL PRIMARY KEY,
    matter_id VARCHAR(36) NOT NULL REFERENCES public.matter_workspace(id) ON DELETE CASCADE,
    event_type VARCHAR(50) NOT NULL,
    event_date TIMESTAMPTZ,
    description TEXT,
    reminder_date TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Compatibility view mapping 'matters' to 'matter_workspace'
CREATE OR REPLACE VIEW public.matters AS
    SELECT * FROM public.matter_workspace;

-- 6. Audit Logs Table (Immutable DPDP compliance and query telemetry)
CREATE TABLE IF NOT EXISTS public.audit_logs (
    id SERIAL PRIMARY KEY,
    query_raw TEXT,
    query_scrubbed TEXT,
    jurisdiction VARCHAR(50),
    language VARCHAR(10),
    confidence_score INTEGER,
    latency_ms DOUBLE PRECISION,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 7. Sources Table (Statutory and treaty corpus registry)
CREATE TABLE IF NOT EXISTS public.sources (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    jurisdiction VARCHAR(50) NOT NULL,
    source_type VARCHAR(50) NOT NULL,
    file_path VARCHAR(500),
    chunk_count INTEGER DEFAULT 0,
    description TEXT,
    effective_date TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 8. Feedback Table (User response ratings and feedback)
CREATE TABLE IF NOT EXISTS public.feedback (
    id SERIAL PRIMARY KEY,
    message_id INTEGER NOT NULL REFERENCES public.messages(id) ON DELETE CASCADE,
    rating VARCHAR(20) NOT NULL,
    comment TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 9. Patentability Assessments Table (Structured prior-art & Section 3/6 reports)
CREATE TABLE IF NOT EXISTS public.patentability_assessments (
    id VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid()::text,
    user_id VARCHAR(36) REFERENCES public.users(id) ON DELETE SET NULL,
    matter_id VARCHAR(36) REFERENCES public.matter_workspace(id) ON DELETE SET NULL,
    title VARCHAR(255) NOT NULL,
    jurisdiction VARCHAR(50) DEFAULT 'India',
    status VARCHAR(50) DEFAULT 'completed',
    result_category VARCHAR(100) NOT NULL,
    request_json TEXT NOT NULL,
    report_json TEXT NOT NULL,
    markdown_report TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 10. Document Records Table (Ingested corpus metadata and checksum tracking)
CREATE TABLE IF NOT EXISTS public.document_records (
    id SERIAL PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    file_path VARCHAR(512) NOT NULL,
    checksum VARCHAR(64) UNIQUE NOT NULL,
    chunk_count INTEGER DEFAULT 0 NOT NULL,
    collection_name VARCHAR(100),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
