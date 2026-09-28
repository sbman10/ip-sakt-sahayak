-- ============================================================================
-- Phase 3 Migration: Profiles, Organisations, Membership Identity & RLS
-- Safe, additive migration for IP-SAKTI Sahayak Supabase PostgreSQL.
-- ============================================================================

-- 1. Profiles table
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    full_name TEXT,
    avatar_url TEXT,
    preferred_language TEXT DEFAULT 'en',
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Ensure updated_at trigger for profiles
CREATE OR REPLACE FUNCTION public.set_updated_at_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_set_profiles_updated_at ON public.profiles;
CREATE TRIGGER trigger_set_profiles_updated_at
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW
    EXECUTE FUNCTION public.set_updated_at_timestamp();

-- Auto-provision profile on auth.users creation
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, full_name, preferred_language)
    VALUES (
        NEW.id,
        COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
        COALESCE(NEW.raw_user_meta_data->>'preferred_language', 'en')
    )
    ON CONFLICT (id) DO NOTHING;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger on auth.users insert
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_user();


-- 2. Organisations table
CREATE TABLE IF NOT EXISTS public.organisations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

DROP TRIGGER IF EXISTS trigger_set_organisations_updated_at ON public.organisations;
CREATE TRIGGER trigger_set_organisations_updated_at
    BEFORE UPDATE ON public.organisations
    FOR EACH ROW
    EXECUTE FUNCTION public.set_updated_at_timestamp();


-- 3. Organisation Members table
CREATE TABLE IF NOT EXISTS public.organisation_members (
    organisation_id UUID NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'organisation_admin', 'reviewer', 'super_admin')),
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    PRIMARY KEY (organisation_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_org_members_user ON public.organisation_members(user_id);
CREATE INDEX IF NOT EXISTS idx_organisations_slug ON public.organisations(slug);


-- ============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================================

-- Enable RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organisations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organisation_members ENABLE ROW LEVEL SECURITY;

-- Profiles policies
DROP POLICY IF EXISTS "profiles_select_own" ON public.profiles;
CREATE POLICY "profiles_select_own"
    ON public.profiles
    FOR SELECT
    USING (auth.uid() = id);

DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;
CREATE POLICY "profiles_update_own"
    ON public.profiles
    FOR UPDATE
    USING (auth.uid() = id)
    WITH CHECK (auth.uid() = id);

-- Organisations policies
DROP POLICY IF EXISTS "organisations_select_member" ON public.organisations;
CREATE POLICY "organisations_select_member"
    ON public.organisations
    FOR SELECT
    USING (
        created_by = auth.uid() OR
        EXISTS (
            SELECT 1 FROM public.organisation_members
            WHERE organisation_members.organisation_id = organisations.id
              AND organisation_members.user_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "organisations_insert_auth" ON public.organisations;
CREATE POLICY "organisations_insert_auth"
    ON public.organisations
    FOR INSERT
    WITH CHECK (auth.uid() = created_by);

DROP POLICY IF EXISTS "organisations_update_admin" ON public.organisations;
CREATE POLICY "organisations_update_admin"
    ON public.organisations
    FOR UPDATE
    USING (
        created_by = auth.uid() OR
        EXISTS (
            SELECT 1 FROM public.organisation_members
            WHERE organisation_members.organisation_id = organisations.id
              AND organisation_members.user_id = auth.uid()
              AND organisation_members.role IN ('organisation_admin', 'super_admin')
        )
    );

-- Organisation Members policies
DROP POLICY IF EXISTS "org_members_select_coworker" ON public.organisation_members;
CREATE POLICY "org_members_select_coworker"
    ON public.organisation_members
    FOR SELECT
    USING (
        user_id = auth.uid() OR
        EXISTS (
            SELECT 1 FROM public.organisation_members AS m
            WHERE m.organisation_id = organisation_members.organisation_id
              AND m.user_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "org_members_admin_manage" ON public.organisation_members;
CREATE POLICY "org_members_admin_manage"
    ON public.organisation_members
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.organisation_members AS m
            WHERE m.organisation_id = organisation_members.organisation_id
              AND m.user_id = auth.uid()
              AND m.role IN ('organisation_admin', 'super_admin')
        )
    );
