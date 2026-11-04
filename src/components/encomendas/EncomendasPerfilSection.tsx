'use client';

import { useEffect, useState } from 'react';
import { User, Lock, Save, CheckCircle2, AlertCircle, Eye, EyeOff } from 'lucide-react';
import { panelCard, panelField, panelBtnPrimary, panelBtnSecondary } from '@/lib/panel-ui';

interface PerfilData {
  email: string;
  nome: string;
  telefone: string;
  empresa: string;
  nif: string;
}

const EMPTY: PerfilData = { email: '', nome: '', telefone: '', empresa: '', nif: '' };

function getInitials(name: string) {
  if (!name) return '??';
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  return name.substring(0, 2).toUpperCase();
}

export function EncomendasPerfilSection() {
  const [data, setData] = useState<PerfilData>(EMPTY);
  const [originalEmail, setOriginalEmail] = useState('');
  const [loading, setLoading] = useState(true);
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [passwords, setPasswords] = useState({ new: '', confirm: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    fetch('/api/encomendas/perfil')
      .then((r) => r.json())
      .then((json) => {
        if (json.error) return;
        setData({
          email: json.email || '',
          nome: json.nome || '',
          telefone: json.telefone || '',
          empresa: json.empresa || '',
          nif: json.nif || '',
        });
        setOriginalEmail(json.email || '');
      })
      .finally(() => setLoading(false));
  }, []);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);
    setSavingProfile(true);
    try {
      const emailChanged = data.email.trim().toLowerCase() !== originalEmail.trim().toLowerCase();
      const res = await fetch('/api/encomendas/perfil', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nome: data.nome,
          telefone: data.telefone,
          empresa: data.empresa,
          nif: data.nif,
          ...(emailChanged ? { email: data.email.trim() } : {}),
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Não foi possível guardar o perfil.');
      if (emailChanged) setOriginalEmail(json.email || data.email);
      setMessage({ type: 'success', text: 'Perfil actualizado com sucesso.' });
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message });
    } finally {
      setSavingProfile(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);
    if (passwords.new !== passwords.confirm) {
      setMessage({ type: 'error', text: 'As senhas não coincidem.' });
      return;
    }
    setSavingPassword(true);
    try {
      const res = await fetch('/api/encomendas/perfil', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: passwords.new }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Não foi possível alterar a senha.');
      setMessage({ type: 'success', text: 'Senha alterada com sucesso.' });
      setPasswords({ new: '', confirm: '' });
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message });
    } finally {
      setSavingPassword(false);
    }
  };

  if (loading) return null;

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div className={`${panelCard} p-4 flex items-center gap-4`}>
        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-red-600/10 text-lg font-bold text-red-600 border border-red-200 dark:border-red-900">
          {getInitials(data.nome)}
        </div>
        <div className="min-w-0">
          <h2 className="truncate text-base font-bold text-gray-900 dark:text-white">{data.nome || 'O meu perfil'}</h2>
          <p className="truncate text-sm text-gray-500 dark:text-zinc-400">{data.email}</p>
        </div>
      </div>

      <form onSubmit={handleSaveProfile} className={`${panelCard} p-4 space-y-4`}>
        <h3 className="flex items-center gap-2 text-sm font-bold text-gray-800 dark:text-white">
          <User className="h-4 w-4 text-red-600" /> Dados da conta
        </h3>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <div className="space-y-1.5">
            <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Nome completo</label>
            <input className={`w-full ${panelField}`} value={data.nome} onChange={(e) => setData({ ...data, nome: e.target.value })} placeholder="O seu nome" />
          </div>
          <div className="space-y-1.5">
            <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Empresa</label>
            <input className={`w-full ${panelField}`} value={data.empresa} onChange={(e) => setData({ ...data, empresa: e.target.value })} placeholder="Nome da empresa" />
          </div>
          <div className="space-y-1.5">
            <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Email</label>
            <input type="email" className={`w-full ${panelField}`} value={data.email} onChange={(e) => setData({ ...data, email: e.target.value })} placeholder="email@exemplo.com" />
          </div>
          <div className="space-y-1.5">
            <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Telefone</label>
            <input className={`w-full ${panelField}`} value={data.telefone} onChange={(e) => setData({ ...data, telefone: e.target.value })} placeholder="+258 ..." />
          </div>
          <div className="space-y-1.5">
            <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400">NIF</label>
            <input className={`w-full ${panelField}`} value={data.nif} onChange={(e) => setData({ ...data, nif: e.target.value })} placeholder="NIF da empresa" />
          </div>
        </div>
        <div className="flex justify-end">
          <button type="submit" disabled={savingProfile} className={panelBtnPrimary}>
            <Save className="h-4 w-4" /> {savingProfile ? 'A guardar...' : 'Guardar perfil'}
          </button>
        </div>
      </form>

      <form onSubmit={handleChangePassword} className={`${panelCard} p-4 space-y-4`}>
        <h3 className="flex items-center gap-2 text-sm font-bold text-gray-800 dark:text-white">
          <Lock className="h-4 w-4 text-red-600" /> Alterar senha
        </h3>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <div className="space-y-1.5">
            <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Nova senha</label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                className={`w-full pr-9 ${panelField}`}
                value={passwords.new}
                onChange={(e) => setPasswords({ ...passwords, new: e.target.value })}
              />
              <button type="button" onClick={() => setShowPassword((v) => !v)} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-zinc-300">
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>
          <div className="space-y-1.5">
            <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Confirmar nova senha</label>
            <input
              type={showPassword ? 'text' : 'password'}
              className={`w-full ${panelField}`}
              value={passwords.confirm}
              onChange={(e) => setPasswords({ ...passwords, confirm: e.target.value })}
            />
          </div>
        </div>
        <div className="flex justify-end">
          <button type="submit" disabled={savingPassword || !passwords.new} className={panelBtnSecondary}>
            <Lock className="h-4 w-4" /> {savingPassword ? 'A actualizar...' : 'Actualizar senha'}
          </button>
        </div>
      </form>

      {message && (
        <div className={`flex items-center gap-2.5 rounded-lg border p-3 text-sm font-medium ${
          message.type === 'success'
            ? 'border-green-200 bg-green-50 text-green-700 dark:border-green-900 dark:bg-green-950/30 dark:text-green-400'
            : 'border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-400'
        }`}>
          {message.type === 'success' ? <CheckCircle2 className="h-4 w-4 shrink-0" /> : <AlertCircle className="h-4 w-4 shrink-0" />}
          {message.text}
        </div>
      )}
    </div>
  );
}
