import { NextRequest, NextResponse } from 'next/server';
import { obtenerCreditos } from '@/lib/credits';

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const userId = searchParams.get('userId');

  if (!userId) {
    return NextResponse.json({ error: 'El parámetro userId es requerido.' }, { status: 400 });
  }

  try {
    const { creditos, isMock } = await obtenerCreditos(userId);
    return NextResponse.json({ credits: creditos, isMock });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Error al obtener créditos.' }, { status: 500 });
  }
}
