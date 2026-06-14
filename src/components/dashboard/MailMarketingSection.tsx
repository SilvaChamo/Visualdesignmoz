'use client';

import React, { useState, useEffect, useRef } from 'react';
import { 
  Plus, Search, Download, Edit2, Trash2, RefreshCw, Send, Megaphone, Newspaper, 
  File as FileIcon, Loader2, LayoutTemplate, Sparkles, X as XLucide, 
  History as HistoryIcon, Calendar, Eye, Pencil, BarChart3, TrendingUp, 
  ArrowUpRight, Check, AlertTriangle, X, Bell, Mail, Target, Package, Globe,
  Shield, Database, Settings, ChevronRight, MessageSquare, ExternalLink,
  ChevronLeft, FileText, Image as ImageIcon, Users
} from 'lucide-react';
import { useAuth } from '@/components/auth/AuthProvider';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { RichTextEditor } from "@/components/RichTextEditor";
import { MultiFileUpload } from "@/components/admin/MultiFileUpload";
import { SenderEmailSelector } from "@/components/admin/SenderEmailSelector";
import { EmailTemplates } from "@/components/admin/EmailTemplates";
import { toast } from "sonner";
import { 
  adminListarSubscritores as listarSubscritores,
  adminAdicionarSubscritor as adicionarSubscritor,
  adminAtualizarSubscritor as atualizarSubscritor,
  adminRemoverSubscritor as removerSubscritor,
  adminListarCampanhas as listarCampanhas,
  adminSalvarCampanha as salvarCampanha,
  adminRemoverCampanha as removerCampanha,
  adminLimparDadosCampanhas as limparDadosCampanhas
} from '@/app/actions/mailmarketing';

const CORES_PALETA = [
  '#000000', '#434343', '#666666', '#999999', '#b7b7b7', '#cccccc', '#d9d9d9', '#ffffff',
  '#ff0000', '#ff4500', '#ff9900', '#ffff00', '#00ff00', '#00ffff', '#4a86e8', '#0000ff',
  '#9900ff', '#ff00ff', '#e6b8a2', '#f4cccc', '#fce5cd', '#fff2cc', '#d9ead3', '#d0e0e3',
  '#9900ff', '#ff00ff', '#e6b8a2', '#f4cccc', '#fce5cd', '#fff2cc', '#d9d9d3', '#d0e0e3',
  '#c9daf8', '#cfe2f3', '#d9d2e9', '#ead1dc', '#cc0000', '#e69138', '#f1c232', '#6aa84f',
  '#45818e', '#3c78d8', '#3d85c6', '#674ea7', '#a64d79', '#85200c', '#783f04', '#7f6000',
];

const RECIPIENT_GROUPS = [
  "Contactos"
];

function MailMarketingContactsSkeleton() {
  return (
    <>
      {[1, 2, 3, 4, 5].map((i) => (
        <tr key={i} className="hover:bg-slate-50/50 transition-colors animate-in fade-in duration-500">
          <td className="px-5 py-[5px]">
            <div className="w-4 h-4 bg-slate-200 rounded animate-pulse" />
          </td>
          <td className="px-5 py-4">
            <div className="space-y-2">
              <div className="h-4 w-32 bg-slate-300 rounded animate-pulse" />
              <div className="h-3 w-48 bg-slate-200 rounded animate-pulse" />
            </div>
          </td>
          <td className="px-5 py-4"><div className="h-4 w-28 bg-slate-200 rounded animate-pulse" /></td>
          <td className="px-5 py-4"><div className="h-6 w-20 bg-slate-100 rounded-md animate-pulse" /></td>
          <td className="px-5 py-4"><div className="h-5 w-16 bg-emerald-50 rounded-md animate-pulse" /></td>
          <td className="px-5 py-4">
            <div className="flex items-center justify-end gap-2">
              <div className="w-7 h-7 bg-slate-100 rounded animate-pulse" />
              <div className="w-7 h-7 bg-red-50 rounded animate-pulse" />
            </div>
          </td>
        </tr>
      ))}
    </>
  )
}

