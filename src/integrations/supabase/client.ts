import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  throw new Error('Missing Supabase environment variables');
}

// Main client - supports auth for admin operations
export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY);

// Public client - no auth persistence, won't hang waiting for session restoration
// Use this for public reads (apps list, feedback, comments, votes)
export const publicSupabase = createClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
    detectSessionInUrl: false,
    storageKey: 'public-supabase-auth', // Different key to avoid GoTrueClient conflicts
  },
});
