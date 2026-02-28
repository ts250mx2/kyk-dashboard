"use client";

import { useState, useRef, useEffect, useCallback } from 'react';
import { ChatInput } from '@/components/chat-input';
import { ResultsDisplay } from '@/components/results-display';
import { cn } from '@/lib/utils';
import { MessageSquare, X, Maximize2, Minimize2, ArrowRight } from 'lucide-react';
import { usePathname } from 'next/navigation';

interface Message {
    role: 'user' | 'assistant';
    content: string;
    sql?: string;
    visualization?: string;
    data?: Record<string, unknown>[];
    error?: string;
    suggested_questions?: string[];
    related_page?: string;
    prompt?: string;
    timestamp?: number;
}

const PAGE_SUGGESTIONS: Record<string, string[]> = {
    '/dashboard': [
        '¿Cuáles fueron las ventas totales de hoy?',
        '¿Qué tienda tiene más ventas acumuladas este mes?',
        'Muéstrame el top 5 de productos más vendidos',
        '¿Cuántas cancelaciones hubo hoy?',
        'Comparar ventas de hoy contra el mismo día de la semana pasada'
    ],
    '/dashboard/overview': [
        'Resumen de ventas del mes actual',
        '¿Cuál es el ticket promedio general?',
        'Analizar tendencia de ventas de los últimos 7 días',
        'Ver distribución de ventas por sucursal',
        '¿Cómo van las aperturas de caja hoy?'
    ],
    '/dashboard/system': [
        'Ver log de preguntas recientes',
        '¿Quiénes son los usuarios más activos?',
        'Revisar errores de sincronización de hoy',
        'Estado de las sucursales activas',
        'Historial de cancelaciones auditoría'
    ],
};

const DEFAULT_FALLBACK = [
    '¿Cómo van las ventas hoy?',
    'Top 5 productos más vendidos',
    'Ventas por sucursal',
    'Ticket promedio del día',
    'Resumen de cancelaciones'
];

