import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !supabaseAnonKey || supabaseUrl === 'seu_projeto_aqui') {
  console.warn("Supabase: Variáveis de ambiente faltando ou inválidas!");
}

// Ensure createClient is called with something, even if empty, but we'll try to prevent crash
// In some versions of supabase-js, empty URL throws.
export const supabase = (supabaseUrl && supabaseUrl !== 'seu_projeto_aqui')
  ? createClient(supabaseUrl, supabaseAnonKey)
  : new Proxy({} as ReturnType<typeof createClient>, {
      get() {
        throw new Error(
          'Supabase não configurado. Defina VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY no arquivo .env'
        );
      }
    });
