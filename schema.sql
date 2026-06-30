-- =========================================================================
-- ESQUEMA DE BASE DE DATOS PARA GIMA (Gacha Intelligence Model Anime)
-- =========================================================================
-- Copia y pega este script en el SQL Editor de tu proyecto en Supabase
-- para crear la tabla de perfiles y habilitar el control de créditos.

-- 1. Crear la tabla de perfiles vinculada a auth.users de Supabase
CREATE TABLE IF NOT EXISTS public.perfiles (
    id UUID REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
    email TEXT,
    nombre_completo TEXT,
    avatar_url TEXT,
    fecha_nacimiento DATE,
    creditos_disponibles INTEGER DEFAULT 5 CHECK (creditos_disponibles >= 0),
    ultimo_reset TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Habilitar la seguridad de nivel de fila (RLS) en la tabla perfiles
ALTER TABLE public.perfiles ENABLE ROW LEVEL SECURITY;

-- 2. Crear Políticas de Seguridad RLS
-- Permitir que los usuarios puedan leer su propio perfil
CREATE POLICY "Los usuarios pueden ver su propio perfil" 
    ON public.perfiles FOR SELECT 
    USING (auth.uid() = id);

-- NOTA: No creamos políticas de actualización (UPDATE) directa para el usuario,
-- ya que la reducción de créditos se hará de manera segura desde el servidor
-- utilizando el cliente con la Service Role Key (Bypass RLS) o funciones seguras RPC.

-- 3. Trigger para crear automáticamente el perfil al registrarse un usuario
-- Esta función se ejecuta automáticamente cuando se crea una cuenta en auth.users.
-- Extrae nombre_completo y fecha_nacimiento de los metadatos de registro enviados desde Next.js.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.perfiles (id, email, nombre_completo, avatar_url, fecha_nacimiento, creditos_disponibles)
    VALUES (
        new.id, 
        new.email, 
        COALESCE((new.raw_user_meta_data->>'nombre_completo')::text, ''),
        COALESCE((new.raw_user_meta_data->>'avatar_url')::text, ''),
        (new.raw_user_meta_data->>'fecha_nacimiento')::date,
        5 -- Inicia con 5 créditos gratis
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Disparar la función anterior cada vez que se inserta un usuario en auth.users
CREATE OR REPLACE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 4. Función de consumo de créditos atómica (segura contra race conditions)
-- Esta función se puede invocar desde Next.js a través del cliente Supabase: supabase.rpc('consumir_credito')
CREATE OR REPLACE FUNCTION public.consumir_credito(user_id UUID)
RETURNS TABLE (exito BOOLEAN, creditos_restantes INTEGER) AS $$
DECLARE
    filas_actualizadas INTEGER;
    creditos_actuales INTEGER;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Nota: Re-definimos la lógica completa de consumir_credito para asegurar consistencia
CREATE OR REPLACE FUNCTION public.consumir_credito(user_id UUID)
RETURNS TABLE (exito BOOLEAN, creditos_restantes INTEGER) AS $$
DECLARE
    filas_actualizadas INTEGER;
    creditos_actuales INTEGER;
BEGIN
    -- Intentar restar 1 crédito si es mayor a 0
    UPDATE public.perfiles
    SET creditos_disponibles = creditos_disponibles - 1
    WHERE id = user_id AND creditos_disponibles > 0
    RETURNING creditos_disponibles INTO creditos_actuales;
    
    GET DIAGNOSTICS filas_actualizadas = ROW_COUNT;
    
    IF filas_actualizadas > 0 THEN
        RETURN QUERY SELECT TRUE, creditos_actuales;
    ELSE
        -- Si no se actualizó, significa que ya tenía 0 créditos
        SELECT creditos_disponibles INTO creditos_actuales FROM public.perfiles WHERE id = user_id;
        RETURN QUERY SELECT FALSE, COALESCE(creditos_actuales, 0);
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =========================================================================
-- TABLAS DE PERSISTENCIA DE CHAT (HISTORIAL Y MULTI-CONVERSACIÓN)
-- =========================================================================

-- 1. Crear la tabla de conversaciones
CREATE TABLE IF NOT EXISTS public.conversaciones (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    titulo TEXT DEFAULT 'Nueva conversación',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Habilitar seguridad RLS en conversaciones
ALTER TABLE public.conversaciones ENABLE ROW LEVEL SECURITY;

-- Políticas de RLS para conversaciones
CREATE POLICY "Los usuarios pueden ver sus propias conversaciones"
    ON public.conversaciones FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Los usuarios pueden crear sus propias conversaciones"
    ON public.conversaciones FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Los usuarios pueden actualizar sus propias conversaciones"
    ON public.conversaciones FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Los usuarios pueden borrar sus propias conversaciones"
    ON public.conversaciones FOR DELETE
    USING (auth.uid() = user_id);

-- 2. Crear la tabla de mensajes
CREATE TABLE IF NOT EXISTS public.mensajes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversacion_id UUID NOT NULL REFERENCES public.conversaciones(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
    content TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Habilitar seguridad RLS en mensajes
ALTER TABLE public.mensajes ENABLE ROW LEVEL SECURITY;

-- Políticas de RLS para mensajes
CREATE POLICY "Los usuarios pueden ver los mensajes de sus conversaciones"
    ON public.mensajes FOR SELECT
    USING (EXISTS (
        SELECT 1 FROM public.conversaciones
        WHERE public.conversaciones.id = mensajes.conversacion_id
          AND public.conversaciones.user_id = auth.uid()
    ));

CREATE POLICY "Los usuarios pueden insertar mensajes en sus conversaciones"
    ON public.mensajes FOR INSERT
    WITH CHECK (EXISTS (
        SELECT 1 FROM public.conversaciones
        WHERE public.conversaciones.id = mensajes.conversacion_id
          AND public.conversaciones.user_id = auth.uid()
    ));

