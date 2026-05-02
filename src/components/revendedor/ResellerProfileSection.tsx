'use client';

import React, { useState, useEffect } from 'react';
import { User, Lock, Save, CheckCircle, AlertCircle, Building2, Phone, Mail } from 'lucide-react';
import { supabase } from '@/lib/supabase-client';

export function ResellerProfileSection() {
  const [userData, setUserData] = useState({
    email: '',
    nome: '',
    telefone: '',
    empresa: ''
  });
  const [passwords, setPasswords] = useState({
    current: '',
    new: '',
    confirm: ''
  });
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });

  useEffect(() => {
    async function loadUser() {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setUserData({
          email: user.email || '',
          nome: user.user_metadata?.nome || user.user_metadata?.full_name || user.email?.split('@')[0] || '',
          telefone: user.user_metadata?.telefone || '',
          empresa: user.user_metadata?.empresa || ''
        });
      }
    }
    loadUser();
  }, []);

  const getInitials = (name: string) => {
    if (!name) return '??';
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  };

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingProfile(true);
    setMessage({ type: '', text: '' });

    try {
      const { error } = await supabase.auth.updateUser({
        data: { 
          nome: userData.nome, 
          telefone: userData.telefone,
          empresa: userData.empresa
        }
      });

      if (error) throw error;
      setMessage({ type: 'success', text: 'Perfil atualizado com sucesso!' });
    } catch (error: any) {
      setMessage({ type: 'error', text: error.message });
    } finally {
      setIsSavingProfile(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (passwords.new !== passwords.confirm) {
      setMessage({ type: 'error', text: 'As novas senhas não coincidem.' });
      return;
    }

    setIsChangingPassword(true);
    setMessage({ type: '', text: '' });

    try {
      const { error } = await supabase.auth.updateUser({
        password: passwords.new
      });

      if (error) throw error;
      setMessage({ type: 'success', text: 'Senha alterada com sucesso!' });
      setPasswords({ current: '', new: '', confirm: '' });
    } catch (error: any) {
      setMessage({ type: 'error', text: error.message });
    } finally {
      setIsChangingPassword(false);
    }
  };

  return (
    <div className="max-w-full">
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 items-start">
        {/* Coluna da Esquerda: Formulários */}
        <div className="lg:col-span-3 space-y-6">
          {/* Informações Pessoais */}
          <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
            <h2 className="text-xl font-bold text-gray-900 mb-6 flex items-center gap-2">
              <User className="w-5 h-5 text-red-600" /> Informações Pessoais
            </h2>

            <form onSubmit={handleUpdateProfile} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-sm font-bold text-gray-700">Nome Completo</label>
                  <input
                    type="text"
                    value={userData.nome}
                    onChange={(e) => setUserData({ ...userData, nome: e.target.value })}
                    className="w-full bg-gray-50 border border-gray-200 rounded px-4 py-2 text-sm focus:ring-2 focus:ring-red-500/20 outline-none"
                    placeholder="Seu nome"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-bold text-gray-700">Nome da Empresa</label>
                  <input
                    type="text"
                    value={userData.empresa}
                    onChange={(e) => setUserData({ ...userData, empresa: e.target.value })}
                    className="w-full bg-gray-50 border border-gray-200 rounded px-4 py-2 text-sm focus:ring-2 focus:ring-red-500/20 outline-none"
                    placeholder="Minha Empresa Lda"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-bold text-gray-700">Email (Apenas leitura)</label>
                  <input
                    type="email"
                    value={userData.email}
                    disabled
                    className="w-full bg-gray-100 border border-gray-200 rounded px-4 py-2 text-sm text-gray-500 cursor-not-allowed"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-bold text-gray-700">Telefone</label>
                  <input
                    type="text"
                    value={userData.telefone}
                    onChange={(e) => setUserData({ ...userData, telefone: e.target.value })}
                    className="w-full bg-gray-50 border border-gray-200 rounded px-4 py-2 text-sm focus:ring-2 focus:ring-red-500/20 outline-none"
                    placeholder="+258 ..."
                  />
                </div>
              </div>

              <div className="pt-4 flex justify-end">
                <button
                  type="submit"
                  disabled={isSavingProfile}
                  className="bg-red-600 hover:bg-red-700 text-white px-5 py-2 rounded text-sm font-bold transition-all disabled:opacity-50 flex items-center gap-2"
                >
                  {isSavingProfile ? 'A guardar...' : <><Save size={16} /> Guardar Perfil</>}
                </button>
              </div>
            </form>
          </div>

          {/* Alterar Senha */}
          <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
            <h2 className="text-xl font-bold text-gray-900 mb-6 flex items-center gap-2">
              <Lock className="w-5 h-5 text-red-600" /> Segurança e Senha
            </h2>

            <form onSubmit={handleChangePassword} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-sm font-bold text-gray-700">Nova Senha</label>
                  <input
                    type="password"
                    value={passwords.new}
                    onChange={(e) => setPasswords({ ...passwords, new: e.target.value })}
                    className="w-full bg-gray-50 border border-gray-200 rounded px-4 py-2 text-sm focus:ring-2 focus:ring-red-500/20 outline-none"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-bold text-gray-700">Confirmar Nova Senha</label>
                  <input
                    type="password"
                    value={passwords.confirm}
                    onChange={(e) => setPasswords({ ...passwords, confirm: e.target.value })}
                    className="w-full bg-gray-50 border border-gray-200 rounded px-4 py-2 text-sm focus:ring-2 focus:ring-red-500/20 outline-none"
                  />
                </div>
              </div>

              <div className="pt-4 flex justify-end">
                <button
                  type="submit"
                  disabled={isChangingPassword || !passwords.new}
                  className="bg-gray-800 hover:bg-gray-900 text-white px-5 py-2 rounded text-sm font-bold transition-all disabled:opacity-50 flex items-center gap-2"
                >
                  {isChangingPassword ? 'A atualizar...' : <><Lock size={16} /> Atualizar Senha</>}
                </button>
              </div>
            </form>
          </div>
        </div>

        {/* Coluna da Direita: Resumo / Sidebar */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden sticky top-0">
            <div className="h-20 bg-gradient-to-r from-red-600 to-red-800"></div>
            <div className="px-5 pb-5">
              <div className="relative -mt-10 mb-4">
                <div className="w-20 h-20 bg-white rounded-2xl shadow-lg flex items-center justify-center text-2xl font-bold text-red-600 border-4 border-white">
                  {getInitials(userData.nome)}
                </div>
              </div>
              
              <div className="space-y-5">
                <div>
                  <h3 className="text-lg font-bold text-gray-900 truncate">{userData.nome || 'Nome do Revendedor'}</h3>
                  <p className="text-xs text-gray-500 flex items-center gap-1 mt-0.5 truncate">
                    <Building2 size={12} /> {userData.empresa || 'Nome da Empresa'}
                  </p>
                </div>

                <div className="pt-5 border-t border-gray-100 space-y-3">
                  <div className="flex items-center gap-3 text-sm text-gray-600">
                    <div className="w-7 h-7 rounded-lg bg-gray-50 flex items-center justify-center text-gray-400 shrink-0">
                      <Mail size={14} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[9px] font-bold text-gray-400 uppercase">Email</p>
                      <p className="font-medium text-xs truncate">{userData.email}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 text-sm text-gray-600">
                    <div className="w-7 h-7 rounded-lg bg-gray-50 flex items-center justify-center text-gray-400 shrink-0">
                      <Phone size={14} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[9px] font-bold text-gray-400 uppercase">Contacto</p>
                      <p className="font-medium text-xs">{userData.telefone || 'N/A'}</p>
                    </div>
                  </div>
                </div>

                <div className="p-3 bg-gray-50 rounded-xl border border-gray-100 mt-4">
                  <p className="text-[9px] font-bold text-gray-400 uppercase mb-1">Estado da Conta</p>
                  <div className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-green-500"></div>
                    <span className="text-xs font-bold text-green-700 uppercase tracking-wider">Activo</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {message.text && (
        <div className={`mt-8 p-4 rounded-lg border flex items-center gap-3 ${
          message.type === 'success' ? 'bg-green-50 border-green-200 text-green-700' : 'bg-red-50 border-red-200 text-red-700'
        }`}>
          {message.type === 'success' ? <CheckCircle size={20} /> : <AlertCircle size={20} />}
          <span className="text-sm font-medium">{message.text}</span>
        </div>
      )}
    </div>
  );
}
