"use client";

import { useState, useRef, useEffect } from 'react';
import { ChatInput } from '@/components/chat-input';
import { ResultsDisplay } from '@/components/results-display';
import { cn } from '@/lib/utils';
import { Sparkles, MessageSquare, Search, Command, ArrowRight } from 'lucide-react';

export default function DashboardChatPage() {
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
    }

    const [messages, setMessages] = useState<Message[]>([]);
    const [isHistoryLoaded, setIsHistoryLoaded] = useState(false);
    const [loading, setLoading] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(() => {
        const savedMessages = localStorage.getItem('kyk_chat_history');
        if (savedMessages) {
            try {
                setMessages(JSON.parse(savedMessages));
            } catch (error) {
                console.error('Error loading chat history:', error);
            }
        }
        setIsHistoryLoaded(true);
    }, []);

    useEffect(() => {
        if (isHistoryLoaded) {
            localStorage.setItem('kyk_chat_history', JSON.stringify(messages));
        }
        scrollToBottom();
    }, [messages, isHistoryLoaded]);

    const handleSend = async (prompt: string) => {
        setMessages((prev) => [...prev, { role: 'user', content: prompt }]);
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
                    content: 'Query processed successfully. Below are the analytical results.',
                    sql: data.sql,
                    visualization: data.visualization,
                    data: data.data,
                    suggested_questions: data.suggested_questions,
                    related_page: data.related_page,
                    prompt: prompt
                }]);
            } else {
                setMessages((prev) => [...prev, {
                    role: 'assistant',
                    content: `System Error: ${data.error || 'Failed to process the request'}`,
                    error: data.error
                }]);
            }
        } catch (err) {
            setMessages((prev) => [...prev, {
                role: 'assistant',
                content: `Connection Failure: ${(err as Error).message}`,
                error: (err as Error).message
            }]);
        } finally {
            setLoading(false);
        }
    };

    const handleClear = () => {
        setMessages([]);
        localStorage.removeItem('kyk_chat_history');
    };

    return (
        <div className="flex flex-col h-[calc(100vh-140px)] max-w-5xl mx-auto relative pt-8">
            <div className="flex-1 overflow-y-auto pr-4 space-y-10 scrollbar-none pb-32">
                {messages.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-center max-w-xl mx-auto space-y-10">
                        <div className="relative group flex items-center justify-center">
                            <div className="relative w-40 h-40 transform group-hover:scale-110 group-hover:-rotate-3 transition-all duration-500 ease-out flex items-center justify-center">
                                <img
                                    src="/kesito.svg"
                                    alt="Asistente Kesito"
                                    className="w-full h-full object-contain"
                                />
                            </div>
                        </div>

                        <div className="space-y-4">
                            <h2 className="text-4xl font-black tracking-tight text-foreground uppercase">Asistente KYK</h2>
                            <p className="text-[15px] text-muted-foreground leading-relaxed max-w-sm mx-auto font-semibold">
                                Explora tus datos con lenguaje natural. Genero SQL, analizo resultados y creo visualizaciones profesionales. 🚀
                            </p>
                        </div>

                        <div className="flex flex-col w-full gap-3 pt-4">
                            {[
                                "📊 Analizar tasa de crecimiento mensual",
                                "🛒 Top 10 productos más vendidos",
                                "📜 Log de auditoría de seguridad hoy",
                                "📈 Proyección de ingresos para el Q1"
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
                                    'max-w-[85%] rounded-2xl p-5 shadow-sm border border-border/40',
                                    msg.role === 'user'
                                        ? 'bg-primary text-primary-foreground border-transparent'
                                        : 'bg-background w-full'
                                )}>
                                    {msg.role === 'assistant' ? (
                                        <div className="flex items-center gap-2 mb-4 text-[10px] font-bold text-muted-foreground uppercase tracking-[0.2em]">
                                            <img src="/kesito.svg" alt="KYK" className="w-5 h-5 object-contain" />
                                            Asistente KYK
                                        </div>
                                    ) : (
                                        <div className="flex items-center gap-2 mb-4 text-[10px] font-bold text-primary-foreground/70 uppercase tracking-[0.2em] justify-end">
                                            Tu Consulta
                                            <span className="text-lg drop-shadow-sm">👤</span>
                                        </div>
                                    )}

                                    <p className={cn("text-[14px] leading-relaxed font-medium", msg.role === 'user' ? '' : 'text-foreground/90')}>
                                        {msg.content}
                                    </p>

                                    {msg.data && (
                                        <div className="mt-6 overflow-hidden rounded-none border border-border/50 bg-muted/10">
                                            <ResultsDisplay
                                                data={msg.data}
                                                sql={msg.sql || ''}
                                                question={msg.prompt || ''}
                                                visualization={(msg.visualization as 'table' | 'bar' | 'line' | 'pie' | 'area') || 'table'}
                                                onVisualizationChange={(newViz: 'table' | 'bar' | 'line' | 'pie' | 'area') => {
                                                    setMessages(prev => prev.map((m, idx) => idx === i ? { ...m, visualization: newViz } : m));
                                                }}
                                            />
                                        </div>
                                    )}

                                    {msg.suggested_questions && msg.suggested_questions.length > 0 && (
                                        <div className="mt-8 pt-6 border-t border-border/40 flex flex-wrap gap-2">
                                            <p className="w-full text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-2">Next Steps</p>
                                            {msg.suggested_questions.map((question, idx) => (
                                                <button
                                                    key={idx}
                                                    onClick={() => handleSend(question)}
                                                    className="flex items-center gap-2 px-4 py-1.5 bg-background border border-border rounded-full hover:border-primary hover:text-primary transition-all text-[11px] font-bold shadow-sm"
                                                >
                                                    {question}
                                                    <ArrowRight size={12} className="opacity-40" />
                                                </button>
                                            ))}
                                        </div>
                                    )}

                                    {msg.related_page && (
                                        <div className="mt-6">
                                            <a
                                                href={msg.related_page}
                                                className="inline-flex items-center gap-2 px-4 py-2 border border-primary/20 bg-primary/5 hover:bg-primary/10 text-primary rounded-xl transition-all text-xs font-bold"
                                            >
                                                Navigate to Detailed Analytics
                                            </a>
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))}
                        {loading && (
                            <div className="flex justify-start">
                                <div className="bg-white border border-slate-200 rounded-2xl p-4 flex items-center gap-4 shadow-md pr-6">
                                    <div className="w-8 h-8 flex items-center justify-center animate-bounce">
                                        <img src="/kesito.svg" alt="Loading" className="w-full h-full object-contain" />
                                    </div>
                                    <div className="flex flex-col">
                                        <span className="text-[13px] text-slate-900 font-bold tracking-tight">Respondiendo tu solicitud</span>
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
                        <ChatInput onSend={handleSend} onClear={handleClear} isLoading={loading} />
                    </div>
                </div>
            </div>
        </div>
    );
}
