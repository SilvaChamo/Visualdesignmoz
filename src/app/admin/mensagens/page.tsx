"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { RichTextEditor } from "@/components/RichTextEditor";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, Send, FileText, FileArchive, File as FileIcon, X, LayoutTemplate, Sparkles, Newspaper, Plus } from "lucide-react";
import { MultiFileUpload } from "@/components/admin/MultiFileUpload";
import { SenderEmailSelector } from "@/components/admin/SenderEmailSelector";
import { EmailTemplates } from "@/components/admin/EmailTemplates";
import { toast } from "sonner";

const PLANS = [
    "Gratuito",
    "Básico",
    "Premium",
    "Profissionais",
    "Subscritores (Newsletter)"
];

export default function AdminMessagesPage() {
    const [subject, setSubject] = useState("");
    const [content, setContent] = useState("");
    const [selectedPlans, setSelectedPlans] = useState<string[]>([]);
    const [senderEmail, setSenderEmail] = useState("admin@your-domain.com");
    const [attachments, setAttachments] = useState<string[]>([]);

    const [isSending, setIsSending] = useState(false);
    const [showTemplates, setShowTemplates] = useState(false);
    const [showNewListModal, setShowNewListModal] = useState(false);
    const [newListName, setNewListName] = useState("");

    const handlePlanToggle = (plan: string) => {
        if (selectedPlans.includes(plan)) {
            setSelectedPlans(selectedPlans.filter((p: string) => p !== plan));
        } else {
            setSelectedPlans([...selectedPlans, plan]);
        }
    };

    const handleSend = async () => {
        if (!subject || !content || selectedPlans.length === 0) {
            toast.error("Por favor, preencha o assunto, conteúdo e selecione pelo menos um grupo de destinatários.");
            return;
        }

        setIsSending(true);

        try {
            // Append attachments to content for the email body visually
            let finalHtml = content;
            if (attachments.length > 0) {
                finalHtml += `<br/><div style="margin-top: 20px; padding-top: 20px; border-top: 1px solid #eee;"><strong>Anexos:</strong><ul style="list-style: none; padding: 0; margin-top: 8px;">`;
                attachments.forEach(url => {
                    const fileName = url.split('/').pop() || "Documento";
                    finalHtml += `<li style="margin-bottom: 8px;"><a href="${url}" target="_blank" style="color: #f97316; text-decoration: underline; display: inline-flex; align-items: center; gap: 4px;">📎 ${fileName}</a></li>`;
                });
                finalHtml += `</ul></div>`;
            }

            // 1. Resolve Recipients
            let allRecipients: { id?: string, email: string }[] = [];

            // A. Fetch from Profiles based on Plans
            const selectedPlanNames = selectedPlans.filter((p: string) => !["Subscritores (Newsletter)", "Profissionais"].includes(p));

            if (selectedPlanNames.length > 0) {
                const { data: profileUsers, error: profError } = await supabase
                    .from('profiles')
                    .select('id, email')
                    .in('plan', selectedPlanNames);

                if (profError) throw profError;
                if (profileUsers) allRecipients = [...allRecipients, ...profileUsers];
            }

            // B. Fetch Professionals if selected
            if (selectedPlans.includes("Profissionais")) {
                const { data: professionals, error: extraError } = await supabase
                    .from('profiles') // Assuming professionals have a role or we use 'professionals' table
                    .select('email, id')
                    .eq('role', 'professional');

                if (!extraError && professionals) {
                    allRecipients = [...allRecipients, ...professionals];
                }
            }

            // C. Fetch Newsletter Subscribers
            if (selectedPlans.includes("Subscritores (Newsletter)")) {
                const { data: subscribers, error: subError } = await supabase
                    .from('newsletter_subscribers')
                    .select('email')
                    .or('metadata->>panel.eq.admin,metadata->>domain.is.null');

                if (subError) throw subError;
                if (subscribers) {
                    allRecipients = [...allRecipients, ...subscribers.map(s => ({ email: s.email }))];
                }
            }

            if (allRecipients.length === 0) {
                toast.error("Nenhum destinatário encontrado para os grupos selecionados.");
                setIsSending(false);
                return;
            }

            // Remove duplicates
            const uniqueEmails = Array.from(new Set(allRecipients.map((r: any) => r.email)));
            const emailList = uniqueEmails.filter(Boolean);

            // 2. Call Send API
            const response = await fetch('/api/admin/messages/send', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    to: emailList,
                    subject: subject,
                    html: finalHtml,
                    attachments: attachments,
                    replyTo: senderEmail,
                    targetAudiences: selectedPlans
                })
            });

            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.error || "Erro ao enviar mensagem");
            }

            toast.success(`Mensagem enviada com sucesso para ${emailList.length} destinatários!`);
            
            // Reset Form (except sender)
            setSubject("");
            setContent("");
            setSelectedPlans([]);
            setAttachments([]);

        } catch (error: any) {
            console.error(error);
            toast.error("Erro ao enviar mensagem: " + error.message);
        } finally {
            setIsSending(false);
        }
    };

    return (
        <div className="w-full space-y-5 animate-in fade-in duration-500">
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-5">
                {/* Main Content */}
                <div className="lg:col-span-3 space-y-5">
                    <div className="bg-white rounded-lg border border-slate-100 shadow-sm overflow-hidden flex flex-col min-h-[600px]">
                        <div className="bg-slate-200 px-5 py-3 border-b border-slate-300 flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <Newspaper className="w-5 h-5 text-slate-600" />
                                <h2 className="font-black text-slate-800 uppercase tracking-widest text-xs">Editor de Mensagem</h2>
                            </div>
                            <div className="flex items-center gap-2">
                                <Button
                                    onClick={handleSend}
                                    disabled={isSending}
                                    className="!bg-emerald-600 hover:!bg-red-600 text-white gap-2 font-black uppercase text-[10px] tracking-widest h-8 px-4 rounded-md shadow-xl shadow-emerald-500/20 transition-all border-none !opacity-100 cursor-pointer"
                                >
                                    {isSending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />}
                                    Enviar
                                </Button>

                                <Button
                                    onClick={() => setShowTemplates(true)}
                                    className="!bg-slate-800 hover:!bg-red-600 text-white gap-2 font-black uppercase text-[10px] tracking-widest h-8 px-4 rounded-md transition-all shadow-xl shadow-gray-900/10 border-none !opacity-100 cursor-pointer"
                                >
                                    <LayoutTemplate className="w-3 h-3" />
                                    Templates
                                </Button>
                            </div>
                        </div>
                        <div className="">
                            <RichTextEditor
                                value={content}
                                onChange={setContent}
                                placeholder="Escreva o corpo do seu email aqui..."
                                className="min-h-[500px] border-none"
                            >
                                <div className="px-5 py-0 bg-white border-b border-slate-200 flex items-center gap-4">
                                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest shrink-0 border-r border-slate-200 pr-4">Assunto</span>
                                    <input
                                        type="text"
                                        placeholder="Escreva aqui o assunto da sua campanha..."
                                        value={subject}
                                        onChange={(e) => setSubject(e.target.value)}
                                        className="w-full bg-transparent border-none focus:ring-0 outline-none text-sm font-bold placeholder:text-slate-200 text-slate-800 p-0"
                                    />
                                    <MultiFileUpload
                                        value={attachments}
                                        onChange={setAttachments}
                                        folder="admin-messages"
                                        layout="minimal"
                                        showList={false}
                                        className="shrink-0"
                                    />
                                </div>
                            </RichTextEditor>
                        </div>
                    </div>

                    {/* Attachments Section */}
                    <div className="bg-white p-5 rounded-lg border border-slate-100 shadow-sm space-y-5">
                        <div className="flex items-center justify-between">
                            <h3 className="text-sm font-black text-slate-900 uppercase tracking-wider flex items-center gap-2">
                                <FileIcon className="w-4 h-4 text-orange-600" />
                                Ficheiros em Anexo
                            </h3>
                            <span className="text-[10px] font-bold text-slate-500 bg-slate-50 px-2 py-0.5 rounded-full border border-slate-100">
                                {attachments.length} Ficheiros
                            </span>
                        </div>

                        <MultiFileUpload
                            value={attachments}
                            onChange={setAttachments}
                            folder="admin-messages"
                            layout="default"
                            description="PDF, Imagens, Documentos (Máx 10MB)"
                        />
                    </div>
                </div>

                {/* Sidebar Configuration */}
                <div className="space-y-5">
                    {/* Sender Selection */}
                    <div className="bg-white p-5 rounded-lg border border-slate-100 shadow-sm space-y-5">
                        <h3 className="text-sm font-black text-slate-900 uppercase tracking-wider">Remetente</h3>
                        <div className="w-full">
                            <SenderEmailSelector
                                value={senderEmail}
                                onChange={setSenderEmail}
                                layout="col"
                            />
                        </div>
                        <p className="text-[10px] text-slate-500 font-medium leading-relaxed">
                            O endereço selecionado será usado para as respostas.
                        </p>
                    </div>

                    {/* Target Audience */}
                    <div className="bg-white p-5 rounded-lg border border-slate-100 shadow-sm space-y-5">
                        <h3 className="text-sm font-black text-slate-900 uppercase tracking-wider">Destinatários</h3>
                        <div className="space-y-3">
                            {PLANS.map(plan => (
                                <div key={plan} className="group relative">
                                    <label className={`flex items-center gap-3 p-3 rounded-lg border transition-all cursor-pointer ${selectedPlans.includes(plan) ? 'bg-orange-50 border-orange-200 ring-1 ring-orange-500/10' : 'bg-white border-slate-200 hover:border-slate-300 shadow-sm'}`}>
                                        <Checkbox id={`plan-${plan}`} checked={selectedPlans.includes(plan)} onCheckedChange={() => handlePlanToggle(plan)} className="rounded-md border-slate-300 data-[state=checked]:bg-orange-600 data-[state=checked]:border-orange-600" />
                                        <span className={`text-xs font-bold ${selectedPlans.includes(plan) ? 'text-orange-700' : 'text-slate-600'}`}>{plan}</span>
                                    </label>
                                </div>
                            ))}
                        </div>
                        <button
                            onClick={() => setShowNewListModal(true)}
                            className="text-xs font-bold text-slate-600 hover:text-red-600 transition-colors flex items-center gap-1.5 uppercase tracking-wider"
                        >
                            <Plus className="w-3 h-3" />
                            Criar Nova Lista
                        </button>
                        <div className="p-3 bg-blue-50/50 rounded-lg border border-blue-100/50 flex items-start gap-3">
                            <Sparkles className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" />
                            <p className="text-[10px] text-blue-800 font-medium leading-relaxed">A sua mensagem também será guardada no histórico de notificações internas.</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Template Picker Modal */}
            {showTemplates && (
                <EmailTemplates
                    onSelect={(html: string) => {
                        setContent(html);
                        setShowTemplates(false);
                        toast.success("Template aplicado!");
                    }}
                    onClose={() => setShowTemplates(false)}
                />
            )}

            {/* New List Modal */}
            {showNewListModal && (
                <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[100] flex items-center justify-center p-6 animate-in fade-in duration-200">
                    <div className="bg-white rounded-xl w-full max-w-md shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">
                        <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50">
                            <h3 className="text-lg font-black text-slate-900 tracking-tight">Criar Nova Lista</h3>
                            <button onClick={() => setShowNewListModal(false)} className="p-2 hover:bg-white rounded-lg transition-colors group">
                                <X className="w-5 h-5 text-slate-400 group-hover:text-slate-600" />
                            </button>
                        </div>
                        <div className="p-5 space-y-5">
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-slate-500 uppercase ml-1 tracking-wider">Nome da Lista</label>
                                <Input
                                    type="text"
                                    value={newListName}
                                    onChange={(e) => setNewListName(e.target.value)}
                                    className="rounded-lg border-slate-200 h-11"
                                    placeholder="Ex: Clientes Premium"
                                />
                            </div>
                            <div className="flex gap-3">
                                <Button
                                    onClick={() => setShowNewListModal(false)}
                                    variant="outline"
                                    className="flex-1 h-11 rounded-lg font-bold text-slate-600"
                                >
                                    Cancelar
                                </Button>
                                <Button
                                    onClick={() => {
                                        if (newListName.trim()) {
                                            toast.success(`Lista "${newListName}" criada!`);
                                            setNewListName("");
                                            setShowNewListModal(false);
                                        } else {
                                            toast.error("Digite um nome para a lista");
                                        }
                                    }}
                                    className="flex-1 h-11 bg-emerald-600 hover:bg-red-600 text-white font-black rounded-lg transition-all shadow-lg border-none !opacity-100"
                                >
                                    Criar Lista
                                </Button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
