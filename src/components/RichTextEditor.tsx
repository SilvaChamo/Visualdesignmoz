"use client";

import React, { useEffect, useRef, useState } from "react";
import { Bold, Italic, List, ListOrdered, Indent, Outdent, Image as ImageIcon, Loader2, Trash2, ZoomIn, ZoomOut, AlignCenter, AlignLeft, AlignRight, Link as LinkIcon, Unlink, ArrowUpDown } from "lucide-react";
import { cn } from "@/lib/utils";

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
        commandFontSize: "",
        fontName: "",
        color: "#000000",
    });
    const [isFocused, setIsFocused] = useState(false);
    const [isColorPickerOpen, setIsColorPickerOpen] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const [selectedImage, setSelectedImage] = useState<HTMLImageElement | null>(null);

    // Initial value sync and external value updates (like template application)
    useEffect(() => {
        if (typeof document !== 'undefined') {
            document.execCommand('defaultParagraphSeparator', false, 'p');
        }
        if (editorRef.current && editorRef.current.innerHTML !== value) {
            if (value === "" && editorRef.current.innerHTML === "<br>") return;
            editorRef.current.innerHTML = value || "";
        }
    }, [value]);

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
                fontName: document.queryCommandValue("fontName")?.replace(/['"]/g, ''),
                commandFontSize: document.queryCommandValue("fontSize"),
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
            const target = e.target as Element;

            // Don't deselect image if clicking inside the toolbar (image controls)
            if (selectedImage && !selectedImage.contains(target)) {
                const isToolbarClick = target.closest('[class*="bg-emerald-50"]') || target.closest('button[title]');
                if (!isToolbarClick) {
                    setSelectedImage(null);
                    // Remove selection styling
                    document.querySelectorAll('.rich-text-image-selected').forEach(img => {
                        img.classList.remove('rich-text-image-selected');
                    });
                }
            }

            // Close color picker if clicking outside
            if (isColorPickerOpen && !target.closest('.relative.group')) {
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
        // Restore selection before executing command so it applies to correct text
        restoreSelection();
        if (editorRef.current) {
            editorRef.current.focus();
        }
        document.execCommand(command, false, value);
        handleInput();
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
            let fileToProcess: Blob = file;
            const fileSizeMB = file.size / (1024 * 1024);

            // Compress if > 1MB
            if (fileSizeMB > 1) {
                toast.info(`Comprimindo imagem (${fileSizeMB.toFixed(1)}MB)...`);
                fileToProcess = await compressImage(file, 1);
                toast.success(`Imagem comprimida para ${(fileToProcess.size / (1024 * 1024)).toFixed(1)}MB`);
            }

            // Convert to Base64 data URI
            const imageUrl = await new Promise<string>((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = (ev) => resolve(ev.target?.result as string);
                reader.onerror = reject;
                reader.readAsDataURL(fileToProcess);
            });

            // Create image element and insert it
            if (editorRef.current) {
                // Restore selection and focus editor to ensure insertion point
                restoreSelection();
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
        } else if (target.tagName === 'A' || target.closest('a')) {
            const link = (target.tagName === 'A' ? target : target.closest('a')) as HTMLAnchorElement;
            e.preventDefault();
            window.open(link.href, "_blank");
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
        selectedImage.style.float = 'none';
        selectedImage.style.display = 'block';
        selectedImage.style.marginLeft = 'auto';
        selectedImage.style.marginRight = 'auto';
        selectedImage.style.marginBottom = '16px';
        handleInput();
    };

    // Float image left (text wraps around right)
    const floatImageLeft = () => {
        if (!selectedImage) return;
        selectedImage.style.display = 'inline-block';
        selectedImage.style.float = 'left';
        selectedImage.style.marginLeft = '0';
        selectedImage.style.marginRight = '16px';
        selectedImage.style.marginBottom = '16px';
        handleInput();
    };

    // Float image right (text wraps around left)
    const floatImageRight = () => {
        if (!selectedImage) return;
        selectedImage.style.display = 'inline-block';
        selectedImage.style.float = 'right';
        selectedImage.style.marginLeft = '16px';
        selectedImage.style.marginRight = '0';
        selectedImage.style.marginBottom = '16px';
        handleInput();
    };

    const insertLink = () => {
        saveSelection();
        const url = prompt("Introduza o URL do link (ex: https://google.com):", "https://");
        if (url) {
            restoreSelection();
            if (editorRef.current) editorRef.current.focus();
            document.execCommand("createLink", false, url);
            handleInput();
            checkStyles();
        }
    };

    const removeLink = () => {
        saveSelection();
        restoreSelection();
        if (editorRef.current) editorRef.current.focus();
        document.execCommand("unlink");
        handleInput();
        checkStyles();
    };

    return (
        <div
            className={cn("flex flex-col bg-white overflow-hidden transition-all relative", className)}
        >
            {/* Toolbar */}
            <div className="flex items-center gap-0 px-1 py-1 border-b border-slate-200 bg-white sticky top-0 z-30 flex-wrap">
                {/* Font Family Selector */}
                <select
                    value={activeStyles.fontName || ""}
                    onMouseDown={() => saveSelection()}
                    onChange={(e) => {
                        const val = e.target.value;
                        if (val) {
                            restoreSelection();
                            if (editorRef.current) editorRef.current.focus();
                            document.execCommand("fontName", false, val);
                            handleInput();
                            checkStyles();
                        }
                    }}
                    className="h-7 text-[11px] font-bold border border-slate-200 rounded text-slate-600 px-1 outline-none hover:border-emerald-500 hover:text-emerald-700 transition-all cursor-pointer appearance-none min-w-fit pr-4 mr-1 shrink-0"
                >
                    <option value="">Fonte Padrão</option>
                    <option value="Arial">Arial</option>
                    <option value="Inter">Inter</option>
                    <option value="Roboto">Roboto</option>
                    <option value="Times New Roman">Times New Roman</option>
                    <option value="Courier New">Courier</option>
                    <option value="Verdana">Verdana</option>
                    <option value="Georgia">Georgia</option>
                </select>

                <div className="w-px h-4 bg-slate-300 mx-1 shrink-0" />
                <ToolbarButton onClick={() => { saveSelection(); execCommand("bold"); }} icon={<span className="font-black text-lg leading-none font-serif">B</span>} title="Bold" isActive={activeStyles.bold} />
                <ToolbarButton onClick={() => { saveSelection(); execCommand("italic"); }} icon={<Italic className="w-4 h-4" />} title="Italic" isActive={activeStyles.italic} />

                <div className="w-px h-4 bg-slate-300 mx-1 shrink-0" />

                {/* Text Alignment */}
                <ToolbarButton onClick={() => { saveSelection(); execCommand("justifyLeft"); }} icon={<AlignLeft className="w-4 h-4" />} title="Alinhar à Esquerda" isActive={activeStyles.justifyLeft} />
                <ToolbarButton onClick={() => { saveSelection(); execCommand("justifyCenter"); }} icon={<AlignCenter className="w-4 h-4" />} title="Centralizar Texto" isActive={activeStyles.justifyCenter} />
                <ToolbarButton onClick={() => { saveSelection(); execCommand("justifyRight"); }} icon={<AlignRight className="w-4 h-4" />} title="Alinhar à Direita" isActive={activeStyles.justifyRight} />



                {/* Font Size Selector */}
                <select
                    value={activeStyles.commandFontSize || ""}
                    onMouseDown={() => saveSelection()}
                    onChange={(e) => {
                        const val = e.target.value;
                        if (val) {
                            restoreSelection();
                            if (editorRef.current) editorRef.current.focus();
                            document.execCommand("fontSize", false, val);
                            handleInput();
                            checkStyles();
                        }
                    }}
                    className="h-7 w-12 text-[11px] font-bold border border-slate-200 rounded text-slate-600 px-1 text-center outline-none hover:border-emerald-500 hover:text-emerald-700 transition-all cursor-pointer appearance-none shrink-0"
                    title="Tamanho da Fonte"
                >
                    <option value="">Nº</option>
                    <option value="1">10</option>
                    <option value="2">12</option>
                    <option value="3">14</option>
                    <option value="4">18</option>
                    <option value="5">24</option>
                    <option value="6">32</option>
                    <option value="7">48</option>
                </select>

                <div className="w-px h-4 bg-slate-300 mx-1 shrink-0" />

                {/* Line Spacing */}
                <div className="relative group shrink-0 flex items-center" title="Espaçamento entre linhas">
                   <ArrowUpDown className="w-3 h-3 text-slate-400 absolute left-1 pointer-events-none" />
                    <select
                        onMouseDown={() => saveSelection()}
                        onChange={(e) => {
                            const val = e.target.value;
                            if (val) {
                                restoreSelection();
                                if (editorRef.current) editorRef.current.focus();
                                
                                const selection = window.getSelection();
                                if (selection && selection.rangeCount > 0) {
                                    let node = selection.anchorNode;
                                    if (node?.nodeType === 3) node = node.parentElement; 
                                    while (node && node !== editorRef.current) {
                                        if (window.getComputedStyle(node as Element).display === 'block') {
                                            (node as HTMLElement).style.lineHeight = val;
                                            (node as HTMLElement).style.marginBottom = `${parseFloat(val) * 0.5}em`;
                                            break;
                                        }
                                        node = node.parentElement;
                                    }
                                }
                                handleInput();
                                e.target.value = "";
                            }
                        }}
                        className="h-7 w-14 text-[11px] font-bold border border-slate-200 rounded text-slate-600 pl-4 pr-1 outline-none hover:border-emerald-500 hover:text-emerald-700 transition-all cursor-pointer appearance-none shrink-0"
                    >
                        <option value="">Espaç.</option>
                        <option value="1.0">1.0</option>
                        <option value="1.15">1.15</option>
                        <option value="1.5">1.5</option>
                        <option value="2.0">2.0</option>
                        <option value="2.5">2.5</option>
                        <option value="3.0">3.0</option>
                    </select>
                </div>

                <div className="w-px h-4 bg-slate-300 mx-1 shrink-0" />

                <ToolbarButton onClick={() => { saveSelection(); execCommand("insertUnorderedList"); }} icon={<List className="w-4 h-4" />} title="Lista de Pontos" />
                <ToolbarButton onClick={() => { saveSelection(); execCommand("insertOrderedList"); }} icon={<ListOrdered className="w-4 h-4" />} title="Lista Numerada" />

                <div className="w-px h-4 bg-slate-300 mx-1 shrink-0" />

                <ToolbarButton onClick={() => { saveSelection(); execCommand("outdent"); }} icon={<Outdent className="w-4 h-4" />} title="Diminuir Recuo (Tab)" />
                <ToolbarButton onClick={() => { saveSelection(); execCommand("indent"); }} icon={<Indent className="w-4 h-4" />} title="Aumentar Recuo (Tab)" />

                <div className="w-px h-4 bg-slate-300 mx-1 shrink-0" />

                {/* Text Color Picker */}
                <div className="relative group shrink-0 mx-1">
                    <button
                        onClick={() => { saveSelection(); setIsColorPickerOpen(!isColorPickerOpen); }}
                        className={cn(
                            "w-7 h-7 flex items-center justify-center border border-slate-200 rounded hover:bg-slate-50 transition-all outline-none",
                            isColorPickerOpen && "border-orange-500 bg-white ring-2 ring-orange-500/10"
                        )}
                        title="Cor do Texto"
                    >
                        <div
                            className="w-4 h-4 rounded-sm border border-slate-300 shadow-sm"
                            style={{ backgroundColor: activeStyles.color || "#000000" }}
                        />
                    </button>
                    {/* Palette */}
                    {isColorPickerOpen && (
                        <div className="absolute top-full left-0 mt-1 p-2 bg-white border border-slate-200 rounded-lg shadow-xl grid grid-cols-5 gap-1 z-50 w-[140px]">
                            {[
                                "#000000", "#434343", "#666666", "#999999", "#b7b7b7", 
                                "#cccccc", "#d9d9d9", "#efefef", "#f3f3f3", "#ffffff",
                                "#980000", "#ff0000", "#ff9900", "#ffff00", "#00ff00", 
                                "#00ffff", "#4a86e8", "#0000ff", "#9900ff", "#ff00ff"
                            ].map((c) => (
                                <button
                                    key={c}
                                    className="w-5 h-5 hover:scale-110 transition-transform shadow-sm border border-slate-200"
                                    style={{ backgroundColor: c }}
                                    onMouseDown={(e) => { 
                                        e.preventDefault(); 
                                        restoreSelection();
                                    }}
                                    onClick={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        if (editorRef.current) editorRef.current.focus();
                                        document.execCommand("foreColor", false, c);
                                        handleInput();
                                        checkStyles();
                                        setIsColorPickerOpen(false); // Close on selection
                                    }}
                                    title={c}
                                />
                            ))}
                        </div>
                    )}
                </div>

                <div className="w-px h-4 bg-slate-300 mx-1 shrink-0" />

                {/* Link Buttons */}
                <ToolbarButton onClick={insertLink} icon={<LinkIcon className="w-4 h-4 text-emerald-600" />} title="Inserir Link" />
                <ToolbarButton onClick={removeLink} icon={<Unlink className="w-4 h-4 text-rose-500" />} title="Remover Link" />

                <div className="w-px h-4 bg-slate-300 mx-1 shrink-0" />

                {/* Image Upload Button */}
                <ToolbarButton
                    onClick={() => { saveSelection(); fileInputRef.current?.click(); }}
                    icon={isUploading ? <Loader2 className="w-5 h-5 animate-spin" /> : <ImageIcon className="w-5 h-5" />}
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
                                onClick={floatImageLeft}
                                className="w-auto px-2 bg-white border border-slate-200 rounded-md shadow-sm h-7 hover:border-emerald-500 hover:text-emerald-600 focus:outline-none"
                                icon={<AlignLeft className="w-4 h-4" />}
                                title="Alinhar à Esquerda (Texto à vista)"
                            />
                            <ToolbarButton
                                onClick={centerImage}
                                className="w-auto px-2 bg-white border border-slate-200 rounded-md shadow-sm h-7 hover:border-emerald-500 hover:text-emerald-600 focus:outline-none"
                                icon={<AlignCenter className="w-4 h-4" />}
                                title="Centralizar Imagem"
                            />
                            <ToolbarButton
                                onClick={floatImageRight}
                                className="w-auto px-2 bg-white border border-slate-200 rounded-md shadow-sm h-7 mr-2 hover:border-emerald-500 hover:text-emerald-600 focus:outline-none"
                                icon={<AlignRight className="w-4 h-4" />}
                                title="Alinhar à Direita (Texto à vista)"
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
                    className="flex-1 px-[20px] py-[20px] min-h-[300px] outline-none text-slate-700 text-sm overflow-y-auto prose prose-sm max-w-none prose-headings:my-2 prose-headings:font-black [&_b]:font-black [&_strong]:font-black prose-ul:list-disc prose-ul:pl-5 prose-ol:list-decimal prose-ol:pl-5 marker:text-black [&_.rich-text-image-selected]:ring-4 [&_.rich-text-image-selected]:ring-orange-500 [&_.rich-text-image-selected]:ring-offset-2 [&_a]:cursor-pointer [&_a]:text-blue-600 [&_a]:underline hover:[&_a]:text-blue-800 transition-all relative z-0"
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

function ToolbarButton({ onClick, icon, title, disabled, isActive, className }: { onClick: () => void; icon: React.ReactNode; title: string; disabled?: boolean; isActive?: boolean; className?: string }) {
    return (
        <button
            type="button"
            onMouseDown={(e) => {
                e.preventDefault();
            }}
            onClick={(e) => {
                e.preventDefault();
                if (!disabled) onClick();
            }}
            disabled={disabled}
            className={cn(
                "w-8 h-8 flex items-center justify-center text-slate-400 hover:text-red-600 transition-all shrink-0",
                isActive && "text-red-600",
                disabled && "opacity-50 cursor-not-allowed",
                className
            )}
            title={title}
        >
            {icon}
        </button>
    );
}
