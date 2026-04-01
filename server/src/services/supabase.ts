import { createClient } from '@supabase/supabase-js';
import { config } from '../config.js';

// Admin-klient med service role — omgår RLS
export const supabase = createClient(config.SUPABASE_URL, config.SUPABASE_SERVICE_KEY, {
  auth: { persistSession: false },
});
