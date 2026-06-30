'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { 
  Gamepad2, Sparkles, BookOpen, Search, Cpu, Coins, ShieldCheck, 
  ArrowRight, Users, MessageSquare, ExternalLink, Activity
} from 'lucide-react';

export default function LandingPage() {
  const router = useRouter();
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [loading, setLoading] = useState(true);
  const [userName, setUserName] = useState('');

  useEffect(() => {
    async function checkUserSession() {
      const isDbConfigured = isSupabaseConfigured();
      if (isDbConfigured) {
        localStorage.removeItem('gima_mock_session');
      } else {
        // 1. Verificar sesión simulada
        const mockSession = localStorage.getItem('gima_mock_session');
        if (mockSession) {
          const parsed = JSON.parse(mockSession);
          setIsLoggedIn(true);
          setUserName(parsed.name || 'Viajero');
          setLoading(false);
          return;
        }
      }

      // 2. Verificar sesión de Supabase
      if (isDbConfigured) {
        try {
          const { data: { session } } = await supabase.auth.getSession();
          if (session && session.user) {
            setIsLoggedIn(true);
            setUserName(session.user.email?.split('@')[0] || 'Viajero');
          }
        } catch (err) {
          console.error('Error al verificar sesión:', err);
        }
      }
      setLoading(false);
    }

    checkUserSession();
  }, []);

  const handleCTA = () => {
    if (isLoggedIn) {
      router.push('/chat');
    } else {
      router.push('/login');
    }
  };

  const scrollToSection = (id: string) => {
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <div className="min-h-screen bg-[#06060c] text-slate-100 font-sans selection:bg-accent-violet/30 selection:text-accent-cyan">
      
      {/* HEADER / NAVBAR */}
      <header className="fixed top-0 left-0 w-full z-40 bg-slate-950/60 backdrop-blur-md border-b border-slate-900/60 transition-all">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          {/* Logo */}
          <div className="flex items-center gap-2 cursor-pointer" onClick={() => router.push('/')}>
            <div className="p-1.5 bg-accent-pink/15 border border-accent-pink/30 rounded-lg text-accent-pink">
              <Gamepad2 className="w-5 h-5" />
            </div>
            <div>
              <span className="font-extrabold text-lg tracking-wider gradient-text-gaming leading-none block">
                GIMA
              </span>
              <span className="text-[8px] tracking-widest font-mono text-slate-500 uppercase block -mt-0.5">
                Gacha Intelligence
              </span>
            </div>
          </div>

          {/* Enlaces de navegación */}
          <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-slate-400">
            <button 
              onClick={() => scrollToSection('funcionamiento')} 
              className="hover:text-slate-200 transition-colors cursor-pointer"
            >
              Cómo Funciona
            </button>
            <button 
              onClick={() => scrollToSection('caracteristicas')} 
              className="hover:text-slate-200 transition-colors cursor-pointer"
            >
              Características
            </button>
            <button 
              onClick={() => scrollToSection('precios')} 
              className="hover:text-slate-200 transition-colors cursor-pointer"
            >
              Planes
            </button>
          </nav>

          {/* Botones de Auth */}
          <div className="flex items-center gap-4">
            {loading ? (
              <div className="w-24 h-9 bg-slate-900 animate-pulse rounded-lg" />
            ) : isLoggedIn ? (
              <div className="flex items-center gap-3">
                <span className="hidden sm:inline text-xs font-mono text-slate-400">
                  Hola, <strong className="text-slate-200">{userName}</strong>
                </span>
                <button
                  onClick={() => router.push('/chat')}
                  className="px-4 py-2 bg-gradient-to-r from-accent-violet to-accent-cyan hover:opacity-90 active:scale-95 text-white text-xs font-bold rounded-lg transition-all shadow-md shadow-accent-violet/10 cursor-pointer"
                >
                  Ir al Chat
                </button>
              </div>
            ) : (
              <>
                <button
                  onClick={() => router.push('/login')}
                  className="text-xs font-bold text-slate-300 hover:text-white px-3 py-2 cursor-pointer transition-colors"
                >
                  Iniciar Sesión
                </button>
                <button
                  onClick={() => router.push('/register')}
                  className="px-4 py-2 bg-slate-900 border border-slate-800 hover:border-accent-violet text-slate-200 hover:text-white text-xs font-bold rounded-lg transition-all cursor-pointer"
                >
                  Registrarse
                </button>
              </>
            )}
          </div>
        </div>
      </header>

      {/* HERO SECTION */}
      <section className="relative pt-32 pb-24 md:pt-40 md:pb-32 overflow-hidden flex items-center justify-center">
        {/* Luces neón decorativas */}
        <div className="absolute top-12 left-1/2 -translate-x-1/2 w-[500px] h-[500px] rounded-full bg-accent-violet/10 blur-[150px] pointer-events-none" />
        
        <div className="max-w-4xl mx-auto px-6 text-center relative z-10 space-y-8">
          {/* Badge */}
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-accent-cyan/10 border border-accent-cyan/20 text-accent-cyan text-xs font-mono tracking-wide">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Consultas Inteligentes de Lore y Meta</span>
          </div>

          {/* Título Principal */}
          <h1 className="text-4xl md:text-6xl font-extrabold tracking-tight leading-[1.1] text-white">
            Descubre el Lore profundo y domina el <span className="gradient-text-gaming">Meta Actual</span>
          </h1>

          {/* Subtítulo */}
          <p className="text-slate-400 text-base md:text-lg max-w-2xl mx-auto font-normal leading-relaxed">
            GIMA es la primera plataforma de inteligencia artificial optimizada para la comunidad gacha. Obtén respuestas detalladas del Lore fijo de historias y rastrea el Meta online al instante.
          </p>

          {/* CTAs */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
            <button
              onClick={handleCTA}
              className="w-full sm:w-auto px-8 py-3.5 bg-gradient-to-r from-accent-violet to-accent-cyan text-white font-bold rounded-xl shadow-lg shadow-accent-violet/20 hover:opacity-95 active:scale-98 transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              {isLoggedIn ? 'Acceder a la Consola' : 'Comenzar Gratis'}
              <ArrowRight className="w-4 h-4" />
            </button>
            <button
              onClick={() => scrollToSection('funcionamiento')}
              className="w-full sm:w-auto px-8 py-3.5 bg-slate-950/60 border border-slate-800 hover:border-slate-700 text-slate-300 hover:text-white font-bold rounded-xl transition-all cursor-pointer"
            >
              Cómo Funciona
            </button>
          </div>

          {/* Mini-estadísticas */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-6 max-w-xl mx-auto pt-12 border-t border-slate-900/60">
            <div className="text-center space-y-1">
              <div className="text-xl font-extrabold text-white">Multijuegos</div>
              <div className="text-xs text-slate-500 font-mono">Genshin, WW, HSR y más</div>
            </div>
            <div className="text-center space-y-1 border-l border-slate-900/60">
              <div className="text-xl font-extrabold text-white">5 Gratis/Día</div>
              <div className="text-xs text-slate-500 font-mono">Créditos de recarga diaria</div>
            </div>
            <div className="text-center space-y-1 border-l border-slate-900/60 col-span-2 md:col-span-1">
              <div className="text-xl font-extrabold text-white">Híbrido IA</div>
              <div className="text-xs text-slate-500 font-mono">Vectores + Web real-time</div>
            </div>
          </div>
        </div>
      </section>

      {/* CÓMO FUNCIONA */}
      <section id="funcionamiento" className="py-20 border-t border-slate-900/50 bg-slate-950/20 relative">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center max-w-xl mx-auto mb-16 space-y-3">
            <h2 className="text-xs font-bold uppercase tracking-widest text-accent-pink font-mono">Tecnología Inteligente</h2>
            <h3 className="text-3xl font-extrabold text-white tracking-tight">
              ¿Cómo opera el Motor de GIMA?
            </h3>
            <p className="text-sm text-slate-400 leading-relaxed">
              Resolvemos tus preguntas combinando el conocimiento estático oficial del Lore con el análisis del Meta en constante cambio de internet.
            </p>
          </div>

          {/* Tarjetas del Flujo */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            {[
              {
                step: '01',
                title: 'Pregunta en el Chat',
                desc: 'Haces una pregunta sobre builds de personajes, sinergias de equipos o misterios de la historia.',
                icon: MessageSquare,
                color: 'text-accent-cyan'
              },
              {
                step: '02',
                title: 'Búsqueda en Vectores',
                desc: 'Escaneamos la base de datos de Supabase (Postgres + pgvector) para recuperar el Lore oficial e inmutable.',
                icon: BookOpen,
                color: 'text-accent-violet'
              },
              {
                step: '03',
                title: 'Rastreo Web en Tiempo Real',
                desc: 'Consultamos la API de Perplexity para buscar tendencias, parches y builds en foros como Reddit y Discord.',
                icon: Search,
                color: 'text-accent-pink'
              },
              {
                step: '04',
                title: 'Consumo y Streaming',
                desc: 'Descontamos 1 crédito, unificamos la información y te la entregamos en streaming palabra por palabra.',
                icon: Cpu,
                color: 'text-emerald-400'
              }
            ].map((flow, i) => {
              const IconComp = flow.icon;
              return (
                <div key={i} className="p-6 rounded-xl glass-panel border border-slate-900 hover:border-slate-800/80 transition-all flex flex-col justify-between space-y-4 group">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-mono text-slate-600 font-bold">{flow.step}</span>
                    <IconComp className={`w-5 h-5 ${flow.color}`} />
                  </div>
                  <div className="space-y-1">
                    <h4 className="font-bold text-sm text-slate-200">{flow.title}</h4>
                    <p className="text-xs text-slate-400 leading-relaxed">{flow.desc}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* CARACTERÍSTICAS */}
      <section id="caracteristicas" className="py-20 relative">
        {/* Luz decorativa */}
        <div className="absolute right-0 top-1/2 -translate-y-1/2 w-80 h-80 rounded-full bg-accent-pink/5 blur-[120px] pointer-events-none" />

        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center max-w-xl mx-auto mb-16 space-y-3">
            <h2 className="text-xs font-bold uppercase tracking-widest text-accent-cyan font-mono">Funcionalidades</h2>
            <h3 className="text-3xl font-extrabold text-white tracking-tight">
              Pensado para jugadores Gacha
            </h3>
            <p className="text-sm text-slate-400 leading-relaxed">
              Ya sea que quieras sumergirte en la historia de tus waifus/husbandos o quieras exprimir cada punto de daño de tu equipo.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {/* Feature 1 */}
            <div className="p-6 rounded-xl glass-panel border border-slate-900 hover:border-slate-800/60 transition-all space-y-4">
              <div className="w-10 h-10 rounded-lg bg-accent-cyan/10 border border-accent-cyan/25 flex items-center justify-center text-accent-cyan">
                <BookOpen className="w-5 h-5" />
              </div>
              <div className="space-y-1">
                <h4 className="font-bold text-base text-slate-200">Oráculo del Lore profundo</h4>
                <p className="text-xs text-slate-400 leading-relaxed">
                  ¿Confundido por la trama de un juego? Accede a explicaciones claras y detalladas del lore del juego basadas en archivos oficiales vectorizados, sin rodeos.
                </p>
              </div>
            </div>

            {/* Feature 2 */}
            <div className="p-6 rounded-xl glass-panel border border-slate-900 hover:border-slate-800/60 transition-all space-y-4">
              <div className="w-10 h-10 rounded-lg bg-accent-violet/10 border border-accent-violet/25 flex items-center justify-center text-accent-violet">
                <Search className="w-5 h-5" />
              </div>
              <div className="space-y-1">
                <h4 className="font-bold text-base text-slate-200">Rastreador del Meta en vivo</h4>
                <p className="text-xs text-slate-400 leading-relaxed">
                  El meta de los gacha cambia con cada actualización. GIMA busca en foros activos y comunidades en el momento de tu consulta para traerte las builds actuales de los personajes.
                </p>
              </div>
            </div>

            {/* Feature 3 */}
            <div className="p-6 rounded-xl glass-panel border border-slate-900 hover:border-slate-800/60 transition-all space-y-4">
              <div className="w-10 h-10 rounded-lg bg-accent-pink/10 border border-accent-pink/25 flex items-center justify-center text-accent-pink">
                <Cpu className="w-5 h-5" />
              </div>
              <div className="space-y-1">
                <h4 className="font-bold text-base text-slate-200">Control de Créditos Diario</h4>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Garantizamos acceso gratuito a todos los usuarios registrados con 5 consultas de IA diarias. Si necesitas más para una sesión intensa de juego, puedes recargar de forma instantánea.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* PLANES / MONETIZACIÓN */}
      <section id="precios" className="py-20 border-t border-slate-900/50 bg-slate-950/10 relative">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center max-w-xl mx-auto mb-16 space-y-3">
            <h2 className="text-xs font-bold uppercase tracking-widest text-accent-violet font-mono">Precios Claros</h2>
            <h3 className="text-3xl font-extrabold text-white tracking-tight">
              Planes adaptados a tu ritmo
            </h3>
            <p className="text-sm text-slate-400 leading-relaxed">
              Elige el acceso diario gratuito o sube de nivel con consultas ilimitadas para tus días de farmeo y análisis profundo.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-3xl mx-auto">
            {/* Plan Gratis */}
            <div className="p-8 rounded-xl glass-panel border border-slate-900 flex flex-col justify-between space-y-6 relative overflow-hidden">
              <div className="space-y-4">
                <div className="text-xs font-mono text-slate-400 uppercase tracking-widest">Viajero (Gratis)</div>
                <div className="flex items-baseline gap-1">
                  <span className="text-3xl font-black text-white">$0</span>
                  <span className="text-xs text-slate-500 font-mono">/ siempre gratis</span>
                </div>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Perfecto para consultas ocasionales sobre personajes y trasfondos de historia del meta actual.
                </p>
                <div className="border-t border-slate-900/60 pt-4 space-y-2">
                  <div className="flex items-center gap-2 text-xs text-slate-300">
                    <ShieldCheck className="w-4 h-4 text-accent-cyan" />
                    <span>5 consultas diarias gratuitas</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-slate-300">
                    <ShieldCheck className="w-4 h-4 text-accent-cyan" />
                    <span>Recarga automática diaria</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-slate-300">
                    <ShieldCheck className="w-4 h-4 text-accent-cyan" />
                    <span>Historial local de chats</span>
                  </div>
                </div>
              </div>
              <button
                onClick={handleCTA}
                className="w-full py-3 bg-slate-900 border border-slate-800 hover:border-slate-700 text-slate-200 hover:text-white font-bold text-xs rounded-lg tracking-wider uppercase transition-all cursor-pointer"
              >
                {isLoggedIn ? 'Ir al Chat' : 'Comenzar Ahora'}
              </button>
            </div>

            {/* Plan Pro */}
            <div className="p-8 rounded-xl bg-gradient-to-br from-accent-violet/10 to-accent-pink/5 border border-accent-violet/40 flex flex-col justify-between space-y-6 relative overflow-hidden">
              <div className="absolute top-0 right-8 bg-accent-pink text-white text-[8px] font-extrabold uppercase font-mono px-3 py-1 rounded-b shadow-sm tracking-wider">
                Recomendado
              </div>
              
              <div className="space-y-4">
                <div className="text-xs font-mono text-accent-cyan uppercase tracking-widest">Gacha Pro (Premium)</div>
                <div className="flex items-baseline gap-1">
                  <span className="text-3xl font-black text-white">$4.99</span>
                  <span className="text-xs text-slate-400 font-mono">/ mes</span>
                </div>
                <p className="text-xs text-slate-200 leading-relaxed">
                  Para los analistas dedicados del meta y los creadores de contenido de videojuegos gacha.
                </p>
                <div className="border-t border-accent-violet/20 pt-4 space-y-2">
                  <div className="flex items-center gap-2 text-xs text-slate-200">
                    <ShieldCheck className="w-4 h-4 text-accent-pink" />
                    <span>Consultas ilimitadas (sin límites diarios)</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-slate-200">
                    <ShieldCheck className="w-4 h-4 text-accent-pink" />
                    <span>Respuestas prioritarias más rápidas</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-slate-200">
                    <ShieldCheck className="w-4 h-4 text-accent-pink" />
                    <span>Búsqueda semántica ilimitada</span>
                  </div>
                </div>
              </div>
              
              <button
                onClick={handleCTA}
                className="w-full py-3 bg-gradient-to-r from-accent-violet to-accent-pink hover:opacity-90 text-white font-bold text-xs rounded-lg tracking-wider uppercase transition-all shadow-md shadow-accent-violet/20 cursor-pointer"
              >
                Obtener Gacha Pro
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="border-t border-slate-900/60 bg-slate-950 py-12 text-slate-500 text-xs relative z-10">
        <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-2">
            <div className="p-1 bg-slate-900 border border-slate-800 rounded-md text-accent-pink">
              <Gamepad2 className="w-4 h-4" />
            </div>
            <span className="font-extrabold text-sm tracking-wider text-slate-400">
              GIMA
            </span>
            <span className="text-[10px] text-slate-600 font-mono">v0.1.0</span>
          </div>

          <div className="flex items-center gap-6">
            <span className="hover:text-slate-400 transition-colors">Lore Database</span>
            <span className="hover:text-slate-400 transition-colors">Meta Analyzer</span>
            <span className="hover:text-slate-400 transition-colors">Contacto</span>
          </div>

          <div>
            <span>&copy; {new Date().getFullYear()} GIMA AI. Todos los derechos reservados.</span>
          </div>
        </div>
      </footer>

    </div>
  );
}
