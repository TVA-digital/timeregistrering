import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Mangler VITE_SUPABASE_URL eller VITE_SUPABASE_ANON_KEY i .env');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
