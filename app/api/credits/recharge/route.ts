import { NextRequest, NextResponse } from 'next/server';
import { recargarCreditos, obtenerCreditos } from '@/lib/credits';

export async function POST(request: NextRequest) {
  try {
    const { userId, amount } = await request.json();

    if (!userId) {
      return NextResponse.json({ error: 'userId es requerido.' }, { status: 400 });
    }

    // Recargar créditos
    await recargarCreditos(userId, amount ?? 5);

    // Obtener créditos actualizados
    const { creditos, isMock } = await obtenerCreditos(userId);

    return NextResponse.json({ success: true, credits: creditos, isMock });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Error al recargar créditos.' }, { status: 500 });
  }
}
