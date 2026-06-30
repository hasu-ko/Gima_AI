import { supabaseAdmin, isSupabaseConfigured } from './supabase';

// Estado en memoria para simular créditos en desarrollo si no hay tokens de Supabase configurados.
// Se reinicia cada vez que el servidor de Next.js se reinicia.
let MOCK_CREDITS_DATABASE: Record<string, number> = {};

export interface ConsumirCreditoResult {
  success: boolean;
  creditosRestantes: number;
  error?: string;
  isMock?: boolean;
}

/**
 * Verifica y consume 1 crédito del usuario de manera segura.
 * Si Supabase está configurado, utiliza el procedimiento almacenado (RPC) de la BD.
 * Si no está configurado (modo desarrollo local sin tokens), simula el consumo en memoria.
 * 
 * @param userId ID del usuario (UUID de Supabase Auth o un string identificador)
 * @returns Promesa con el resultado de la transacción
 */
export async function consumirCredito(userId: string): Promise<ConsumirCreditoResult> {
  // --- MODO DESARROLLO SIN TOKENS ---
  if (!isSupabaseConfigured()) {
    // Inicializar créditos para el usuario ficticio si no existe (5 créditos por defecto)
    if (MOCK_CREDITS_DATABASE[userId] === undefined) {
      MOCK_CREDITS_DATABASE[userId] = 5;
    }

    const creditosActuales = MOCK_CREDITS_DATABASE[userId];

    if (creditosActuales > 0) {
      MOCK_CREDITS_DATABASE[userId] = creditosActuales - 1;
      return {
        success: true,
        creditosRestantes: MOCK_CREDITS_DATABASE[userId],
        isMock: true,
      };
    } else {
      return {
        success: false,
        creditosRestantes: 0,
        isMock: true,
      };
    }
  }

  // --- MODO PRODUCCIÓN / DESARROLLO CON SUPABASE REAL ---
  try {
    // Invocamos la función RPC 'consumir_credito' que creamos en schema.sql
    // Usamos supabaseAdmin (Service Role) para saltarnos el RLS y permitir la actualización desde backend.
    const { data, error } = await supabaseAdmin.rpc('consumir_credito', {
      user_id: userId,
    });

    if (error) {
      console.error('Error al consumir créditos en Supabase:', error);
      return {
        success: false,
        creditosRestantes: 0,
        error: error.message,
      };
    }

    // data es devuelto como un array debido a RETURNS TABLE en PostgreSQL.
    // data[0] = { exito: boolean, creditos_restantes: number }
    if (data && data.length > 0) {
      return {
        success: data[0].exito,
        creditosRestantes: data[0].creditos_restantes,
        isMock: false,
      };
    }

    return {
      success: false,
      creditosRestantes: 0,
      error: 'No se recibieron datos de la base de datos.',
    };
  } catch (err: any) {
    console.error('Error de red/servidor al consumir créditos:', err);
    return {
      success: false,
      creditosRestantes: 0,
      error: err.message || 'Error desconocido del servidor.',
    };
  }
}

/**
 * Obtiene los créditos disponibles de un usuario.
 * Soporta modo real (Supabase) y simulado.
 */
export async function obtenerCreditos(userId: string): Promise<{ creditos: number; isMock: boolean }> {
  if (!isSupabaseConfigured()) {
    if (MOCK_CREDITS_DATABASE[userId] === undefined) {
      MOCK_CREDITS_DATABASE[userId] = 5;
    }
    return {
      creditos: MOCK_CREDITS_DATABASE[userId],
      isMock: true,
    };
  }

  try {
    const { data, error } = await supabaseAdmin
      .from('perfiles')
      .select('creditos_disponibles')
      .eq('id', userId)
      .single();

    if (error) {
      console.error('Error al obtener créditos en Supabase:', error);
      return { creditos: 0, isMock: false };
    }

    return {
      creditos: data?.creditos_disponibles ?? 0,
      isMock: false,
    };
  } catch {
    return { creditos: 0, isMock: false };
  }
}

/**
 * Resetea o recarga los créditos de un usuario (para desarrollo/pruebas).
 */
export async function recargarCreditos(userId: string, cantidad = 5): Promise<void> {
  if (!isSupabaseConfigured()) {
    MOCK_CREDITS_DATABASE[userId] = cantidad;
    return;
  }

  await supabaseAdmin
    .from('perfiles')
    .update({ creditos_disponibles: cantidad })
    .eq('id', userId);
}
