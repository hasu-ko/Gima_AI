'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { 
  Gamepad2, Sparkles, Send, Coins, LogOut, MessageSquare, 
  Search, ShieldAlert, CreditCard, Check, X, RefreshCw, Zap,
  Plus, Trash2, Menu, Settings, Camera, User, Lock, ExternalLink, Globe
} from 'lucide-react';

interface RAGSource {
  id: number;
  title: string;
  url: string;
}

interface Message {
  role: 'user' | 'assistant';
  content: string;
  fuentes?: RAGSource[];
  modo?: string;
  modelo?: string;
}

interface Conversation {
  id: string;
  user_id: string;
  titulo: string;
  created_at: string;
  updated_at: string;
}

// Función lightweight para renderizar markdown básico en HTML
function renderMarkdown(text: string): string {
  if (!text) return '';
  
  let html = text
    // Escapar HTML básico
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    // Code blocks (antes de otras transformaciones)
    .replace(/```(\w*)\n([\s\S]*?)```/g, '<pre><code>$2</code></pre>')
    // Inline code
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    // Headers
    .replace(/^### (.+)$/gm, '<h3>$1</h3>')
    .replace(/^## (.+)$/gm, '<h2>$1</h2>')
    .replace(/^# (.+)$/gm, '<h1>$1</h1>')
    // Bold y italic
    .replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    // Links
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>')
    // Horizontal rule
    .replace(/^---$/gm, '<hr />')
    // Listas no-ordenadas  
    .replace(/^[-•] (.+)$/gm, '<li>$1</li>')
    // Citas [Fuente N] resaltadas
    .replace(/\[Fuente (\d+)\]/g, '<strong style="color:#67e8f9">[Fuente $1]</strong>')
    .replace(/\[(\d+)\]/g, '<strong style="color:#67e8f9">[$1]</strong>')
    // Line breaks (doble newline = párrafo, single = br)
    .replace(/\n\n/g, '</p><p>')
    .replace(/\n/g, '<br />');
  
  // Envolver listas
  html = html.replace(/(<li>.*?<\/li>(?:<br \/>)?)+/g, (match) => {
    return '<ul>' + match.replace(/<br \/>/g, '') + '</ul>';
  });
  
  // Envolver en párrafo
  html = '<p>' + html + '</p>';
  
  // Limpiar párrafos vacíos
  html = html.replace(/<p>\s*<\/p>/g, '');
  
  return html;
}

export default function ChatPage() {
  const router = useRouter();
  const [user, setUser] = useState<{ id: string; email: string; name: string; avatar?: string; isMock?: boolean; isAdmin?: boolean } | null>(null);
  const [loading, setLoading] = useState(true);

  // Dropdown del usuario
  const [showUserMenu, setShowUserMenu] = useState(false);
  
  // Modal de Ajustes
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [newName, setNewName] = useState('');
  const [newAvatar, setNewAvatar] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [settingsError, setSettingsError] = useState<string | null>(null);
  const [settingsSuccess, setSettingsSuccess] = useState<string | null>(null);
  const [savingSettings, setSavingSettings] = useState(false);

  // Cargar estados del modal cuando se abre
  useEffect(() => {
    if (showSettingsModal && user) {
      setNewName(user.name || '');
      setNewAvatar(user.avatar || '');
      setNewPassword('');
      setConfirmPassword('');
      setSettingsError(null);
      setSettingsSuccess(null);
    }
  }, [showSettingsModal, user]);

  // Cerrar el menú de usuario al hacer click fuera
  useEffect(() => {
    if (!showUserMenu) return;
    const handleCloseMenu = () => setShowUserMenu(false);
    window.addEventListener('click', handleCloseMenu);
    return () => window.removeEventListener('click', handleCloseMenu);
  }, [showUserMenu]);
  
  // Chat state
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputMsg, setInputMsg] = useState('');
  const [sending, setSending] = useState(false);
  const [credits, setCredits] = useState(5);
  const [searchModo, setSearchModo] = useState<'completo' | 'rapido'>('completo');
  const [isCreditsMock, setIsCreditsMock] = useState(true);

  // Estados de multi-conversación
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConvId, setActiveConvId] = useState<string | null>(null);
  const [loadingConvs, setLoadingConvs] = useState<boolean>(true);
  const [isSidebarOpen, setIsSidebarOpen] = useState<boolean>(false);
  
  // Modales
  const [showPaywall, setShowPaywall] = useState(false);
  const [buyingPlan, setBuyingPlan] = useState<string | null>(null);
  const [rechargeSuccess, setRechargeSuccess] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const typewriterIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Limpieza del intervalo de escritura al desmontar
  useEffect(() => {
    return () => {
      if (typewriterIntervalRef.current) {
        clearInterval(typewriterIntervalRef.current);
      }
    };
  }, []);

  // Cargar sesión del usuario al montar
  useEffect(() => {
    async function checkAuth() {
      const isDbConfigured = isSupabaseConfigured();
      if (isDbConfigured) {
        localStorage.removeItem('gima_mock_session');
      } else {
        // 1. Verificar sesión simulada
        const mockSessionStr = localStorage.getItem('gima_mock_session');
        if (mockSessionStr) {
          const mockUser = JSON.parse(mockSessionStr);
          // Set mock admin for testing purposes
          if (mockUser.id === 'dev-user-12345') mockUser.isAdmin = true;
          setUser(mockUser);
          await syncCredits(mockUser.id);
          await loadConversations(mockUser.id, true);
          setLoading(false);
          return;
        }
      }

      // 2. Verificar sesión real de Supabase
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session && session.user) {
          let profileName = '';
          let profileAvatar = '';
          let profileIsAdmin = false;
          try {
            const { data: profile } = await supabase
              .from('perfiles')
              .select('*')
              .eq('id', session.user.id)
              .single();

            if (profile) {
              profileName = profile.nombre_completo || '';
              if ('avatar_url' in profile) {
                profileAvatar = profile.avatar_url || '';
              }
              if ('is_admin' in profile) {
                profileIsAdmin = profile.is_admin || false;
              }
            }
          } catch (e) {
            console.warn('Error reading from perfiles table:', e);
          }

          const realUser = {
            id: session.user.id,
            email: session.user.email ?? '',
            name: profileName || session.user.user_metadata?.nombre_completo || session.user.user_metadata?.name || session.user.email?.split('@')[0] || 'Viajero',
            avatar: profileAvatar || session.user.user_metadata?.avatar_url || '',
            isMock: false,
            isAdmin: profileIsAdmin
          };
          setUser(realUser);
          await syncCredits(realUser.id);
          await loadConversations(realUser.id, false);
        } else {
          // Si no hay sesión, mandar a login
          router.push('/login');
        }
      } catch (err) {
        console.error('Error de autenticación:', err);
        router.push('/login');
      } finally {
        setLoading(false);
      }
    }

    checkAuth();
  }, [router]);

  // Cargar conversaciones desde la base de datos o localStorage
  const loadConversations = async (userId: string, isMockUser: boolean) => {
    setLoadingConvs(true);
    if (isMockUser) {
      try {
        const storedConvs = localStorage.getItem('gima_conversations');
        if (storedConvs) {
          const allConvs = JSON.parse(storedConvs) as Conversation[];
          const userConvs = allConvs.filter(c => c.user_id === userId);
          userConvs.sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());
          setConversations(userConvs);
          if (userConvs.length > 0) {
            setActiveConvId(userConvs[0].id);
            loadMessages(userConvs[0].id, true);
          } else {
            handleNewChat();
          }
        } else {
          handleNewChat();
        }
      } catch (err) {
        console.error('Error al cargar conversaciones simuladas:', err);
      } finally {
        setLoadingConvs(false);
      }
    } else {
      try {
        const { data, error } = await supabase
          .from('conversaciones')
          .select('*')
          .eq('user_id', userId)
          .order('updated_at', { ascending: false });

        if (error) throw error;

        setConversations(data || []);
        if (data && data.length > 0) {
          setActiveConvId(data[0].id);
          loadMessages(data[0].id, false);
        } else {
          handleNewChat();
        }
      } catch (err) {
        console.error('Error al cargar conversaciones de Supabase:', err);
      } finally {
        setLoadingConvs(false);
      }
    }
  };

  // Cargar mensajes de una conversación
  const loadMessages = async (convId: string, isMockUser: boolean) => {
    if (isMockUser) {
      try {
        const storedMsgs = localStorage.getItem('gima_messages');
        if (storedMsgs) {
          const allMsgs = JSON.parse(storedMsgs) as Record<string, Message[]>;
          setMessages(allMsgs[convId] || []);
        } else {
          setMessages([]);
        }
      } catch (err) {
        console.error('Error al cargar mensajes simulados:', err);
      }
    } else {
      try {
        const { data, error } = await supabase
          .from('mensajes')
          .select('role, content')
          .eq('conversacion_id', convId)
          .order('created_at', { ascending: true });

        if (error) throw error;
        setMessages(data || []);
      } catch (err) {
        console.error('Error al cargar mensajes de Supabase:', err);
      }
    }
  };

  // Seleccionar una conversación
  const handleSelectConversation = (convId: string) => {
    setActiveConvId(convId);
    loadMessages(convId, user?.isMock ?? true);
    setIsSidebarOpen(false);
  };

  // Iniciar un nuevo chat vacío
  const handleNewChat = () => {
    setActiveConvId(null);
    setMessages([]);
    setIsSidebarOpen(false);
  };

  // Eliminar una conversación y sus mensajes
  const handleDeleteConversation = async (e: React.MouseEvent, convId: string) => {
    e.stopPropagation();
    const isMockUser = user?.isMock ?? true;

    if (isMockUser) {
      try {
        // Eliminar conversación del localStorage
        const storedConvs = localStorage.getItem('gima_conversations');
        if (storedConvs) {
          const allConvs = JSON.parse(storedConvs) as Conversation[];
          const updatedConvs = allConvs.filter(c => c.id !== convId);
          localStorage.setItem('gima_conversations', JSON.stringify(updatedConvs));
          setConversations(updatedConvs.filter(c => c.user_id === user?.id));
        }

        // Eliminar mensajes del localStorage
        const storedMsgs = localStorage.getItem('gima_messages');
        if (storedMsgs) {
          const allMsgs = JSON.parse(storedMsgs) as Record<string, Message[]>;
          delete allMsgs[convId];
          localStorage.setItem('gima_messages', JSON.stringify(allMsgs));
        }
      } catch (err) {
        console.error('Error al borrar conversación simulada:', err);
      }
    } else {
      try {
        const { error } = await supabase
          .from('conversaciones')
          .delete()
          .eq('id', convId);

        if (error) throw error;
        setConversations(prev => prev.filter(c => c.id !== convId));
      } catch (err) {
        console.error('Error al borrar conversación de Supabase:', err);
      }
    }

    // Si borramos la conversación activa, volvemos a la pantalla de nuevo chat
    if (activeConvId === convId) {
      handleNewChat();
    }
  };

  // Desplazar chat hacia abajo al recibir mensajes
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, sending]);

  // Sincronizar créditos con el backend
  const syncCredits = async (uid: string) => {
    try {
      const response = await fetch(`/api/credits?userId=${uid}`);
      if (response.ok) {
        const data = await response.json();
        setCredits(data.creditos);
        setIsCreditsMock(data.isMock);
        // Ensure UI updates user role if server says they're an admin
        if (data.isAdmin && user && !user.isAdmin) {
            setUser({ ...user, isAdmin: true });
        }
      }
    } catch (e) {
      console.error('Error fetching credits:', e);
    }
  };

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = 96;
        canvas.height = 96;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          const size = Math.min(img.width, img.height);
          const sx = (img.width - size) / 2;
          const sy = (img.height - size) / 2;
          ctx.drawImage(img, sx, sy, size, size, 0, 0, 96, 96);
          const base64 = canvas.toDataURL('image/jpeg', 0.85);
          setNewAvatar(base64);
        }
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setSavingSettings(true);
    setSettingsError(null);
    setSettingsSuccess(null);

    // Validar contraseñas si el usuario ingresó algo en newPassword
    if (newPassword) {
      if (newPassword.length < 6) {
        setSettingsError('La nueva contraseña debe tener al menos 6 caracteres.');
        setSavingSettings(false);
        return;
      }
      if (newPassword !== confirmPassword) {
        setSettingsError('Las contraseñas no coinciden.');
        setSavingSettings(false);
        return;
      }
    }

    try {
      if (user.isMock) {
        // Guardar en modo simulado (localStorage)
        const updatedUser = {
          ...user,
          name: newName,
          avatar: newAvatar
        };
        
        localStorage.setItem('gima_mock_session', JSON.stringify(updatedUser));
        setUser(updatedUser);
        setSettingsSuccess('Ajustes guardados correctamente.');
      } else {
        // Guardar en Supabase real
        if (newPassword) {
          const { error: pwdError } = await supabase.auth.updateUser({
            password: newPassword
          });
          if (pwdError) throw pwdError;
        }

        const { error: authError } = await supabase.auth.updateUser({
          data: {
            nombre_completo: newName,
            avatar_url: newAvatar
          }
        });
        if (authError) throw authError;

        try {
          const { error: dbError } = await supabase
            .from('perfiles')
            .update({
              nombre_completo: newName,
              avatar_url: newAvatar
            } as any)
            .eq('id', user.id);

          if (dbError) {
            await supabase
              .from('perfiles')
              .update({
                nombre_completo: newName
              })
              .eq('id', user.id);
          }
        } catch (dbErr) {
          console.warn('Error actualizando tabla perfiles:', dbErr);
        }

        setUser({
          ...user,
          name: newName,
          avatar: newAvatar
        });

        setSettingsSuccess('Ajustes guardados correctamente.');
      }
    } catch (err: any) {
      setSettingsError(err.message || 'Error al guardar los ajustes.');
    } finally {
      setSavingSettings(false);
    }
  };

  const handleLogout = async () => {
    if (typewriterIntervalRef.current) {
      clearInterval(typewriterIntervalRef.current);
      typewriterIntervalRef.current = null;
    }
    localStorage.removeItem('gima_mock_session');
    await supabase.auth.signOut();
    router.push('/');
  };

  // Enviar mensaje al Route Handler backend de Chat
  const handleSendMessage = async (e?: React.FormEvent, customText?: string) => {
    if (e) e.preventDefault();
    const queryText = customText || inputMsg;
    if (!queryText.trim() || sending) return;

    if (credits <= 0) {
      setShowPaywall(true);
      return;
    }

    const isMockUser = user?.isMock ?? true;
    let currentConvId = activeConvId;
    
    setSending(true);
    setInputMsg('');

    try {
      // 1. Si no hay conversación activa, crear una nueva primero
      if (!currentConvId) {
        const title = queryText.length > 25 ? queryText.substring(0, 25) + '...' : queryText;
        
        if (isMockUser) {
          const newConv: Conversation = {
            id: 'mock-conv-' + Math.random().toString(36).substring(2, 9),
            user_id: user?.id || 'dev-user-12345',
            titulo: title,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          };
          
          // Guardar conversación en localStorage
          const storedConvs = localStorage.getItem('gima_conversations');
          const allConvs = storedConvs ? (JSON.parse(storedConvs) as Conversation[]) : [];
          allConvs.unshift(newConv);
          localStorage.setItem('gima_conversations', JSON.stringify(allConvs));
          
          setConversations(prev => [newConv, ...prev]);
          setActiveConvId(newConv.id);
          currentConvId = newConv.id;
        } else {
          // Crear en Supabase
          const { data: convData, error: convError } = await supabase
            .from('conversaciones')
            .insert({
              user_id: user?.id,
              titulo: title
            })
            .select()
            .single();

          if (convError) throw convError;

          setConversations(prev => [convData, ...prev]);
          setActiveConvId(convData.id);
          currentConvId = convData.id;
        }
      }
      
      const convId = currentConvId as string;

      // 2. Agregar y persistir el mensaje del usuario
      const userMessage: Message = { role: 'user', content: queryText };
      const newMessages = [...messages, userMessage];
      setMessages(newMessages);

      if (isMockUser) {
        const storedMsgs = localStorage.getItem('gima_messages');
        const allMsgs = storedMsgs ? (JSON.parse(storedMsgs) as Record<string, Message[]>) : {};
        allMsgs[convId] = [...(allMsgs[convId] || []), userMessage];
        localStorage.setItem('gima_messages', JSON.stringify(allMsgs));
        
        // Actualizar timestamp en localStorage
        const storedConvs = localStorage.getItem('gima_conversations');
        if (storedConvs) {
          const allConvs = JSON.parse(storedConvs) as Conversation[];
          const currentConv = allConvs.find(c => c.id === convId);
          if (currentConv) {
            currentConv.updated_at = new Date().toISOString();
            localStorage.setItem('gima_conversations', JSON.stringify(allConvs));
            setConversations(allConvs.filter(c => c.user_id === user?.id).sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()));
          }
        }
      } else {
        // Guardar en Supabase
        const { error: msgError } = await supabase
          .from('mensajes')
          .insert({
            conversacion_id: convId,
            role: 'user',
            content: queryText
          });

        if (msgError) throw msgError;

        // Actualizar updated_at de la conversación en Supabase
        await supabase
          .from('conversaciones')
          .update({ updated_at: new Date().toISOString() })
          .eq('id', convId);

        // Actualizar orden en estado local
        setConversations(prev => {
          const index = prev.findIndex(c => c.id === convId);
          if (index !== -1) {
            const updated = [...prev];
            updated[index] = { ...updated[index], updated_at: new Date().toISOString() };
            return updated.sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());
          }
          return prev;
        });
      }

      // 3. Llamar al endpoint de chat para la respuesta del bot (RAG Agent)
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user?.id,
          message: queryText,
          modo: searchModo,
        }),
      });

      const data = await response.json();

      if (response.status === 402) {
        setCredits(0);
        setShowPaywall(true);
        const botErrorMsg: Message = { 
          role: 'assistant', 
          content: '⚠️ Lo siento, has agotado tus créditos de consulta diaria. Por favor compra más créditos o suscríbete para continuar.' 
        };
        setMessages([...newMessages, botErrorMsg]);
      } else if (!data.success) {
        // Error del agente RAG (503 = no disponible, 502 = error del agente)
        if (data.creditsRemaining !== undefined) {
          setCredits(data.creditsRemaining);
        }
        const errorDetail = data.error || 'Error desconocido al procesar la consulta.';
        const isRagDown = response.status === 503;
        const botErrorMsg: Message = { 
          role: 'assistant', 
          content: isRagDown
            ? `🔌 **El agente de búsqueda no está disponible.**\n\nAsegúrate de que el servidor FastAPI esté corriendo:\n\`\`\`\ncd fastapi-rag-search-agent\nuvicorn main:app --reload\n\`\`\`\n\n_Detalle: ${errorDetail}_`
            : `⚠️ **Error del agente de búsqueda:**\n\n${errorDetail}\n\n_Intenta de nuevo o reformula tu pregunta._`
        };
        setMessages([...newMessages, botErrorMsg]);
      } else {
        setCredits(data.creditsRemaining);
        
        const responseText = data.response;
        const botMessage: Message = { 
          role: 'assistant', 
          content: responseText,
          fuentes: data.fuentes || [],
          modo: data.modo,
          modelo: data.modelo,
        };
        
        // Efecto de máquina de escribir
        let charIndex = 0;
        setMessages([...newMessages, { role: 'assistant', content: '', fuentes: [], modo: data.modo, modelo: data.modelo }]);
        
        if (typewriterIntervalRef.current) {
          clearInterval(typewriterIntervalRef.current);
        }

        typewriterIntervalRef.current = setInterval(() => {
          setMessages((prev) => {
            const next = [...prev];
            const last = next[next.length - 1];
            if (last && last.role === 'assistant') {
              last.content = responseText.slice(0, charIndex + 1);
            }
            return next;
          });
          charIndex++;
          if (charIndex >= responseText.length) {
            if (typewriterIntervalRef.current) {
              clearInterval(typewriterIntervalRef.current);
              typewriterIntervalRef.current = null;
            }
            
            // Actualizar las fuentes al final de la animación
            setMessages((prev) => {
              const next = [...prev];
              const last = next[next.length - 1];
              if (last && last.role === 'assistant') {
                last.fuentes = botMessage.fuentes;
              }
              return next;
            });
            
            // Persistir el mensaje del bot al terminar la animación
            if (isMockUser) {
              const storedMsgs = localStorage.getItem('gima_messages');
              if (storedMsgs) {
                const allMsgs = JSON.parse(storedMsgs) as Record<string, Message[]>;
                allMsgs[convId] = [...(allMsgs[convId] || []), botMessage];
                localStorage.setItem('gima_messages', JSON.stringify(allMsgs));
              }
            } else {
              // Validar que el usuario siga autenticado antes de insertar en la DB
              supabase.auth.getSession().then(({ data: { session } }) => {
                if (!session) return;
                
                supabase
                  .from('mensajes')
                  .insert({
                    conversacion_id: convId,
                    role: 'assistant',
                    content: responseText
                  })
                  .then(({ error: insertBotError }) => {
                    if (insertBotError) console.error('Error al persistir respuesta del asistente en Supabase:', insertBotError);
                  });
              });
            }
          }
        }, 12);
      }
    } catch (err: any) {
      console.error('Error al enviar mensaje:', err);
      setMessages(prev => [...prev, { 
        role: 'assistant', 
        content: 'Hubo un error de red al procesar tu consulta. Por favor inténtalo de nuevo.' 
      }]);
    } finally {
      setSending(false);
    }
  };

  // Simular la pasarela de pago para recargar créditos
  const handleSimulatePayment = async (plan: string, amount: number) => {
    setBuyingPlan(plan);
    // Simular retraso de red del banco / pasarela
    await new Promise((resolve) => setTimeout(resolve, 1500));
    
    if (user) {
      try {
        const response = await fetch('/api/credits/recharge', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: user.id,
            amount: plan === 'pro' ? 9999 : 20, // 20 créditos o ilimitados (representado por 9999)
          }),
        });

        if (response.ok) {
          const data = await response.json();
          setCredits(data.credits);
          setRechargeSuccess(true);
          setTimeout(() => {
            setRechargeSuccess(false);
            setShowPaywall(false);
          }, 2000);
        }
      } catch (err) {
        console.error('Error al recargar:', err);
      }
    }
    setBuyingPlan(null);
  };

  const selectQuickQuestion = (question: string) => {
    if (credits <= 0) {
      setShowPaywall(true);
    } else {
      handleSendMessage(undefined, question);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen w-full flex flex-col items-center justify-center bg-[#06060c]">
        <RefreshCw className="w-10 h-10 text-accent-cyan animate-spin mb-4" />
        <p className="text-sm font-mono text-slate-400">Iniciando motor GIMA...</p>
      </div>
    );
  }

  return (
    <div className="flex h-screen w-full bg-[#06060c] text-slate-100 overflow-hidden font-sans">
      
      {/* SIDEBAR MÓVIL (DRAWER OVERLAY) */}
      {isSidebarOpen && (
        <div className="fixed inset-0 z-50 flex md:hidden bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
          <aside className="w-72 bg-slate-950 border-r border-slate-900 flex flex-col justify-between p-6 animate-in slide-in-from-left duration-300">
            <div className="flex flex-col h-full overflow-hidden">
              {/* Header con botón cerrar */}
              <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-2">
                  <div className="p-2 bg-accent-pink/10 border border-accent-pink/30 rounded-lg text-accent-pink">
                    <Gamepad2 className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="font-extrabold text-lg tracking-wider gradient-text-gaming leading-none">
                      GIMA
                    </span>
                    <div className="text-[9px] tracking-widest font-mono text-slate-500 uppercase">
                      Assistant
                      {user?.isAdmin && (
                        <span className="ml-2 px-1 rounded bg-red-500/20 text-red-400 border border-red-500/30">
                          ADMIN
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => setIsSidebarOpen(false)}
                  className="p-1 text-slate-500 hover:text-white rounded-md cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Botón Nuevo Chat */}
              <button 
                onClick={handleNewChat}
                className="w-full py-2.5 mb-4 text-center text-xs font-bold uppercase tracking-wider text-white bg-gradient-to-r from-accent-violet to-accent-cyan hover:opacity-95 rounded-lg transition-all cursor-pointer flex items-center justify-center gap-1.5 shadow-md shadow-accent-violet/10 shrink-0"
              >
                <Plus className="w-3.5 h-3.5" />
                Nuevo Chat
              </button>

              {/* Historial de chats */}
              <div className="flex-1 flex flex-col overflow-hidden">
                <div className="text-[10px] uppercase font-mono tracking-widest text-slate-500 mb-3 px-1 shrink-0">
                  Chats recientes
                </div>
                <div className="space-y-1.5 flex-1 overflow-y-auto pr-1">
                  {loadingConvs ? (
                    <div className="text-center py-4 text-xs text-slate-600 font-mono">Cargando chats...</div>
                  ) : conversations.length === 0 ? (
                    <div className="text-center py-6 text-xs text-slate-500 font-sans">No hay chats recientes</div>
                  ) : (
                    conversations.map((conv) => (
                      <div
                        key={conv.id}
                        className={`group w-full flex items-center justify-between p-2.5 rounded-lg border text-xs transition-all cursor-pointer ${
                          activeConvId === conv.id
                            ? 'border-accent-cyan bg-slate-900/60 text-white font-semibold'
                            : 'border-transparent hover:border-slate-800 bg-slate-900/10 hover:bg-slate-900/40 text-slate-400 hover:text-slate-200'
                        }`}
                        onClick={() => handleSelectConversation(conv.id)}
                      >
                        <div className="flex items-center gap-2 overflow-hidden flex-1">
                          <MessageSquare className="w-3.5 h-3.5 text-slate-600 shrink-0 group-hover:text-accent-cyan" />
                          <span className="truncate">{conv.titulo}</span>
                        </div>
                        <button
                          onClick={(e) => handleDeleteConversation(e, conv.id)}
                          className="opacity-0 group-hover:opacity-100 p-1 hover:text-red-400 rounded transition-all cursor-pointer"
                          title="Borrar chat"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Perfil del usuario / Cerrar sesión */}
              <div className="p-4 border-t border-slate-900 bg-slate-950/40 flex items-center justify-between mt-auto relative">
                <div className="flex items-center gap-2 overflow-hidden">
                  {user?.avatar ? (
                    <img 
                      src={user.avatar} 
                      alt="Avatar" 
                      className="w-8 h-8 rounded-full object-cover border border-slate-800 shrink-0" 
                    />
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-accent-violet to-accent-pink flex items-center justify-center text-xs font-bold text-white shrink-0">
                      {user?.name ? user.name.slice(0, 2).toUpperCase() : 'US'}
                    </div>
                  )}
                  <div className="flex flex-col overflow-hidden">
                    <span className="text-xs font-bold text-slate-200 truncate">{user?.name}</span>
                    <span className="text-[10px] text-slate-500 font-mono truncate">{user?.email}</span>
                  </div>
                </div>
                <div className="relative">
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowUserMenu(!showUserMenu);
                    }}
                    title="Ajustes y Sesión"
                    className="p-1.5 text-slate-500 hover:text-white rounded-md hover:bg-slate-900 transition-all cursor-pointer"
                  >
                    <Settings className="w-4 h-4" />
                  </button>
                  
                  {showUserMenu && (
                    <div className="absolute bottom-full right-0 mb-2 w-48 bg-slate-950/95 border border-slate-800 rounded-xl p-2.5 shadow-2xl flex flex-col gap-1 z-50 animate-in fade-in slide-in-from-bottom-2 duration-200">
                      <button
                        onClick={() => {
                          setShowUserMenu(false);
                          setShowSettingsModal(true);
                        }}
                        className="w-full flex items-center gap-2 px-3 py-2 text-xs text-slate-350 hover:text-white hover:bg-slate-900 rounded-lg transition-all cursor-pointer text-left font-medium"
                      >
                        <Settings className="w-3.5 h-3.5 text-accent-cyan" />
                        Ajustes de Cuenta
                      </button>
                      
                      {user?.isAdmin && (
                        <button
                          onClick={() => {
                            setShowUserMenu(false);
                            router.push('/admin');
                          }}
                          className="w-full flex items-center gap-2 px-3 py-2 text-xs text-accent-violet hover:text-white hover:bg-slate-900 rounded-lg transition-all cursor-pointer text-left font-medium"
                        >
                          <Lock className="w-3.5 h-3.5 text-accent-violet" />
                          Panel de Admin
                        </button>
                      )}
                      
                      <div className="h-[1px] bg-slate-900 my-1" />
                      <button
                        onClick={() => {
                          setShowUserMenu(false);
                          handleLogout();
                        }}
                        className="w-full flex items-center gap-2 px-3 py-2 text-xs text-slate-400 hover:text-red-400 hover:bg-red-950/15 rounded-lg transition-all cursor-pointer text-left font-medium"
                      >
                        <LogOut className="w-3.5 h-3.5" />
                        Cerrar sesión
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </aside>
          <div className="flex-1" onClick={() => setIsSidebarOpen(false)} />
        </div>
      )}

      {/* SIDEBAR IZQUIERDO */}
      <aside className="w-80 border-r border-slate-900 bg-slate-950/70 backdrop-blur-md flex flex-col justify-between hidden md:flex shrink-0">
        <div className="p-6 flex flex-col h-full overflow-hidden">
          
          {/* Logo */}
          <div className="flex items-center gap-2 mb-8 cursor-pointer" onClick={() => router.push('/')}>
            <div className="p-2 bg-accent-pink/10 border border-accent-pink/30 rounded-lg text-accent-pink">
              <Gamepad2 className="w-5 h-5" />
            </div>
            <div>
              <span className="font-extrabold text-lg tracking-wider gradient-text-gaming leading-none">
                GIMA
              </span>
              <div className="text-[9px] tracking-widest font-mono text-slate-500 uppercase">
                Assistant v0.1.0
              </div>
            </div>
          </div>

          {/* Monitor de Créditos */}
          <div className="p-4 rounded-xl glass-panel border border-slate-800/80 mb-6 relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-16 h-16 bg-gradient-to-br from-accent-cyan/10 to-transparent rounded-bl-full" />
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-mono text-slate-400 font-semibold uppercase tracking-wider flex items-center gap-1.5">
                <Coins className="w-3.5 h-3.5 text-accent-cyan" />
                Créditos Diarios
              </span>
              <span className="text-xs font-bold font-mono text-white">
                {credits === 9999 ? '∞' : `${credits} / 5`}
              </span>
            </div>
            
            {/* Barra de progreso visual */}
            <div className="w-full bg-slate-900 rounded-full h-1.5 mb-2 overflow-hidden border border-slate-800">
              <div 
                className="bg-gradient-to-r from-accent-violet to-accent-cyan h-full transition-all duration-500" 
                style={{ width: `${credits === 9999 ? 100 : (credits / 5) * 100}%` }}
              />
            </div>
            
            <p className="text-[10px] text-slate-500 font-mono">
              {isCreditsMock ? '⚡ Servidor en memoria local' : '🔒 Conectado a base de datos'}
            </p>

            {credits === 0 && (
              <button 
                onClick={() => setShowPaywall(true)}
                className="mt-3 w-full py-1.5 text-center text-[10px] font-bold uppercase tracking-wider text-pink-300 bg-accent-pink/10 hover:bg-accent-pink/20 border border-accent-pink/30 rounded-md transition-all cursor-pointer flex items-center justify-center gap-1"
              >
                <Zap className="w-3 h-3 text-accent-pink" />
                Obtener Créditos Pro
              </button>
            )}
          </div>

          {/* Historial de chats */}
          <div className="flex-1 flex flex-col overflow-hidden">
            <button 
              onClick={handleNewChat}
              className="w-full py-2.5 mb-4 text-center text-xs font-bold uppercase tracking-wider text-white bg-gradient-to-r from-accent-violet to-accent-cyan hover:opacity-95 rounded-lg transition-all cursor-pointer flex items-center justify-center gap-1.5 shadow-md shadow-accent-violet/10 shrink-0"
            >
              <Plus className="w-3.5 h-3.5" />
              Nuevo Chat
            </button>
            <div className="text-[10px] uppercase font-mono tracking-widest text-slate-500 mb-3 px-1 shrink-0">
              Chats recientes
            </div>
            <div className="space-y-1.5 flex-1 overflow-y-auto pr-1">
              {loadingConvs ? (
                <div className="text-center py-4 text-xs text-slate-600 font-mono">Cargando chats...</div>
              ) : conversations.length === 0 ? (
                <div className="text-center py-6 text-xs text-slate-500 font-sans">No hay chats recientes</div>
              ) : (
                conversations.map((conv) => (
                  <div
                    key={conv.id}
                    className={`group w-full flex items-center justify-between p-2.5 rounded-lg border text-xs transition-all cursor-pointer ${
                      activeConvId === conv.id
                        ? 'border-accent-cyan bg-slate-900/60 text-white font-semibold'
                        : 'border-transparent hover:border-slate-800 bg-slate-900/10 hover:bg-slate-900/40 text-slate-400 hover:text-slate-200'
                    }`}
                    onClick={() => handleSelectConversation(conv.id)}
                  >
                    <div className="flex items-center gap-2 overflow-hidden flex-1">
                      <MessageSquare className="w-3.5 h-3.5 text-slate-600 shrink-0 group-hover:text-accent-cyan" />
                      <span className="truncate">{conv.titulo}</span>
                    </div>
                    <button
                      onClick={(e) => handleDeleteConversation(e, conv.id)}
                      className="opacity-0 group-hover:opacity-100 p-1 hover:text-red-400 rounded transition-all cursor-pointer"
                      title="Borrar chat"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>

        </div>

        {/* Perfil del usuario / Cerrar sesión */}
        <div className="p-4 border-t border-slate-900 bg-slate-950/40 flex items-center justify-between relative">
          <div className="flex items-center gap-2 overflow-hidden">
            {user?.avatar ? (
              <img 
                src={user.avatar} 
                alt="Avatar" 
                className="w-8 h-8 rounded-full object-cover border border-slate-800 shrink-0" 
              />
            ) : (
              <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-accent-violet to-accent-pink flex items-center justify-center text-xs font-bold text-white shrink-0">
                {user?.name ? user.name.slice(0, 2).toUpperCase() : 'US'}
              </div>
            )}
            <div className="flex flex-col overflow-hidden">
              <span className="text-xs font-bold text-slate-200 truncate">{user?.name}</span>
              <span className="text-[10px] text-slate-500 font-mono truncate">{user?.email}</span>
            </div>
          </div>
          <div className="relative">
            <button 
              onClick={(e) => {
                e.stopPropagation();
                setShowUserMenu(!showUserMenu);
              }}
              title="Ajustes y Sesión"
              className="p-1.5 text-slate-500 hover:text-white rounded-md hover:bg-slate-900 transition-all cursor-pointer"
            >
              <Settings className="w-4 h-4" />
            </button>
            
            {showUserMenu && (
              <div className="absolute bottom-full right-0 mb-2 w-48 bg-slate-950/95 border border-slate-800 rounded-xl p-2.5 shadow-2xl flex flex-col gap-1 z-50 animate-in fade-in slide-in-from-bottom-2 duration-200">
                <button
                  onClick={() => {
                    setShowUserMenu(false);
                    setShowSettingsModal(true);
                  }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-xs text-slate-350 hover:text-white hover:bg-slate-900 rounded-lg transition-all cursor-pointer text-left font-medium"
                >
                  <Settings className="w-3.5 h-3.5 text-accent-cyan" />
                  Ajustes de Cuenta
                </button>
                <div className="h-[1px] bg-slate-900 my-1" />
                <button
                  onClick={() => {
                    setShowUserMenu(false);
                    handleLogout();
                  }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-xs text-slate-400 hover:text-red-400 hover:bg-red-950/15 rounded-lg transition-all cursor-pointer text-left font-medium"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  Cerrar sesión
                </button>
              </div>
            )}
          </div>
        </div>
      </aside>

      {/* PANEL DE CHAT PRINCIPAL */}
      <main className="flex-1 flex flex-col bg-[#07070d]/85 relative">
        
        {/* Cabecera Móvil (si Sidebar está oculto) */}
        <header className="h-16 border-b border-slate-900 flex items-center justify-between px-6 md:px-8 bg-slate-950/30 backdrop-blur-sm">
          <div className="flex items-center gap-2">
            <button 
              onClick={() => setIsSidebarOpen(true)}
              className="p-1.5 bg-slate-900 border border-slate-800 text-slate-350 hover:text-white rounded-md md:hidden cursor-pointer"
            >
              <Menu className="w-4 h-4" />
            </button>
            <h2 className="font-bold text-sm tracking-wide text-slate-200 flex items-center gap-2">
              Consola de Consulta
              <span className="px-2 py-0.5 rounded-full text-[9px] bg-accent-cyan/10 border border-accent-cyan/30 text-accent-cyan font-mono animate-pulse">
                META / LORE
              </span>
            </h2>
          </div>
          
          <div className="flex items-center gap-3">
            <div className="md:hidden flex items-center gap-1.5 px-3 py-1 bg-slate-900 border border-slate-800 rounded-full">
              <Coins className="w-3 h-3 text-accent-cyan" />
              <span className="text-[10px] font-bold font-mono">
                {credits === 9999 ? '∞' : credits}
              </span>
            </div>
            <button 
              onClick={() => setShowSettingsModal(true)}
              title="Ajustes de Cuenta"
              className="md:hidden p-1.5 text-slate-400 hover:text-accent-cyan cursor-pointer"
            >
              <Settings className="w-4.5 h-4.5" />
            </button>
          </div>
        </header>

        {/* ÁREA DE MENSAJES */}
        <div className="flex-1 overflow-y-auto p-6 md:p-8 space-y-6">
          {messages.length === 0 ? (
            /* Pantalla de Bienvenida */
            <div className="h-full flex flex-col items-center justify-center max-w-2xl mx-auto text-center space-y-8 py-12">
              <div className="space-y-3">
                <div className="inline-flex p-3 bg-accent-violet/10 rounded-2xl border border-accent-violet/20 text-accent-violet mb-2">
                  <Sparkles className="w-8 h-8 text-accent-cyan anime-pulse-slow" />
                </div>
                <h1 className="text-3xl md:text-5xl font-extrabold tracking-tight">
                  Hola, <span className="gradient-text-gaming">{user?.name}</span>
                </h1>
                <p className="text-slate-400 text-sm md:text-base max-w-md mx-auto">
                  ¿Qué deseas consultar hoy? Puedo analizar el Lore profundo de personajes o rastrear foros para darte la última Build óptima del Meta.
                </p>
              </div>

              {/* Tarjetas de sugerencias */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full pt-4">
                {[
                  {
                    title: 'Lore de Personaje',
                    desc: '¿Cuál es el verdadero origen del Sustentador de los Principios Celestiales?',
                    question: '¿Cuál es el verdadero origen del Sustentador de los Principios Celestiales?'
                  },
                  {
                    title: 'Optimización de Build',
                    desc: 'Build recomendada de Jiyan con el set de eco óptimo y arma de 4 estrellas.',
                    question: 'Build recomendada de Jiyan con el set de eco óptimo y arma de 4 estrellas en Wuthering Waves'
                  },
                  {
                    title: 'Análisis de Composición',
                    desc: '¿Qué equipos hacen mejor sinergia con Acheron en Star Rail?',
                    question: '¿Qué equipos hacen mejor sinergia con Acheron en Honkai Star Rail?'
                  },
                  {
                    title: 'Búsqueda Web (RAG)',
                    desc: '¿Qué se dice en Reddit sobre la última actualización del parche?',
                    question: '¿Qué se dice en Reddit sobre los cambios del meta en el último parche de Genshin Impact?'
                  }
                ].map((sug, i) => (
                  <button
                    key={i}
                    onClick={() => selectQuickQuestion(sug.question)}
                    className="p-4 rounded-xl glass-panel-interactive text-left flex flex-col space-y-1 cursor-pointer"
                  >
                    <span className="text-xs font-bold text-accent-cyan flex items-center gap-1">
                      <Search className="w-3 h-3" />
                      {sug.title}
                    </span>
                    <span className="text-xs text-slate-400 line-clamp-2">{sug.desc}</span>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            /* Lista de Mensajes del Chat */
            <div className="max-w-3xl mx-auto space-y-6">
              {messages.map((msg, i) => (
                <div 
                  key={i} 
                  className={`flex gap-4 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  {msg.role !== 'user' && (
                    <div className="w-8 h-8 rounded-lg bg-accent-violet/10 border border-accent-violet/30 flex items-center justify-center text-accent-cyan font-bold text-xs shrink-0 select-none">
                      G
                    </div>
                  )}

                  <div 
                    className={`max-w-[85%] rounded-xl p-4 text-sm leading-relaxed ${
                      msg.role === 'user'
                        ? 'bg-gradient-to-br from-accent-violet/25 to-slate-900 border border-accent-violet/30 text-white rounded-br-none'
                        : 'glass-panel text-slate-200 border border-slate-800/80 rounded-bl-none'
                    }`}
                  >
                    {msg.role === 'assistant' ? (
                      <div>
                        <div className="chat-markdown" dangerouslySetInnerHTML={{ __html: renderMarkdown(msg.content) }} />
                        {msg.fuentes && msg.fuentes.length > 0 && (
                          <div className="sources-panel">
                            <div className="flex items-center gap-1.5 mb-2">
                              <Globe className="w-3 h-3 text-accent-cyan" />
                              <span className="text-[10px] font-mono font-bold text-slate-500 uppercase tracking-wider">Fuentes</span>
                              {msg.modo && (
                                <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-accent-violet/10 border border-accent-violet/20 text-accent-violet">
                                  {msg.modo}
                                </span>
                              )}
                            </div>
                            <div className="flex flex-wrap gap-1.5">
                              {msg.fuentes.map((src) => (
                                <a
                                  key={src.id}
                                  href={src.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="source-chip"
                                  title={src.url}
                                >
                                  <ExternalLink className="w-2.5 h-2.5 shrink-0" />
                                  [{src.id}] {src.title || new URL(src.url).hostname}
                                </a>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    ) : (
                      msg.content
                    )}
                  </div>

                  {msg.role === 'user' && (
                    <div className="w-8 h-8 rounded-lg bg-slate-800 flex items-center justify-center text-slate-300 font-bold text-xs shrink-0 select-none uppercase">
                      {user?.name.slice(0, 2)}
                    </div>
                  )}
                </div>
              ))}
              
              {/* Spinner de enviando */}
              {sending && (
                <div className="flex gap-4 justify-start">
                  <div className="w-8 h-8 rounded-lg bg-accent-violet/10 border border-accent-violet/30 flex items-center justify-center text-accent-cyan font-bold text-xs shrink-0 animate-pulse">
                    G
                  </div>
                  <div className="glass-panel text-slate-400 border border-slate-800/80 rounded-xl rounded-bl-none p-4 text-sm flex items-center gap-2.5">
                    <div className="flex gap-1.5">
                      <div className="thinking-dot" />
                      <div className="thinking-dot" />
                      <div className="thinking-dot" />
                    </div>
                    <span className="font-mono text-xs">
                      {searchModo === 'completo' 
                        ? 'Buscando en la web, leyendo páginas y sintetizando con IA...'
                        : 'Búsqueda rápida en la web...'}
                    </span>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* INPUT DE CHAT */}
        <div className="p-4 md:p-6 border-t border-slate-900 bg-slate-950/20">
          <form onSubmit={handleSendMessage} className="max-w-3xl mx-auto relative flex gap-2">
            
            <input
              type="text"
              value={inputMsg}
              onChange={(e) => setInputMsg(e.target.value)}
              disabled={sending || credits <= 0}
              placeholder={
                credits <= 0 
                  ? "❌ Sin créditos. Hazte Pro para continuar..." 
                  : "Pregunta sobre el Lore de un personaje o el Meta actual..."
              }
              className="flex-1 py-3.5 pl-4 pr-12 rounded-xl bg-slate-950/80 border border-slate-800 text-sm placeholder-slate-500 text-white focus:outline-none focus:border-accent-cyan focus:ring-1 focus:ring-accent-cyan disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            />
            
            <button
              type="submit"
              disabled={sending || !inputMsg.trim() || credits <= 0}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-2 bg-gradient-to-r from-accent-violet to-accent-cyan text-white rounded-lg hover:opacity-90 active:scale-95 disabled:opacity-30 disabled:scale-100 disabled:pointer-events-none transition-all cursor-pointer"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
          
          <div className="mt-3 flex items-center justify-center gap-4">
            <div className="modo-toggle">
              <button 
                type="button"
                className={searchModo === 'rapido' ? 'active' : ''}
                onClick={() => setSearchModo('rapido')}
                title="Solo snippets del buscador (más veloz)"
              >
                ⚡ Rápido
              </button>
              <button 
                type="button"
                className={searchModo === 'completo' ? 'active' : ''}
                onClick={() => setSearchModo('completo')}
                title="Busca y lee páginas completas (más detalle)"
              >
                🔍 Completo
              </button>
            </div>
            <p className="text-[10px] font-mono text-slate-500">
              {user?.isAdmin 
                ? '👑 Modo Administrador: Tienes consultas ilimitadas.'
                : 'GIMA usa IA para buscar en la web y sintetizar respuestas con fuentes citadas.'}
            </p>
          </div>
        </div>
      </main>

      {/* MODAL DE MURO DE PAGO (PAYWALL) */}
      {showPaywall && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="relative w-full max-w-lg glass-panel neon-border-pink rounded-2xl p-8 shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            
            <button 
              onClick={() => setShowPaywall(false)}
              className="absolute top-4 right-4 p-1.5 text-slate-500 hover:text-white rounded-md hover:bg-slate-900 transition-all cursor-pointer"
            >
              <X className="w-4.5 h-4.5" />
            </button>

            {/* Icono de advertencia */}
            <div className="flex flex-col items-center text-center mb-6">
              <div className="p-3 bg-accent-pink/10 border border-accent-pink/30 rounded-2xl text-accent-pink mb-3 animate-bounce">
                <ShieldAlert className="w-8 h-8" />
              </div>
              <h2 className="text-2xl font-extrabold tracking-tight text-white uppercase">
                ¡Créditos Agotados!
              </h2>
              <p className="text-slate-400 text-xs mt-1 max-w-sm">
                Has alcanzado tu límite diario de 5 consultas gratuitas. Recarga o suscríbete para seguir explorando el Lore y el Meta.
              </p>
            </div>

            {/* Éxito de recarga */}
            {rechargeSuccess ? (
              <div className="p-8 rounded-xl bg-emerald-950/20 border border-emerald-500/30 flex flex-col items-center justify-center text-center space-y-2 animate-in fade-in">
                <div className="w-12 h-12 rounded-full bg-emerald-500/20 border border-emerald-500 text-emerald-400 flex items-center justify-center">
                  <Check className="w-6 h-6" />
                </div>
                <h3 className="font-bold text-emerald-400">¡Pago Procesado (Simulado)!</h3>
                <p className="text-xs text-emerald-300">Tus créditos han sido actualizados con éxito.</p>
              </div>
            ) : (
              /* Opciones de compra */
              <div className="space-y-4">
                
                {/* Opción 1: Paquete de créditos */}
                <div className="p-5 rounded-xl bg-slate-950/60 border border-slate-800 hover:border-slate-700 transition-all flex justify-between items-center group">
                  <div className="space-y-1">
                    <h3 className="font-bold text-sm text-slate-200">Gacha Mini Pack</h3>
                    <p className="text-xs text-slate-400">+20 consultas al agente RAG con IA</p>
                    <span className="inline-block text-[9px] bg-slate-900 text-slate-400 font-mono px-2 py-0.5 rounded border border-slate-800">
                      Un solo pago
                    </span>
                  </div>
                  <button
                    disabled={buyingPlan !== null}
                    onClick={() => handleSimulatePayment('mini', 1.99)}
                    className="px-4 py-2.5 bg-slate-900 border border-slate-700 hover:border-accent-cyan hover:bg-slate-950 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 cursor-pointer text-accent-cyan"
                  >
                    {buyingPlan === 'mini' ? (
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <>
                        <CreditCard className="w-3.5 h-3.5" />
                        $1.99 USD
                      </>
                    )}
                  </button>
                </div>

                {/* Opción 2: Suscripción Pro */}
                <div className="p-5 rounded-xl bg-gradient-to-r from-accent-violet/10 to-accent-pink/5 border border-accent-violet/40 hover:border-accent-pink/50 transition-all flex justify-between items-center relative overflow-hidden group">
                  <div className="absolute top-0 right-10 bg-accent-pink text-white text-[8px] font-extrabold uppercase font-mono px-3 py-0.5 rounded-b shadow-sm">
                    Recomendado
                  </div>
                  <div className="space-y-1">
                    <h3 className="font-bold text-sm text-white flex items-center gap-1.5">
                      Gacha Pro
                      <Sparkles className="w-3.5 h-3.5 text-accent-pink animate-pulse" />
                    </h3>
                    <p className="text-xs text-slate-300">Consultas ilimitadas + Respuestas más veloces</p>
                    <span className="inline-block text-[9px] bg-accent-violet/20 text-accent-cyan font-mono px-2 py-0.5 rounded border border-accent-violet/30">
                      Suscripción mensual
                    </span>
                  </div>
                  <button
                    disabled={buyingPlan !== null}
                    onClick={() => handleSimulatePayment('pro', 4.99)}
                    className="px-4 py-2.5 bg-gradient-to-r from-accent-violet to-accent-pink text-white text-xs font-bold rounded-lg hover:opacity-90 active:scale-95 transition-all flex items-center gap-1.5 cursor-pointer shadow-md shadow-accent-violet/15"
                  >
                    {buyingPlan === 'pro' ? (
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <>
                        <Zap className="w-3.5 h-3.5" />
                        $4.99 / mes
                      </>
                    )}
                  </button>
                </div>

                <p className="text-[9px] text-center text-slate-500 font-mono mt-4">
                  * Este es un entorno de desarrollo local. Los pagos son simulados para testing.
                </p>

              </div>
            )}

          </div>
        </div>
      )}

      {/* MODAL DE AJUSTES DE PERFIL */}
      {showSettingsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="relative w-full max-w-md glass-panel neon-border-violet rounded-2xl p-6 md:p-8 shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            
            <button 
              onClick={() => setShowSettingsModal(false)}
              className="absolute top-4 right-4 p-1.5 text-slate-500 hover:text-white rounded-md hover:bg-slate-900 transition-all cursor-pointer"
            >
              <X className="w-4.5 h-4.5" />
            </button>

            <div className="flex flex-col items-center mb-6">
              <div className="p-3 bg-accent-violet/10 border border-accent-violet/30 rounded-2xl text-accent-cyan mb-3">
                <Settings className="w-6 h-6 animate-spin-slow" />
              </div>
              <h2 className="text-xl font-extrabold tracking-tight text-white uppercase">
                Ajustes de Cuenta
              </h2>
              <p className="text-slate-400 text-[11px] font-mono mt-1">
                Personaliza tu perfil de viajero
              </p>
            </div>

            <form onSubmit={handleSaveSettings} className="space-y-5">
              {/* Foto de Perfil / Avatar */}
              <div className="flex flex-col items-center space-y-3">
                <label className="text-[11px] font-bold font-mono text-slate-400 uppercase tracking-wider">
                  Foto de Perfil
                </label>
                
                <div className="relative group cursor-pointer">
                  {newAvatar ? (
                    <img 
                      src={newAvatar} 
                      alt="Nuevo Avatar" 
                      className="w-20 h-20 rounded-full object-cover border-2 border-accent-cyan/50 shadow-lg shadow-accent-cyan/15 group-hover:opacity-85 transition-all" 
                    />
                  ) : (
                    <div className="w-20 h-20 rounded-full bg-gradient-to-tr from-accent-violet to-accent-pink flex items-center justify-center text-2xl font-bold text-white border-2 border-slate-800 shadow-lg group-hover:opacity-85 transition-all">
                      {newName ? newName.slice(0, 2).toUpperCase() : 'US'}
                    </div>
                  )}
                  
                  {/* Overlay con ícono de cámara */}
                  <label htmlFor="avatar-upload" className="absolute inset-0 flex items-center justify-center bg-black/60 rounded-full opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer">
                    <Camera className="w-5 h-5 text-white" />
                  </label>
                  
                  <input 
                    id="avatar-upload"
                    type="file" 
                    accept="image/*"
                    onChange={handleAvatarChange}
                    className="hidden" 
                  />
                </div>
                
                <span className="text-[10px] text-slate-500 font-mono">
                  Haz clic para subir una foto personalizada
                </span>
              </div>

              {/* Input Nombre */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold font-mono text-slate-400 uppercase tracking-wider block">
                  Nombre de Viajero
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">
                    <User className="w-4 h-4" />
                  </span>
                  <input
                    type="text"
                    required
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder="Tu nombre o nick"
                    className="w-full py-2.5 pl-10 pr-4 rounded-xl bg-slate-950/80 border border-slate-800 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-accent-cyan focus:ring-1 focus:ring-accent-cyan transition-all"
                  />
                </div>
              </div>

              {/* Sección Cambiar Contraseña */}
              <div className="pt-2 border-t border-slate-900 space-y-3">
                <span className="text-[11px] font-bold font-mono text-slate-400 uppercase tracking-wider block">
                  Cambiar Contraseña
                </span>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <span className="text-[10px] text-slate-500 font-mono block">Nueva contraseña</span>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">
                        <Lock className="w-3.5 h-3.5" />
                      </span>
                      <input
                        type="password"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        placeholder="Mín. 6 caracteres"
                        className="w-full py-2 pl-9 pr-3 rounded-lg bg-slate-950/80 border border-slate-800 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-accent-cyan focus:ring-1 focus:ring-accent-cyan transition-all"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <span className="text-[10px] text-slate-500 font-mono block">Confirmar contraseña</span>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">
                        <Lock className="w-3.5 h-3.5" />
                      </span>
                      <input
                        type="password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="Repite la contraseña"
                        className="w-full py-2 pl-9 pr-3 rounded-lg bg-slate-950/80 border border-slate-800 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-accent-cyan focus:ring-1 focus:ring-accent-cyan transition-all"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Mensajes de éxito / error */}
              {settingsError && (
                <div className="p-3 rounded-lg bg-red-950/20 border border-red-500/30 text-red-400 text-xs text-center font-mono">
                  ⚠️ {settingsError}
                </div>
              )}

              {settingsSuccess && (
                <div className="p-3 rounded-lg bg-emerald-950/20 border border-emerald-500/30 text-emerald-400 text-xs text-center font-mono">
                  ✅ {settingsSuccess}
                </div>
              )}

              {/* Botón de envío */}
              <button
                type="submit"
                disabled={savingSettings}
                className="w-full flex items-center justify-center gap-2 py-3 bg-gradient-to-r from-accent-violet via-accent-cyan to-accent-pink text-white text-xs font-bold uppercase tracking-wider hover:opacity-95 active:scale-[0.98] transition-all disabled:opacity-50 cursor-pointer rounded-xl shadow-md shadow-accent-violet/10"
              >
                {savingSettings ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    Guardando Ajustes...
                  </>
                ) : (
                  'Guardar Cambios'
                )}
              </button>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
