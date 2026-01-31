import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';

const SUPABASE_URL = 'https://REDACTED.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_REDACTED';

export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY);
