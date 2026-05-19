'use client';

import { useState, useRef, useEffect } from 'react';
import { Share2, FileText, Copy, Mail, Check, FileCode, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { downloadPdf, formatAsText, formatAsMarkdown, PdfExportOptions } from '@/lib/export-pdf';

interface ShareMenuProps {
    payload: PdfExportOptions;
    /** Variante de visualización */
    variant?: 'icon' | 'pill';
}

type ShareAction = 'pdf' | 'text' | 'markdown' | 'email';

export function ShareMenu({ payload, variant = 'icon' }: ShareMenuProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [busy, setBusy] = useState<ShareAction | null>(null);
    const [copied, setCopied] = useState<ShareAction | null>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        function handleClickOutside(e: MouseEvent) {
            if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
                setIsOpen(false);
            }
        }
        if (isOpen) document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [isOpen]);

    const flashCopied = (a: ShareAction) => {
        setCopied(a);
        setTimeout(() => setCopied(null), 1500);
    };

    const handleDownloadPdf = async () => {
        setBusy('pdf');
        try {
            // Pequeño defer para que el spinner se vea
            await new Promise(r => setTimeout(r, 50));
            downloadPdf(payload);
        } catch (e: any) {
            console.error('Error generando PDF:', e);
            alert('No se pudo generar el PDF: ' + (e?.message || ''));
        } finally {
            setBusy(null);
            setIsOpen(false);
        }
    };

    const handleCopyText = async () => {
        setBusy('text');
        try {
            const text = formatAsText(payload);
            await navigator.clipboard.writeText(text);
            flashCopied('text');
        } catch (e) {
            console.error('Clipboard error:', e);
            alert('No se pudo copiar al portapapeles');
        } finally {
            setBusy(null);
        }
    };

    const handleCopyMarkdown = async () => {
        setBusy('markdown');
        try {
            const md = formatAsMarkdown(payload);
            await navigator.clipboard.writeText(md);
            flashCopied('markdown');
        } catch (e) {
            console.error('Clipboard error:', e);
            alert('No se pudo copiar al portapapeles');
        } finally {
            setBusy(null);
        }
    };

    const handleEmail = () => {
        const subject = encodeURIComponent(`Análisis: ${payload.question.slice(0, 80)}`);
        const body = encodeURIComponent(formatAsText(payload).slice(0, 1800)); // mailto truncates long bodies
        window.location.href = `mailto:?subject=${subject}&body=${body}`;
        setIsOpen(false);
    };

    const Trigger = (
        <button
            onClick={() => setIsOpen(!isOpen)}
            className={cn(
                variant === 'icon'
                    ? "p-1.5 rounded-lg hover:bg-slate-100 transition-colors text-slate-400 hover:text-slate-600"
                    : "inline-flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-bold rounded-full transition-all border bg-white border-slate-200 text-slate-700 hover:border-slate-300 hover:bg-slate-50 active:scale-95"
            )}
            title="Compartir o descargar este análisis"
        >
            <Share2 className={variant === 'icon' ? "w-4 h-4" : "w-3.5 h-3.5"} />
            {variant === 'pill' && <span>Compartir</span>}
        </button>
    );

    return (
        <div ref={containerRef} className="relative inline-block">
            {Trigger}

            {isOpen && (
                <div className="absolute right-0 top-full mt-2 w-[220px] bg-white border border-slate-200 rounded-2xl shadow-xl z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200 py-1">
                    <MenuItem
                        icon={<FileText className="w-4 h-4" />}
                        label="Descargar PDF"
                        description="Análisis + datos + tabla"
                        onClick={handleDownloadPdf}
                        busy={busy === 'pdf'}
                    />
                    <MenuItem
                        icon={copied === 'text' ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                        label={copied === 'text' ? 'Copiado!' : 'Copiar texto'}
                        description="Pegar en cualquier app"
                        onClick={handleCopyText}
                        busy={busy === 'text'}
                    />
                    <MenuItem
                        icon={copied === 'markdown' ? <Check className="w-4 h-4 text-emerald-600" /> : <FileCode className="w-4 h-4" />}
                        label={copied === 'markdown' ? 'Copiado!' : 'Copiar Markdown'}
                        description="Para docs/Slack/Notion"
                        onClick={handleCopyMarkdown}
                        busy={busy === 'markdown'}
                    />
                    <div className="h-px bg-slate-100 my-1" />
                    <MenuItem
                        icon={<Mail className="w-4 h-4" />}
                        label="Enviar por email"
                        description="Abrir cliente de correo"
                        onClick={handleEmail}
                        busy={false}
                    />
                </div>
            )}
        </div>
    );
}

function MenuItem({ icon, label, description, onClick, busy }: {
    icon: React.ReactNode;
    label: string;
    description: string;
    onClick: () => void;
    busy: boolean;
}) {
    return (
        <button
            onClick={onClick}
            disabled={busy}
            className="w-full px-3 py-2 flex items-start gap-3 hover:bg-slate-50 transition-colors text-left disabled:opacity-50"
        >
            <div className="flex-shrink-0 w-7 h-7 rounded-lg bg-slate-100 flex items-center justify-center text-slate-600 mt-0.5">
                {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : icon}
            </div>
            <div className="flex-1 min-w-0">
                <p className="text-[13px] font-bold text-slate-800 leading-tight">{label}</p>
                <p className="text-[10px] text-slate-500 mt-0.5">{description}</p>
            </div>
        </button>
    );
}
