"use client";

import { useState, useEffect } from "react";
import { Plus, Trash2, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

interface SenderEmailSelectorProps {
    value: string;
    onChange: (value: string) => void;
    layout?: 'row' | 'col';
    currentUserEmail?: string;
}

// Remover mocks, usar apenas emails reais
const DEFAULT_EMAILS: string[] = [];

export function SenderEmailSelector({ value, onChange, layout = 'row', currentUserEmail }: SenderEmailSelectorProps) {
    const [emails, setEmails] = useState<string[]>(DEFAULT_EMAILS);
    const [newEmail, setNewEmail] = useState("");
    const [isDialogOpen, setIsDialogOpen] = useState(false);

    // Load from localStorage on mount
    useEffect(() => {
        const saved = localStorage.getItem("platform_sender_emails");
        let list = [...DEFAULT_EMAILS];

        if (saved) {
            try {
                const parsed = JSON.parse(saved);
                // 🧹 LIMPAR: Filtrar emails inválidos (joao, teste, exemplo, etc)
                const validEmails = parsed.filter((email: string) => {
                    const invalidPatterns = ['joao', 'teste', 'exemplo', 'your-domain', 'placeholder', '@example.com'];
                    return !invalidPatterns.some(pattern => email.toLowerCase().includes(pattern));
                });
                if (validEmails.length !== parsed.length) {
                    console.log('[SenderEmailSelector] Limpando emails inválidos do localStorage:', parsed.filter((e: string) => !validEmails.includes(e)));
                    localStorage.setItem("platform_sender_emails", JSON.stringify(validEmails));
                }
                list = Array.from(new Set([...list, ...validEmails]));
            } catch (e) {
                console.error("Failed to parse saved emails", e);
            }
        }

        // Se a lista estiver vazia e tivermos o email do utilizador, usá-lo como base real
        if (list.length === 0 && currentUserEmail) {
            list = [currentUserEmail];
        }

        setEmails(list);

        // Se não houver valor seleccionado e tivermos opções, seleccionar a primeira
        if (!value && list.length > 0) {
            onChange(list[0]);
        }
    }, [currentUserEmail, value, onChange]);

    const handleAddEmail = () => {
        if (!newEmail || !newEmail.includes("@")) {
            alert("Por favor insira um email válido");
            return;
        }

        const updated = Array.from(new Set([...emails, newEmail]));
        setEmails(updated);
        localStorage.setItem("platform_sender_emails", JSON.stringify(updated));

        onChange(newEmail); // Select the new one
        setNewEmail("");
        setIsDialogOpen(false);
    };

    const handleDeleteEmail = (emailToDelete: string, e: React.MouseEvent) => {
        e.stopPropagation();
        const updated = emails.filter(e => e !== emailToDelete);
        setEmails(updated);
        localStorage.setItem("platform_sender_emails", JSON.stringify(updated));

        if (value === emailToDelete) {
            onChange(updated[0] || "");
        }
    };

    return (
        <div className={`flex ${layout === 'col' ? 'flex-col' : 'flex-row'} gap-5 items-center w-full`}>
            <div className="flex-1 min-w-0 w-full">
                <Select value={value} onValueChange={onChange}>
                    <SelectTrigger className="w-full bg-slate-50 border-slate-300 h-11 rounded">
                        <div className="flex items-center gap-2 text-slate-700">
                            <Mail className="w-4 h-4 text-slate-400" />
                            <SelectValue placeholder="Selecione um email de origem" />
                        </div>
                    </SelectTrigger>
                    <SelectContent className="bg-white border-slate-200 shadow-xl overflow-hidden z-[110]">
                        {emails.map((email) => (
                            <SelectItem key={email} value={email} className="group cursor-pointer hover:bg-slate-50 py-3">
                                <div className="flex items-center justify-between w-full min-w-[300px]">
                                    <span className="font-medium text-slate-700">{email}</span>
                                </div>
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>

            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogTrigger asChild>
                    <Button 
                        className={`${layout === 'col' ? 'w-full' : 'shrink-0'} gap-2 bg-emerald-50 border border-emerald-300 text-emerald-600 hover:bg-emerald-100 hover:text-emerald-700 h-10 rounded font-black uppercase text-[10px] tracking-widest transition-all  border-none !opacity-100`}
                    >
                        <Plus className="w-4 h-4 text-white" />
                        Cadastrar Email
                    </Button>
                </DialogTrigger>
                <DialogContent className="rounded bg-white dark:bg-white border-slate-200">
                    <DialogHeader>
                        <DialogTitle className="font-black text-xl tracking-tight">Novo Remetente</DialogTitle>
                        <DialogDescription className="text-sm font-medium text-slate-500">
                            Adicione um novo endereço de email para as suas campanhas.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-5">
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Endereço de Email</label>
                            <Input
                                placeholder="ex: news@exemplo.com"
                                value={newEmail}
                                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewEmail(e.target.value)}
                                className="h-11 rounded border-slate-300 focus:ring-emerald-500"
                            />
                        </div>
                    </div>
                    <DialogFooter className="p-5 bg-slate-50 gap-3 border-t border-slate-100">
                        <Button variant="ghost" onClick={() => setIsDialogOpen(false)} className="h-10 rounded font-medium text-slate-700 hover:bg-slate-200 transition-all">Cancelar</Button>
                        <Button onClick={handleAddEmail} className="bg-emerald-50 border border-emerald-300 text-emerald-600 hover:bg-emerald-100 hover:text-emerald-700 px-8 h-10 rounded font-black uppercase text-[10px] tracking-widest transition-all  border-none !opacity-100">Adicionar Email</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
