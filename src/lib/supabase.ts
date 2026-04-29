/**
 * Shared Supabase Client (AUTH-002)
 *
 * Single Supabase client instance used by both:
 * - AuthContext (user authentication)
 * - useSupabaseOAuth (backend creation OAuth)
 *
 * ## Security Architecture
 *
 * - **persistSession: true** — Sessions persist in localStorage across tab closes.
 *   This is the standard tradeoff for auth UX: localStorage tokens are accessible
 *   to XSS, but the alternative (persistSession: false) forces re-login on every
 *   tab close, which is unacceptable for a user-facing app.
 * - **autoRefreshToken: true** — SDK handles silent token refresh automatically.
 * - **detectSessionInUrl: true** — SDK auto-detects OAuth callback tokens in URL hash.
 *
 * @module lib/supabase
 */

import { createClient } from '@supabase/supabase-js';

export const supabaseClient = createClient(
  import.meta.env.VITE_SUPABASE_URL || '',
  import.meta.env.VITE_SUPABASE_ANON_KEY || '',
  {
    auth: {
      persistSession: true, // localStorage — sessions survive tab close (AUTH-003)
      autoRefreshToken: true, // SDK handles silent token refresh
      detectSessionInUrl: true, // Auto-detect OAuth callback tokens in URL hash
    },
  }
);

export default supabaseClient;
