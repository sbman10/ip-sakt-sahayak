-- ============================================================================
-- Phase 6 Migration: Canonical Identity Schema Fix (RLS Dependency Safe)
-- Resolves psycopg "operator does not exist: uuid = character varying" mismatch
-- by standardizing tenancy and identity columns to VARCHAR(36) referencing public.users(id).
-- ============================================================================

BEGIN;

-- ============================================================================
-- STEP 1: DROP ALL DEPENDENT RLS POLICIES (PHASE 3 & PHASE 4)
-- ============================================================================

-- A. Conversations Policies
DROP POLICY IF EXISTS "conversations_tenant_isolation_select" ON public.conversations;
DROP POLICY IF EXISTS "conversations_tenant_isolation_insert" ON public.conversations;
DROP POLICY IF EXISTS "conversations_tenant_isolation_update" ON public.conversations;
DROP POLICY IF EXISTS "conversations_tenant_isolation_delete" ON public.conversations;

-- B. Uploaded Documents Policies
DROP POLICY IF EXISTS "uploaded_documents_tenant_isolation_select" ON public.uploaded_documents;
DROP POLICY IF EXISTS "uploaded_documents_tenant_isolation_insert" ON public.uploaded_documents;
DROP POLICY IF EXISTS "uploaded_documents_tenant_isolation_delete" ON public.uploaded_documents;

-- C. Matter Workspace Policies
DROP POLICY IF EXISTS "matters_tenant_isolation_select" ON public.matter_workspace;
DROP POLICY IF EXISTS "matters_tenant_isolation_modify" ON public.matter_workspace;

-- D. Organisations, Members, and Profiles Policies
DROP POLICY IF EXISTS "profiles_select_own" ON public.profiles;
DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;
DROP POLICY IF EXISTS "organisations_select_member" ON public.organisations;
DROP POLICY IF EXISTS "organisations_insert_auth" ON public.organisations;
DROP POLICY IF EXISTS "organisations_update_admin" ON public.organisations;
DROP POLICY IF EXISTS "org_members_select_coworker" ON public.organisation_members;
DROP POLICY IF EXISTS "org_members_admin_manage" ON public.organisation_members;


-- ============================================================================
-- STEP 2: DROP FOREIGN KEYS AND PRIMARY KEYS
-- ============================================================================

-- Dependent table FKs
ALTER TABLE IF EXISTS public.conversations 
    DROP CONSTRAINT IF EXISTS conversations_organisation_id_fkey;

ALTER TABLE IF EXISTS public.uploaded_documents 
    DROP CONSTRAINT IF EXISTS uploaded_documents_organisation_id_fkey;

ALTER TABLE IF EXISTS public.matter_workspace 
    DROP CONSTRAINT IF EXISTS matter_workspace_organisation_id_fkey;

ALTER TABLE IF EXISTS public.audit_logs 
    DROP CONSTRAINT IF EXISTS audit_logs_organisation_id_fkey;

ALTER TABLE IF EXISTS public.patentability_assessments 
    DROP CONSTRAINT IF EXISTS patentability_assessments_organisation_id_fkey;

-- Phase 3 table constraints
ALTER TABLE IF EXISTS public.organisation_members 
    DROP CONSTRAINT IF EXISTS organisation_members_pkey,
    DROP CONSTRAINT IF EXISTS organisation_members_organisation_id_fkey,
    DROP CONSTRAINT IF EXISTS organisation_members_user_id_fkey;

ALTER TABLE IF EXISTS public.organisations 
    DROP CONSTRAINT IF EXISTS organisations_pkey,
    DROP CONSTRAINT IF EXISTS organisations_created_by_fkey;

ALTER TABLE IF EXISTS public.profiles 
    DROP CONSTRAINT IF EXISTS profiles_pkey,
    DROP CONSTRAINT IF EXISTS profiles_id_fkey;


-- ============================================================================
-- STEP 3: ALTER COLUMN TYPES TO VARCHAR(36)
-- ============================================================================

-- Clean up any unlinked profile row before adding the foreign key to public.users
DELETE FROM public.profiles 
WHERE id::text NOT IN (SELECT id FROM public.users);

