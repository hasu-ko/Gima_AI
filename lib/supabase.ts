import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder-project.supabase.co';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.placeholder-anon-key';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.placeholder-service-key';

// Cliente público para usar en componentes del lado del cliente
export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Cliente administrador para usar EXCLUSIVAMENTE en el servidor (Route Handlers, Server Actions)
// Este cliente tiene permisos de Service Role y puede hacer bypass de las reglas RLS de la base de datos
export const supabaseAdmin = typeof window === 'undefined'
  ? createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    })
  : null as any;

// Helper para comprobar si las credenciales de Supabase son las reales o son placeholders
export const isSupabaseConfigured = () => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  
  const isUrlPlaceholder = !url || 
    url === 'https://placeholder-project.supabase.co' || 
    url.includes('placeholder');
    
  const isAnonPlaceholder = !anonKey || 
    anonKey === 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.placeholder-anon-key' || 
    anonKey.includes('placeholder');

  if (isUrlPlaceholder || isAnonPlaceholder) {
    return false;
  }

  // Si estamos en el servidor (Route Handlers, Server Actions, etc.), también validamos la key del service role
  if (typeof window === 'undefined') {
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const isServicePlaceholder = !serviceKey || 
      serviceKey === 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.placeholder-service-key' || 
      serviceKey.includes('placeholder');
      
    if (isServicePlaceholder) {
      return false;
    }
  }

  return true;
};