function MailMarketingCampaignsSkeleton() {
  return (
    <div className="space-y-4">
      {[1, 2, 3, 4].map((i) => (
        <div key={i} className="flex items-center justify-between p-4 rounded-xl border border-slate-100 bg-white animate-in fade-in duration-500">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-slate-100 rounded-xl border border-slate-50 animate-pulse" />
            <div className="space-y-2">
              <div className="h-4 bg-slate-300 rounded w-48 animate-pulse" />
              <div className="h-3 bg-slate-200 rounded w-32 animate-pulse" />
            </div>
          </div>
          <div className="flex items-center gap-8">
            <div className="text-right space-y-2">
              <div className="h-3 bg-slate-200 rounded w-16 animate-pulse ml-auto" />
              <div className="h-4 bg-slate-300 rounded w-12 animate-pulse ml-auto" />
            </div>
            <div className="w-24 flex justify-end">
              <div className="h-6 bg-slate-100 rounded-md w-16 animate-pulse" />
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

export function MailMarketingSection({ 
  sites, 
  currentUserEmail, 
  activeTab: externalActiveTab, 
  onTabChange 
}: { 
  sites: any[], 
  currentUserEmail?: string, 
  activeTab?: string, 
  onTabChange?: (tab: any) => void 
}) {
  const [internalActiveTab, setInternalActiveTab] = useState('comp');
  const activeTab = externalActiveTab || internalActiveTab;
  const setActiveTab = onTabChange || setInternalActiveTab;

  const [listas, setListas] = useState<string[]>(["Contactos"]);
  const [searchTerm, setSearchTerm] = useState('');

  // Filtrar domínios reais
  const pureSites = sites.filter(s => !s.domain.toLowerCase().startsWith('mail.'));

  // 🎯 Detecção Inteligente: Site → Domínio do Email → Hostname
  const getDefaultDomain = () => {
    if (pureSites.length > 0) return pureSites[0].domain;
    if (currentUserEmail && currentUserEmail.includes('@')) {
      const emailDomain = currentUserEmail.split('@')[1];
      if (emailDomain && emailDomain !== 'localhost' && !emailDomain.startsWith('127.')) {
        return emailDomain;
      }
    }
    if (typeof window !== 'undefined') {
      const host = window.location.hostname.replace('client.', '').replace('portal.', '');
      if (host && host !== 'localhost' && !host.startsWith('127.')) return host;
    }
    return '';
  };

  const [selectedSite, setSelectedSite] = useState(getDefaultDomain());
  const [campaignToResend, setCampaignToResend] = useState<any>(null);

  useEffect(() => {
    if (!selectedSite) {
      const defaultDomain = getDefaultDomain();
      if (defaultDomain) {
        setSelectedSite(defaultDomain);
      }
    }
  }, [selectedSite, pureSites, currentUserEmail]);

  return (
    <div className="space-y-5 h-full overflow-auto">
      <div className="relative min-h-full">
        <div className={`transition-all duration-300 ${activeTab === 'comp' ? 'block opacity-100 relative z-10' : 'hidden opacity-0 absolute inset-0 z-0 pointer-events-none'}`}>
          <MailMarketingComposer selectedSite={selectedSite} setSelectedSite={setSelectedSite} sites={pureSites} onGoToContacts={() => setActiveTab('subs')} currentUserEmail={currentUserEmail} listas={listas} setListas={setListas} campaignToResend={campaignToResend} setCampaignToResend={setCampaignToResend} />
        </div>
        <div className={`transition-all duration-300 ${activeTab === 'subs' ? 'block opacity-100 relative z-10' : 'hidden opacity-0 absolute inset-0 z-0 pointer-events-none'}`}>
          <MailMarketingContacts selectedSite={selectedSite} setSelectedSite={setSelectedSite} sites={pureSites} listas={listas} searchTerm={searchTerm} setSearchTerm={setSearchTerm} />
        </div>
        <div className={`transition-all duration-300 ${activeTab === 'camp' ? 'block opacity-100 relative z-10' : 'hidden opacity-0 absolute inset-0 z-0 pointer-events-none'}`}>
          <MailMarketingCampaigns selectedSite={selectedSite} currentUserEmail={currentUserEmail} onResend={(camp: any) => { setCampaignToResend(camp); setActiveTab('comp'); }} />
        </div>
      </div>
    </div>
  )
}

function MailMarketingComposer({ selectedSite, setSelectedSite, sites, onGoToContacts, currentUserEmail, listas, setListas, campaignToResend, setCampaignToResend }: { selectedSite: string, setSelectedSite: (s: string) => void, sites: any[], onGoToContacts: () => void, currentUserEmail?: string, listas: string[], setListas: (l: string[]) => void, campaignToResend?: any, setCampaignToResend?: (c: any) => void }) {
  const { user } = useAuth();
  const [subject, setSubject] = useState("");
  const [content, setContent] = useState("");
  const [selectedPlans, setSelectedPlans] = useState<string[]>(["Contactos"]);
  const [senderEmail, setSenderEmail] = useState(currentUserEmail || "");
  const [attachments, setAttachments] = useState<string[]>([]);
  const [isSending, setIsSending] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);
  const [showNewListPopup, setShowNewListPopup] = useState(false);
  const [newListTitle, setNewListTitle] = useState("");
  const [showSuccessDialog, setShowSuccessDialog] = useState(false);
  const [showValidationError, setShowValidationError] = useState(false);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [showReputationInfo, setShowReputationInfo] = useState(false);
  
  const [lastSendData, setLastSendData] = useState<any>(null);
  const [domainReputation, setDomainReputation] = useState<any>(null);
  const [loadingReputation, setLoadingReputation] = useState(false);
  const [domainEmails, setDomainEmails] = useState<string[]>([]);
  const [loadingDomainEmails, setLoadingDomainEmails] = useState(false);

  const fetchReputation = async () => {
    if (!selectedSite) return;
    setLoadingReputation(true);
    try {
      const response = await fetch(`/api/mailmarketing-send?domain=${encodeURIComponent(selectedSite)}`);
      const data = await response.json();
      if (data.success) {
        setDomainReputation(data.reputation);
      }
    } catch (error) {
      console.error("Erro ao buscar reputação:", error);
    } finally {
      setLoadingReputation(false);
    }
  };

  useEffect(() => {
    fetchReputation();
  }, [selectedSite]);

  useEffect(() => {
    const fetchDomainEmails = async () => {
      if (!selectedSite) return;
      setLoadingDomainEmails(true);
      try {
        const [supabaseRes, panelRes] = await Promise.allSettled([
          fetch('/api/email-contas'),
          fetch('/api/panel-bridge', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'listEmails', params: { domain: selectedSite } })
          })
        ]);
        
        let allEmailsList: string[] = [];
        
        if (supabaseRes.status === 'fulfilled') {
          const result = await supabaseRes.value.json();
          const data = result.contas || result;
          if (Array.isArray(data)) {
            const supabaseEmails = data
              .filter((account: any) => {
                const emailDomain = account.email?.split('@')[1]?.toLowerCase();
                return emailDomain === selectedSite.toLowerCase();
              })
              .map((account: any) => account.email);
            allEmailsList = [...allEmailsList, ...supabaseEmails];
          }
        }
        
        if (panelRes.status === 'fulfilled') {
          const result = await panelRes.value.json();
          if (result.success && Array.isArray(result.emails)) {
            allEmailsList = [...allEmailsList, ...result.emails];
          }
        }
        
        const domainEmailsList = [...new Set(allEmailsList.filter((e: string) => e && e.includes('@')))];
        
        if (currentUserEmail) {
          const userDomain = currentUserEmail.split('@')[1]?.toLowerCase();
          if (userDomain === selectedSite.toLowerCase() && !domainEmailsList.includes(currentUserEmail)) {
            domainEmailsList.push(currentUserEmail);
          }
        }
        
        if (domainEmailsList.length === 0 && currentUserEmail) {
          domainEmailsList.push(currentUserEmail);
        }
        
        const sortedEmails = domainEmailsList.sort((a: string, b: string) => {
          const aLower = a.toLowerCase();
          const bLower = b.toLowerCase();
          const userEmail = currentUserEmail?.toLowerCase();
          const selectedDomain = selectedSite.toLowerCase();
          if (aLower === userEmail) return -1;
          if (bLower === userEmail) return 1;
          if (aLower === `marketing@${selectedDomain}`) return -1;
          if (bLower === `marketing@${selectedDomain}`) return 1;
          if (aLower === `geral@${selectedDomain}` || aLower === `admin@${selectedDomain}`) return -1;
          if (bLower === `geral@${selectedDomain}` || bLower === `admin@${selectedDomain}`) return 1;
          return aLower.localeCompare(bLower);
        });
        
        const uniqueEmails = [...new Set(domainEmailsList)];
        setDomainEmails(uniqueEmails);
        if (uniqueEmails.length > 0 && !uniqueEmails.includes(senderEmail)) {
          setSenderEmail(uniqueEmails[0]);
        }
      } catch (error) {
        console.error("Erro ao buscar emails do domínio:", error);
      } finally {
        setLoadingDomainEmails(false);
      }
    };
    fetchDomainEmails();
  }, [selectedSite, currentUserEmail]);

  useEffect(() => {
    if (campaignToResend) {
      setSubject(campaignToResend.subject || "");
      setContent(campaignToResend.content || "");
    }
  }, [campaignToResend]);

  const normalizeDomain = (value?: string | null) =>
    (value || '')
      .toLowerCase()
      .trim()
      .replace(/^https?:\/\//, '')
      .replace(/^www\./, '')
      .replace(/^mail\./, '')
      .replace(/\/.*$/, '');

  const allowedDomains = new Set(
    (sites || [])
      .map((s: any) => normalizeDomain(s?.domain))
      .filter(Boolean)
      .concat(selectedSite ? [normalizeDomain(selectedSite)] : [])
  );

  const isPlatformDomain = (domain: string) =>
    domain.includes('visualdesign') || domain.includes('visualdesigne');

  const handlePlanToggle = (plan: string) => {
    if (selectedPlans.includes(plan)) {
      setSelectedPlans(selectedPlans.filter((p: string) => p !== plan));
    } else {
      setSelectedPlans([...selectedPlans, plan]);
    }
  };

  const handleSend = async () => {
    const errors = [];
    if (!subject || subject.trim() === '') errors.push('Assunto do email é obrigatório');
    if (!content || content.trim() === '') errors.push('Conteúdo da mensagem é obrigatório');
    if (selectedPlans.length === 0) errors.push('Selecione pelo menos uma lista de destinatários');

    if (errors.length > 0) {
      setValidationErrors(errors);
      setShowValidationError(true);
      return;
    }

    setIsSending(true);

    try {
      let finalHtml = content;
      if (attachments.length > 0) {
        finalHtml += `<br/><div style="margin-top: 20px; padding-top: 20px; border-top: 1px solid #eee;"><strong>Anexos:</strong><ul style="list-style: none; padding: 0; margin-top: 8px;">`;
        attachments.forEach(url => {
          const fileName = url.split('/').pop() || "Documento";
          finalHtml += `<li style="margin-bottom: 8px;"><a href="${url}" target="_blank" style="color: #ea580c; text-decoration: underline; display: inline-flex; align-items: center; gap: 4px;">📎 ${fileName}</a></li>`;
        });
        finalHtml += `</ul></div>`;
      }

      let allRecipients: { id?: string, email: string }[] = [];

      if (selectedPlans.length > 0) {
        let data = await listarSubscritores(selectedSite);
        if ((!data || data.length === 0) && selectedSite) {
          data = await listarSubscritores();
        }
        
        if (data) {
          const filteredData = data.filter((s: any) => {
            const contactDomain = normalizeDomain(s?.metadata?.domain);
            const listName = s.metadata?.list || 'Contactos';
            if (!selectedPlans.includes(listName)) return false;
            if (!contactDomain || isPlatformDomain(contactDomain)) return true;
            if (allowedDomains.size > 0 && allowedDomains.has(contactDomain)) return true;
            if (allowedDomains.size === 0) return true;
            return false;
          });
          allRecipients = [...allRecipients, ...filteredData.map((s: any) => ({ email: s.email }))];
        }
      }

      if (allRecipients.length === 0) {
        toast.error("Nenhum destinatário encontrado na sua lista de contactos.");
        setIsSending(false);
        return;
      }

      const emailList = Array.from(new Set(allRecipients.map((r: any) => r.email))).filter(Boolean);
      let targetDomain = selectedSite || process.env.NEXT_PUBLIC_DEFAULT_DOMAIN || 'visualdesign.pt';

      const clientName = user?.user_metadata?.full_name || user?.user_metadata?.nome || senderEmail?.split('@')[0] || user?.email?.split('@')[0] || '';
      const clientEmail = senderEmail || user?.email || '';

      setLastSendData({ emailList, finalHtml, targetDomain, clientName, clientEmail });

      const response = await fetch('/api/mailmarketing-send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: emailList,
          subject,
          content: finalHtml,
          domain: targetDomain,
          clientName: clientName,
          clientEmail: clientEmail,
          sender: clientEmail ? `"${clientName || clientEmail}" <${clientEmail}>` : undefined
        })
      });

      const result = await response.json();
      
      if (!response.ok) {
        if (result.code === 'DAILY_LIMIT_EXCEEDED') {
          toast.error(`⚠️ ${result.error}`, { duration: 5000 });
          setIsSending(false);
          return;
        }
        throw new Error(result.error || result.message || "Erro ao enviar mensagem");
      }
      
      const sentCount = result?.details?.success ?? 0;
      const failedCount = result?.details?.failed ?? emailList.length;
      
      if (sentCount === 0) {
        throw new Error(result?.details?.errors?.[0] || "Nenhum email foi entregue. Verifique a configuração SMTP.");
      } else if (failedCount > 0) {
        toast.warning(`Envio parcial: ${sentCount} entregue(s), ${failedCount} falha(s).`);
      } else {
        toast.success(`Campanha enviada com sucesso para ${sentCount} contactos!`);
      }

      await salvarCampanha({
        subject,
        content_html: finalHtml,
        total_recipients: emailList.length,
        domain: selectedSite,
        owner_email: user?.email || currentUserEmail || ''
      });

      setAttachments([]);
      setShowSuccessDialog(true);
    } catch (error: any) {
      console.error("❌ ERRO:", error);
      toast.error(error.message || "Erro ao enviar mensagem");
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="w-full space-y-5 animate-in fade-in duration-500">
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-5">
        <div className="lg:col-span-3 space-y-5">
          <div className="bg-white rounded-lg border border-slate-100 shadow-sm overflow-hidden flex flex-col min-h-[600px]">
            <div className="bg-slate-200 px-5 py-3 border-b border-slate-300 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Newspaper className="w-5 h-5 text-slate-600" />
                <h2 className="font-black text-slate-800 uppercase tracking-widest text-xs">Editor de Mensagem</h2>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2 bg-white rounded-md border border-slate-300 px-2 h-8">
                  <Mail className="w-4 h-4 text-slate-500 shrink-0" />
                  <select
                    value={senderEmail}
                    onChange={(e) => setSenderEmail(e.target.value)}
                    disabled={loadingDomainEmails || domainEmails.length === 0}
                    className="h-full px-1 text-xs font-bold text-slate-700 bg-transparent border-none focus:outline-none focus:ring-0 min-w-[200px] max-w-[300px] truncate"
                  >
                    {loadingDomainEmails ? (
                      <option value="">A carregar...</option>
                    ) : domainEmails.length === 0 ? (
                      <option value="">Nenhum email disponível</option>
                    ) : (
                      domainEmails.map((email) => (
                        <option key={email} value={email}>{email}</option>
                      ))
                    )}
                  </select>
                </div>
                <Button onClick={handleSend} disabled={isSending || !senderEmail} className="!bg-emerald-600 hover:!bg-red-600 text-white gap-2 font-black uppercase text-[10px] tracking-widest h-8 px-4 rounded-md shadow-xl transition-all border-none">
                  {isSending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />} Enviar
                </Button>
                <Button onClick={() => setShowTemplates(true)} className="!bg-slate-800 hover:!bg-red-600 text-white gap-2 font-black uppercase text-[10px] tracking-widest h-8 px-4 rounded-md transition-all border-none">
                  <LayoutTemplate className="w-3 h-3" /> Templates
                </Button>
              </div>
            </div>
            <div className="">
              <RichTextEditor value={content} onChange={setContent} placeholder="Escreva o corpo do seu email aqui..." className="min-h-[500px] border-none">
                <div className="px-5 py-2 bg-white border-b border-slate-200 flex items-center gap-4">
                  <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest shrink-0 border-r border-slate-200 pr-4">Assunto</span>
                  <input type="text" placeholder="Escreva aqui o assunto da sua campanha..." value={subject} onChange={(e) => setSubject(e.target.value)} className="w-full bg-transparent border-none focus:ring-0 outline-none text-sm font-bold text-slate-800 p-0" />
                  <MultiFileUpload value={attachments} onChange={setAttachments} folder="client-marketing" layout="minimal" showList={false} className="shrink-0" />
                </div>
              </RichTextEditor>
            </div>
          </div>
          <div className="bg-white p-5 rounded-lg border border-slate-100 shadow-sm space-y-5">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-black text-slate-900 uppercase tracking-wider flex items-center gap-2">
                <FileIcon className="w-4 h-4 text-orange-600" /> Ficheiros em Anexo
              </h3>
              <span className="text-[10px] font-bold text-slate-500 bg-slate-50 px-2 py-0.5 rounded-full border border-slate-100">
                {attachments.length} Ficheiros
              </span>
            </div>
            <MultiFileUpload value={attachments} onChange={setAttachments} folder="client-marketing" layout="default" description="PDF, Imagens, Documentos (Máx 10MB)" />
          </div>
        </div>
        <div className="space-y-5">
          <div className="bg-white p-5 rounded-lg border border-slate-100 shadow-sm space-y-5">
            <h3 className="text-sm font-black text-slate-900 uppercase tracking-wider">Destinatários</h3>
            <div className="space-y-3">
              {listas.map(plan => (
                <div key={plan} className="group relative">
                  <label className={`flex items-center gap-3 p-3 rounded-lg border transition-all cursor-pointer ${selectedPlans.includes(plan) ? 'bg-orange-50 border-orange-200' : 'bg-white border-slate-200'}`}>
                    <Checkbox id={`plan-${plan}`} checked={selectedPlans.includes(plan)} onCheckedChange={() => handlePlanToggle(plan)} />
                    <span className={`text-xs font-bold ${selectedPlans.includes(plan) ? 'text-orange-700' : 'text-slate-600'}`}>{plan}</span>
                  </label>
                  <button onClick={(e) => { e.stopPropagation(); setListas(listas.filter(l => l !== plan)); setSelectedPlans(selectedPlans.filter(p => p !== plan)); }} className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 text-slate-400 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-all">
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
              <button onClick={() => setShowNewListPopup(true)} className="w-fit mt-2 ml-1 text-[10px] font-bold text-orange-600 uppercase tracking-widest underline flex items-center gap-1">
                <Plus size={10} /> Criar nova lista
              </button>
            </div>
            {selectedSite && domainReputation && (
              <div className="mt-4 p-4 rounded-lg border border-slate-200/70 shadow-sm">
                <div className="flex items-center justify-between mb-3">
                   <div>
                     <span className="text-sm font-bold text-slate-700">Limite Diário</span>
                     <div className="text-[10px] text-red-500 font-medium">200 emails disponíveis</div>
                   </div>
                </div>
                <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
                   <div className="h-full bg-green-500" style={{ width: `${Math.min(((domainReputation.sentToday || 0) / 200) * 100, 100)}%` }} />
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
      {showTemplates && <EmailTemplates onSelect={(html: string) => { setContent(html); setShowTemplates(false); }} onClose={() => setShowTemplates(false)} />}
      {showNewListPopup && (
        <div className="fixed inset-0 bg-slate-900/60 flex items-center justify-center z-[100]">
          <div className="bg-white rounded-xl p-8 w-full max-w-sm mx-4">
            <h3 className="text-lg font-black text-slate-900 mb-5">Nova Lista</h3>
            <input autoFocus type="text" placeholder="Ex: Clientes VIP..." value={newListTitle} onChange={(e) => setNewListTitle(e.target.value)} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-lg text-sm mb-5" />
            <div className="flex gap-3">
              <button onClick={() => { if (newListTitle) { setListas([...listas, newListTitle]); setNewListTitle(""); setShowNewListPopup(false); } }} className="flex-1 bg-black text-white py-3 rounded-lg text-[10px] font-black uppercase">Adicionar</button>
              <button onClick={() => setShowNewListPopup(false)} className="flex-1 bg-slate-100 text-slate-600 py-3 rounded-lg text-[10px] font-black uppercase">Cancelar</button>
            </div>
          </div>
        </div>
      )}
      {showSuccessDialog && (
        <div className="fixed inset-0 bg-slate-900/60 flex items-center justify-center z-[100]">
          <div className="bg-white rounded-xl p-10 w-full max-w-sm mx-4 text-center">
            <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-4"><Check className="w-8 h-8" /></div>
            <h3 className="text-xl font-black text-slate-900 mb-6">Campanha Enviada!</h3>
            <button onClick={() => { setShowSuccessDialog(false); setSubject(""); setContent(""); }} className="w-full bg-emerald-600 text-white py-3.5 rounded-lg text-[10px] font-black uppercase">OK, Fechar Editor</button>
          </div>
        </div>
      )}
      {showValidationError && (
        <div className="fixed inset-0 bg-slate-900/60 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-8 max-w-sm w-full mx-4 shadow-2xl">
            <div className="flex flex-col items-center gap-3 mb-3 text-center">
              <AlertTriangle className="w-10 h-10 text-red-600" />
              <h3 className="font-bold">Campos Obrigatórios</h3>
            </div>
            <div className="space-y-1.5 mb-4 text-center text-xs text-red-600">
              {validationErrors.map((error, i) => <div key={i}>{error}</div>)}
            </div>
            <button onClick={() => setShowValidationError(false)} className="w-full bg-red-600 text-white py-3 rounded-lg font-black uppercase text-[10px]">Entendido</button>
          </div>
        </div>
      )}
    </div>
  );
}

function MailMarketingContacts({ selectedSite, setSelectedSite, sites, listas, searchTerm, setSearchTerm }: { selectedSite: string, setSelectedSite: (s: string) => void, sites: any[], listas: string[], searchTerm: string, setSearchTerm: (value: string) => void }) {
  const [subscribers, setSubscribers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [newName, setNewName] = useState('');
  const [newListLabel, setNewListLabel] = useState('Contactos');
  const [newDomainLabel, setNewDomainLabel] = useState('');
  const [editingSub, setEditingSub] = useState<any>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedSubscriberIds, setSelectedSubscriberIds] = useState<string[]>([]);
  const itemsPerPage = 10;

  const fetchSubs = async () => {
    try {
      setLoading(true);
      let data = await listarSubscritores(selectedSite);
      if ((!data || data.length === 0) && selectedSite) {
        data = await listarSubscritores();
      }
      setSubscribers(data || []);
    } catch (error) {
      console.error(error);
      toast.error("Erro ao carregar subscritores");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchSubs(); }, [selectedSite, searchTerm]);

  const filteredSubscribers = subscribers.filter(s => !searchTerm || s.email.toLowerCase().includes(searchTerm.toLowerCase()));
  const totalPages = Math.ceil(filteredSubscribers.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const currentItems = filteredSubscribers.slice(startIndex, startIndex + itemsPerPage);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEmail) return;
    try {
      const payload = { email: newEmail, full_name: newName, domain: newDomainLabel || selectedSite, list: newListLabel };
      const result = editingSub ? await atualizarSubscritor(editingSub.id, payload) : await adicionarSubscritor(payload);
      if (result) {
        toast.success("Contacto guardado!");
        setShowAddForm(false);
        setEditingSub(null);
        setNewEmail('');
        fetchSubs();
      }
    } catch (error: any) {
      toast.error(error.message || "Erro ao guardar");
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Remover contacto?")) return;
    try { await removerSubscritor(id); fetchSubs(); } catch (e) { toast.error("Erro ao remover"); }
  };

  return (
    <div className="w-full space-y-5 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-5 bg-white p-5 rounded-lg border border-slate-100 shadow-sm">
        <div className="flex items-center gap-5">
          <div className="w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center"><Users className="w-6 h-6 text-orange-600" /></div>
          <div><h2 className="text-xl font-black text-slate-900 tracking-tight">Lista de Contactos</h2></div>
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={() => setShowAddForm(true)} className="!bg-emerald-600 text-white font-black uppercase text-[10px] tracking-widest">Adicionar</Button>
          <Button onClick={() => fetchSubs()} className="!bg-slate-800 text-white font-black uppercase text-[10px] tracking-widest">Actualizar</Button>
        </div>
      </div>
      <div className="bg-white rounded-lg border border-slate-100 shadow-sm overflow-hidden">
        <table className="w-full text-left">
          <thead className="bg-slate-50 border-b">
            <tr>
              <th className="px-5 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest">Contacto</th>
              <th className="px-5 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest">Dominio</th>
              <th className="px-5 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest">Lista</th>
              <th className="px-5 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Acoes</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {loading ? <MailMarketingContactsSkeleton /> : currentItems.map(sub => (
              <tr key={sub.id} className="hover:bg-slate-50 transition-colors">
                <td className="px-5 py-3 font-bold text-slate-900 text-sm">{sub.email}</td>
                <td className="px-5 py-3"><span className="text-[10px] font-black px-2 py-0.5 bg-blue-50 text-blue-600 rounded-full">{sub.metadata?.domain || '-'}</span></td>
                <td className="px-5 py-3"><span className="text-[10px] font-black px-2 py-0.5 bg-orange-50 text-orange-600 rounded-full">{sub.metadata?.list || 'Contactos'}</span></td>
                <td className="px-5 py-3 text-right flex justify-end gap-2">
                  <button onClick={() => { setEditingSub(sub); setNewEmail(sub.email); setNewName(sub.full_name || ''); setShowAddForm(true); }} className="p-2 hover:bg-blue-50 text-slate-400 hover:text-blue-600 rounded-lg"><Pencil size={14} /></button>
                  <button onClick={() => handleDelete(sub.id)} className="p-2 hover:bg-red-50 text-slate-400 hover:text-red-600 rounded-lg"><Trash2 size={14} /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {showAddForm && (
        <div className="fixed inset-0 bg-slate-900/40 z-[100] flex items-center justify-center p-4">
          <div className="bg-white rounded-lg w-full max-w-md shadow-2xl p-6">
            <h3 className="text-lg font-black mb-5">{editingSub ? 'Editar' : 'Novo'} Contacto</h3>
            <form onSubmit={handleAdd} className="space-y-4">
              <Input value={newEmail} onChange={e => setNewEmail(e.target.value)} placeholder="Email" required />
              <Input value={newName} onChange={e => setNewName(e.target.value)} placeholder="Nome" />
              <div className="flex gap-2">
                <Button type="submit" className="flex-1 !bg-slate-900">Guardar</Button>
                <Button type="button" onClick={() => setShowAddForm(false)} className="flex-1 !bg-red-600">Cancelar</Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function MailMarketingCampaigns({ selectedSite, currentUserEmail, onResend }: { selectedSite: string, currentUserEmail?: string, onResend?: (c: any) => void }) {
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  const fetchCampaigns = async () => {
    try {
      setLoading(true);
      const data = await listarCampanhas(selectedSite, currentUserEmail);
      setCampaigns(data || []);
    } catch (error) {
      console.error(error);
      toast.error("Erro ao carregar campanhas");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchCampaigns(); }, [selectedSite]);

  const filteredCampaigns = campaigns.filter(c => !searchTerm || c.subject?.toLowerCase().includes(searchTerm.toLowerCase()));

  return (
    <div className="w-full space-y-6 animate-in fade-in duration-500">
      <div className="flex items-center justify-between gap-4 bg-white p-5 rounded-xl border border-slate-100">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-orange-50 rounded-xl flex items-center justify-center"><BarChart3 className="w-5 h-5 text-orange-600" /></div>
          <div><h2 className="text-xl font-black text-slate-900 tracking-tight">Histórico de Campanhas</h2></div>
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <div className="bg-white p-6 rounded-xl border shadow-sm">
          <span className="text-[10px] font-black text-slate-400 uppercase">Total Enviado</span>
          <p className="text-3xl font-black mt-2">{campaigns.reduce((a, b) => a + (b.recipient_count || 0), 0)}</p>
        </div>
        <div className="bg-white p-6 rounded-xl border shadow-sm">
          <span className="text-[10px] font-black text-slate-400 uppercase">Campanhas</span>
          <p className="text-3xl font-black mt-2">{campaigns.length}</p>
        </div>
      </div>
      <div className="bg-white rounded-xl border shadow-sm overflow-hidden p-5">
        <div className="space-y-4">
          {loading ? <MailMarketingCampaignsSkeleton /> : filteredCampaigns.map(camp => (
            <div key={camp.id} className="flex items-center justify-between p-4 border rounded-xl hover:bg-slate-50">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 bg-slate-100 rounded-lg flex items-center justify-center"><Mail className="w-5 h-5 text-slate-400" /></div>
                <div><h4 className="font-bold">{camp.subject}</h4><p className="text-[10px] text-slate-400 uppercase font-black">{new Date(camp.created_at).toLocaleString()}</p></div>
              </div>
              <div className="flex items-center gap-4">
                <div className="text-right"><p className="text-sm font-black">{camp.recipient_count || 0}</p></div>
                <button onClick={() => onResend && onResend(camp)} className="p-2 hover:bg-orange-50 text-slate-400 hover:text-orange-600 rounded-lg"><RefreshCw size={14} /></button>
                <button onClick={async () => { if (confirm("Remover campanha?")) { await removerCampanha(camp.id); fetchCampaigns(); } }} className="p-2 hover:bg-red-50 text-slate-400 hover:text-red-600 rounded-lg"><Trash2 size={14} /></button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