-- Profiles
ALTER TABLE public.profiles 
    ALTER COLUMN id TYPE VARCHAR(36) USING id::text;

-- Organisations
ALTER TABLE public.organisations 
    ALTER COLUMN id TYPE VARCHAR(36) USING id::text,
    ALTER COLUMN id SET DEFAULT gen_random_uuid()::text,
    ALTER COLUMN created_by TYPE VARCHAR(36) USING created_by::text;

-- Organisation Members
ALTER TABLE public.organisation_members 
    ALTER COLUMN organisation_id TYPE VARCHAR(36) USING organisation_id::text,
    ALTER COLUMN user_id TYPE VARCHAR(36) USING user_id::text;

-- Business Tables (conversations, uploaded_documents, matter_workspace, etc.)
ALTER TABLE public.conversations 
    ALTER COLUMN organisation_id TYPE VARCHAR(36) USING organisation_id::text;

ALTER TABLE public.uploaded_documents 
    ALTER COLUMN organisation_id TYPE VARCHAR(36) USING organisation_id::text;

ALTER TABLE public.matter_workspace 
    ALTER COLUMN organisation_id TYPE VARCHAR(36) USING organisation_id::text;

ALTER TABLE public.audit_logs 
    ALTER COLUMN organisation_id TYPE VARCHAR(36) USING organisation_id::text;

ALTER TABLE public.patentability_assessments 
    ALTER COLUMN organisation_id TYPE VARCHAR(36) USING organisation_id::text;


-- ============================================================================
-- STEP 4: RE-CREATE PRIMARY KEYS
-- ============================================================================

ALTER TABLE public.profiles 
    ADD CONSTRAINT profiles_pkey PRIMARY KEY (id);

ALTER TABLE public.organisations 
    ADD CONSTRAINT organisations_pkey PRIMARY KEY (id);

ALTER TABLE public.organisation_members 
    ADD CONSTRAINT organisation_members_pkey PRIMARY KEY (organisation_id, user_id);


-- ============================================================================
-- STEP 5: RE-CREATE FOREIGN KEYS (ANCHORED TO public.users AND public.organisations)
-- ============================================================================

ALTER TABLE public.profiles 
    ADD CONSTRAINT profiles_id_fkey 
    FOREIGN KEY (id) REFERENCES public.users(id) ON DELETE CASCADE;

ALTER TABLE public.organisations 
    ADD CONSTRAINT organisations_created_by_fkey 
    FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE CASCADE;

ALTER TABLE public.organisation_members 
    ADD CONSTRAINT organisation_members_organisation_id_fkey 
    FOREIGN KEY (organisation_id) REFERENCES public.organisations(id) ON DELETE CASCADE,
    ADD CONSTRAINT organisation_members_user_id_fkey 
    FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;

ALTER TABLE public.conversations 
    ADD CONSTRAINT conversations_organisation_id_fkey 
    FOREIGN KEY (organisation_id) REFERENCES public.organisations(id) ON DELETE CASCADE;

ALTER TABLE public.uploaded_documents 
    ADD CONSTRAINT uploaded_documents_organisation_id_fkey 
    FOREIGN KEY (organisation_id) REFERENCES public.organisations(id) ON DELETE CASCADE;

ALTER TABLE public.matter_workspace 
    ADD CONSTRAINT matter_workspace_organisation_id_fkey 
    FOREIGN KEY (organisation_id) REFERENCES public.organisations(id) ON DELETE CASCADE;

ALTER TABLE public.audit_logs 
    ADD CONSTRAINT audit_logs_organisation_id_fkey 
    FOREIGN KEY (organisation_id) REFERENCES public.organisations(id) ON DELETE SET NULL;

ALTER TABLE public.patentability_assessments 
    ADD CONSTRAINT patentability_assessments_organisation_id_fkey 
    FOREIGN KEY (organisation_id) REFERENCES public.organisations(id) ON DELETE CASCADE;


