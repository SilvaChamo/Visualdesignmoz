"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { RichTextEditor } from "@/components/RichTextEditor";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, Send, FileText, FileArchive, File as FileIcon, X, LayoutTemplate, Sparkles, MessageSquare } from "lucide-react";
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
        <div className="w-full max-w-full space-y-8 pb-20 animate-in fade-in duration-500">
            <div className="flex items-center justify-between bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
                <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-orange-100 rounded-xl flex items-center justify-center">
                        <MessageSquare className="w-6 h-6 text-orange-600" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-black text-slate-900 tracking-tight">Compor Mensagem</h1>
                        <p className="text-sm text-slate-500 font-medium">Envie notificações e emails profissionais para a sua audiência.</p>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    <button
                        onClick={() => setShowTemplates(true)}
                        className="flex items-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl transition-all font-bold text-xs uppercase tracking-wider"
                    >
                        <LayoutTemplate className="w-4 h-4" />
                        Templates
                    </button>
                    <Button
                        onClick={handleSend}
                        disabled={isSending}
                        className="bg-emerald-600 hover:bg-orange-600 text-white px-6 h-10 rounded-xl font-bold uppercase text-xs tracking-widest shadow-lg shadow-emerald-500/20 transition-all hover:-translate-y-0.5 active:translate-y-0"
                    >
                        {isSending ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                            <>
                                <Send className="w-4 h-4 mr-2" />
                                Enviar Agora
                            </>
                        )}
                    </Button>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Main Content */}
                <div className="lg:col-span-2 space-y-6">
                    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden flex flex-col min-h-[600px]">
                        <div className="p-1">
                            <RichTextEditor
                                value={content}
                                onChange={setContent}
                                placeholder="Escreva o corpo do seu email aqui. Use as ferramentas de formatação para destacar informações importantes..."
                                className="min-h-[500px] border-none"
                            >
                                {/* Subject below toolbar */}
                                <div className="px-6 py-4 bg-white border-b border-slate-50">
                                    <input
                                        type="text"
                                        placeholder="Indique o assunto da mensagem..."
                                        value={subject}
                                        onChange={(e) => setSubject(e.target.value)}
                                        className="w-full bg-transparent border-none focus:ring-0 text-xl font-bold placeholder:text-slate-200 text-slate-800 p-0"
                                    />
                                </div>
                            </RichTextEditor>
                        </div>
                    </div>
                    
                    {/* Attachments Section */}
                    <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm space-y-4">
                        <div className="flex items-center justify-between">
                            <h3 className="text-sm font-black text-slate-900 uppercase tracking-wider flex items-center gap-2">
                                <FileIcon className="w-4 h-4 text-orange-500" />
                                Ficheiros em Anexo
                            </h3>
                            <span className="text-[10px] font-bold text-slate-400 bg-slate-50 px-2 py-0.5 rounded-full border border-slate-100">
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
                <div className="space-y-6">
                    {/* Sender Selection */}
                    <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm space-y-4">
                        <h3 className="text-sm font-black text-slate-900 uppercase tracking-wider">Remetente</h3>
                        <SenderEmailSelector
                            value={senderEmail}
                            onChange={setSenderEmail}
                        />
                        <p className="text-[10px] text-slate-400 font-medium leading-relaxed">
                            O endereço selecionado será usado para as respostas dos utilizadores.
                        </p>
                    </div>

                    {/* Target Audience */}
                    <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm space-y-4">
                        <div className="flex justify-between items-center">
                            <h3 className="text-sm font-black text-slate-900 uppercase tracking-wider">Destinatários</h3>
                            <div className="flex gap-2">
                                <button
                                    onClick={() => setSelectedPlans(PLANS)}
                                    className="text-[9px] uppercase font-bold text-emerald-600 hover:underline"
                                >
                                    Todos
                                </button>
                                <button
                                    onClick={() => setSelectedPlans([])}
                                    className="text-[9px] uppercase font-bold text-slate-400 hover:underline"
                                >
                                    Nenhum
                                </button>
                            </div>
                        </div>
                        
                        <div className="space-y-2">
                            {PLANS.map(plan => (
                                <label
                                    key={plan}
                                    className={`flex items-center gap-3 p-3 rounded-xl border transition-all cursor-pointer group ${
                                        selectedPlans.includes(plan)
                                            ? 'bg-emerald-50 border-emerald-200 ring-1 ring-emerald-500/10'
                                            : 'bg-white border-slate-100 hover:border-slate-200'
                                    }`}
                                >
                                    <Checkbox
                                        id={`plan-${plan}`}
                                        checked={selectedPlans.includes(plan)}
                                        onCheckedChange={() => handlePlanToggle(plan)}
                                        className="rounded-md border-slate-300 data-[state=checked]:bg-emerald-600 data-[state=checked]:border-emerald-600"
                                    />
                                    <span className={`text-xs font-bold ${
                                        selectedPlans.includes(plan) ? 'text-emerald-700' : 'text-slate-600'
                                    }`}>
                                        {plan}
                                    </span>
                                </label>
                            ))}
                        </div>
                        
                        <div className="p-3 bg-blue-50/50 rounded-xl border border-blue-100/50 flex items-start gap-3">
                            <Sparkles className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" />
                            <p className="text-[10px] text-blue-700 font-medium leading-relaxed">
                                A sua mensagem também será guardada no histórico de notificações internas dos utilizadores registados.
                            </p>
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
        </div>
    );
}
