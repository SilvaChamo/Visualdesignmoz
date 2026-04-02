"use client";

import React, { useEffect, useRef, useState } from "react";
import { Bold, Italic, List, ListOrdered, Indent, Outdent, Image as ImageIcon, Loader2, Trash2, ZoomIn, ZoomOut, AlignCenter, AlignLeft, AlignRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ChevronDown } from "lucide-react";

interface RichTextEditorProps {
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
    className?: string;
    style?: React.CSSProperties;
    children?: React.ReactNode;
}

export function RichTextEditor({ value, onChange, placeholder, className, style, children }: RichTextEditorProps) {
    const editorRef = useRef<HTMLDivElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [activeStyles, setActiveStyles] = useState({
        bold: false,
        italic: false,
        justifyLeft: false,
        justifyCenter: false,
        justifyRight: false,
        fontSize: "",
        color: "#000000",
    });
    const [isFocused, setIsFocused] = useState(false);
    const [isColorPickerOpen, setIsColorPickerOpen] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const [selectedImage, setSelectedImage] = useState<HTMLImageElement | null>(null);

    // Initial value sync (only once to avoid cursor jumping)
    useEffect(() => {
        if (typeof document !== 'undefined') {
            document.execCommand('defaultParagraphSeparator', false, 'p');
        }
        if (editorRef.current && editorRef.current.innerHTML !== value) {
            if (value === "" && editorRef.current.innerHTML === "<br>") return;
            if (editorRef.current.innerHTML === "") {
                editorRef.current.innerHTML = value;
            }
        }
    }, []);

    const [isInputFocused, setIsInputFocused] = useState(false); // Track input focus
    const [localFontSize, setLocalFontSize] = useState("");
    const selectionRangeRef = useRef<Range | null>(null);

    // Sync active style to local state when not focused
    useEffect(() => {
        if (!isInputFocused) {
            setLocalFontSize(activeStyles.fontSize);
        }
    }, [activeStyles.fontSize, isInputFocused]);

    const saveSelection = () => {
        if (typeof window === 'undefined') return;
        const selection = window.getSelection();
        if (selection && selection.rangeCount > 0) {
            selectionRangeRef.current = selection.getRangeAt(0).cloneRange();
        }
    };

    const restoreSelection = () => {
        if (typeof window === 'undefined') return;
        const selection = window.getSelection();
        if (selection && selectionRangeRef.current) {
            selection.removeAllRanges();
            selection.addRange(selectionRangeRef.current);
        }
    };

    // Check current styles based on selection
    const checkStyles = () => {
        if (typeof document !== 'undefined') {
            setActiveStyles(prev => ({
                bold: document.queryCommandState("bold"),
                italic: document.queryCommandState("italic"),
                justifyLeft: document.queryCommandState("justifyLeft"),
                justifyCenter: document.queryCommandState("justifyCenter"),
                justifyRight: document.queryCommandState("justifyRight"),
                // Detect current color (approximate)
                color: document.queryCommandValue("foreColor"),
                // Only update font size if input is NOT focused
                fontSize: isInputFocused ? prev.fontSize : getComputedFontSize(),
            }));
        }
    };

    const getComputedFontSize = () => {
        const selection = window.getSelection();
        if (selection && selection.rangeCount > 0) {
            let node = selection.anchorNode;
            // If it's a text node, use parent. If it's an element, use itself.
            if (node?.nodeType === 3 && node.parentElement) {
                node = node.parentElement;
            } else if (node?.nodeType !== 1 && node?.parentElement) {
                // Fallback for other node types
                node = node.parentElement;
            }

            if (node && node instanceof Element) {
                const size = window.getComputedStyle(node).fontSize;
                // Return integer part
                return size ? Math.round(parseFloat(size.replace("px", ""))).toString() : "";
            }
        }
        return "";
    }


    useEffect(() => {
        const handler = () => checkStyles();
        document.addEventListener("selectionchange", handler);
        return () => document.removeEventListener("selectionchange", handler);
    }, []);

    // Clear selected image or color picker when clicking outside
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (selectedImage && !selectedImage.contains(e.target as Node)) {
                setSelectedImage(null);
                // Remove selection styling
                document.querySelectorAll('.rich-text-image-selected').forEach(img => {
                    img.classList.remove('rich-text-image-selected');
                });
            }

            // Close color picker if clicking outside
            if (isColorPickerOpen && !(e.target as Element).closest('.relative.group')) {
                setIsColorPickerOpen(false);
            }
        };
        document.addEventListener('click', handleClickOutside);
        return () => document.removeEventListener('click', handleClickOutside);
    }, [selectedImage, isColorPickerOpen]);

    const handleInput = () => {
        if (editorRef.current) {
            onChange(editorRef.current.innerHTML);
            checkStyles();
        }
    };

    const execCommand = (command: string, value: string | undefined = undefined) => {
        document.execCommand(command, false, value);
        if (editorRef.current) {
            editorRef.current.focus();
        }
        checkStyles();
    };

    // Compress image if > 1MB
    const compressImage = async (file: File, maxSizeMB: number = 1): Promise<Blob> => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                const img = new window.Image();
                img.onload = () => {
                    const canvas = document.createElement('canvas');
                    let { width, height } = img;

                    // Calculate compression quality based on file size
                    const fileSizeMB = file.size / (1024 * 1024);
                    let quality = 0.8;

                    if (fileSizeMB > maxSizeMB) {
                        // Resize if too large
                        const scale = Math.sqrt(maxSizeMB / fileSizeMB);
                        width = Math.round(width * scale);
                        height = Math.round(height * scale);
                        quality = 0.7;
                    }

                    canvas.width = width;
                    canvas.height = height;
                    const ctx = canvas.getContext('2d');
                    ctx?.drawImage(img, 0, 0, width, height);

                    canvas.toBlob(
                        (blob) => {
                            if (blob) {
                                resolve(blob);
                            } else {
                                reject(new Error('Failed to compress image'));
                            }
                        },
                        'image/jpeg',
                        quality
                    );
                };
                img.onerror = reject;
                img.src = e.target?.result as string;
            };
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
    };

    // Handle image upload
    const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (!file.type.startsWith('image/')) {
            toast.error('Por favor seleccione um ficheiro de imagem');
            return;
        }

        setIsUploading(true);

        try {
            let fileToUpload: Blob = file;
            const fileSizeMB = file.size / (1024 * 1024);

            // Compress if > 1MB
            if (fileSizeMB > 1) {
                toast.info(`Comprimindo imagem (${fileSizeMB.toFixed(1)}MB)...`);
                fileToUpload = await compressImage(file, 1);
                toast.success(`Imagem comprimida para ${(fileToUpload.size / (1024 * 1024)).toFixed(1)}MB`);
            }

            // Generate unique filename
            const timestamp = Date.now();
            const randomStr = Math.random().toString(36).substring(7);
            const ext = 'jpg';
            const fileName = `content-images/${timestamp}-${randomStr}.${ext}`;

            // Upload to Supabase Storage
            const { data, error } = await supabase.storage
                .from('public-assets')
                .upload(fileName, fileToUpload, {
                    cacheControl: '3600',
                    contentType: 'image/jpeg'
                });

            if (error) throw error;

            // Get public URL
            const { data: urlData } = supabase.storage
                .from('public-assets')
                .getPublicUrl(fileName);

            const imageUrl = urlData.publicUrl;

            // Create image element and insert it
            if (editorRef.current) {
                // Focus editor first to ensure insertion point
                editorRef.current.focus();

                const img = document.createElement('img');
                img.src = imageUrl;
                img.alt = 'Imagem';
                img.style.cssText = 'max-width: 100%; height: auto; cursor: pointer; border-radius: 8px; margin: 16px 0; display: block;';
                img.className = 'content-image';
                img.setAttribute('data-resizable', 'true');

                // Insert at cursor or append to end
                const selection = window.getSelection();
                if (selection && selection.rangeCount > 0 && editorRef.current.contains(selection.anchorNode)) {
                    const range = selection.getRangeAt(0);
                    range.deleteContents();
                    range.insertNode(img);
                    
                    // Create spacing after image
                    const p = document.createElement('p');
                    p.innerHTML = '<br>';
                    img.after(p);
                    
                    range.setStartAfter(p);
                    range.collapse(true);
                    selection.removeAllRanges();
                    selection.addRange(range);
                } else {
                    editorRef.current.appendChild(img);
                    const p = document.createElement('p');
                    p.innerHTML = '<br>';
                    editorRef.current.appendChild(p);
                }

                handleInput();
                toast.success('Imagem inserida com sucesso!');
            }

        } catch (error: any) {
            console.error('Upload error:', error);
            toast.error('Erro ao fazer upload: ' + error.message);
        } finally {
            setIsUploading(false);
            if (fileInputRef.current) {
                fileInputRef.current.value = '';
            }
        }
    };

    // Handle image click for selection/resize
    const handleEditorClick = (e: React.MouseEvent) => {
        const target = e.target as HTMLElement;

        if (target.tagName === 'IMG') {
            e.preventDefault();
            const img = target as HTMLImageElement;

            // Remove previous selection
            document.querySelectorAll('.rich-text-image-selected').forEach(el => {
                el.classList.remove('rich-text-image-selected');
            });

            // Add selection to clicked image
            img.classList.add('rich-text-image-selected');
            setSelectedImage(img);
        }
        checkStyles();
    };

    // Resize selected image
    const resizeImage = (factor: number) => {
        if (!selectedImage) return;

        const currentWidth = selectedImage.offsetWidth;
        const newWidth = Math.max(100, Math.min(800, currentWidth * factor));

        selectedImage.style.width = `${newWidth}px`;
        selectedImage.style.height = 'auto';
        handleInput();
    };

    // Delete selected image
    const deleteImage = () => {
        if (!selectedImage) return;
        selectedImage.remove();
        setSelectedImage(null);
        handleInput();
        toast.success('Imagem removida');
    };

    // Center selected image
    const centerImage = () => {
        if (!selectedImage) return;

        // Toggle centering
        const isCentered = selectedImage.style.marginLeft === 'auto' && selectedImage.style.marginRight === 'auto';

        if (isCentered) {
            // Remove centering
            selectedImage.style.marginLeft = '0';
            selectedImage.style.marginRight = '0';
            selectedImage.style.display = 'inline-block';
            selectedImage.style.width = '48%';
            selectedImage.style.margin = '1%';
        } else {
            // Center the image and make it full width
            selectedImage.style.marginLeft = 'auto';
            selectedImage.style.marginRight = 'auto';
            selectedImage.style.display = 'block';
            selectedImage.style.width = '100%';
            selectedImage.style.margin = '16px auto';
        }
        handleInput();
    };

    return (
        <div
            className={cn("flex flex-col bg-white overflow-hidden transition-all relative", className)}
        >
            {/* Toolbar */}
            <div className="flex items-center gap-1.5 px-3 py-2 border-b border-slate-100 bg-white sticky top-0 z-30 flex-wrap shadow-sm">
                <ToolbarButton onClick={() => execCommand("bold")} icon={<span className="font-black text-lg leading-none font-serif">B</span>} title="Bold" isActive={activeStyles.bold} />
                <ToolbarButton onClick={() => execCommand("italic")} icon={<Italic className="w-4 h-4" />} title="Italic" isActive={activeStyles.italic} />

                <div className="w-px h-4 bg-slate-300 mx-1" />

                {/* Text Alignment */}
                <ToolbarButton onClick={() => execCommand("justifyLeft")} icon={<AlignLeft className="w-4 h-4" />} title="Alinhar à Esquerda" isActive={activeStyles.justifyLeft} />
                <ToolbarButton onClick={() => execCommand("justifyCenter")} icon={<AlignCenter className="w-4 h-4" />} title="Centralizar Texto" isActive={activeStyles.justifyCenter} />
                <ToolbarButton onClick={() => execCommand("justifyRight")} icon={<AlignRight className="w-4 h-4" />} title="Alinhar à Direita" isActive={activeStyles.justifyRight} />

                <div className="w-px h-4 bg-slate-300 mx-1" />

                {/* Heading Selector */}
                <select
                    onChange={(e) => {
                        const val = e.target.value;
                        if (val) {
                            execCommand("formatBlock", val);
                            e.target.value = ""; // Reset
                        }
                    }}
                    className="h-8 text-[11px] font-bold border border-slate-200 rounded-lg bg-slate-50 text-slate-600 px-2 outline-none hover:border-orange-500 hover:bg-white transition-all cursor-pointer appearance-none min-w-[100px]"
                >
                    <option value="">CABEÇALHO</option>
                    <option value="H1">Título 1 (H1)</option>
                    <option value="H2">Título 2 (H2)</option>
                    <option value="H3">Título 3 (H3)</option>
                    <option value="H4">Título 4 (H4)</option>
                    <option value="H5">Título 5 (H5)</option>
                    <option value="H6">Título 6 (H6)</option>
                    <option value="P">Parágrafo</option>
                </select>

                <div className="w-px h-4 bg-slate-300 mx-1" />
                
                <ToolbarButton onClick={() => execCommand("insertUnorderedList")} icon={<List className="w-4 h-4" />} title="Lista de Pontos" />
                <ToolbarButton onClick={() => execCommand("insertOrderedList")} icon={<ListOrdered className="w-4 h-4" />} title="Lista Numerada" />

                <div className="w-px h-4 bg-slate-300 mx-1" />

                <ToolbarButton onClick={() => execCommand("outdent")} icon={<Outdent className="w-4 h-4" />} title="Diminuir Recuo (Tab)" />
                <ToolbarButton onClick={() => execCommand("indent")} icon={<Indent className="w-4 h-4" />} title="Aumentar Recuo (Tab)" />

                <div className="w-px h-4 bg-slate-300 mx-1" />

                {/* Text Color Picker */}
                <div className="relative group shrink-0">
                    <button
                        onClick={() => setIsColorPickerOpen(!isColorPickerOpen)}
                        className={cn(
                            "flex items-center gap-2 border border-slate-200 rounded-lg px-2 bg-slate-50 h-8 hover:border-orange-500 hover:bg-white transition-all outline-none",
                            isColorPickerOpen && "border-orange-500 bg-white ring-2 ring-orange-500/10"
                        )}
                        title="Cor do Texto"
                    >
                        <span className="font-black text-[9px] text-slate-400 uppercase select-none">COR</span>
                        <div
                            className="w-4 h-4 rounded-full border border-white shadow-sm"
                            style={{ backgroundColor: activeStyles.color || "#000000" }}
                        />
                        <ChevronDown className={cn("w-3 h-3 text-slate-400 transition-transform", isColorPickerOpen && "rotate-180")} />
                    </button>
                    {/* Palette */}
                    {isColorPickerOpen && (
                        <div className="absolute top-full left-0 mt-1 p-2 bg-white border border-slate-200 rounded-lg shadow-xl grid grid-cols-4 gap-1 z-50 w-[140px]">
                            {[
                                { color: "#000000", title: "Preto" },
                                { color: "#475569", title: "Cinza" },
                                { color: "#2563eb", title: "Azul" },
                                { color: "#dc2626", title: "Vermelho" },
                                { color: "#000000", title: "Preto" }, // Assuming site black
                                { color: "#f97316", title: "Laranja (Visual Design)" }, // Site Orange
                                { color: "#ffffff", title: "Branco", border: true },
                            ].map((c) => (
                                <button
                                    key={c.color}
                                    className={cn(
                                        "w-6 h-6 rounded-full hover:scale-110 transition-transform",
                                        c.border && "border border-slate-200"
                                    )}
                                    style={{ backgroundColor: c.color }}
                                    onClick={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        execCommand("foreColor", c.color);
                                        setIsColorPickerOpen(false); // Close on selection
                                    }}
                                    title={c.title}
                                />
                            ))}
                        </div>
                    )}
                </div>

                <div className="w-px h-4 bg-slate-300 mx-1" />

                {/* Image Upload Button */}
                <ToolbarButton
                    onClick={() => fileInputRef.current?.click()}
                    icon={isUploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ImageIcon className="w-4 h-4" />}
                    title="Inserir Imagem"
                    disabled={isUploading}
                />
                <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleImageUpload}
                    className="hidden"
                />

                {/* Image Resize Controls (show when image selected) */}
                {selectedImage && (
                    <>
                        <div className="w-px h-4 bg-slate-300 mx-1" />
                        <div className="flex items-center gap-1 bg-emerald-50 rounded-md px-2 py-1">
                            <span className="text-[10px] font-bold text-emerald-600 uppercase">Imagem:</span>
                            <ToolbarButton
                                onClick={() => resizeImage(0.8)}
                                icon={<ZoomOut className="w-4 h-4" />}
                                title="Reduzir Imagem"
                            />
                            <ToolbarButton
                                onClick={() => resizeImage(1.25)}
                                icon={<ZoomIn className="w-4 h-4" />}
                                title="Aumentar Imagem"
                            />
                            <ToolbarButton
                                onClick={centerImage}
                                icon={
                                    <div className="flex items-center gap-1.5 px-1">
                                        <AlignCenter className="w-4 h-4" />
                                        <span className="text-[10px] font-black uppercase">Centralizar</span>
                                    </div>
                                }
                                title="Centralizar Imagem"
                            />
                            <ToolbarButton
                                onClick={deleteImage}
                                icon={<Trash2 className="w-4 h-4 text-rose-500" />}
                                title="Remover Imagem"
                            />
                        </div>
                    </>
                )}
            </div>
            
            {children}

            {/* Editor Area Container */}
            <div className="relative flex-1 flex flex-col">
                {/* Placeholder Overlay */}
                {!value && !isFocused && (
                    <div className="absolute top-6 left-6 text-slate-400 text-sm pointer-events-none select-none italic font-medium opacity-60 z-10">
                        {placeholder || "Escreva o corpo do seu email aqui..."}
                    </div>
                )}
                
                <div
                    ref={editorRef}
                    contentEditable
                    className="flex-1 px-6 py-6 min-h-[300px] outline-none text-slate-700 text-sm overflow-y-auto prose prose-sm max-w-none prose-headings:my-2 prose-headings:font-black [&_b]:font-black [&_strong]:font-black prose-ul:list-disc prose-ul:pl-5 prose-ol:list-decimal prose-ol:pl-5 marker:text-orange-600 [&_.rich-text-image-selected]:ring-4 [&_.rich-text-image-selected]:ring-orange-500 [&_.rich-text-image-selected]:ring-offset-2 transition-all relative z-0"
                    onInput={handleInput}
                    onFocus={() => setIsFocused(true)}
                    onBlur={() => setIsFocused(false)}
                    onClick={handleEditorClick}
                    onKeyUp={checkStyles}
                    onMouseUp={checkStyles}
                    data-placeholder={placeholder}
                    style={{
                        ...style,
                        fontWeight: 400,
                        lineHeight: 1.6
                    } as React.CSSProperties}
                />
            </div>
            {/* Dynamic CSS Default Spacing */}
            <style jsx>{`
                :global([contenteditable] p), :global([contenteditable] div) {
                    line-height: 1.6 !important;
                    margin-bottom: 1.5em !important;
                }
                :global([contenteditable] p:last-child), :global([contenteditable] div:last-child) {
                    margin-bottom: 0 !important;
                }
                :global(.prose ul), :global(.prose ol) {
                    padding-left: 1.5rem !important;
                    margin-top: 1em !important;
                    margin-bottom: 1em !important;
                }
            `}</style>

            {/* Upload Progress Overlay */}
            {isUploading && (
                <div className="absolute inset-0 bg-white/80 flex items-center justify-center z-20">
                    <div className="flex items-center gap-3 bg-emerald-50 px-6 py-3 rounded-lg border border-emerald-200 shadow-lg">
                        <Loader2 className="w-5 h-5 animate-spin text-emerald-600" />
                        <span className="text-sm font-bold text-emerald-700">A carregar imagem...</span>
                    </div>
                </div>
            )}
        </div>
    );
}

function ToolbarButton({ onClick, icon, title, disabled, isActive }: { onClick: () => void; icon: React.ReactNode; title: string; disabled?: boolean; isActive?: boolean }) {
    return (
        <button
            type="button"
            onClick={(e) => {
                e.preventDefault();
                if (!disabled) onClick();
            }}
            disabled={disabled}
            className={cn(
                "p-2 text-slate-500 hover:text-orange-700 hover:bg-orange-50 rounded-lg transition-all shrink-0",
                isActive && "text-orange-600 bg-white border border-orange-200 shadow-sm",
                disabled && "opacity-50 cursor-not-allowed"
            )}
            title={title}
        >
            {icon}
        </button>
    );
}
