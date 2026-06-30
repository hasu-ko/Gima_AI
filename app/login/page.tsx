'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { Mail, Lock, Gamepad2, Sparkles, LogIn, ArrowRight, Info } from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const isConfigured = isSupabaseConfigured();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    if (!email || !password) {
      setErrorMsg('Por favor completa todos los campos.');
      setLoading(false);
      return;
    }

    if (!isConfigured) {
      // Si no está configurado, simulamos el inicio de sesión para el entorno local
      setTimeout(() => {
        // Guardamos una sesión simulada en localStorage para persistencia básica local
        localStorage.setItem('gima_mock_session', JSON.stringify({
          id: 'dev-user-12345',
          email: email,
          name: email.split('@')[0],
          isMock: true
        }));
        setSuccessMsg('¡Modo Desarrollo Local activado con éxito! Redirigiendo...');
        setLoading(false);
        setTimeout(() => {
          router.push('/');
        }, 1000);
      }, 800);
      return;
    }

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        setErrorMsg(error.message);
      } else if (data.user) {
        setSuccessMsg('¡Inicio de sesión correcto! Entrando al sistema...');
        setTimeout(() => {
          router.push('/');
        }, 1000);
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Ocurrió un error inesperado.');
    } finally {
      setLoading(false);
    }
  };



  // Botón directo para jugar / probar sin ingresar credenciales
  const handleQuickDemoEnter = () => {
    localStorage.setItem('gima_mock_session', JSON.stringify({
      id: 'dev-guest-gacha',
      email: 'viajero@gima.ai',
      name: 'Viajero_Gacha',
      isMock: true
    }));
    router.push('/');
  };

  return (
    <div className="relative min-h-screen w-full flex items-center justify-center p-4">
      {/* Círculos de luz neón de fondo decorativos */}
      <div className="absolute top-1/4 left-1/4 -translate-x-1/2 -translate-y-1/2 w-72 h-72 rounded-full bg-accent-pink/10 blur-[100px] pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 translate-x-1/2 translate-y-1/2 w-80 h-80 rounded-full bg-accent-cyan/10 blur-[120px] pointer-events-none" />

      {/* Tarjeta de Login Glassmorphic con Borde Neón Violeta */}
      <div className="relative w-full max-w-md glass-panel neon-border-violet rounded-2xl p-8 shadow-2xl transition-all duration-500 overflow-hidden">
        
        {/* Adorno brillante en la esquina superior derecha */}
        <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-accent-cyan to-transparent opacity-10 rounded-bl-full pointer-events-none" />

        {/* Cabecera / Logo */}
        <div className="flex flex-col items-center mb-8 text-center">
          <div className="p-3 bg-accent-violet/10 rounded-xl mb-3 border border-accent-violet/30 animate-pulse">
            <Gamepad2 className="w-8 h-8 text-accent-cyan" />
          </div>
          <h1 className="text-4xl font-extrabold tracking-wider gradient-text-gaming leading-none">
            GIMA
          </h1>
          <p className="text-xs tracking-widest text-slate-400 font-mono mt-1">
            Gacha Intelligence Model Anime
          </p>
          <p className="text-sm text-slate-300 mt-3 font-medium">
            Lore profundo y Meta en tiempo real
          </p>
        </div>

        {/* Notificación informativa del estado del Servidor */}
        {!isConfigured && (
          <div className="mb-6 p-3 rounded-lg bg-accent-cyan/10 border border-accent-cyan/20 text-xs text-cyan-200 flex items-start gap-2">
            <Info className="w-4 h-4 mt-0.5 shrink-0 text-accent-cyan" />
            <div>
              <span className="font-semibold text-white">Modo Desarrollo Sin Tokens:</span> Puedes ingresar cualquier correo o hacer clic en <strong>Acceso Rápido</strong> para probar la interfaz y simulación de créditos.
            </div>
          </div>
        )}

        {/* Alertas */}
        {errorMsg && (
          <div className="mb-4 p-3 rounded-lg bg-red-950/40 border border-red-500/30 text-xs text-red-300 font-medium">
            {errorMsg}
          </div>
        )}
        {successMsg && (
          <div className="mb-4 p-3 rounded-lg bg-emerald-950/40 border border-emerald-500/30 text-xs text-emerald-300 font-medium">
            {successMsg}
          </div>
        )}

        {/* Formulario */}
        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-400 font-mono mb-1 uppercase tracking-wider">
              Correo Electrónico
            </label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              <input
                type="email"
                required
                placeholder="ejemplo@gima.ai"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 rounded-lg bg-slate-950/80 border border-slate-800 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-accent-cyan focus:ring-1 focus:ring-accent-cyan transition-all"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-400 font-mono mb-1 uppercase tracking-wider">
              Contraseña
            </label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              <input
                type="password"
                required
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 rounded-lg bg-slate-950/80 border border-slate-800 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-accent-cyan focus:ring-1 focus:ring-accent-cyan transition-all"
              />
            </div>
          </div>

          {/* Botones principales */}
          <div className="grid grid-cols-2 gap-3 pt-2">
            <button
              type="submit"
              disabled={loading}
              className="col-span-2 md:col-span-1 w-full flex items-center justify-center gap-2 py-3 rounded-lg bg-gradient-to-r from-accent-violet to-accent-cyan text-white text-xs font-bold uppercase tracking-wider hover:opacity-90 active:scale-[0.98] transition-all disabled:opacity-50 cursor-pointer"
            >
              <LogIn className="w-4 h-4" />
              {loading ? 'Entrando...' : 'Entrar'}
            </button>
            <button
              type="button"
              onClick={() => router.push('/register')}
              className="col-span-2 md:col-span-1 w-full py-3 rounded-lg border border-slate-800 bg-slate-900/40 text-slate-300 text-xs font-bold uppercase tracking-wider hover:bg-slate-900 hover:text-white transition-all cursor-pointer"
            >
              Registrarse
            </button>
          </div>
        </form>

        {/* Separador */}
        <div className="relative my-6 text-center">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-slate-800" />
          </div>
          <span className="relative bg-[#0b0b15] px-3 text-[10px] uppercase font-mono text-slate-500">
            o entra sin credenciales
          </span>
        </div>

        {/* Botón de Acceso Rápido */}
        <button
          onClick={handleQuickDemoEnter}
          className="w-full flex items-center justify-center gap-2 py-3 rounded-lg bg-gradient-to-r from-accent-pink/20 to-accent-violet/20 border border-accent-pink/40 hover:from-accent-pink/30 hover:to-accent-violet/30 text-pink-300 hover:text-white text-xs font-bold uppercase tracking-wider transition-all cursor-pointer group"
        >
          <Sparkles className="w-4 h-4 text-accent-pink group-hover:scale-110 transition-transform" />
          Acceso Rápido (Invitado)
          <ArrowRight className="w-3.5 h-3.5 opacity-60 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all" />
        </button>

        {/* Pie de página */}
        <div className="mt-8 text-center">
          <p className="text-[10px] text-slate-500 font-mono">
            GIMA v0.1.0 • Hecho para la Comunidad Gacha
          </p>
        </div>

      </div>
    </div>
  );
}
