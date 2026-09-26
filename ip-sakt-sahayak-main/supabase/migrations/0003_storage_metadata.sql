-- ==============================================================================
-- Migration 0003: Storage Metadata & Legal Documents Bucket
-- Database: Supabase PostgreSQL (Public Schema & Storage Schema)
-- Project: RAGVYN AI / IP-SAKTI Sahayak
-- ==============================================================================
-- 1. Creates public.uploaded_documents table referencing Supabase Storage keys.
-- 2. Initializes the private 'legal-documents' storage bucket in Supabase Storage.
-- ==============================================================================

-- 1. Uploaded Documents Table
CREATE TABLE IF NOT EXISTS public.uploaded_documents (
    id VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid()::text,
    user_id VARCHAR(36) NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    matter_id VARCHAR(36) REFERENCES public.matter_workspace(id) ON DELETE SET NULL,
    conversation_id VARCHAR(36) REFERENCES public.conversations(id) ON DELETE SET NULL,
    filename VARCHAR(255) NOT NULL,
    original_filename VARCHAR(255) NOT NULL,
    file_type VARCHAR(50) NOT NULL,
    file_size BIGINT NOT NULL,
    storage_path VARCHAR(500) NOT NULL,
    bucket_name VARCHAR(100) NOT NULL DEFAULT 'legal-documents',
    chunk_count INTEGER DEFAULT 0,
    is_processed BOOLEAN DEFAULT FALSE,
    processing_status VARCHAR(50) DEFAULT 'pending',
    metadata_json TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for Uploaded Documents
CREATE INDEX IF NOT EXISTS idx_uploaded_documents_user_id ON public.uploaded_documents(user_id);
CREATE INDEX IF NOT EXISTS idx_uploaded_documents_matter_id ON public.uploaded_documents(matter_id);
CREATE INDEX IF NOT EXISTS idx_uploaded_documents_conversation_id ON public.uploaded_documents(conversation_id);
CREATE INDEX IF NOT EXISTS idx_uploaded_documents_created_at ON public.uploaded_documents(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_uploaded_documents_storage_path ON public.uploaded_documents(storage_path);

-- 2. Initialize Private 'legal-documents' Bucket in Supabase Storage
-- Safe execution block: only executes if storage.buckets table exists (Supabase environment)
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'storage' AND table_name = 'buckets'
    ) THEN
        INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
        VALUES (
            'legal-documents',
            'legal-documents',
            false,
            10485760, -- 10MB limit
            ARRAY[
                'application/pdf',
                'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                'application/msword',
                'text/plain',
                'image/png',
                'image/jpeg'
            ]
        )
        ON CONFLICT (id) DO UPDATE SET
            public = false,
            file_size_limit = EXCLUDED.file_size_limit,
            allowed_mime_types = EXCLUDED.allowed_mime_types;
    END IF;
END $$;
