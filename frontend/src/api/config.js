/**
 * Resolve the backend origin for both local development and the deployed app.
 * Vercel should still receive VITE_API_BASE_URL, but the production fallback
 * prevents an empty or malformed Vercel variable from producing requests such
 * as `//api/auth/login`.
 */
export function getApiBase() {
  const configured = String(import.meta.env.VITE_API_BASE_URL || '')
    .trim()
    .replace(/\/+$/, '')

  if (configured) return configured

  return import.meta.env.PROD
    ? 'https://ragvyn-k825.onrender.com'
    : 'http://127.0.0.1:8000'
}
