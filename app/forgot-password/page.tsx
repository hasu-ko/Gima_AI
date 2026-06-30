'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { isSupabaseConfigured } from '@/lib/supabase';
import { Gamepad2, Mail, Loader2, ArrowLeft, Info, HelpCircle } from 'lucide-react';

export default function ForgotPasswordPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [isDbConfigured, setIsDbConfigured] = useState(false);

  useEffect(() => {
    setIsDbConfigured(isSupabaseConfigured());
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;

    setLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const response = await fetch('/api/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      });

      const data = await response.json();

      if (response.ok && data.success) {
        setSuccessMsg(data.message);
      } else {
        setErrorMsg(data.error || 'Ocurrió un error inesperado al solicitar el enlace.');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Error de conexión con el servidor.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen w-full flex items-center justify-center p-4 bg-[#06060c] text-slate-100 font-sans">
      {/* Círculos de luz neón de fondo decorativos */}
      <div className="absolute top-1/4 left-1/4 -translate-x-1/2 -translate-y-1/2 w-72 h-72 rounded-full bg-accent-pink/10 blur-[100px] pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 translate-x-1/2 translate-y-1/2 w-80 h-80 rounded-full bg-accent-cyan/10 blur-[120px] pointer-events-none" />

      {/* Tarjeta de Recuperación Glassmorphic con Borde Neón Violeta */}
      <div className="relative w-full max-w-md glass-panel neon-border-violet rounded-2xl p-8 shadow-2xl transition-all duration-500 overflow-hidden">
        
        {/* Adorno brillante en la esquina superior derecha */}
        <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-accent-cyan to-transparent opacity-10 rounded-bl-full pointer-events-none" />

        {/* Cabecera / Logo */}
        <div className="flex flex-col items-center mb-6 text-center">
          <div className="p-3 bg-accent-pink/10 rounded-xl mb-3 border border-accent-pink/30 animate-pulse">
            <HelpCircle className="w-8 h-8 text-accent-pink" />
          </div>
          <h1 className="text-3xl font-extrabold tracking-wider gradient-text-gaming leading-none">
            RECUPERAR ACCESO
          </h1>
          <p className="text-xs tracking-widest text-slate-400 font-mono mt-2 uppercase">
            Restablecer Contraseña
          </p>
          <p className="text-sm text-slate-350 mt-4 max-w-xs">
            Ingresa tu correo registrado y te enviaremos un enlace único para cambiar tu contraseña.
          </p>
        </div>

        {/* Notificación informativa del modo de desarrollo local sin SMTP */}
        <div className="mb-6 p-3 rounded-lg bg-accent-cyan/10 border border-accent-cyan/20 text-xs text-cyan-200 flex items-start gap-2">
          <Info className="w-4 h-4 mt-0.5 shrink-0 text-accent-cyan" />
          <div>
            <span className="font-semibold text-white">Consola de Desarrollo:</span> Los enlaces de recuperación se registran en los logs de correos locales. Puedes abrirlos y copiarlos desde la ruta <a href="/email-logs" target="_blank" className="font-bold underline text-white hover:text-accent-cyan transition-colors">/email-logs</a>.
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
        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-xs font-semibold text-slate-400 font-mono mb-1.5 uppercase tracking-wider">
              Correo Electrónico
            </label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="ejemplo@correo.com"
                className="w-full pl-10 pr-4 py-3 bg-slate-950/80 border border-slate-800 rounded-lg text-sm placeholder-slate-500 text-white focus:outline-none focus:border-accent-violet focus:ring-1 focus:ring-accent-violet transition-all duration-300"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3.5 px-4 bg-gradient-to-r from-accent-violet to-accent-pink hover:opacity-90 active:scale-[0.98] text-white rounded-lg text-sm font-bold tracking-wider uppercase transition-all duration-300 shadow-md shadow-accent-violet/20 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:pointer-events-none"
          >
            {loading ? (
              <>
                <Loader2 className="w-4.5 h-4.5 animate-spin" />
                Enviando enlace...
              </>
            ) : (
              'Enviar Enlace'
            )}
          </button>
        </form>

        {/* Retornar al Login */}
        <div className="mt-6 pt-4 border-t border-slate-900 text-center">
          <button
            onClick={() => router.push('/login')}
            className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-white transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Volver al Inicio de Sesión
          </button>
        </div>
      </div>
    </div>
  );
}
