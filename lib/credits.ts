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
      // PGRST116 significa que no se encontró ninguna fila para ese id en public.perfiles
      if (error.code === 'PGRST116') {
        console.log(`[Credits] El perfil de usuario ${userId} no existe en la tabla perfiles. Creando perfil automático...`);
        
        // 1. Obtener los metadatos de usuario desde auth.users
        const { data: authData, error: authError } = await supabaseAdmin.auth.admin.getUserById(userId);
        
        if (authError || !authData?.user) {
          console.error('Error al obtener usuario de Auth para auto-crear perfil:', authError);
          return { creditos: 0, isMock: false };
        }

        const email = authData.user.email || '';
        const name = authData.user.user_metadata?.nombre_completo || email.split('@')[0] || 'Viajero';
        const birthDate = authData.user.user_metadata?.fecha_nacimiento || null;

        // 2. Insertar fila en perfiles con 5 créditos iniciales
        const { data: newProfile, error: insertError } = await supabaseAdmin
          .from('perfiles')
          .insert({
            id: userId,
            email,
            nombre_completo: name,
            fecha_nacimiento: birthDate,
            creditos_disponibles: 5
          })
          .select('creditos_disponibles')
          .single();

        if (insertError) {
          console.error('Error al auto-crear perfil en Supabase:', insertError);
          if (insertError.code === '42P01') {
            console.error('⚠️ ALERTA DE CONFIGURACIÓN: La tabla "public.perfiles" no existe en Supabase. Por favor, copia y pega el archivo "schema.sql" en el SQL Editor de tu panel de Supabase.');
          }
          if (insertError.code === 'PGRST204' || insertError.message?.includes('fecha_nacimiento') || insertError.message?.includes('nombre_completo')) {
            console.error('⚠️ ALERTA DE CONFIGURACIÓN: Faltan las columnas "nombre_completo" y/o "fecha_nacimiento" en tu tabla "perfiles" en Supabase.\n\nEjecuta las siguientes consultas SQL en el SQL Editor de tu panel de Supabase:\n\nALTER TABLE public.perfiles ADD COLUMN IF NOT EXISTS nombre_completo TEXT;\nALTER TABLE public.perfiles ADD COLUMN IF NOT EXISTS fecha_nacimiento DATE;\n');
          }
          return { creditos: 0, isMock: false };
        }

        console.log(`[Credits] Perfil auto-creado con éxito para ${email} (5 créditos gratuitos asignados).`);
        return {
          creditos: newProfile?.creditos_disponibles ?? 5,
          isMock: false
        };
      }

      console.error('Error al obtener créditos en Supabase:', error);
      if (error.code === '42P01') {
        console.error('⚠️ ALERTA DE CONFIGURACIÓN: La tabla "public.perfiles" no existe en Supabase. Por favor, copia y pega el archivo "schema.sql" en el SQL Editor de tu panel de Supabase.');
      }
      return { creditos: 0, isMock: false };
    }

    return {
      creditos: data?.creditos_disponibles ?? 0,
      isMock: false,
    };
  } catch (err) {
    console.error('Excepción al obtener créditos en Supabase:', err);
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
