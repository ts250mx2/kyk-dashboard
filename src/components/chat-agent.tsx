"use client";

import { useState, useRef, useEffect, useCallback } from 'react';
import { ChatInput } from '@/components/chat-input';
import { ResultsDisplay } from '@/components/results-display';
import { cn } from '@/lib/utils';
import {
    MessageSquare,
    X,
    Maximize2,
    Minimize2,
    ArrowRight,
    Sparkles,
    Search,
    ArrowLeft,
    Trash2
} from 'lucide-react';
import { usePathname } from 'next/navigation';

interface Message {
    role: 'user' | 'assistant';
    content: string;
    sql?: string;
    visualization?: string;
    results?: Record<string, any>[];
    insight?: string;
    suggestedQuestions?: string[];
    timestamp?: number;
    error?: string;
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
        const savedMessages = localStorage.getItem('kyk_integrated_chat_history');
        if (savedMessages) {
            try {
                const parsed = JSON.parse(savedMessages);
                const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;
                const filtered = parsed.filter((msg: Message) => !msg.timestamp || msg.timestamp > oneDayAgo);
                setMessages(filtered);
            } catch (e) {
                setMessages([]);
            }
        }
        setIsHistoryLoaded(true);
    }, []);

    useEffect(() => {
        if (isHistoryLoaded) {
            localStorage.setItem('kyk_integrated_chat_history', JSON.stringify(messages));
        }
        scrollToBottom();
    }, [messages, isHistoryLoaded]);

    const handleSend = async (prompt: string) => {
        if (!prompt.trim()) return;

        // Safety net: If prompt looks like a refinement (inheritance)
        let finalPrompt = prompt;
        const lowerPrompt = prompt.toLowerCase();
        const isRefinement = lowerPrompt.startsWith('por ') ||
            lowerPrompt.startsWith('de ') ||
            lowerPrompt.startsWith('en ') ||
            lowerPrompt.startsWith('este ') ||
            lowerPrompt.startsWith('esta ');

        if (isRefinement) {
            const lastUserMsg = [...messages].reverse().find(m => m.role === 'user');
            if (lastUserMsg) {
                // Remove question marks if present in original
                const cleanLast = lastUserMsg.content.replace(/\?$/, '');
                finalPrompt = `${cleanLast} ${prompt}`;
            }
        }

        const userMsg: Message = { role: 'user', content: finalPrompt, timestamp: Date.now() };
        setMessages((prev) => [...prev, userMsg]);
        setLoading(true);

        try {
            const response = await fetch('/api/query', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ prompt: finalPrompt }),
            });
            const data = await response.json();

            if (response.ok) {
                const assistantMsg: Message = {
                    role: 'assistant',
                    content: data.message || 'He procesado tu consulta.',
                    sql: data.sql,
                    visualization: data.visualization,
                    results: data.data,
                    insight: data.insight,
                    suggestedQuestions: data.suggested_questions,
                    timestamp: Date.now(),
                };
                setMessages((prev) => [...prev, assistantMsg]);
            } else {
                let errorContent = `Error: ${data.error || 'No se pudo procesar la solicitud'}`;
                if (data.sql) {
                    errorContent += `\n\nConsulta SQL fallida:\n${data.sql}`;
                }
                setMessages((prev) => [...prev, {
                    role: 'assistant',
                    content: errorContent,
                    timestamp: Date.now(),
                }]);
            }
        } catch (err) {
            setMessages((prev) => [...prev, {
                role: 'assistant',
                content: `Error de conexión: ${(err as Error).message}`,
                timestamp: Date.now(),
            }]);
        } finally {
            setLoading(false);
        }
    };

    const handleClear = () => {
        setMessages([]);
        localStorage.removeItem('kyk_integrated_chat_history');
        loadDefaultSuggestions();
    };

    return (
        <div className="fixed bottom-6 right-6 z-[9999] flex flex-col items-end">
            {/* Chat Trigger */}
            {!isOpen && (
                <button
                    onClick={() => setIsOpen(true)}
                    className="group relative flex items-center justify-center w-16 h-16 bg-white border border-slate-200 text-indigo-600 rounded-full shadow-2xl hover:scale-110 active:scale-95 transition-all duration-300 animate-in zoom-in"
                >
                    <div className="absolute inset-0 bg-indigo-600 rounded-full animate-ping opacity-10 pointer-events-none" />
                    <img src="/kesito.svg" alt="KYK" className="w-10 h-10 object-contain group-hover:rotate-12 transition-transform" />
                    <div className="absolute -top-1 -right-1 w-4 h-4 bg-green-500 border-2 border-white rounded-full" />
                </button>
            )}

            {/* Chat Window */}
            {isOpen && (
                <div className={cn(
                    "bg-slate-50 border border-slate-200 shadow-2xl rounded-[32px] flex flex-col mb-4 overflow-hidden transition-all duration-300 ease-in-out",
                    isExpanded
                        ? "fixed inset-0 z-[10000] rounded-none md:rounded-[40px] md:inset-6"
                        : "w-[380px] md:w-[850px] h-[500px] md:h-[85vh]"
                )}>
                    {/* Header */}
                    <div className="p-5 bg-white border-b border-slate-100 flex items-center justify-between">
                        <div className="flex items-center space-x-4">
                            <div className="w-12 h-12 bg-white border border-slate-100 rounded-2xl shadow-sm flex items-center justify-center overflow-hidden">
                                <img src="/kesito.svg" alt="KYK" className="w-8 h-8 object-contain" />
                            </div>
                            <div>
                                <h3 className="font-black text-slate-900 tracking-tight leading-none uppercase text-xs">Analista Digital KYK</h3>
                                <div className="flex items-center space-x-1.5 mt-1">
                                    <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">En línea</span>
                                </div>
                            </div>
                        </div>
                        <div className="flex items-center space-x-2">
                            <button onClick={handleClear} className="p-2 hover:bg-slate-100 rounded-xl transition-colors text-slate-400" title="Limpiar chat">
                                <Trash2 className="w-5 h-5" />
                            </button>
                            <button onClick={() => setIsExpanded(!isExpanded)} className="p-2 hover:bg-slate-100 rounded-xl transition-colors text-slate-400 hidden md:block">
                                {isExpanded ? <Minimize2 className="w-5 h-5" /> : <Maximize2 className="w-5 h-5" />}
                            </button>
                            <button onClick={() => setIsOpen(false)} className="p-2 hover:bg-slate-100 rounded-xl transition-colors text-slate-400">
                                <X className="w-6 h-6" />
                            </button>
                        </div>
                    </div>

                    {/* Messages Area */}
                    <div className="flex-1 overflow-y-auto p-4 md:p-8 space-y-8 scroll-smooth scrollbar-hide" id="chat-messages">
                        {messages.length === 0 && (
                            <div className="flex flex-col items-center justify-center h-full text-center space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
                                <div className="p-8 bg-white rounded-[40px] shadow-xl border border-slate-100">
                                    <img src="/kesito.svg" alt="Kesito" className="w-16 h-16 object-contain animate-pulse" />
                                </div>
                                <div className="space-y-2">
                                    <h2 className="text-3xl font-black tracking-tight text-slate-900">¿Qué analizamos hoy?</h2>
                                    <p className="text-slate-500 max-w-sm font-medium">Estoy listo para explorar tus datos de ventas, compras e inventario.</p>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 w-full max-w-lg">
                                    {defaultSuggestions.map((s, i) => (
                                        <button
                                            key={i}
                                            onClick={() => handleSend(s)}
                                            className="p-5 text-left bg-white border border-slate-100 rounded-[24px] hover:border-indigo-500 hover:shadow-xl transition-all group animate-in fade-in zoom-in duration-300"
                                            style={{ animationDelay: `${i * 100}ms` }}
                                        >
                                            <p className="text-[10px] font-black uppercase text-indigo-600 tracking-widest mb-1.5 opacity-60">Sugerencia</p>
                                            <p className="text-sm font-bold text-slate-700 group-hover:text-indigo-700 leading-tight">{s}</p>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}

                        {messages.map((message, index) => (
                            <div key={index} className={cn("flex flex-col animate-in fade-in slide-in-from-bottom-4 duration-500", message.role === 'user' ? "items-end" : "items-start")}>
                                <div className={cn(
                                    "max-w-[85%] rounded-[32px] overflow-hidden shadow-sm",
                                    message.role === 'user'
                                        ? "bg-slate-900 text-white rounded-tr-none px-6 py-4"
                                        : "bg-white border border-slate-200 rounded-tl-none"
                                )}>
                                    {message.role === 'assistant' ? (
                                        <div className="flex flex-col">
                                            {/* Analyst Header */}
                                            <div className="bg-slate-50 border-b border-slate-100 px-6 py-3 flex items-center justify-between">
                                                <div className="flex items-center space-x-2">
                                                    <div className="w-2 h-2 bg-indigo-600 rounded-full animate-pulse" />
                                                    <span className="text-[10px] font-black uppercase tracking-[0.2em] text-indigo-600">Reporte Analítico Senior</span>
                                                </div>
                                                <div className="flex space-x-1">
                                                    <div className="w-1.5 h-1.5 bg-slate-200 rounded-full" />
                                                    <div className="w-1.5 h-1.5 bg-slate-200 rounded-full" />
                                                </div>
                                            </div>

                                            {/* Analysis Content */}
                                            <div className="px-6 py-6 group">
                                                <p className="text-[16px] leading-relaxed text-slate-700 font-medium italic mb-6 border-l-4 border-indigo-200 pl-6 bg-indigo-50/30 py-4 rounded-r-2xl whitespace-pre-wrap">
                                                    {message.content}
                                                </p>

                                                {message.insight && (
                                                    <div className="bg-indigo-600 text-white p-5 rounded-[24px] mb-8 shadow-lg shadow-indigo-100 flex items-start space-x-4 animate-in slide-in-from-left-4 duration-500">
                                                        <div className="p-3 bg-white/20 rounded-2xl">
                                                            <Search className="w-5 h-5" />
                                                        </div>
                                                        <div>
                                                            <span className="text-[10px] font-black uppercase tracking-[0.2em] opacity-70">Hallazgo Clave</span>
                                                            <p className="text-[15px] font-bold leading-tight mt-1">{message.insight}</p>
                                                        </div>
                                                    </div>
                                                )}

                                                {message.results && message.results.length > 0 && !(message.results.length === 1 && Object.keys(message.results[0]).length === 1) && (
                                                    <div className="mt-2 animate-in zoom-in-95 duration-700 delay-200">
                                                        <ResultsDisplay
                                                            data={message.results}
                                                            sql={message.sql || ''}
                                                            question={messages[index - 1]?.content || ''}
                                                            visualization={message.visualization as any || 'table'}
                                                        />
                                                    </div>
                                                )}

                                                {message.suggestedQuestions && message.suggestedQuestions.length > 0 && (
                                                    <div className="mt-10 pt-8 border-t border-slate-100 animate-in fade-in duration-700 delay-500">
                                                        <span className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400 block mb-4">Análisis sugeridos</span>
                                                        <div className="flex flex-wrap gap-2">
                                                            {message.suggestedQuestions.map((q, i) => (
                                                                <button
                                                                    key={i}
                                                                    onClick={() => handleSend(q)}
                                                                    className="px-5 py-2.5 text-xs font-bold text-indigo-600 bg-white hover:bg-indigo-600 hover:text-white rounded-2xl transition-all border border-indigo-100 shadow-sm hover:shadow-md active:scale-95"
                                                                >
                                                                    {q}
                                                                </button>
                                                            ))}
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    ) : (
                                        <p className="text-[16px] font-bold leading-relaxed whitespace-pre-wrap">{message.content}</p>
                                    )}
                                </div>
                                <span className="text-[10px] font-bold text-slate-400 mt-2 px-2 uppercase tracking-widest opacity-0 group-hover:opacity-100 transition-opacity">
                                    {new Date(message.timestamp || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </span>
                            </div>
                        ))}

                        {loading && (
                            <div className="flex items-start space-x-3 animate-in fade-in duration-300">
                                <div className="p-4 bg-white border border-slate-200 rounded-[24px] rounded-tl-none shadow-xl flex items-center space-x-4">
                                    <div className="flex space-x-1">
                                        <div className="w-2 h-2 bg-indigo-600 rounded-full animate-bounce [animation-delay:-0.3s]" />
                                        <div className="w-2 h-2 bg-indigo-600 rounded-full animate-bounce [animation-delay:-0.15s]" />
                                        <div className="w-2 h-2 bg-indigo-600 rounded-full animate-bounce" />
                                    </div>
                                    <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Analizando datos...</span>
                                </div>
                            </div>
                        )}
                        <div ref={messagesEndRef} />
                    </div>

                    {/* Footer / Input Area */}
                    <div className="p-6 bg-white border-t border-slate-100 shadow-[0_-10px_40px_-15px_rgba(0,0,0,0.05)]">
                        <ChatInput
                            onSend={handleSend}
                            isLoading={loading}
                        />
                        <p className="text-[9px] text-center text-slate-400 mt-4 uppercase tracking-[0.3em] font-bold">Powered by Merkurio Engine Analytics</p>
                    </div>
                </div>
            )}
        </div>
    );
}
