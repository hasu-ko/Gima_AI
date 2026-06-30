'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { Loader2, CheckCircle, AlertCircle } from 'lucide-react';

export default function AuthCallbackPage() {
  const router = useRouter();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    async function handleAuthCallback() {
      try {
        // 1. Obtener parámetros de búsqueda (para flujo PKCE con ?code=...)
        const params = new URLSearchParams(window.location.search);
        const code = params.get('code');
        const redirectTo = params.get('redirect_to') || '/';

        if (code) {
          // Intercambiar el código por una sesión
          const { error } = await supabase.auth.exchangeCodeForSession(code);
          if (error) throw error;
        }

        // 2. Verificar si ya tenemos sesión (para flujo Implícito con hash #access_token=...)
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        if (sessionError) throw sessionError;

        if (session) {
          if (mounted) {
            setStatus('success');
            // Redirigir al inicio o página elegida después de un breve instante para dar feedback visual
            setTimeout(() => {
              router.push(redirectTo);
            }, 1500);
          }
          return;
        }

        // 3. Suscribirse a cambios de estado por si tarda un poco en procesar el hash
        const { data: { subscription } } = supabase.auth.onAuthStateChange(
          async (event, currentSession) => {
            if (currentSession && mounted) {
              setStatus('success');
              subscription.unsubscribe();
              setTimeout(() => {
                router.push(redirectTo);
              }, 1500);
            }
          }
        );

        // Dar un tiempo de espera antes de declarar error por falta de sesión
        setTimeout(async () => {
          if (!mounted) return;
          const { data: { session: finalSession } } = await supabase.auth.getSession();
          if (!finalSession) {
            setStatus('error');
            setErrorMsg('No se pudo establecer una sesión de usuario activa.');
          }
        }, 5000);

      } catch (err: any) {
        console.error('Error en el callback de autenticación:', err);
        if (mounted) {
          setStatus('error');
          setErrorMsg(err.message || 'Ocurrió un error inesperado al verificar tu cuenta.');
        }
      }
    }

    handleAuthCallback();

    return () => {
      mounted = false;
    };
  }, [router]);

  return (
    <div className="relative min-h-screen w-full flex items-center justify-center p-4 bg-[#0a0516]">
      {/* Luces neón decorativas de fondo */}
      <div className="absolute top-1/4 left-1/4 -translate-x-1/2 -translate-y-1/2 w-72 h-72 rounded-full bg-accent-violet/10 blur-[100px] pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 translate-x-1/2 translate-y-1/2 w-80 h-80 rounded-full bg-accent-cyan/10 blur-[120px] pointer-events-none" />

      <div className="relative w-full max-w-md glass-panel neon-border-violet rounded-2xl p-8 shadow-2xl text-center overflow-hidden">
        
        {/* Cabecera / Adorno neón */}
        <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-accent-cyan to-transparent opacity-10 rounded-bl-full pointer-events-none" />

        {status === 'loading' && (
          <div className="flex flex-col items-center py-6">
            <Loader2 className="w-12 h-12 text-accent-cyan animate-spin mb-4" />
            <h1 className="text-2xl font-extrabold tracking-wider gradient-text-gaming leading-none mb-3">
              VERIFICANDO CUENTA
            </h1>
            <p className="text-slate-300 text-sm">
              Estamos procesando tu inicio de sesión seguro en GIMA. Por favor espera...
            </p>
          </div>
        )}

        {status === 'success' && (
          <div className="flex flex-col items-center py-6 animate-in zoom-in-95 duration-300">
            <CheckCircle className="w-14 h-14 text-emerald-400 mb-4 animate-bounce" />
            <h1 className="text-2xl font-extrabold tracking-wider text-emerald-400 leading-none mb-3">
              ¡CUENTA VERIFICADA!
            </h1>
            <p className="text-slate-300 text-sm">
              Inicio de sesión exitoso. Redirigiéndote a GIMA...
            </p>
          </div>
        )}

        {status === 'error' && (
          <div className="flex flex-col items-center py-6 animate-in zoom-in-95 duration-300">
            <AlertCircle className="w-14 h-14 text-red-400 mb-4 animate-pulse" />
            <h1 className="text-2xl font-extrabold tracking-wider text-red-400 leading-none mb-3">
              ERROR DE AUTENTICACIÓN
            </h1>
            <p className="text-red-300 text-sm mb-6">
              {errorMsg}
            </p>
            <button
              onClick={() => router.push('/login')}
              className="w-full py-3 px-4 bg-accent-violet/20 hover:bg-accent-violet/30 border border-accent-violet/40 hover:border-accent-violet/60 text-slate-200 hover:text-white rounded-lg text-sm font-semibold tracking-wider uppercase transition-all duration-300 shadow-md cursor-pointer"
            >
              Volver al Login
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
