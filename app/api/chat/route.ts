import { NextRequest, NextResponse } from 'next/server';
import { consumirCredito } from '@/lib/credits';

// URL del backend FastAPI RAG Agent
const FASTAPI_URL = process.env.FASTAPI_RAG_URL || 'http://localhost:8000';

interface RAGSource {
  fuente: number;
  title: string;
  url: string;
}

interface RAGResponse {
  query: string;
  respuesta: string;
  fuentes: RAGSource[];
  modo: string;
  iteraciones: number;
  modelo: string;
}

export async function POST(request: NextRequest) {
  try {
    const { userId, message, modo } = await request.json();

    if (!userId || !message) {
      return NextResponse.json(
        { success: false, error: 'Faltan parámetros requeridos (userId, message).' },
        { status: 400 }
      );
    }

    // 1. Validar y descontar un crédito en el backend
    const creditResult = await consumirCredito(userId);

    if (!creditResult.success) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Créditos agotados. Compra más créditos para continuar.',
          creditsRemaining: 0 
        },
        { status: 402 }
      );
    }

    // 2. Llamar al agente FastAPI RAG para obtener una respuesta real con IA
    let ragData: RAGResponse;
    try {
      const ragResponse = await fetch(`${FASTAPI_URL}/api/search`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: message,
          modo: modo || 'completo',
        }),
      });

      if (!ragResponse.ok) {
        const errorBody = await ragResponse.json().catch(() => ({}));
        const detail = errorBody.detail || `Error del agente RAG (HTTP ${ragResponse.status})`;
        throw new Error(detail);
      }

      ragData = await ragResponse.json();
    } catch (fetchError: any) {
      // Si el agente no está disponible, devolver un error claro
      const isConnectionError = fetchError.cause?.code === 'ECONNREFUSED' 
        || fetchError.message?.includes('fetch failed')
        || fetchError.message?.includes('ECONNREFUSED');

      if (isConnectionError) {
        return NextResponse.json({
          success: false,
          error: 'El agente de búsqueda RAG no está disponible. Asegúrate de que el servidor FastAPI esté corriendo en ' + FASTAPI_URL,
          creditsRemaining: creditResult.creditosRestantes,
          isMock: creditResult.isMock,
        }, { status: 503 });
      }

      return NextResponse.json({
        success: false,
        error: `Error del agente RAG: ${fetchError.message}`,
        creditsRemaining: creditResult.creditosRestantes,
        isMock: creditResult.isMock,
      }, { status: 502 });
    }

    // 3. Formatear la respuesta con las fuentes
    const formattedSources = ragData.fuentes.map(f => ({
      id: f.fuente,
      title: f.title,
      url: f.url,
    }));

    // 4. Responder con éxito
    return NextResponse.json({
      success: true,
      response: ragData.respuesta,
      fuentes: formattedSources,
      modo: ragData.modo,
      iteraciones: ragData.iteraciones,
      modelo: ragData.modelo,
      creditsRemaining: creditResult.creditosRestantes,
      isMock: creditResult.isMock,
    });

  } catch (error: any) {
    console.error('Error en API Chat:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Error interno del servidor.' },
      { status: 500 }
    );
  }
}
