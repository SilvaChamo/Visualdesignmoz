"use client";

import { useState, useRef } from "react";
import { Upload, X, File as FileIcon, Loader2, Paperclip, Trash2, FileText, FileArchive, Image } from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";

interface MultiFileUploadProps {
    value: string[];
    onChange: (urls: string[]) => void;
    label?: string;
    description?: string;
    maxSizeMB?: number;
    bucket?: string;
    folder?: string;
    showList?: boolean;
    layout?: 'default' | 'minimal';
    className?: string;
}

export function MultiFileUpload({
    value = [],
    onChange,
    label = "Anexos",
    description = "Carregue imagens ou documentos (PDF, Docx)",
    maxSizeMB = 10,
    bucket = "ticket-attachments",
    folder = "attachments",
    layout = 'default',
    showList = true,
    className
}: MultiFileUploadProps) {
    const [uploading, setUploading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (!files || files.length === 0) return;

        setUploading(true);
        setError(null);

        const newUrls: string[] = [];
        const errors: string[] = [];

        for (let i = 0; i < files.length; i++) {
            const file = files[i];

            // Size check
            if (file.size > maxSizeMB * 1024 * 1024) {
                errors.push(`${file.name} excede ${maxSizeMB}MB`);
                continue;
            }

            try {
                const formData = new FormData();
                formData.append('file', file);
                formData.append('bucket', bucket);
                formData.append('folder', folder);

                const response = await fetch('/api/storage-upload', {
                    method: 'POST',
                    body: formData
                });
                const result = await response.json();
                if (!response.ok) {
                    throw new Error(result?.error || 'Falha no upload');
                }
                if (!result?.url) {
                    throw new Error('URL pública não retornada');
                }
                newUrls.push(result.url);
            } catch (err: any) {
                console.error("Upload error for", file.name, err);
                errors.push(`Erro ao carregar ${file.name}: ${err?.message || 'falha no upload'}`);
            }
        }

        if (errors.length > 0) {
            setError(errors.join(", "));
        }

        if (newUrls.length > 0) {
            onChange([...value, ...newUrls]);
        }

        setUploading(false);
        if (fileInputRef.current) fileInputRef.current.value = "";
    };

    const removeFile = (urlToRemove: string) => {
        onChange(value.filter(url => url !== urlToRemove));
    };

    return (
        <div className={cn(layout === 'minimal' ? "" : "space-y-3", className)}>
            {layout === 'minimal' ? (
                <div className="flex flex-wrap gap-2 items-center">
                    <button
                        type="button"
                        className={cn(
                            "w-10 h-10 rounded-full bg-transparent hover:bg-slate-50 flex items-center justify-center transition-all active:scale-95",
                            uploading ? "opacity-50 pointer-events-none" : ""
                        )}
                        onClick={() => !uploading && fileInputRef.current?.click()}
                        title="Adicionar Anexo"
                    >
                        {uploading ? (
                            <Loader2 className="w-5 h-5 text-emerald-600 animate-spin" />
                        ) : (
                            <Paperclip className="w-5 h-5 text-slate-500" />
                        )}
                    </button>
                    {showList && value.length > 0 && (
                        <div className="flex gap-2 flex-wrap">
                            {value.map((url, index) => (
                                <div key={index} className="flex items-center gap-2 px-3 py-1 bg-slate-100 rounded-full border border-slate-200 text-xs text-slate-700 animate-in fade-in zoom-in">
                                    <span className="max-w-[100px] truncate">{url.split('/').pop()}</span>
                                    <button onClick={() => removeFile(url)} className="text-slate-400 hover:text-red-500"><X className="w-3 h-3" /></button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            ) : (
                <p className="text-xs text-slate-500 font-medium">{description}</p>
            )}

            <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileSelect}
                multiple
                className="hidden"
                disabled={uploading}
            />

            {/* Error Message */}
            {error && (
                <p className="text-xs font-bold text-red-500 bg-red-50 p-2 rounded-lg border border-red-100">
                    {error}
                </p>
            )}

            {/* File List (Default Layout): sempre em linhas */}
            {layout === 'default' && showList && value.length > 0 && (
                <div className="space-y-2">
                    {value.map((url, index) => (
                        <div key={index} className="flex items-center justify-between p-3 bg-white border border-slate-100 rounded-lg shadow-sm group">
                            <div className="flex items-center gap-3 overflow-hidden">
                                <div className="w-8 h-8 rounded bg-slate-100 flex items-center justify-center shrink-0">
                                    {url.match(/\.(jpg|jpeg|png|gif|webp)$/i) ? (
                                        <img src={url} alt="thumbnail" className="w-full h-full object-cover rounded" />
                                    ) : url.match(/\.pdf$/i) ? (
                                        <FileText className="w-4 h-4 text-red-500" />
                                    ) : url.match(/\.(zip|rar)$/i) ? (
                                        <FileArchive className="w-4 h-4 text-yellow-600" />
                                    ) : (
                                        <FileIcon className="w-4 h-4 text-slate-500" />
                                    )}
                                </div>
                                <a href={url} target="_blank" rel="noopener noreferrer" className="text-xs font-medium text-blue-600 hover:underline truncate">
                                    {url.split('/').pop()}
                                </a>
                            </div>
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => removeFile(url)}
                                className="h-8 w-8 p-0 text-slate-400 hover:text-red-500"
                            >
                                <Trash2 className="w-4 h-4" />
                            </Button>
                        </div>
                    ))}
                </div>
            )}

            {/* Botão simples de anexar (default): sempre no fim */}
            {layout === 'default' && (
                <Button
                    type="button"
                    variant="outline"
                    className={cn("h-9 text-xs font-bold", uploading ? "opacity-50 pointer-events-none" : "")}
                    onClick={() => !uploading && fileInputRef.current?.click()}
                    disabled={uploading}
                >
                    {uploading ? (
                        <>
                            <Loader2 className="w-4 h-4 animate-spin mr-2" />
                            A carregar...
                        </>
                    ) : (
                        <>
                            <Paperclip className="w-4 h-4 mr-2" />
                            Anexar ficheiro
                        </>
                    )}
                </Button>
            )}
        </div>
    );
}
