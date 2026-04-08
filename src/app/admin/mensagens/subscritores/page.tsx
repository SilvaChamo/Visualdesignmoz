"use client";

import React, { useState, useEffect } from 'react';
import { UserPlus, Search, Trash2, Download, Upload, Filter, Mail, Users, CheckCircle2, X } from 'lucide-react';
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

interface Subscriber {
  id: string;
  email: string;
  full_name: string | null;
  status: string;
  created_at: string;
}

export default function SubscritoresPage() {
  const [subscribers, setSubscribers] = useState<Subscriber[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [newName, setNewName] = useState('');

  const fetchSubscribers = async () => {
    try {
      setLoading(true);
      let query = supabase
        .from('newsletter_subscribers')
        .select('*')
        .or('metadata->>panel.eq.admin,metadata->>domain.is.null')
        .order('created_at', { ascending: false });

      if (searchTerm) {
        query = query.ilike('email', `%${searchTerm}%`);
      }

      const { data, error } = await query;
      if (error) throw error;
      setSubscribers(data || []);
    } catch (error: any) {
      console.error('Failed to fetch subscribers:', error);
      toast.error("Erro ao carregar subscritores");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
        fetchSubscribers();
    }, 300);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  const handleAddSubscriber = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEmail) return;

    try {
      const { error } = await supabase
        .from('newsletter_subscribers')
        .insert({
          email: newEmail,
          full_name: newName,
          status: 'subscribed',
          metadata: { panel: 'admin' }
        });
      
      if (error) throw error;

      toast.success("Subscritor adicionado com sucesso!");
      setNewEmail('');
      setNewName('');
      setShowAddForm(false);
      fetchSubscribers();
    } catch (error: any) {
      console.error('Failed to add subscriber:', error);
      toast.error(error.message.includes('unique') ? "Este email já está registado" : "Erro ao adicionar subscritor");
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const { error } = await supabase
        .from('newsletter_subscribers')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
      
      toast.success("Subscritor removido");
      fetchSubscribers();
    } catch (error: any) {
      console.error('Failed to delete subscriber:', error);
      toast.error("Erro ao remover subscritor");
    }
  };

  const exportCSV = () => {
    const headers = ['Email', 'Nome', 'Status', 'Data Subscrição'];
    const rows = subscribers.map(s => [s.email, s.full_name || '', s.status, new Date(s.created_at).toLocaleDateString()]);
    
    const csvContent = [headers, ...rows].map(e => e.join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `subscritores_Portal Digital_${new Date().toISOString().split('T')[0]}.csv`);
    link.click();
    toast.success("Exportação concluída!");
  };

  return (
    <div className="w-full space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
        <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-emerald-100 rounded-xl flex items-center justify-center">
                <Users className="w-6 h-6 text-emerald-600" />
            </div>
            <div>
                <h1 className="text-2xl font-black text-slate-900 tracking-tight">Lista de Subscritores</h1>
                <p className="text-sm text-slate-500 font-medium">Faça a gestão da sua base de dados de marketing.</p>
            </div>
        </div>
        
        <div className="flex gap-2">
          <button 
            onClick={exportCSV}
            className="flex items-center gap-2 px-4 py-2 bg-slate-50 hover:bg-slate-100 text-slate-600 rounded-xl border border-slate-200 transition-all font-bold text-xs uppercase tracking-wider"
          >
            <Download size={16} />
            Exportar CSV
          </button>
          <Button 
            onClick={() => setShowAddForm(true)}
            className="bg-emerald-600 hover:bg-orange-600 text-white px-6 h-10 rounded-xl font-bold uppercase text-xs tracking-widest shadow-lg shadow-emerald-500/20 transition-all"
          >
            <UserPlus size={16} className="mr-2" />
            Novo Subscritor
          </Button>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-slate-50 flex items-center gap-4 bg-slate-50/30">
            <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
                <input
                    type="text"
                    placeholder="Pesquisar por email..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all text-sm"
                />
            </div>
            <div className="hidden md:flex items-center gap-2 text-xs font-bold text-slate-400 uppercase tracking-widest">
                <Filter size={14} /> Filtrar por:
                <span className="bg-white px-3 py-1 rounded-full border border-slate-200 text-slate-600">Todos</span>
            </div>
        </div>

        <div className="overflow-x-auto">
            <table className="w-full text-left">
            <thead className="bg-slate-50/50 border-b border-slate-100">
                <tr>
                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Subscritor</th>
                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Status</th>
                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Data de Registo</th>
                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Ações</th>
                </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
                {loading ? (
                [1, 2, 3, 4, 5].map(i => (
                    <tr key={i} className="animate-pulse">
                    <td colSpan={4} className="px-6 py-6 h-16 bg-slate-50/20" />
                    </tr>
                ))
                ) : subscribers.length === 0 ? (
                <tr>
                    <td colSpan={4} className="px-6 py-20 text-center">
                    <div className="flex flex-col items-center gap-4">
                        <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center">
                            <Mail size={32} className="text-slate-200" />
                        </div>
                        <div className="space-y-1">
                            <p className="font-bold text-slate-900">Nenhum subscritor encontrado</p>
                            <p className="text-sm text-slate-400">Inicie a sua lista adicionando um novo contacto.</p>
                        </div>
                        <Button variant="outline" onClick={() => setShowAddForm(true)} className="rounded-xl border-dashed">
                            Adicionar Manualmente
                        </Button>
                    </div>
                    </td>
                </tr>
                ) : subscribers.map((sub) => (
                <tr key={sub.id} className="hover:bg-slate-50/50 transition-colors group">
                    <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center font-bold text-slate-500 uppercase text-xs border border-white shadow-sm">
                            {sub.email.substring(0, 2)}
                        </div>
                        <div className="flex flex-col">
                            <span className="font-bold text-slate-900 text-sm">{sub.email}</span>
                            <span className="text-xs text-slate-400 font-medium">{sub.full_name || 'Particular'}</span>
                        </div>
                    </div>
                    </td>
                    <td className="px-6 py-4">
                    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                        sub.status === 'subscribed' ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' : 'bg-rose-50 text-rose-600 border border-rose-100'
                    }`}>
                        <div className={`w-1.5 h-1.5 rounded-full ${sub.status === 'subscribed' ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                        {sub.status === 'subscribed' ? 'Subscrito' : 'Inativo'}
                    </span>
                    </td>
                    <td className="px-6 py-4 text-xs font-bold text-slate-500">
                    {new Date(sub.created_at).toLocaleDateString('pt-PT', { day: '2-digit', month: 'long', year: 'numeric' })}
                    </td>
                    <td className="px-6 py-4 text-right">
                    <button 
                        onClick={() => handleDelete(sub.id)}
                        className="p-2 text-slate-300 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all group-hover:opacity-100 md:opacity-0"
                    >
                        <Trash2 size={18} />
                    </button>
                    </td>
                </tr>
                ))}
            </tbody>
            </table>
        </div>
      </div>

      {/* Add Form Modal */}
      {showAddForm && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[100] flex items-center justify-center p-6 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">
            <div className="p-8 border-b border-slate-50 flex items-center justify-between bg-slate-50/50">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-emerald-100 rounded-xl flex items-center justify-center">
                    <UserPlus className="w-5 h-5 text-emerald-600" />
                </div>
                <h3 className="text-xl font-black text-slate-900 tracking-tight">
                    Novo Subscritor
                </h3>
              </div>
              <button onClick={() => setShowAddForm(false)} className="p-2 hover:bg-white rounded-full transition-colors group">
                <X className="w-5 h-5 text-slate-400 group-hover:text-slate-600" />
              </button>
            </div>
            <form onSubmit={handleAddSubscriber} className="p-8 space-y-6">
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-500 uppercase ml-1 tracking-wider">Endereço de Email</label>
                <Input
                  type="email"
                  required
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  className="rounded-xl border-slate-200 h-12"
                  placeholder="exemplo@servico.com"
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-500 uppercase ml-1 tracking-wider">Nome Completo (Opcional)</label>
                <Input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="rounded-xl border-slate-200 h-12"
                  placeholder="Nome do cliente ou empresa"
                />
              </div>
              <div className="flex gap-3 pt-4">
                <Button
                  type="submit"
                  className="flex-1 h-12 bg-emerald-600 hover:bg-emerald-700 text-white font-black rounded-xl transition-all shadow-xl shadow-emerald-500/20 uppercase text-xs tracking-widest"
                >
                  Confirmar Registo
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
