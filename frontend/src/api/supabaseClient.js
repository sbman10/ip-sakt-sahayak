/**
 * frontend/src/api/supabaseClient.js
 * -----------------------------------
 * Consolidated Supabase browser client for IP-SAKTI Sahayak.
 * Strictly uses frontend-safe environment variables:
 * - VITE_SUPABASE_URL
 * - VITE_SUPABASE_ANON_KEY
 * - VITE_SITE_URL
 */

import { createClient } from '@supabase/supabase-js'

const supabaseUrl = (
  import.meta.env.VITE_SUPABASE_URL ||
  'https://dvutvnmskqcrvsjtufwm.supabase.co'
).trim()

const supabaseAnonKey = (
  import.meta.env.VITE_SUPABASE_ANON_KEY ||
  ''
).trim()

export const siteUrl = (
  import.meta.env.VITE_SITE_URL ||
  (typeof window !== 'undefined' ? window.location.origin : 'https://ragvynai.vercel.app')
).trim().replace(/\/+$/, '')

if (!supabaseAnonKey && typeof window !== 'undefined') {
  console.warn(
    '[SupabaseClient] VITE_SUPABASE_ANON_KEY is not set. Set it in your environment or Vercel dashboard.'
  )
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey || 'placeholder-anon-key', {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storage: typeof window !== 'undefined' ? window.localStorage : undefined,
  },
})

export default supabase
