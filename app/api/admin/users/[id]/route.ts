import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin, isSupabaseConfigured } from '@/lib/supabase';

// Helper for verifying admin status
async function isAdmin(request: NextRequest) {
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

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const isAdminUser = await isAdmin(request);
    
    if (!isAdminUser) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    }

    const { id } = await params;
    const body = await request.json();

    if (!isSupabaseConfigured()) {
      return NextResponse.json({ success: true, message: 'Usuario actualizado en modo simulado' });
    }

    // Only allow updating certain fields
    const allowedUpdates: any = {};
    if (body.creditos_disponibles !== undefined) allowedUpdates.creditos_disponibles = body.creditos_disponibles;
    if (body.is_admin !== undefined) allowedUpdates.is_admin = body.is_admin;

    const { error } = await supabaseAdmin
      .from('perfiles')
      .update(allowedUpdates)
      .eq('id', id);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error updating user for admin:', error);
    return NextResponse.json({ error: error.message || 'Error del servidor' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const isAdminUser = await isAdmin(request);
    
    if (!isAdminUser) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    }

    const { id } = await params;

    if (!isSupabaseConfigured()) {
      return NextResponse.json({ success: true, message: 'Usuario eliminado en modo simulado' });
    }

    // Deleting from auth.users automatically cascades to perfiles due to our schema
    const { error } = await supabaseAdmin.auth.admin.deleteUser(id);

    if (error) {
       // Si falla borrarlo de auth.users, intentamos borrarlo de perfiles manualmente por si acaso
       await supabaseAdmin.from('perfiles').delete().eq('id', id);
       throw error;
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error deleting user for admin:', error);
    return NextResponse.json({ error: error.message || 'Error del servidor' }, { status: 500 });
  }
}