-- ============================================================================
-- STEP 6: RE-CREATE INDEXES
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_org_members_user ON public.organisation_members(user_id);
CREATE INDEX IF NOT EXISTS idx_organisations_created_by ON public.organisations(created_by);
CREATE INDEX IF NOT EXISTS idx_conversations_org_id ON public.conversations(organisation_id);
CREATE INDEX IF NOT EXISTS idx_uploaded_docs_org_id ON public.uploaded_documents(organisation_id);
CREATE INDEX IF NOT EXISTS idx_matter_workspace_org_id ON public.matter_workspace(organisation_id);


-- ============================================================================
-- STEP 7: RE-CREATE ALL RLS POLICIES (WITH BULLETPROOF ::text CASTS)
-- ============================================================================

-- Profiles Policies
CREATE POLICY "profiles_select_own"
    ON public.profiles FOR SELECT
    USING ((id)::text = (auth.uid())::text);

CREATE POLICY "profiles_update_own"
    ON public.profiles FOR UPDATE
    USING ((id)::text = (auth.uid())::text)
    WITH CHECK ((id)::text = (auth.uid())::text);

-- Organisations Policies
CREATE POLICY "organisations_select_member"
    ON public.organisations FOR SELECT
    USING (
        (created_by)::text = (auth.uid())::text OR
        EXISTS (
            SELECT 1 FROM public.organisation_members
            WHERE (organisation_members.organisation_id)::text = (organisations.id)::text
              AND (organisation_members.user_id)::text = (auth.uid())::text
        )
    );

CREATE POLICY "organisations_insert_auth"
    ON public.organisations FOR INSERT
    WITH CHECK ((created_by)::text = (auth.uid())::text);

CREATE POLICY "organisations_update_admin"
    ON public.organisations FOR UPDATE
    USING (
        (created_by)::text = (auth.uid())::text OR
        EXISTS (
            SELECT 1 FROM public.organisation_members
            WHERE (organisation_members.organisation_id)::text = (organisations.id)::text
              AND (organisation_members.user_id)::text = (auth.uid())::text
              AND organisation_members.role IN ('organisation_admin', 'super_admin')
        )
    );

-- Organisation Members Policies
CREATE POLICY "org_members_select_coworker"
    ON public.organisation_members FOR SELECT
    USING (
        (user_id)::text = (auth.uid())::text OR
        EXISTS (
            SELECT 1 FROM public.organisation_members AS m
            WHERE (m.organisation_id)::text = (organisation_members.organisation_id)::text
              AND (m.user_id)::text = (auth.uid())::text
        )
    );

CREATE POLICY "org_members_admin_manage"
    ON public.organisation_members FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.organisation_members AS m
            WHERE (m.organisation_id)::text = (organisation_members.organisation_id)::text
              AND (m.user_id)::text = (auth.uid())::text
              AND m.role IN ('organisation_admin', 'super_admin')
        )
    );

-- Conversations Policies
CREATE POLICY "conversations_tenant_isolation_select"
    ON public.conversations FOR SELECT
    USING (
        (user_id)::text = (auth.uid())::text OR
        (organisation_id IS NOT NULL AND EXISTS (
            SELECT 1 FROM public.organisation_members
            WHERE (organisation_members.organisation_id)::text = (conversations.organisation_id)::text
              AND (organisation_members.user_id)::text = (auth.uid())::text
        ))
    );

CREATE POLICY "conversations_tenant_isolation_insert"
    ON public.conversations FOR INSERT
    WITH CHECK (
        (user_id IS NULL OR (user_id)::text = (auth.uid())::text) AND
        (organisation_id IS NULL OR EXISTS (
            SELECT 1 FROM public.organisation_members
            WHERE (organisation_members.organisation_id)::text = (conversations.organisation_id)::text
              AND (organisation_members.user_id)::text = (auth.uid())::text
        ))
    );

CREATE POLICY "conversations_tenant_isolation_update"
    ON public.conversations FOR UPDATE
    USING (
        (user_id)::text = (auth.uid())::text OR
        (organisation_id IS NOT NULL AND EXISTS (
            SELECT 1 FROM public.organisation_members
            WHERE (organisation_members.organisation_id)::text = (conversations.organisation_id)::text
              AND (organisation_members.user_id)::text = (auth.uid())::text
              AND organisation_members.role IN ('organisation_admin', 'reviewer', 'super_admin')
        ))
    );

