'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { 
  ArrowLeft, Mail, RefreshCw, Search, CheckCircle2, 
  XCircle, Clock, Copy, Check, FileText, AlertTriangle 
} from 'lucide-react';

interface EmailLogEntry {
  timestamp: string;
  email: string;
  name: string;
  status: 'success' | 'failed';
  details: string;
  type: string;
}

export default function EmailLogsPage() {
  const router = useRouter();
  
  const [logs, setLogs] = useState<EmailLogEntry[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  const fetchLogs = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/email-logs');
      if (!res.ok) {
        throw new Error('Error al obtener los logs del servidor.');
      }
      const data = await res.json();
      setLogs(data.logs || []);
    } catch (err: any) {
      setError(err.message || 'No se pudieron cargar los registros de correo.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  const handleCopyLink = async (text: string, index: number) => {
    // Buscar si hay un enlace en el campo details
    const urlRegex = /(https?:\/\/[^\s]+)/;
    const match = text.match(urlRegex);
    const linkToCopy = match ? match[0] : text;

    try {
      await navigator.clipboard.writeText(linkToCopy);
      setCopiedIndex(index);
      setTimeout(() => setCopiedIndex(null), 2000);
    } catch (err) {
      console.error('Error al copiar:', err);
    }
  };

  // Filtrar logs según búsqueda
  const filteredLogs = logs.filter(log => 
    log.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
    log.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    log.status.toLowerCase().includes(searchQuery.toLowerCase()) ||
    log.details.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Estadísticas
  const totalLogs = logs.length;
  const successCount = logs.filter(l => l.status === 'success').length;
  const failedCount = logs.filter(l => l.status === 'failed').length;
  const successRate = totalLogs > 0 ? Math.round((successCount / totalLogs) * 100) : 100;

  const formatDate = (isoString: string) => {
    try {
      const date = new Date(isoString);
      return date.toLocaleString('es-ES', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      });
    } catch {
      return isoString;
    }
  };

  return (
    <div className="min-h-screen bg-[#06060c] text-slate-100 font-sans pb-16">
      
      {/* HEADER / NAVBAR */}
      <header className="sticky top-0 z-40 bg-slate-950/80 backdrop-blur-md border-b border-slate-900 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button 
            onClick={() => router.push('/register')}
            className="p-2 hover:bg-slate-900 border border-slate-800 hover:border-slate-700 text-slate-400 hover:text-slate-200 rounded-lg transition-all cursor-pointer"
            title="Volver al Registro"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <Mail className="w-5 h-5 text-accent-cyan animate-pulse" />
              <span className="font-extrabold text-lg tracking-wider gradient-text-gaming leading-none block">
                GIMA EMAIL LOGS
              </span>
            </div>
            <span className="text-[10px] text-slate-500 font-mono tracking-wider block mt-1">
              HISTORIAL DE REGISTROS Y ESTADO DE SMTP (GMAIL)
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={fetchLogs}
            disabled={loading}
            className="p-2 hover:bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-900 hover:border-slate-800 rounded-lg transition-all cursor-pointer disabled:opacity-50"
            title="Actualizar Logs"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={() => router.push('/register')}
            className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 text-slate-300 hover:text-white text-xs font-bold rounded-lg transition-all cursor-pointer"
          >
            Volver a Registro
          </button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 pt-8 space-y-8">
        
        {/* TARJETAS DE ESTADÍSTICAS */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="glass-panel p-5 rounded-xl border border-slate-900">
            <span className="text-xs text-slate-500 font-mono block uppercase">Total Envíos</span>
            <span className="text-3xl font-extrabold text-white mt-1 block">{totalLogs}</span>
          </div>
          <div className="glass-panel p-5 rounded-xl border border-slate-900">
            <span className="text-xs text-slate-500 font-mono block uppercase">Enviados (Éxito)</span>
            <span className="text-3xl font-extrabold text-emerald-400 mt-1 block">{successCount}</span>
          </div>
          <div className="glass-panel p-5 rounded-xl border border-slate-900">
            <span className="text-xs text-slate-500 font-mono block uppercase">Fallidos</span>
            <span className="text-3xl font-extrabold text-red-400 mt-1 block">{failedCount}</span>
          </div>
          <div className="glass-panel p-5 rounded-xl border border-slate-900">
            <span className="text-xs text-slate-500 font-mono block uppercase">Tasa de Éxito</span>
            <span className="text-3xl font-extrabold text-accent-cyan mt-1 block">{successRate}%</span>
          </div>
        </div>

        {/* BUSCADOR */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input 
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Filtrar por correo, nombre, estado o detalles..."
            className="w-full pl-10 pr-4 py-3 bg-slate-950/60 border border-slate-850 focus:border-accent-cyan rounded-xl text-sm text-slate-200 outline-none transition-all placeholder:text-slate-500"
          />
        </div>

        {/* TABLA DE LOGS */}
        <div className="glass-panel rounded-2xl border border-slate-900 overflow-hidden bg-slate-950/20">
          {loading && logs.length === 0 ? (
            <div className="flex flex-col items-center justify-center space-y-4 p-20">
              <div className="w-10 h-10 border-4 border-t-accent-cyan border-slate-900 rounded-full animate-spin"></div>
              <p className="text-xs font-mono text-slate-500">Cargando historial de envío...</p>
            </div>
          ) : error ? (
            <div className="p-12 text-center space-y-4">
              <AlertTriangle className="w-8 h-8 text-red-500 mx-auto" />
              <p className="text-sm text-red-450">{error}</p>
              <button 
                onClick={fetchLogs} 
                className="px-4 py-2 bg-slate-900 border border-slate-800 text-xs font-bold rounded-lg cursor-pointer"
              >
                Reintentar
              </button>
            </div>
          ) : filteredLogs.length === 0 ? (
            <div className="p-20 text-center space-y-3">
              <FileText className="w-10 h-10 text-slate-600 mx-auto" />
              <p className="text-sm text-slate-400 font-medium">No se encontraron registros de correos.</p>
              <p className="text-xs text-slate-600">Completa un registro en /register para generar un log.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm border-collapse">
                <thead>
                  <tr className="border-b border-slate-900 bg-slate-950/40 text-slate-400 font-mono text-xs uppercase">
                    <th className="py-4 px-6 font-semibold">Estado</th>
                    <th className="py-4 px-6 font-semibold">Destinatario</th>
                    <th className="py-4 px-6 font-semibold">Fecha / Hora</th>
                    <th className="py-4 px-6 font-semibold">Detalles del Envío</th>
                    <th className="py-4 px-6 font-semibold text-center">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-900/60">
                  {filteredLogs.map((log, idx) => {
                    const hasLink = log.details.includes('http://') || log.details.includes('https://');
                    return (
                      <tr key={idx} className="hover:bg-slate-900/20 transition-colors">
                        {/* Estado */}
                        <td className="py-4 px-6">
                          {log.status === 'success' ? (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-semibold">
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              Éxito
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-semibold">
                              <XCircle className="w-3.5 h-3.5" />
                              Error
                            </span>
                          )}
                        </td>

                        {/* Destinatario */}
                        <td className="py-4 px-6">
                          <div className="font-semibold text-slate-200">{log.name}</div>
                          <div className="text-xs text-slate-500 font-mono">{log.email}</div>
                        </td>

                        {/* Fecha */}
                        <td className="py-4 px-6 text-slate-350 text-xs font-mono">
                          <div className="flex items-center gap-1">
                            <Clock className="w-3 h-3 text-slate-500" />
                            {formatDate(log.timestamp)}
                          </div>
                        </td>

                        {/* Detalles */}
                        <td className="py-4 px-6">
                          <div className="max-w-md">
                            {log.status === 'failed' ? (
                              <div className="p-2.5 bg-red-950/20 border border-red-900/30 text-red-400 font-mono text-[11px] rounded-lg break-words whitespace-pre-wrap leading-relaxed shadow-sm">
                                {log.details}
                              </div>
                            ) : (
                              <div className="p-2 bg-slate-900/40 border border-slate-850/60 font-mono text-[11px] text-slate-400 rounded-lg truncate shadow-sm">
                                {log.details}
                              </div>
                            )}
                          </div>
                        </td>

                        {/* Acciones */}
                        <td className="py-4 px-6 text-center">
                          <button
                            onClick={() => handleCopyLink(log.details, idx)}
                            className={`p-2 rounded-lg border transition-all inline-flex items-center gap-1 text-xs font-bold cursor-pointer ${
                              copiedIndex === idx
                                ? 'bg-emerald-950/40 border-emerald-800 text-emerald-400'
                                : 'bg-slate-900 hover:bg-slate-800 border-slate-800 text-slate-300 hover:text-white'
                            }`}
                            title={hasLink ? "Copiar enlace de confirmación" : "Copiar ID/Mensaje"}
                          >
                            {copiedIndex === idx ? (
                              <>
                                <Check className="w-3.5 h-3.5" />
                                <span className="hidden sm:inline">Copiado</span>
                              </>
                            ) : (
                              <>
                                <Copy className="w-3.5 h-3.5" />
                                <span className="hidden sm:inline">
                                  {hasLink ? 'Copiar Enlace' : 'Copiar'}
                                </span>
                              </>
                            )}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
        
      </main>
    </div>
  );
}