export function ChatAgent() {
    const pathname = usePathname();
    const [isOpen, setIsOpen] = useState(false);
    const [isExpanded, setIsExpanded] = useState(false);
    const [messages, setMessages] = useState<Message[]>([]);
    const [defaultSuggestions, setDefaultSuggestions] = useState<string[]>([]);
    const [isHistoryLoaded, setIsHistoryLoaded] = useState(false);
    const [loading, setLoading] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    const loadDefaultSuggestions = useCallback(async () => {
        if (pathname === '/dashboard/chat') {
            try {
                const response = await fetch('/api/query/top-questions');
                const data = await response.json();
                if (Array.isArray(data)) {
                    setDefaultSuggestions(data.map((q: any) => q.Pregunta));
                } else {
                    setDefaultSuggestions(DEFAULT_FALLBACK);
                }
            } catch (error) {
                console.error('Error fetching top questions:', error);
                setDefaultSuggestions(DEFAULT_FALLBACK);
            }
        } else {
            const suggestions = PAGE_SUGGESTIONS[pathname] || DEFAULT_FALLBACK;
            setDefaultSuggestions(suggestions);
        }
    }, [pathname]);

    useEffect(() => {
        if (messages.length === 0) {
            loadDefaultSuggestions();
        }
    }, [messages.length, loadDefaultSuggestions]);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(() => {
        const pruneOldMessages = (savedMsgs: string) => {
            try {
                const parsed = JSON.parse(savedMsgs);
                const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;
                // Keep if recent OR if it has no timestamp (for legacy transition, though safer to purge if old)
                return parsed.filter((msg: Message) => !msg.timestamp || msg.timestamp > oneDayAgo);
            } catch (e) {
                return [];
            }
        };

        const savedMessages = localStorage.getItem('kyk_chat_history');
        if (savedMessages) {
            const filtered = pruneOldMessages(savedMessages);
            setMessages(filtered);
        }
        setIsHistoryLoaded(true);
    }, []);

    // Prune history when opening the agent
    useEffect(() => {
        if (isOpen) {
            const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;
            setMessages(prev => prev.filter(msg => !msg.timestamp || msg.timestamp > oneDayAgo));
        }
    }, [isOpen]);

    useEffect(() => {
        if (isHistoryLoaded) {
            localStorage.setItem('kyk_chat_history', JSON.stringify(messages));
        }
        scrollToBottom();
    }, [messages, isHistoryLoaded]);

    const handleSend = async (prompt: string) => {
        const currentTimestamp = Date.now();
        setMessages((prev) => [...prev, { role: 'user', content: prompt, timestamp: currentTimestamp }]);
        setLoading(true);

        try {
            const response = await fetch('/api/query', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ prompt }),
            });
            const data = await response.json();

            if (response.ok) {
                setMessages((prev) => [...prev, {
                    role: 'assistant',
                    content: 'He procesado tu consulta. Aquí tienes los resultados.',
                    sql: data.sql,
                    visualization: data.visualization,
                    data: data.data,
                    suggested_questions: data.suggested_questions,
                    related_page: data.related_page,
                    prompt: prompt,
                    timestamp: Date.now()
                }]);
            } else {
                setMessages((prev) => [...prev, {
                    role: 'assistant',
                    content: `Error: ${data.error || 'No se pudo procesar la solicitud'}`,
                    error: data.error
                }]);
            }
        } catch (err) {
            setMessages((prev) => [...prev, {
                role: 'assistant',
                content: `Error de conexión: ${(err as Error).message}`,
                error: (err as Error).message
            }]);
        } finally {
            setLoading(false);
        }
    };

    const handleClear = () => {
        setMessages([]);
        localStorage.removeItem('kyk_chat_history');
        loadDefaultSuggestions();
    };

    return (
        <div className="fixed bottom-6 right-6 z-[9999] flex flex-col items-end">
            {/* Chat Window */}
            {isOpen && (
                <div className={cn(
                    "bg-background border border-border shadow-2xl rounded-3xl flex flex-col mb-4 overflow-hidden transition-all duration-300 ease-in-out",
                    isExpanded
                        ? "fixed inset-4 md:inset-auto md:bottom-24 md:right-6 md:w-[800px] md:h-[80vh]"
                        : "w-[380px] h-[500px]"
                )}>
                    {/* Header */}
                    <div className="p-4 bg-primary text-primary-foreground flex items-center justify-between shadow-lg">
                        <div className="flex items-center gap-2">
                            <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center">
                                <img src="/kesito.svg" alt="KYK" className="w-5 h-5 object-contain" />
                            </div>
                            <div>
                                <h3 className="font-bold text-sm uppercase tracking-wider leading-none">Asistente KYK</h3>
                                <span className="text-[10px] opacity-70">En línea</span>
                            </div>
                        </div>
                        <div className="flex items-center gap-1">
                            <button
                                onClick={() => setIsExpanded(!isExpanded)}
                                className="p-2 hover:bg-white/10 rounded-full transition-colors hidden md:block"
                            >
                                {isExpanded ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
                            </button>
                            <button
                                onClick={() => setIsOpen(false)}
                                className="p-2 hover:bg-white/10 rounded-full transition-colors"
                            >
                                <X size={20} />
                            </button>
                        </div>
                    </div>

                    {/* Messages Area */}
                    <div className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-thin">
                        {messages.length === 0 ? (
                            <div className="h-full flex flex-col items-center justify-center text-center p-6 space-y-4">
                                <img src="/kesito.svg" alt="Kesito" className="w-20 h-20 opacity-50 grayscale" />
                                <div className="space-y-2">
                                    <p className="text-sm font-bold text-muted-foreground uppercase">¡Hola! Soy tu asistente de IA.</p>
                                    <p className="text-xs text-muted-foreground/60">¿En qué puedo ayudarte hoy?</p>
                                </div>

                                {defaultSuggestions.length > 0 && (
                                    <div className="w-full space-y-2 mt-4">
                                        <p className="text-[10px] font-bold text-muted-foreground/40 uppercase tracking-widest text-center">Sugerencias para ti</p>
                                        <div className="flex flex-col gap-2">
                                            {defaultSuggestions.slice(0, 5).map((suggestion, idx) => (
                                                <button
                                                    key={idx}
                                                    onClick={() => handleSend(suggestion)}
                                                    className="w-full text-left px-4 py-2 bg-muted/50 border border-border hover:border-primary hover:text-primary transition-all text-xs rounded-xl shadow-sm flex items-center justify-between group"
                                                >
                                                    <span className="truncate">{suggestion}</span>
                                                    <ArrowRight size={14} className="opacity-0 group-hover:opacity-100 -translate-x-2 group-hover:translate-x-0 transition-all" />
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        ) : (
                            messages.map((msg, i) => (
                                <div key={i} className={cn('flex flex-col', msg.role === 'user' ? 'items-end' : 'items-start')}>
                                    <div className={cn(
                                        'max-w-[90%] rounded-2xl p-3 shadow-sm text-sm',
                                        msg.role === 'user'
                                            ? 'bg-primary text-primary-foreground'
                                            : 'bg-muted border border-border'
                                    )}>
                                        <p className="leading-relaxed">
                                            {msg.content}
                                        </p>

                                        {msg.data && (
                                            <div className="mt-4 overflow-hidden rounded-none border border-border/50">
                                                <div className="scale-90 origin-top-left overflow-auto" style={{ width: '111.11%' }}>
                                                    <ResultsDisplay
                                                        data={msg.data}
                                                        sql={msg.sql || ''}
                                                        question={msg.prompt || ''}
                                                        visualization={(msg.visualization as 'table' | 'bar' | 'line' | 'pie' | 'area') || 'table'}
                                                        onVisualizationChange={(newViz) => {
                                                            setMessages(prev => prev.map((m, idx) => idx === i ? { ...m, visualization: newViz } : m));
                                                        }}
                                                    />
                                                </div>
                                            </div>
                                        )}

                                        {msg.suggested_questions && msg.suggested_questions.length > 0 && (
                                            <div className="mt-4 pt-3 border-t border-border/40 flex flex-wrap gap-1">
                                                {msg.suggested_questions.map((question, idx) => (
                                                    <button
                                                        key={idx}
                                                        onClick={() => handleSend(question)}
                                                        className="px-3 py-1 bg-background border border-border rounded-full hover:border-primary hover:text-primary transition-all text-[10px] font-bold shadow-sm flex items-center gap-1"
                                                    >
                                                        {question}
                                                        <ArrowRight size={10} className="opacity-40" />
                                                    </button>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ))
                        )}
                        {loading && (
                            <div className="flex justify-start">
                                <div className="bg-muted border border-border rounded-2xl p-3 flex items-center gap-3 shadow-sm">
                                    <div className="w-5 h-5 animate-bounce">
                                        <img src="/kesito.svg" alt="Loading" className="w-full h-full object-contain" />
                                    </div>
                                    <span className="text-[11px] font-bold text-muted-foreground uppercase animate-pulse">Analizando...</span>
                                </div>
                            </div>
                        )}
                        <div ref={messagesEndRef} />
                    </div>

                    {/* Bottom Area (Input) */}
                    <div className="p-4 bg-muted/30 border-t border-border">
                        <ChatInput onSend={handleSend} onClear={handleClear} isLoading={loading} />
                    </div>
                </div>
            )}

            {/* Floating Trigger Button */}
            {!isOpen && (
                <button
                    onClick={() => setIsOpen(true)}
                    className="group relative flex items-center justify-center w-16 h-16 bg-primary text-primary-foreground rounded-full shadow-2xl hover:scale-110 active:scale-95 transition-all duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)] animate-in zoom-in"
                >
                    <div className="absolute inset-0 bg-primary rounded-full animate-ping opacity-20 pointer-events-none" />
                    <img
                        src="/kesito.svg"
                        alt="Chat"
                        className="w-10 h-10 object-contain group-hover:rotate-12 transition-transform duration-300"
                    />
                    <div className="absolute -top-1 -right-1 w-4 h-4 bg-green-500 border-2 border-background rounded-full" />
                </button>
            )}
        </div>
    );
}
