'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ShieldAlert, Users, CreditCard, Trash2, ShieldCheck, ChevronLeft, Search } from 'lucide-react';
import { supabase } from '@/lib/supabase';

interface UserProfile {
  id: string;
  email: string;
  nombre_completo: string;
  creditos_disponibles: number;
  is_admin: boolean;
  created_at: string;
}

export default function AdminPage() {
  const router = useRouter();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  useEffect(() => {
    async function checkAdminAndLoad() {
      // Get current session
      const { data: { session } } = await supabase.auth.getSession();
      
      const mockSessionStr = localStorage.getItem('gima_mock_session');
      let userId = session?.user?.id;
      
      if (!userId && mockSessionStr) {
        const mockUser = JSON.parse(mockSessionStr);
        userId = mockUser.id;
      }
      
      if (!userId) {
        router.push('/login');
        return;
      }
      
      setCurrentUserId(userId);

      try {
        const response = await fetch('/api/admin/users', {
          headers: { 'x-user-id': userId }
        });
        
        if (response.status === 403) {
          router.push('/chat');
          return;
        }

        const data = await response.json();
        if (data.users) {
          setUsers(data.users);
        }
      } catch (error) {
        console.error('Error cargando usuarios:', error);
      } finally {
        setLoading(false);
      }
    }

    checkAdminAndLoad();
  }, [router]);

  const handleUpdateCredits = async (userId: string, newCredits: number) => {
    if (!currentUserId) return;
    
    try {
      const response = await fetch(`/api/admin/users/${userId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': currentUserId
        },
        body: JSON.stringify({ creditos_disponibles: newCredits })
      });
      
      if (response.ok) {
        setUsers(users.map(u => u.id === userId ? { ...u, creditos_disponibles: newCredits } : u));
      } else {
        alert('Error al actualizar créditos');
      }
    } catch (error) {
      console.error(error);
    }
  };

  const handleToggleAdmin = async (userId: string, currentAdminStatus: boolean) => {
    if (!currentUserId) return;
    if (userId === currentUserId) {
      alert('No puedes quitarte el rol de admin a ti mismo.');
      return;
    }
    
    if (!confirm(`¿Estás seguro de que quieres ${currentAdminStatus ? 'quitar' : 'dar'} el rol de administrador a este usuario?`)) return;

    try {
      const response = await fetch(`/api/admin/users/${userId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': currentUserId
        },
        body: JSON.stringify({ is_admin: !currentAdminStatus })
      });
      
      if (response.ok) {
        setUsers(users.map(u => u.id === userId ? { ...u, is_admin: !currentAdminStatus } : u));
      } else {
        alert('Error al actualizar rol');
      }
    } catch (error) {
      console.error(error);
    }
  };

  const handleDeleteUser = async (userId: string, email: string) => {
    if (!currentUserId) return;
    if (userId === currentUserId) {
      alert('No puedes eliminar tu propia cuenta desde aquí.');
      return;
    }

    const confirmEmail = prompt(`Esta acción es IRREVERSIBLE. Escribe el correo del usuario (${email}) para confirmar la eliminación:`);
    if (confirmEmail !== email) return;

    try {
      const response = await fetch(`/api/admin/users/${userId}`, {
        method: 'DELETE',
        headers: {
          'x-user-id': currentUserId
        }
      });
      
      if (response.ok) {
        setUsers(users.filter(u => u.id !== userId));
      } else {
        alert('Error al eliminar usuario');
      }
    } catch (error) {
      console.error(error);
    }
  };

  const filteredUsers = users.filter(u => 
    u.email?.toLowerCase().includes(searchTerm.toLowerCase()) || 
    (u.nombre_completo || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center relative overflow-hidden">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-accent-violet/20 blur-[100px] rounded-full" />
        <div className="w-8 h-8 border-t-2 border-accent-violet border-solid rounded-full animate-spin"></div>
        <p className="mt-4 text-slate-400 font-mono text-xs">Verificando credenciales...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 font-sans selection:bg-accent-violet/30 flex flex-col relative overflow-hidden">
      {/* Background gradients */}
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-accent-violet/5 blur-[120px] rounded-full pointer-events-none" />
      <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-accent-cyan/5 blur-[120px] rounded-full pointer-events-none" />

      {/* Header */}
      <header className="border-b border-slate-900 bg-slate-950/50 backdrop-blur-md sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => router.push('/chat')}
              className="p-2 -ml-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-900 transition-colors"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-2">
              <ShieldAlert className="w-5 h-5 text-accent-violet" />
              <h1 className="font-bold text-lg">Panel de Administración</h1>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            <div className="glass-panel px-3 py-1.5 rounded-full flex items-center gap-2 text-xs font-mono">
              <Users className="w-3.5 h-3.5 text-accent-cyan" />
              <span>{users.length} Usuarios</span>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-6xl w-full mx-auto p-6 z-10">
        
        {/* Toolbar */}
        <div className="flex flex-col sm:flex-row gap-4 justify-between items-center mb-6">
          <div className="relative w-full sm:w-96">
            <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input 
              type="text" 
              placeholder="Buscar por nombre o email..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-slate-900/50 border border-slate-800 rounded-xl py-2 pl-9 pr-4 text-sm focus:outline-none focus:border-accent-violet transition-colors"
            />
          </div>
        </div>

        {/* Users Table */}
        <div className="glass-panel rounded-2xl overflow-hidden border border-slate-800/80">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-900/80 border-b border-slate-800 font-mono text-xs text-slate-400">
                <tr>
                  <th className="px-6 py-4 font-medium">Usuario</th>
                  <th className="px-6 py-4 font-medium">Email</th>
                  <th className="px-6 py-4 font-medium">Rol</th>
                  <th className="px-6 py-4 font-medium text-center">Créditos</th>
                  <th className="px-6 py-4 font-medium text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/50">
                {filteredUsers.map((user) => (
                  <tr key={user.id} className="hover:bg-slate-900/30 transition-colors group">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center font-bold text-xs">
                          {user.nombre_completo ? user.nombre_completo.slice(0, 2).toUpperCase() : 'US'}
                        </div>
                        <div>
                          <p className="font-medium text-slate-200">{user.nombre_completo || 'Sin nombre'}</p>
                          <p className="text-[10px] text-slate-500 font-mono">
                            {new Date(user.created_at).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-slate-300">
                      {user.email}
                    </td>
                    <td className="px-6 py-4">
                      <button 
                        onClick={() => handleToggleAdmin(user.id, user.is_admin)}
                        title="Clic para cambiar rol"
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-[10px] font-mono font-bold transition-colors border ${
                          user.is_admin 
                            ? 'bg-accent-violet/10 text-accent-violet border-accent-violet/20 hover:bg-accent-violet/20' 
                            : 'bg-slate-800 text-slate-400 border-slate-700 hover:bg-slate-700 hover:text-white'
                        }`}
                      >
                        {user.is_admin ? <ShieldCheck className="w-3 h-3" /> : <Users className="w-3 h-3" />}
                        {user.is_admin ? 'ADMIN' : 'USER'}
                      </button>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-center gap-2">
                        <CreditCard className="w-3.5 h-3.5 text-slate-500" />
                        <input 
                          type="number" 
                          className="w-16 bg-slate-950 border border-slate-700 rounded px-2 py-1 text-center font-mono text-sm focus:outline-none focus:border-accent-cyan"
                          value={user.creditos_disponibles}
                          onChange={(e) => {
                            const val = parseInt(e.target.value);
                            if (!isNaN(val)) {
                              handleUpdateCredits(user.id, val);
                            }
                          }}
                        />
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button 
                        onClick={() => handleDeleteUser(user.id, user.email)}
                        className="p-1.5 text-slate-500 hover:text-red-400 hover:bg-red-500/10 rounded transition-colors opacity-0 group-hover:opacity-100"
                        title="Eliminar usuario"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            
            {filteredUsers.length === 0 && (
              <div className="py-12 text-center text-slate-500 text-sm">
                No se encontraron usuarios.
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
