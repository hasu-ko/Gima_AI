'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { Mail, Lock, User, Calendar, ShieldAlert, Sparkles, ArrowLeft, Check, X, LogIn } from 'lucide-react';
import CustomDatePicker from '@/components/DatePicker';

export default function RegisterPage() {
  const router = useRouter();

  // Estados de los campos
  const [nombreCompleto, setNombreCompleto] = useState('');
  const [fechaNacimiento, setFechaNacimiento] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // Estados de carga y feedback
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Estados de campos tocados (para validación al perder foco)
  const [nombreCompletoTouched, setNombreCompletoTouched] = useState(false);
  const [fechaNacimientoTouched, setFechaNacimientoTouched] = useState(false);
  const [emailTouched, setEmailTouched] = useState(false);
  const [passwordTouched, setPasswordTouched] = useState(false);
  const [confirmPasswordTouched, setConfirmPasswordTouched] = useState(false);

  const isConfigured = isSupabaseConfigured();

  // Excepciones / Validaciones de contraseña individuales
  const passLength = password.length >= 8;
  const passHasUpper = /[A-Z]/.test(password);
  const passHasLower = /[a-z]/.test(password);
  const passHasNumber = /[0-9]/.test(password);
  const passHasSpecial = /[@$!%*?&!@#$%^&*(),.?":{}|<>]/.test(password);

  const isPasswordValid = passLength && passHasUpper && passHasLower && passHasNumber && passHasSpecial;

  // Validación de edad (Mínimo 13 años)
  const validarEdad = (birthDateString: string): boolean => {
    if (!birthDateString) return false;

    const birthDate = new Date(birthDateString);
    const today = new Date();

    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();

    // Ajustar si el cumpleaños no ha pasado este año
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }

    return age >= 13;
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    // Marcar todos los campos como tocados al enviar
    setNombreCompletoTouched(true);
    setFechaNacimientoTouched(true);
    setEmailTouched(true);
    setPasswordTouched(true);
    setConfirmPasswordTouched(true);

    setLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    // 1. Validar nombre completo
    if (nombreCompleto.trim().length < 3) {
      setErrorMsg('El nombre completo debe tener al menos 3 caracteres.');
      setLoading(false);
      return;
    }

    // 2. Validar edad (Menores de 13 no permitidos)
    if (!fechaNacimiento) {
      setErrorMsg('Por favor introduce tu fecha de nacimiento.');
      setLoading(false);
      return;
    }

    if (!validarEdad(fechaNacimiento)) {
      setErrorMsg('Excepción de Edad: Debes tener al menos 13 años para registrarte en GIMA.');
      setLoading(false);
      return;
    }

    // 3. Validar formato de email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setErrorMsg('Por favor introduce un formato de correo electrónico válido.');
      setLoading(false);
      return;
    }

    // 4. Validar excepciones de contraseña
    if (!isPasswordValid) {
      setErrorMsg('La contraseña no cumple con los requisitos mínimos de seguridad.');
      setLoading(false);
      return;
    }

    // 5. Validar que las contraseñas coincidan
    if (password !== confirmPassword) {
      setErrorMsg('Excepción de Contraseña: Las contraseñas no coinciden.');
      setLoading(false);
      return;
    }

    // --- REGISTRO SEGURO A TRAVÉS DE LA API (REAL O SIMULADO) ---
    try {
      const response = await fetch('/api/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email,
          password,
          nombreCompleto,
          fechaNacimiento,
          redirectTo: `${window.location.origin}/auth/callback`,
        }),
      });

      const resData = await response.json();

      if (!response.ok || !resData.success) {
        setErrorMsg(resData.error || 'Ocurrió un error al registrarse.');
      } else {
        if (resData.isMock) {
          // Si fue simulado, guarda sesión mock
          const mockUser = {
            id: 'dev-user-' + Math.random().toString(36).substr(2, 9),
            email: email,
            name: nombreCompleto,
            fecha_nacimiento: fechaNacimiento,
            isMock: true
          };
          localStorage.setItem('gima_mock_session', JSON.stringify(mockUser));
          
          setSuccessMsg(resData.message || '¡Registro simulado completado! Redirigiendo...');
          setLoading(false);
          setTimeout(() => {
            router.push('/');
          }, 2000);
          return;
        }

        // Si fue real
        setSuccessMsg(resData.message || '¡Registro completado! Verifica tu correo electrónico para activar tu cuenta.');
        
        // Limpiar campos y reiniciar estados de tocado
        setNombreCompleto('');
        setFechaNacimiento('');
        setEmail('');
        setPassword('');
        setConfirmPassword('');
        setNombreCompletoTouched(false);
        setFechaNacimientoTouched(false);
        setEmailTouched(false);
        setPasswordTouched(false);
        setConfirmPasswordTouched(false);
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Ocurrió un error al registrarse.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen w-full flex items-center justify-center p-4 py-12">
      {/* Luces neón decorativas */}
      <div className="absolute top-1/4 left-1/4 -translate-x-1/2 -translate-y-1/2 w-72 h-72 rounded-full bg-accent-violet/10 blur-[100px] pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 translate-x-1/2 translate-y-1/2 w-80 h-80 rounded-full bg-accent-cyan/10 blur-[120px] pointer-events-none" />

      {/* Tarjeta de Registro */}
      <div className="relative w-full max-w-lg glass-panel neon-border-violet rounded-2xl p-8 shadow-2xl overflow-hidden transition-all duration-300">

        {/* Adorno superior */}
        <div className="absolute top-0 left-0 w-24 h-24 bg-gradient-to-br from-accent-violet to-transparent opacity-10 rounded-br-full pointer-events-none" />

        {/* Cabecera */}
        <div className="flex flex-col items-center mb-6 text-center">
          <div className="p-2.5 bg-accent-pink/10 rounded-xl mb-3 border border-accent-pink/20">
            <Sparkles className="w-6 h-6 text-accent-pink animate-pulse" />
          </div>
          <h1 className="text-3xl font-extrabold tracking-wider gradient-text-gaming leading-none">
            REGISTRO GIMA
          </h1>
          <p className="text-xs tracking-widest text-slate-400 font-mono mt-1">
            Gacha Intelligence Model Anime
          </p>
          <p className="text-sm text-slate-300 mt-2 font-medium">
            Únete para consultar lore y meta al instante
          </p>
        </div>

        {/* Notificaciones */}
        {errorMsg && (
          <div className="mb-4 p-3.5 rounded-lg bg-red-950/40 border border-red-500/30 text-xs text-red-300 font-medium flex items-center gap-2 animate-in fade-in">
            <ShieldAlert className="w-4 h-4 text-red-400 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}
        {successMsg && (
          <div className="mb-4 p-3.5 rounded-lg bg-emerald-950/40 border border-emerald-500/30 text-xs text-emerald-300 font-medium flex items-center gap-2 animate-in fade-in">
            <Check className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* Formulario */}
        <form onSubmit={handleRegister} className="space-y-4">

          {/* Nombre Completo */}
          <div>
            <label className="block text-xs font-semibold text-slate-400 font-mono mb-1 uppercase tracking-wider">
              Nombre Completo
            </label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              <input
                type="text"
                required
                placeholder="Ej. John Doe"
                value={nombreCompleto}
                onChange={(e) => setNombreCompleto(e.target.value)}
                onBlur={() => setNombreCompletoTouched(true)}
                className="w-full pl-10 pr-4 py-2.5 rounded-lg bg-slate-950/80 border border-slate-800 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-accent-cyan focus:ring-1 focus:ring-accent-cyan transition-all"
              />
            </div>
            {nombreCompletoTouched && !nombreCompleto.trim() && (
              <p className="mt-1 text-[11px] text-red-400 font-mono">
                * El nombre completo es obligatorio.
              </p>
            )}
            {nombreCompletoTouched && nombreCompleto.trim() && nombreCompleto.trim().length < 3 && (
              <p className="mt-1 text-[11px] text-red-400 font-mono">
                * Debe tener al menos 3 caracteres.
              </p>
            )}
          </div>

          {/* Fecha de Nacimiento */}
          <div>
            <label className="block text-xs font-semibold text-slate-400 font-mono mb-1 uppercase tracking-wider">
              Fecha de Nacimiento (Mínimo 13 años)
            </label>
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none z-10" />
              <CustomDatePicker
                value={fechaNacimiento}
                onChange={(val) => setFechaNacimiento(val)}
                onBlur={() => setFechaNacimientoTouched(true)}
              />
            </div>
            {fechaNacimientoTouched && !fechaNacimiento && (
              <p className="mt-1 text-[11px] text-red-400 font-mono">
                * La fecha de nacimiento es obligatoria.
              </p>
            )}
            {fechaNacimientoTouched && fechaNacimiento && !validarEdad(fechaNacimiento) && (
              <p className="mt-1 text-[11px] text-red-400 font-mono">
                * Debes tener al menos 13 años para registrarte en GIMA.
              </p>
            )}
          </div>

          {/* Correo */}
          <div>
            <label className="block text-xs font-semibold text-slate-400 font-mono mb-1 uppercase tracking-wider">
              Correo Electrónico
            </label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              <input
                type="email"
                required
                placeholder="aventurero@gima.ai"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onBlur={() => setEmailTouched(true)}
                className="w-full pl-10 pr-4 py-2.5 rounded-lg bg-slate-950/80 border border-slate-800 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-accent-cyan focus:ring-1 focus:ring-accent-cyan transition-all"
              />
            </div>
            {emailTouched && !email.trim() && (
              <p className="mt-1 text-[11px] text-red-400 font-mono">
                * El correo electrónico es obligatorio.
              </p>
            )}
            {emailTouched && email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && (
              <p className="mt-1 text-[11px] text-red-400 font-mono">
                * Introduce una dirección de correo válida.
              </p>
            )}
          </div>

          {/* Contraseña */}
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
                onBlur={() => setPasswordTouched(true)}
                className="w-full pl-10 pr-4 py-2.5 rounded-lg bg-slate-950/80 border border-slate-800 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-accent-cyan focus:ring-1 focus:ring-accent-cyan transition-all"
              />
            </div>
            {passwordTouched && !password && (
              <p className="mt-1 text-[11px] text-red-400 font-mono">
                * La contraseña es obligatoria.
              </p>
            )}
            {passwordTouched && password && !isPasswordValid && (
              <p className="mt-1 text-[11px] text-red-400 font-mono">
                * Requisitos mínimos de seguridad incompletos.
              </p>
            )}

            {/* Checklist de validación de contraseña */}
            <div className="mt-3 p-3 rounded-lg bg-slate-950/50 border border-slate-900 grid grid-cols-2 gap-2 text-[10px] font-mono">
              <div className={`flex items-center gap-1.5 ${passLength ? 'text-emerald-400' : ((password || passwordTouched) ? 'text-red-400' : 'text-slate-500')}`}>
                {passLength ? <Check className="w-3.5 h-3.5" /> : <X className="w-3.5 h-3.5" />}
                Mínimo 8 caracteres
              </div>
              <div className={`flex items-center gap-1.5 ${passHasUpper ? 'text-emerald-400' : ((password || passwordTouched) ? 'text-red-400' : 'text-slate-500')}`}>
                {passHasUpper ? <Check className="w-3.5 h-3.5" /> : <X className="w-3.5 h-3.5" />}
                1 Mayúscula (A-Z)
              </div>
              <div className={`flex items-center gap-1.5 ${passHasLower ? 'text-emerald-400' : ((password || passwordTouched) ? 'text-red-400' : 'text-slate-500')}`}>
                {passHasLower ? <Check className="w-3.5 h-3.5" /> : <X className="w-3.5 h-3.5" />}
                1 Minúscula (a-z)
              </div>
              <div className={`flex items-center gap-1.5 ${passHasNumber ? 'text-emerald-400' : ((password || passwordTouched) ? 'text-red-400' : 'text-slate-500')}`}>
                {passHasNumber ? <Check className="w-3.5 h-3.5" /> : <X className="w-3.5 h-3.5" />}
                1 Número (0-9)
              </div>
              <div className={`flex items-center gap-1.5 ${passHasSpecial ? 'text-emerald-400' : ((password || passwordTouched) ? 'text-red-400' : 'text-slate-500')}`}>
                {passHasSpecial ? <Check className="w-3.5 h-3.5" /> : <X className="w-3.5 h-3.5" />}
                1 Especial (@$!%*?&)
              </div>
            </div>
          </div>

          {/* Confirmar Contraseña */}
          <div>
            <label className="block text-xs font-semibold text-slate-400 font-mono mb-1 uppercase tracking-wider">
              Confirmar Contraseña
            </label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              <input
                type="password"
                required
                placeholder="••••••••"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                onBlur={() => setConfirmPasswordTouched(true)}
                className="w-full pl-10 pr-4 py-2.5 rounded-lg bg-slate-950/80 border border-slate-800 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-accent-cyan focus:ring-1 focus:ring-accent-cyan transition-all"
              />
            </div>
            {confirmPasswordTouched && !confirmPassword && (
              <p className="mt-1 text-[11px] text-red-400 font-mono">
                * Confirmar la contraseña es obligatorio.
              </p>
            )}
            {confirmPasswordTouched && confirmPassword && password !== confirmPassword && (
              <p className="mt-1 text-[11px] text-red-400 font-mono">
                * Las contraseñas no coinciden.
              </p>
            )}
          </div>

          {/* Botón enviar */}
          <button
            type="submit"
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 py-3 mt-4 rounded-lg bg-gradient-to-r from-accent-violet via-accent-cyan to-accent-pink text-white text-xs font-bold uppercase tracking-wider hover:opacity-95 active:scale-[0.98] transition-all disabled:opacity-50 cursor-pointer"
          >
            {loading ? 'Creando Gacha-Perfil...' : 'Crear Cuenta'}
          </button>
        </form>

        {/* Retorno a login */}
        <div className="mt-6 text-center">
          <button
            onClick={() => router.push('/login')}
            className="inline-flex items-center gap-1 text-xs text-slate-400 hover:text-white transition-all cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Volver a Iniciar Sesión
          </button>
        </div>

        <div className="mt-4 p-3 bg-accent-violet/10 border border-accent-violet/20 rounded-lg text-center animate-in fade-in">
          <p className="text-[11px] text-slate-350 leading-normal">
            🔧 <strong>Logs de Correo:</strong> Puedes monitorizar el estado y depurar SMTP en{' '}
            <button
              type="button"
              onClick={() => router.push('/email-logs')}
              className="text-accent-cyan hover:underline font-bold cursor-pointer font-mono"
            >
              /email-logs
            </button>
          </p>
        </div>

        {/* Pie */}
        <div className="mt-6 text-center border-t border-slate-900 pt-4">
          <p className="text-[10px] text-slate-500 font-mono">
            GIMA v0.1.0 • Seguridad de Datos y Cuentas Gacha
          </p>
        </div>

      </div>
    </div>
  );
}
