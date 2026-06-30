'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { KeyRound, Lock, Loader2, ArrowLeft, Check, AlertTriangle } from 'lucide-react';

export default function ResetPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [isMock, setIsMock] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    async function checkAuthSession() {
      try {
        // 1. Intentar obtener sesión activa de Supabase
        const { data: { session: initialSession } } = await supabase.auth.getSession();
        if (initialSession && initialSession.user) {
          setUserEmail(initialSession.user.email ?? null);
          setIsMock(false);
          setLoading(false);
          return;
        }

        // Si no hay sesión inmediata, suscribirse al estado de autenticación (por si está inicializando)
        const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
          if (session && session.user) {
            setUserEmail(session.user.email ?? null);
            setIsMock(false);
            setLoading(false);
            subscription.unsubscribe();
          } else if (event === 'INITIAL_SESSION') {
            // Si ya terminó de inicializar y la sesión sigue siendo nula
            subscription.unsubscribe();

            // 2. Comprobar si tenemos parámetros de simulación (modo local desconectado)
            const params = new URLSearchParams(window.location.search);
            const mockEmail = params.get('email');
            const mockToken = params.get('token');

            if (mockEmail && mockToken) {
              setUserEmail(mockEmail);
              setIsMock(true);
              setLoading(false);
            } else {
              // Sin credenciales de recuperación, redirigir
              router.push('/login');
            }
          }
        });
      } catch (err) {
        console.error('Error al verificar sesión de recuperación:', err);
        router.push('/login');
      }
    }

    checkAuthSession();
  }, [router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      setErrorMsg('Las contraseñas no coinciden.');
      return;
    }
    if (password.length < 6) {
      setErrorMsg('La contraseña debe tener al menos 6 caracteres.');
      return;
    }

    setSubmitting(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      if (isMock) {
        // Modo simulado
        if (password === '123456' || password === 'password' || password === 'contrasena') {
          setErrorMsg('Excepción: La nueva contraseña no puede ser igual a tu contraseña actual.');
          setSubmitting(false);
          return;
        }

        setSuccessMsg('¡Contraseña restablecida con éxito! Redirigiéndote al inicio de sesión...');
        setTimeout(() => {
          router.push('/login');
        }, 2000);
      } else {
        // Modo Supabase real
        // 1. VALIDACIÓN DE EXCEPCIÓN: Comprobar que la nueva contraseña no sea igual a la actual.
        // Hacemos una prueba de inicio de sesión rápida usando un cliente sin persistencia ni storage para no alterar la sesión del navegador.
        const tempSupabase = createClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
          {
            auth: {
              persistSession: false,
              storage: {
                getItem: () => null,
                setItem: () => {},
                removeItem: () => {}
              }
            }
          }
        );

        const { error: signInError } = await tempSupabase.auth.signInWithPassword({
          email: userEmail!,
          password: password
        });

        // Si signIn no da error, significa que las credenciales propuestas son correctas y vigentes
        if (!signInError) {
          setErrorMsg('Excepción: La nueva contraseña no puede ser idéntica a tu contraseña actual.');
          setSubmitting(false);
          return;
        }

        // 2. Proceder a cambiar la contraseña oficialmente en la cuenta autenticada
        const { error: updateError } = await supabase.auth.updateUser({
          password: password
        });

        if (updateError) throw updateError;

        // 3. Cerrar sesión por seguridad tras cambiar la contraseña
        await supabase.auth.signOut();
        localStorage.removeItem('gima_mock_session');

        setSuccessMsg('¡Contraseña restablecida con éxito! Redirigiéndote al inicio de sesión...');
        setTimeout(() => {
          router.push('/login');
        }, 2500);
      }
    } catch (err: any) {
      console.error('Error al cambiar contraseña:', err);
      setErrorMsg(err.message || 'Ocurrió un error inesperado al actualizar tu contraseña.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen w-full flex flex-col items-center justify-center bg-[#06060c] text-slate-100 font-sans">
        <Loader2 className="w-10 h-10 text-accent-cyan animate-spin mb-4" />
        <p className="text-sm font-mono text-slate-400">Verificando sesión segura...</p>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen w-full flex items-center justify-center p-4 bg-[#06060c] text-slate-100 font-sans">
      {/* Círculos de luz neón de fondo decorativos */}
      <div className="absolute top-1/4 left-1/4 -translate-x-1/2 -translate-y-1/2 w-72 h-72 rounded-full bg-accent-pink/10 blur-[100px] pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 translate-x-1/2 translate-y-1/2 w-80 h-80 rounded-full bg-accent-cyan/10 blur-[120px] pointer-events-none" />

      {/* Tarjeta Glassmorphic */}
      <div className="relative w-full max-w-md glass-panel neon-border-violet rounded-2xl p-8 shadow-2xl transition-all duration-500 overflow-hidden">
        
        {/* Adorno brillante */}
        <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-accent-cyan to-transparent opacity-10 rounded-bl-full pointer-events-none" />

        {/* Cabecera */}
        <div className="flex flex-col items-center mb-6 text-center">
          <div className="p-3 bg-accent-violet/10 rounded-xl mb-3 border border-accent-violet/30 animate-pulse">
            <KeyRound className="w-8 h-8 text-accent-cyan" />
          </div>
          <h1 className="text-3xl font-extrabold tracking-wider gradient-text-gaming leading-none">
            NUEVA CONTRASEÑA
          </h1>
          <p className="text-xs tracking-widest text-slate-400 font-mono mt-2 uppercase">
            Área de Recuperación Segura
          </p>
          <div className="mt-4 px-3 py-1.5 bg-slate-900/60 border border-slate-800 rounded-full text-xs font-mono text-slate-300 max-w-xs truncate">
            Usuario: <span className="text-accent-cyan font-bold">{userEmail}</span>
          </div>
        </div>

        {/* Alertas */}
        {errorMsg && (
          <div className="mb-4 p-3 rounded-lg bg-red-950/40 border border-red-500/30 text-xs text-red-300 font-medium animate-in fade-in duration-200">
            {errorMsg}
          </div>
        )}
        {successMsg && (
          <div className="mb-4 p-3 rounded-lg bg-emerald-950/40 border border-emerald-500/30 text-xs text-emerald-300 font-medium animate-in fade-in duration-200">
            {successMsg}
          </div>
        )}

        {/* Formulario */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-400 font-mono mb-1.5 uppercase tracking-wider">
              Nueva Contraseña
            </label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Mínimo 6 caracteres"
                className="w-full pl-10 pr-4 py-3 bg-slate-950/80 border border-slate-800 rounded-lg text-sm placeholder-slate-500 text-white focus:outline-none focus:border-accent-cyan focus:ring-1 focus:ring-accent-cyan transition-all duration-300"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-400 font-mono mb-1.5 uppercase tracking-wider">
              Confirmar Nueva Contraseña
            </label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              <input
                type="password"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Repite tu nueva contraseña"
                className="w-full pl-10 pr-4 py-3 bg-slate-950/80 border border-slate-800 rounded-lg text-sm placeholder-slate-500 text-white focus:outline-none focus:border-accent-cyan focus:ring-1 focus:ring-accent-cyan transition-all duration-300"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full py-3.5 px-4 bg-gradient-to-r from-accent-violet to-accent-cyan hover:opacity-90 active:scale-[0.98] text-white rounded-lg text-sm font-bold tracking-wider uppercase transition-all duration-300 shadow-md shadow-accent-violet/20 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:pointer-events-none"
          >
            {submitting ? (
              <>
                <Loader2 className="w-4.5 h-4.5 animate-spin" />
                Actualizando contraseña...
              </>
            ) : (
              'Guardar Contraseña'
            )}
          </button>
        </form>

        {/* Retornar al Login */}
        <div className="mt-6 pt-4 border-t border-slate-900 text-center">
          <button
            onClick={async () => {
              await supabase.auth.signOut();
              router.push('/login');
            }}
            className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-white transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Cancelar y Volver al Login
          </button>
        </div>
      </div>
    </div>
  );
}
