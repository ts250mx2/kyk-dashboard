"use client";

import { useState, useRef, useEffect } from 'react';
import { ChatInput } from '@/components/chat-input';
import { ResultsDisplay } from '@/components/results-display';
import { cn } from '@/lib/utils';
import { Sparkles, MessageSquare, Search, Command, ArrowRight, Trash2 } from 'lucide-react';

export default function DashboardChatPage() {
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
        userSelectedViz?: 'table' | 'chart' | 'sql' | null;
    }

    const [messages, setMessages] = useState<Message[]>([]);
    const [isHistoryLoaded, setIsHistoryLoaded] = useState(false);
    const [loading, setLoading] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);

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
            } catch (error) {
                console.error('Error loading chat history:', error);
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

        const userMsg: Message = { role: 'user', content: prompt, timestamp: Date.now() };
        setMessages((prev) => [...prev, userMsg].slice(-20));
        setLoading(true);

        try {
            const response = await fetch('/api/query', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ prompt }),
            });
            const data = await response.json();

            if (response.ok) {
                const assistantMsg: Message = {
                    role: 'assistant',
                    content: data.message || (data.data && data.data.length > 0
                        ? 'He procesado tu consulta. Aquí están los resultados de mi análisis.'
                        : 'No encontré información para tu solicitud.'),
                    sql: data.sql,
                    visualization: data.visualization,
                    results: data.data,
                    insight: data.insight,
                    suggestedQuestions: data.suggested_questions,
                    timestamp: Date.now(),
                };
                setMessages((prev) => [...prev, assistantMsg].slice(-20));
            } else {
                setMessages((prev) => [...prev, {
                    role: 'assistant' as const,
                    content: `Error del Sistema: ${data.error || 'No se pudo procesar la solicitud'}`,
                    error: data.error,
                    timestamp: Date.now(),
                }].slice(-20));
            }
        } catch (err) {
            setMessages((prev) => [...prev, {
                role: 'assistant' as const,
                content: `Falla de Conexión: ${(err as Error).message}`,
                error: (err as Error).message,
                timestamp: Date.now(),
            }].slice(-20));
        } finally {
            setLoading(false);
        }
    };

    const handleClear = () => {
        setMessages([]);
        localStorage.removeItem('kyk_integrated_chat_history');
    };

    return (
        <div className="flex flex-col h-[calc(100vh-140px)] max-w-5xl mx-auto relative pt-8">
            {/* Header / Brand */}
            {messages.length > 0 && (
                <div className="flex items-center justify-between mb-8 pb-4 border-b border-border/40">
                    <div className="flex items-center gap-4">
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
                    <button
                        onClick={handleClear}
                        className="flex items-center gap-2 px-4 py-2 text-xs font-bold text-slate-400 hover:text-red-500 transition-colors uppercase tracking-widest"
                    >
                        <Trash2 size={14} />
                        Limpiar Historial
                    </button>
                </div>
            )}

            <div className="flex-1 overflow-y-auto pr-4 space-y-10 scrollbar-none pb-32">
                {messages.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-center max-w-xl mx-auto space-y-10">
                        <div className="relative group flex items-center justify-center">
                            <div className="relative w-40 h-40 transform group-hover:scale-110 group-hover:-rotate-3 transition-all duration-500 ease-out flex items-center justify-center text-6xl">
                                <img
                                    src="/kesito.svg"
                                    alt="Asistente Kesito"
                                    className="w-full h-full object-contain"
                                />
                            </div>
                        </div>

                        <div className="space-y-4">
                            <h2 className="text-4xl font-black tracking-tight text-foreground uppercase">Analista Digital KYK</h2>
                            <p className="text-[15px] text-muted-foreground leading-relaxed max-w-sm mx-auto font-semibold">
                                Explora tus datos con lenguaje natural. Genero SQL, analizo resultados y creo visualizaciones profesionales. 🚀
                            </p>
                        </div>

                        <div className="flex flex-col w-full gap-3 pt-4">
                            {[
                                "📈 ¿Cuáles fueron las ventas totales de hoy?",
                                "📊 Mostrar las 5 sucursales con más ventas este mes",
                                "🛒 ¿Qué productos se vendieron más ayer?",
                                "📜 Ver las aperturas de caja de hoy",
                                "💰 ¿Cuál es el total de retiros de esta semana?"
                            ].map((q) => (
                                <button
                                    key={q}
                                    onClick={() => handleSend(q)}
                                    className="flex items-center justify-between p-5 bg-white border border-slate-200 rounded-3xl text-left hover:border-[#4050B4] hover:bg-slate-50 transition-all group shadow-sm"
                                >
                                    <span className="text-[14px] font-bold text-slate-700 group-hover:text-[#4050B4] transition-colors">{q}</span>
                                    <div className="p-1 px-3 bg-[#4050B4] text-white text-[10px] font-black rounded-xl shadow-lg group-hover:scale-110 transition-transform tracking-widest">
                                        ENVIAR
                                    </div>
                                </button>
                            ))}
                        </div>
                    </div>
                ) : (
                    <div className="space-y-8 w-full">
                        {messages.map((msg, i) => (
                            <div key={i} className={cn('flex flex-col', msg.role === 'user' ? 'items-end' : 'items-start')}>
                                <div className={cn(
                                    'max-w-[85%] rounded-[32px] shadow-sm',
                                    msg.role === 'user'
                                        ? 'bg-slate-900 text-white rounded-tr-none px-6 py-4'
                                        : 'bg-white border border-slate-200 rounded-tl-none overflow-hidden'
                                )}>
                                    {msg.role === 'assistant' ? (
                                        <div className="flex flex-col">
                                            {/* Analyst Header */}
                                            <div className="bg-slate-50 border-b border-slate-100 px-6 py-3 flex items-center justify-between">
                                                <div className="flex items-center space-x-2">
                                                    <div className="w-2 h-2 bg-indigo-600 rounded-full animate-pulse" />
                                                    <span className="text-[10px] font-black uppercase tracking-[0.2em] text-indigo-600">Reporte Analítico Senior</span>
                                                </div>
                                            </div>

                                            {/* Analysis Content */}
                                            <div className="px-6 py-6 group">
                                                <p className="text-[16px] leading-relaxed text-slate-700 font-medium italic mb-6 border-l-4 border-indigo-200 pl-6 bg-indigo-50/30 py-4 rounded-r-2xl whitespace-pre-wrap">
                                                    {msg.content}
                                                </p>

                                                {msg.insight && (
                                                    <div className="bg-indigo-600 text-white p-5 rounded-[24px] mb-8 shadow-lg shadow-indigo-100 flex items-start space-x-4 animate-in slide-in-from-left-4 duration-500">
                                                        <div className="p-3 bg-white/20 rounded-2xl">
                                                            <Search className="w-5 h-5" />
                                                        </div>
                                                        <div>
                                                            <span className="text-[10px] font-black uppercase tracking-[0.2em] opacity-70">Hallazgo Clave</span>
                                                            <p className="text-[15px] font-bold leading-tight mt-1">{msg.insight}</p>
                                                        </div>
                                                    </div>
                                                )}

                                                {msg.results && msg.results.length > 0 && !msg.userSelectedViz && (
                                                    <div className="mt-4 flex flex-wrap gap-2 animate-in fade-in slide-in-from-bottom-2 duration-500">
                                                        <button
                                                            onClick={() => {
                                                                setMessages(prev => prev.map((m, idx) =>
                                                                    idx === i ? { ...m, userSelectedViz: 'table' } : m
                                                                ));
                                                            }}
                                                            className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 hover:border-[#4050B4] hover:text-[#4050B4] transition-all font-bold text-[12px] shadow-sm uppercase tracking-tight"
                                                        >
                                                            <span>📊</span> Ver como Tabla
                                                        </button>
                                                        <button
                                                            onClick={() => {
                                                                setMessages(prev => prev.map((m, idx) =>
                                                                    idx === i ? { ...m, userSelectedViz: 'chart' } : m
                                                                ));
                                                            }}
                                                            className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 hover:border-[#4050B4] hover:text-[#4050B4] transition-all font-bold text-[12px] shadow-sm uppercase tracking-tight"
                                                        >
                                                            <span>📈</span> Ver como Gráfica
                                                        </button>
                                                    </div>
                                                )}

                                                {msg.results && msg.userSelectedViz && (
                                                    <div className="mt-6 overflow-hidden rounded-none border border-border/50 bg-muted/10 animate-in zoom-in-95 duration-300">
                                                        <ResultsDisplay
                                                            data={msg.results}
                                                            sql={msg.sql || ''}
                                                            question={messages[i - 1]?.content || ''}
                                                            visualization={msg.userSelectedViz === 'chart' ? (msg.visualization as any) || 'bar' : 'table'}
                                                            onVisualizationChange={(newViz) => {
                                                                setMessages(prev => prev.map((m, idx) => idx === i ? { ...m, visualization: newViz } : m));
                                                            }}
                                                        />
                                                        <button
                                                            onClick={() => {
                                                                setMessages(prev => prev.map((m, idx) =>
                                                                    idx === i ? { ...m, userSelectedViz: null } : m
                                                                ));
                                                            }}
                                                            className="mt-2 text-[10px] font-bold text-slate-400 hover:text-slate-600 uppercase tracking-widest px-2 pb-2"
                                                        >
                                                            ← Cambiar formato
                                                        </button>
                                                    </div>
                                                )}

                                                {msg.suggestedQuestions && msg.suggestedQuestions.length > 0 && (
                                                    <div className="mt-8 pt-6 border-t border-slate-100 flex flex-wrap gap-2">
                                                        <p className="w-full text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-2">Pasos Sugeridos</p>
                                                        {msg.suggestedQuestions.map((question, idx) => (
                                                            <button
                                                                key={idx}
                                                                onClick={() => handleSend(question)}
                                                                className="flex items-center gap-2 px-4 py-1.5 bg-background border border-border rounded-full hover:border-[#4050B4] hover:text-[#4050B4] transition-all text-[11px] font-bold shadow-sm"
                                                            >
                                                                {question}
                                                                <ArrowRight size={12} className="opacity-40" />
                                                            </button>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="flex flex-col">
                                            <div className="flex items-center gap-2 mb-2 text-[10px] font-bold text-primary-foreground/70 uppercase tracking-[0.2em] justify-end">
                                                Tu Consulta
                                                <span className="text-lg">👤</span>
                                            </div>
                                            <p className="text-[16px] font-bold leading-relaxed whitespace-pre-wrap">{msg.content}</p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))}
                        {loading && (
                            <div className="flex justify-start">
                                <div className="bg-white border border-slate-200 rounded-[24px] rounded-tl-none p-4 flex items-center gap-4 shadow-xl pr-6">
                                    <div className="w-8 h-8 flex items-center justify-center animate-bounce">
                                        <img src="/kesito.svg" alt="Loading" className="w-full h-full object-contain" />
                                    </div>
                                    <div className="flex flex-col">
                                        <span className="text-[13px] text-slate-900 font-bold tracking-tight">Analista Digital KYK</span>
                                        <span className="text-[10px] text-slate-500 font-medium uppercase tracking-widest animate-pulse">Analizando datos...</span>
                                    </div>
                                </div>
                            </div>
                        )}
                        <div ref={messagesEndRef} />
                    </div>
                )}
            </div>

            <div className="absolute bottom-6 left-0 w-full">
                <div className="max-w-3xl mx-auto">
                    <div className="bg-background rounded-2xl border border-border shadow-2xl p-1 transition-all focus-within:border-primary/40 focus-within:ring-4 focus-within:ring-primary/5">
                        <ChatInput onSend={handleSend} isLoading={loading} />
                    </div>
                </div>
            </div>
        </div>
    );
}
