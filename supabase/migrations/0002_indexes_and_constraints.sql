-- ==============================================================================
-- Migration 0002: Indexes and Constraints
-- Database: Supabase PostgreSQL (Public Schema)
-- Project: RAGVYN AI / IP-SAKTI Sahayak
-- ==============================================================================
-- Adds performance indexes on foreign keys, temporal sort columns, and lookup
-- fields, alongside domain constraints for DPDP audit compliance and data integrity.
-- ==============================================================================

-- 1. Users Indexes
CREATE INDEX IF NOT EXISTS idx_users_email ON public.users(email);
CREATE INDEX IF NOT EXISTS idx_users_role ON public.users(role);

-- 2. Conversations Indexes
CREATE INDEX IF NOT EXISTS idx_conversations_user_id ON public.conversations(user_id);
CREATE INDEX IF NOT EXISTS idx_conversations_created_at ON public.conversations(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_conversations_jurisdiction ON public.conversations(jurisdiction);

-- 3. Messages Indexes
CREATE INDEX IF NOT EXISTS idx_messages_conversation_id ON public.messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON public.messages(created_at ASC);

-- 4. Matter Workspace Indexes
CREATE INDEX IF NOT EXISTS idx_matter_workspace_user_id ON public.matter_workspace(user_id);
CREATE INDEX IF NOT EXISTS idx_matter_workspace_case_type ON public.matter_workspace(case_type);
CREATE INDEX IF NOT EXISTS idx_matter_workspace_status ON public.matter_workspace(status);
CREATE INDEX IF NOT EXISTS idx_matter_workspace_updated_at ON public.matter_workspace(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_matter_workspace_app_num ON public.matter_workspace(application_number) WHERE application_number IS NOT NULL;

-- 5. Matter Events Indexes
CREATE INDEX IF NOT EXISTS idx_matter_events_matter_id ON public.matter_events(matter_id);
CREATE INDEX IF NOT EXISTS idx_matter_events_reminder_date ON public.matter_events(reminder_date) WHERE reminder_date IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_matter_events_event_date ON public.matter_events(event_date) WHERE event_date IS NOT NULL;

-- 6. Audit Logs Indexes
CREATE INDEX IF NOT EXISTS idx_audit_logs_timestamp ON public.audit_logs(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_jurisdiction ON public.audit_logs(jurisdiction);

-- 7. Feedback Indexes
CREATE INDEX IF NOT EXISTS idx_feedback_message_id ON public.feedback(message_id);

-- 8. Patentability Assessments Indexes
CREATE INDEX IF NOT EXISTS idx_patentability_user_id ON public.patentability_assessments(user_id);
CREATE INDEX IF NOT EXISTS idx_patentability_matter_id ON public.patentability_assessments(matter_id);
CREATE INDEX IF NOT EXISTS idx_patentability_created_at ON public.patentability_assessments(created_at DESC);

-- 9. Document Records Indexes
CREATE INDEX IF NOT EXISTS idx_document_records_checksum ON public.document_records(checksum);
CREATE INDEX IF NOT EXISTS idx_document_records_collection ON public.document_records(collection_name);

-- 10. Integrity Constraints
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'chk_users_role'
    ) THEN
        ALTER TABLE public.users
        ADD CONSTRAINT chk_users_role
        CHECK (role IN ('user', 'admin', 'expert'));
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'chk_matter_case_type'
    ) THEN
        ALTER TABLE public.matter_workspace
        ADD CONSTRAINT chk_matter_case_type
        CHECK (case_type IN ('patent', 'trademark', 'copyright', 'gi', 'biodiversity', 'trade_secret'));
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'chk_matter_status'
    ) THEN
        ALTER TABLE public.matter_workspace
        ADD CONSTRAINT chk_matter_status
        CHECK (status IN ('draft', 'in_progress', 'filed', 'examination', 'granted', 'rejected', 'abandoned'));
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'chk_messages_role'
    ) THEN
        ALTER TABLE public.messages
        ADD CONSTRAINT chk_messages_role
        CHECK (role IN ('user', 'assistant', 'system'));
    END IF;
END $$;
