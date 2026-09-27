-- ============================================================================
-- Phase 4 Migration: Tenant and Document Isolation & RLS
-- Safe, additive migration for IP-SAKTI Sahayak Supabase PostgreSQL.
-- ============================================================================

-- 1. Conversations: Add organisation_id and tenant indexes
ALTER TABLE public.conversations 
    ADD COLUMN IF NOT EXISTS organisation_id UUID REFERENCES public.organisations(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_conversations_org_id ON public.conversations(organisation_id);
CREATE INDEX IF NOT EXISTS idx_conversations_user_id ON public.conversations(user_id);


-- 2. Uploaded Documents: Add organisation_id and tenant indexes
ALTER TABLE public.uploaded_documents 
    ADD COLUMN IF NOT EXISTS organisation_id UUID REFERENCES public.organisations(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_uploaded_docs_org_id ON public.uploaded_documents(organisation_id);
CREATE INDEX IF NOT EXISTS idx_uploaded_docs_user_id ON public.uploaded_documents(user_id);


-- 3. Matter Workspace: Add organisation_id and tenant indexes
ALTER TABLE public.matter_workspace 
    ADD COLUMN IF NOT EXISTS organisation_id UUID REFERENCES public.organisations(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_matter_workspace_org_id ON public.matter_workspace(organisation_id);


-- 4. Audit Logs: Add user_id and organisation_id telemetry columns
ALTER TABLE public.audit_logs 
    ADD COLUMN IF NOT EXISTS user_id VARCHAR(36);

ALTER TABLE public.audit_logs 
    ADD COLUMN IF NOT EXISTS organisation_id UUID REFERENCES public.organisations(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON public.audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_org_id ON public.audit_logs(organisation_id);


-- 5. Patentability Assessments: Add organisation_id and tenant indexes
ALTER TABLE public.patentability_assessments 
    ADD COLUMN IF NOT EXISTS organisation_id UUID REFERENCES public.organisations(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_patentability_org_id ON public.patentability_assessments(organisation_id);


-- ============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES FOR TENANT DATA
-- Bulletproof type-casting: casts both sides of every ID equality comparison
-- to ::text to seamlessly handle VARCHAR, TEXT, or UUID across all schemas.
-- ============================================================================

-- Conversations RLS
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "conversations_tenant_isolation_select" ON public.conversations;
CREATE POLICY "conversations_tenant_isolation_select"
    ON public.conversations
    FOR SELECT
    USING (
        (user_id)::text = (auth.uid())::text OR
        (organisation_id IS NOT NULL AND EXISTS (
            SELECT 1 FROM public.organisation_members
            WHERE (organisation_members.organisation_id)::text = (conversations.organisation_id)::text
              AND (organisation_members.user_id)::text = (auth.uid())::text
        ))
    );

DROP POLICY IF EXISTS "conversations_tenant_isolation_insert" ON public.conversations;
CREATE POLICY "conversations_tenant_isolation_insert"
    ON public.conversations
    FOR INSERT
    WITH CHECK (
        (user_id IS NULL OR (user_id)::text = (auth.uid())::text) AND
        (organisation_id IS NULL OR EXISTS (
            SELECT 1 FROM public.organisation_members
            WHERE (organisation_members.organisation_id)::text = (conversations.organisation_id)::text
              AND (organisation_members.user_id)::text = (auth.uid())::text
        ))
    );

DROP POLICY IF EXISTS "conversations_tenant_isolation_update" ON public.conversations;
CREATE POLICY "conversations_tenant_isolation_update"
    ON public.conversations
    FOR UPDATE
    USING (
        (user_id)::text = (auth.uid())::text OR
        (organisation_id IS NOT NULL AND EXISTS (
            SELECT 1 FROM public.organisation_members
            WHERE (organisation_members.organisation_id)::text = (conversations.organisation_id)::text
              AND (organisation_members.user_id)::text = (auth.uid())::text
              AND organisation_members.role IN ('organisation_admin', 'reviewer', 'super_admin')
        ))
    );

DROP POLICY IF EXISTS "conversations_tenant_isolation_delete" ON public.conversations;
CREATE POLICY "conversations_tenant_isolation_delete"
    ON public.conversations
    FOR DELETE
    USING (
        (user_id)::text = (auth.uid())::text OR
        (organisation_id IS NOT NULL AND EXISTS (
            SELECT 1 FROM public.organisation_members
            WHERE (organisation_members.organisation_id)::text = (conversations.organisation_id)::text
              AND (organisation_members.user_id)::text = (auth.uid())::text
              AND organisation_members.role IN ('organisation_admin', 'super_admin')
        ))
    );


-- Uploaded Documents RLS
ALTER TABLE public.uploaded_documents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "uploaded_documents_tenant_isolation_select" ON public.uploaded_documents;
CREATE POLICY "uploaded_documents_tenant_isolation_select"
    ON public.uploaded_documents
    FOR SELECT
    USING (
        (user_id)::text = (auth.uid())::text OR
        (organisation_id IS NOT NULL AND EXISTS (
            SELECT 1 FROM public.organisation_members
            WHERE (organisation_members.organisation_id)::text = (uploaded_documents.organisation_id)::text
              AND (organisation_members.user_id)::text = (auth.uid())::text
        ))
    );

DROP POLICY IF EXISTS "uploaded_documents_tenant_isolation_insert" ON public.uploaded_documents;
CREATE POLICY "uploaded_documents_tenant_isolation_insert"
    ON public.uploaded_documents
    FOR INSERT
    WITH CHECK (
        (user_id)::text = (auth.uid())::text AND
        (organisation_id IS NULL OR EXISTS (
            SELECT 1 FROM public.organisation_members
            WHERE (organisation_members.organisation_id)::text = (uploaded_documents.organisation_id)::text
              AND (organisation_members.user_id)::text = (auth.uid())::text
        ))
    );

DROP POLICY IF EXISTS "uploaded_documents_tenant_isolation_delete" ON public.uploaded_documents;
CREATE POLICY "uploaded_documents_tenant_isolation_delete"
    ON public.uploaded_documents
    FOR DELETE
    USING (
        (user_id)::text = (auth.uid())::text OR
        (organisation_id IS NOT NULL AND EXISTS (
            SELECT 1 FROM public.organisation_members
            WHERE (organisation_members.organisation_id)::text = (uploaded_documents.organisation_id)::text
              AND (organisation_members.user_id)::text = (auth.uid())::text
              AND organisation_members.role IN ('organisation_admin', 'super_admin')
        ))
    );


-- Matter Workspace RLS
ALTER TABLE public.matter_workspace ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "matters_tenant_isolation_select" ON public.matter_workspace;
CREATE POLICY "matters_tenant_isolation_select"
    ON public.matter_workspace
    FOR SELECT
    USING (
        (user_id)::text = (auth.uid())::text OR
        (organisation_id IS NOT NULL AND EXISTS (
            SELECT 1 FROM public.organisation_members
            WHERE (organisation_members.organisation_id)::text = (matter_workspace.organisation_id)::text
              AND (organisation_members.user_id)::text = (auth.uid())::text
        ))
    );

DROP POLICY IF EXISTS "matters_tenant_isolation_modify" ON public.matter_workspace;
CREATE POLICY "matters_tenant_isolation_modify"
    ON public.matter_workspace
    FOR ALL
    USING (
        (user_id)::text = (auth.uid())::text OR
        (organisation_id IS NOT NULL AND EXISTS (
            SELECT 1 FROM public.organisation_members
            WHERE (organisation_members.organisation_id)::text = (matter_workspace.organisation_id)::text
              AND (organisation_members.user_id)::text = (auth.uid())::text
              AND organisation_members.role IN ('organisation_admin', 'reviewer', 'super_admin')
        ))
    );


