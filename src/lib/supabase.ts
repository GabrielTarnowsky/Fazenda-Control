import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey || supabaseUrl === 'seu_projeto_aqui') {
  console.warn("Supabase URL ou Anon Key não configurados no arquivo .env");
}

export const supabase = createClient(supabaseUrl || '', supabaseAnonKey || '');
