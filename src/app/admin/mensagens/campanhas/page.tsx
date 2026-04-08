"use client";

import React, { useState, useEffect } from 'react';
import { Mail, CheckCircle2, XCircle, Clock, Calendar, BarChart3, ArrowUpRight, TrendingUp, Filter, Search, Plus } from 'lucide-react';
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import Link from "next/link";

interface Campaign {
  id: string;
  subject: string;
  status: string;
  sent_at: string | null;
  total_recipients: number;
  successful_sends: number;
  failed_sends: number;
  created_at: string;
}

export default function CampanhasPage() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchCampaigns = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('email_campaigns')
        .select('*')
        .ilike('sender_email', 'admin:%')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setCampaigns(data || []);
    } catch (error: any) {
      console.error('Failed to fetch campaigns:', error);
      toast.error("Erro ao carregar histórico");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCampaigns();
  }, []);

  const totalSent = campaigns.reduce((acc, current: any) => acc + (current.recipient_count || current.total_recipients || 0), 0);
  const totalSuccess = campaigns.reduce((acc, current: any) => acc + (current.recipient_count || current.successful_sends || 0), 0);
  const successRate = totalSent > 0 ? (totalSuccess / totalSent) * 100 : 0;

  return (
    <div className="w-full space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
        <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-orange-100 rounded-xl flex items-center justify-center">
                <BarChart3 className="w-6 h-6 text-orange-600" />
            </div>
            <div>
                <h1 className="text-2xl font-black text-slate-900 tracking-tight">Histórico de Campanhas</h1>
                <p className="text-sm text-slate-500 font-medium">Análise de desempenho e registo de mensagens enviadas.</p>
            </div>
        </div>
        
        <Link href="/admin/mensagens">
          <Button className="bg-emerald-600 hover:bg-emerald-700 text-white px-6 h-10 rounded-xl font-bold uppercase text-xs tracking-widest shadow-lg shadow-emerald-500/20 transition-all">
            <Plus size={16} className="mr-2" />
            Nova Campanha
          </Button>
        </Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Quick Stats */}
        <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
            <Mail size={80} />
          </div>
          <div className="flex items-center gap-4 mb-4">
            <div className="p-3 bg-blue-50 text-blue-600 rounded-xl">
              <Mail size={20} />
            </div>
            <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Total de Envios</p>
          </div>
          <div className="flex items-baseline gap-2">
            <p className="text-3xl font-black text-slate-900">{totalSent.toLocaleString()}</p>
            <span className="text-[10px] font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full uppercase">Acumulado</span>
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
            <TrendingUp size={80} />
          </div>
          <div className="flex items-center gap-4 mb-4">
            <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl">
              <TrendingUp size={20} />
            </div>
            <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Taxa de Sucesso</p>
          </div>
          <div className="flex items-baseline gap-2">
            <p className="text-3xl font-black text-slate-900">{successRate.toFixed(1)}%</p>
            <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full uppercase">Entrega</span>
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
            <Calendar size={80} />
          </div>
          <div className="flex items-center gap-4 mb-4">
            <div className="p-3 bg-purple-50 text-purple-600 rounded-xl">
              <ArrowUpRight size={20} />
            </div>
            <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Campanhas</p>
          </div>
          <div className="flex items-baseline gap-2">
            <p className="text-3xl font-black text-slate-900">{campaigns.length}</p>
            <span className="text-[10px] font-bold text-purple-600 bg-purple-50 px-2 py-0.5 rounded-full uppercase">Executadas</span>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-slate-50 flex items-center justify-between bg-slate-50/30">
            <div className="flex items-center gap-3">
                <h3 className="font-black text-slate-900 uppercase text-xs tracking-widest">Lista de Envios</h3>
                <span className="bg-white px-2 py-0.5 rounded-full border border-slate-200 text-[10px] font-bold text-slate-400">
                    {campaigns.length} Registos
                </span>
            </div>
            <div className="flex gap-2">
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300" size={14} />
                    <input
                        type="text"
                        placeholder="Pesquisar assunto..."
                        className="pl-9 pr-4 py-1.5 bg-white border border-slate-200 rounded-xl outline-none focus:ring-1 focus:ring-orange-500 text-xs w-48 transition-all"
                    />
                </div>
            </div>
        </div>

        <div className="divide-y divide-slate-50">
          {loading ? (
            [1, 2, 3].map(i => (
              <div key={i} className="p-8 animate-pulse flex justify-between">
                <div className="space-y-3">
                  <div className="h-5 w-72 bg-slate-100 rounded-lg" />
                  <div className="h-3 w-40 bg-slate-50 rounded-lg" />
                </div>
                <div className="flex gap-4">
                  <div className="h-10 w-20 bg-slate-50 rounded-lg" />
                  <div className="h-10 w-20 bg-slate-50 rounded-lg" />
                </div>
              </div>
            ))
          ) : campaigns.length === 0 ? (
            <div className="p-20 text-center text-slate-400">
              <Mail size={48} className="mx-auto text-slate-100 mb-4" />
              <p className="font-bold text-slate-900">Ainda não enviou nenhuma campanha</p>
              <p className="text-sm mt-1">Crie a sua primeira mensagem no compositor.</p>
            </div>
          ) : campaigns.map((campaign) => (
            <div key={campaign.id} className="p-8 hover:bg-slate-50/50 transition-all flex flex-col lg:flex-row lg:items-center justify-between gap-6 group">
              <div className="space-y-2">
                <h4 className="font-black text-lg text-slate-800 group-hover:text-orange-600 transition-colors uppercase tracking-tight leading-tight">{campaign.subject}</h4>
                <div className="flex flex-wrap items-center gap-6 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                  <span className="flex items-center gap-2">
                    <Calendar size={14} className="text-slate-300" />
                    {campaign.sent_at ? new Date(campaign.sent_at).toLocaleDateString('pt-PT', { day: '2-digit', month: 'short', year: 'numeric' }) : 'Em Rascunho'}
                  </span>
                  <span className="flex items-center gap-2">
                    <Clock size={14} className="text-slate-300" />
                    {campaign.sent_at ? new Date(campaign.sent_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '-'}
                  </span>
                  <span className="flex items-center gap-2">
                    <Mail size={14} className="text-slate-300" />
                    BCC Broadcast
                  </span>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-4 lg:justify-end">
                <div className="bg-white px-4 py-2 rounded-2xl border border-slate-100 text-center shadow-sm min-w-[90px]">
                  <p className="text-[9px] text-slate-400 font-black uppercase tracking-wider mb-1">Destinos</p>
                  <p className="font-black text-slate-900 text-lg leading-none">{(campaign as any).recipient_count || campaign.total_recipients || 0}</p>
                </div>
                <div className="bg-emerald-50/50 px-4 py-2 rounded-2xl border border-emerald-100/50 text-center shadow-sm min-w-[90px]">
                  <p className="text-[9px] text-emerald-500/70 font-black uppercase tracking-wider mb-1">Sucesso</p>
                  <p className="font-black text-emerald-700 text-lg leading-none">{(campaign as any).recipient_count || campaign.successful_sends || 0}</p>
                </div>
                <div className="bg-rose-50/50 px-4 py-2 rounded-2xl border border-rose-100/50 text-center shadow-sm min-w-[90px]">
                  <p className="text-[9px] text-rose-500/70 font-black uppercase tracking-wider mb-1">Falha</p>
                  <p className="font-black text-rose-700 text-lg leading-none">{campaign.failed_sends || 0}</p>
                </div>
                <div className={`px-5 py-2.5 rounded-xl font-black text-[10px] uppercase tracking-widest border transition-all ${
                  campaign.status === 'sent' 
                    ? 'bg-blue-50 text-blue-600 border-blue-100' 
                    : 'bg-orange-50 text-orange-600 border-orange-100'
                }`}>
                  {campaign.status === 'sent' ? 'Concluída' : 'Executando'}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
