import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin, isSupabaseConfigured } from '@/lib/supabase';

// Helper for verifying admin status
async function isAdmin(request: NextRequest) {
  // Check authorization header or rely on session if we pass userId
  const userId = request.headers.get('x-user-id');
  if (!userId) return false;

  if (!isSupabaseConfigured()) {
    return userId === 'dev-user-12345';
  }

  const { data } = await supabaseAdmin
    .from('perfiles')
    .select('is_admin')
    .eq('id', userId)
    .single();
    
  return data?.is_admin === true;
}

export async function GET(request: NextRequest) {
  try {
    const isAdminUser = await isAdmin(request);
    
    if (!isAdminUser) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    }

    if (!isSupabaseConfigured()) {
      // Mock data for development
      return NextResponse.json({
        users: [
          { id: 'dev-user-12345', email: 'admin@dev.local', nombre_completo: 'Dev Admin', creditos_disponibles: 9999, is_admin: true, created_at: new Date().toISOString() },
          { id: 'user-002', email: 'player@example.com', nombre_completo: 'Gamer One', creditos_disponibles: 2, is_admin: false, created_at: new Date().toISOString() }
        ]
      });
    }

    // Fetch all users using Service Role
    const { data: users, error } = await supabaseAdmin
      .from('perfiles')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      throw error;
    }

    return NextResponse.json({ users });
  } catch (error: any) {
    console.error('Error fetching users for admin:', error);
    return NextResponse.json({ error: error.message || 'Error del servidor' }, { status: 500 });
  }
}