CREATE POLICY "conversations_tenant_isolation_delete"
    ON public.conversations FOR DELETE
    USING (
        (user_id)::text = (auth.uid())::text OR
        (organisation_id IS NOT NULL AND EXISTS (
            SELECT 1 FROM public.organisation_members
            WHERE (organisation_members.organisation_id)::text = (conversations.organisation_id)::text
              AND (organisation_members.user_id)::text = (auth.uid())::text
              AND organisation_members.role IN ('organisation_admin', 'super_admin')
        ))
    );

-- Uploaded Documents Policies
CREATE POLICY "uploaded_documents_tenant_isolation_select"
    ON public.uploaded_documents FOR SELECT
    USING (
        (user_id)::text = (auth.uid())::text OR
        (organisation_id IS NOT NULL AND EXISTS (
            SELECT 1 FROM public.organisation_members
            WHERE (organisation_members.organisation_id)::text = (uploaded_documents.organisation_id)::text
              AND (organisation_members.user_id)::text = (auth.uid())::text
        ))
    );

CREATE POLICY "uploaded_documents_tenant_isolation_insert"
    ON public.uploaded_documents FOR INSERT
    WITH CHECK (
        (user_id)::text = (auth.uid())::text AND
        (organisation_id IS NULL OR EXISTS (
            SELECT 1 FROM public.organisation_members
            WHERE (organisation_members.organisation_id)::text = (uploaded_documents.organisation_id)::text
              AND (organisation_members.user_id)::text = (auth.uid())::text
        ))
    );

CREATE POLICY "uploaded_documents_tenant_isolation_delete"
    ON public.uploaded_documents FOR DELETE
    USING (
        (user_id)::text = (auth.uid())::text OR
        (organisation_id IS NOT NULL AND EXISTS (
            SELECT 1 FROM public.organisation_members
            WHERE (organisation_members.organisation_id)::text = (uploaded_documents.organisation_id)::text
              AND (organisation_members.user_id)::text = (auth.uid())::text
              AND organisation_members.role IN ('organisation_admin', 'super_admin')
        ))
    );

-- Matter Workspace Policies
CREATE POLICY "matters_tenant_isolation_select"
    ON public.matter_workspace FOR SELECT
    USING (
        (user_id)::text = (auth.uid())::text OR
        (organisation_id IS NOT NULL AND EXISTS (
            SELECT 1 FROM public.organisation_members
            WHERE (organisation_members.organisation_id)::text = (matter_workspace.organisation_id)::text
              AND (organisation_members.user_id)::text = (auth.uid())::text
        ))
    );

CREATE POLICY "matters_tenant_isolation_modify"
    ON public.matter_workspace FOR ALL
    USING (
        (user_id)::text = (auth.uid())::text OR
        (organisation_id IS NOT NULL AND EXISTS (
            SELECT 1 FROM public.organisation_members
            WHERE (organisation_members.organisation_id)::text = (matter_workspace.organisation_id)::text
              AND (organisation_members.user_id)::text = (auth.uid())::text
              AND organisation_members.role IN ('organisation_admin', 'reviewer', 'super_admin')
        ))
    );


-- ============================================================================
-- STEP 8: UPDATE SUPABASE AUTH USER PROVISIONING TRIGGER
-- ============================================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.users (id, email, password_hash, full_name, role, is_active, is_verified)
    VALUES (
        NEW.id::text,
        NEW.email,
        '',
        COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
        'user',
        TRUE,
        TRUE
    )
    ON CONFLICT (id) DO NOTHING;

    INSERT INTO public.profiles (id, full_name, preferred_language)
    VALUES (
        NEW.id::text,
        COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
        COALESCE(NEW.raw_user_meta_data->>'preferred_language', 'en')
    )
    ON CONFLICT (id) DO NOTHING;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMIT;
