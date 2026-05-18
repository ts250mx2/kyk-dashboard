"use client";

import { useState, useRef, useEffect, useCallback } from 'react';
import { ChatInput } from '@/components/chat-input';
import { ResultsDisplay } from '@/components/results-display';
import { cn } from '@/lib/utils';
import {
    X,
    Maximize2,
    Trash2,
    Lightbulb,
    Target,
    ChevronDown,
    ChevronUp,
    ExternalLink
} from 'lucide-react';
import { usePathname, useRouter } from 'next/navigation';

interface Message {
    role: 'user' | 'assistant';
    content: string;
    sql?: string;
    visualization?: string;
    results?: Record<string, any>[];
    suggestedQuestions?: string[];
    timestamp?: number;
    error?: string;
    ai_model?: string;
    key_insights?: string[];
    recommendations?: string[];
    suggested_reports?: Array<{
        report_name: string;
        reason: string;
        expected_action?: string;
        path?: string;
    }>;
}

const PAGE_SUGGESTIONS: Record<string, string[]> = {
    '/dashboard': [
        '¿Cómo va el desempeño operativo de hoy vs ayer?',
        'Analiza los KPIs principales del mes actual',
        'Identifica productos con anomalías en ventas',
        '¿Qué sucursales necesitan atención inmediata?',
        'Proyección de ventas para fin de mes'
    ],
    '/dashboard/overview': [
        'Resumen ejecutivo de ventas del mes actual',
        '¿Cuál es la evolución del ticket promedio?',
        'Analizar tendencias de los últimos 30 días',
        'Benchmarking de desempeño entre sucursales',
        'Análisis de factores que impactan ventas'
    ],
    '/dashboard/sales/operations': [
        '¿Cómo está el desempeño por sucursal hoy?',
        'Comparativa semanal: esta semana vs la anterior',
        '¿Qué productos lideran y cuáles rezagan?',
        'Análisis de tickets cancelados hoy',
        'Eficiencia operativa por tienda'
    ],
    '/dashboard/sales/heatmap': [
        '¿Cuándo son las horas de mayor demanda?',
        'Optimización de horarios según patrones de tráfico',
        'Análisis de picos de venta por día',
        'Patrones de comportamiento del cliente',
        'Eficiencia de personal por hora'
    ],
    '/dashboard/purchases/dashboard': [
        'Resumen de la cadena de suministro este mes',
        '¿Cuál es el status general de órdenes activas?',
        'Análisis de eficiencia de recepción',
        'Proveedores con mejor y peor desempeño',
        'Oportunidades de optimización en compras'
    ],
    '/dashboard/purchases/orders': [
        '¿Qué órdenes están en riesgo de retraso?',
        'Análisis de confiabilidad de proveedores',
        'Próximos arribes programados vs realidad',
        'Órdenes que requieren seguimiento urgente',
        'Evaluación de ciclos de entrega'
    ],
    '/dashboard/purchases/distributions': [
        '¿Cuál es la eficiencia de distribución actual?',
        'Identificar cuellos de botella en surtido',
        'Análisis de tiempos de entrega a sucursales',
        'Optimización de rutas de distribución',
        'Evaluación de cobertura de inventario'
    ],
    '/dashboard/purchases/routes': [
        '¿Cuál es la eficiencia operativa de rutas?',
        'Rutas críticas con riesgo de retraso',
        'Análisis de costos de transporte',
        'Desempeño de unidades y conductores',
        'Optimización de consolidación de entregas'
    ],
    '/dashboard/system': [
        'Tendencias de comportamiento de usuarios',
        '¿Cuáles son los análisis más consultados?',
        'Evaluación de adopción del sistema IA',
        'Patrones de error y mejoras necesarias',
        'Historial de cambios y auditoría'
    ],
};

const DEFAULT_FALLBACK = [
    '¿Cómo va el negocio vs período anterior?',
    'Identifica productos y categorías clave',
    'Análisis de performance por sucursal',
    'Evaluación de métricas operativas críticas',
    'Oportunidades de optimización identificadas'
];

export function ChatAgent() {
    const pathname = usePathname();
    const router = useRouter();
    const [isOpen, setIsOpen] = useState(false);
    const [messages, setMessages] = useState<Message[]>([]);
    const [defaultSuggestions, setDefaultSuggestions] = useState<string[]>([]);
    const [isHistoryLoaded, setIsHistoryLoaded] = useState(false);
    const [loading, setLoading] = useState(false);
    const [expandedInsights, setExpandedInsights] = useState<Record<number, boolean>>({});
    const [expandedRecommendations, setExpandedRecommendations] = useState<Record<number, boolean>>({});
    const messagesEndRef = useRef<HTMLDivElement>(null);

    const toggleInsights = (index: number) => {
        setExpandedInsights(prev => ({ ...prev, [index]: !prev[index] }));
    };

    const toggleRecommendations = (index: number) => {
        setExpandedRecommendations(prev => ({ ...prev, [index]: !prev[index] }));
    };

    const navigateToReport = (path?: string) => {
        if (path) {
            router.push(path);
            setIsOpen(false);
        }
    };

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

    const [position, setPosition] = useState({ x: 0, y: 0 });

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

        const savedPosition = localStorage.getItem('kyk_chat_agent_position');
        if (savedPosition) {
            try {
                setPosition(JSON.parse(savedPosition));
            } catch (e) {
                setPosition({ x: 0, y: 0 });
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
                const cleanLast = lastUserMsg.content.replace(/\?$/, '');
                finalPrompt = `${cleanLast} ${prompt}`;
            }
        }

        const userMsg: Message = { role: 'user', content: finalPrompt, timestamp: Date.now() };
        setMessages((prev) => [...prev, userMsg]);
        setLoading(true);

        try {
            const selectedModel = typeof window !== 'undefined' ? localStorage.getItem('ai_query_model') || 'gpt-4o' : 'gpt-4o';
            const response = await fetch('/api/query', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ prompt: finalPrompt, model: selectedModel }),
            });
            const data = await response.json();

            if (response.ok) {
                const assistantMsg: Message = {
                    role: 'assistant',
                    content: data.message || 'He procesado tu consulta.',
                    sql: data.sql,
                    visualization: data.visualization,
                    results: data.data,
                    suggestedQuestions: data.suggested_questions,
                    timestamp: Date.now(),
                    ai_model: data.ai_model,
                    key_insights: data.key_insights,
                    recommendations: data.recommendations,
                    suggested_reports: data.suggested_reports,
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
        <div
            className="fixed z-[9999] flex flex-col items-end"
            style={{
                bottom: `calc(1.5rem + ${-position.y}px)`,
                right: `calc(1.5rem + ${-position.x}px)`,
                touchAction: 'none'
            }}
        >
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
                <div className="bg-slate-50 border border-slate-200 shadow-2xl flex flex-col mb-4 overflow-hidden transition-all duration-300 ease-in-out w-[380px] md:w-[850px] h-[500px] md:h-[85vh] rounded-[32px]">
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
                            <button
                                onClick={() => router.push('/chat')}
                                className="p-2 hover:bg-slate-100 rounded-xl transition-colors text-slate-400"
                                title="Abrir en página completa"
                            >
                                <Maximize2 className="w-5 h-5" />
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
                                                    <span className="text-[10px] font-black uppercase tracking-[0.2em] text-indigo-600">
                                                        Reporte Analítico Senior {message.ai_model && `(${message.ai_model})`}
                                                    </span>
                                                </div>
                                                <div className="flex space-x-1">
                                                    <div className="w-1.5 h-1.5 bg-slate-200 rounded-full" />
                                                    <div className="w-1.5 h-1.5 bg-slate-200 rounded-full" />
                                                </div>
                                            </div>

                                            {/* Analysis Content - Respuesta Corta */}
                                            <div className="px-6 py-6 group">
                                                <p className="text-[15px] leading-relaxed text-slate-700 font-medium whitespace-pre-wrap mb-5">
                                                    {message.content}
                                                </p>

                                                {message.results && message.results.length > 0 && !(message.results.length === 1 && Object.keys(message.results[0]).length === 1) && (
                                                    <div className="mt-2 mb-2 animate-in zoom-in-95 duration-700 delay-200">
                                                        <ResultsDisplay
                                                            data={message.results}
                                                            sql={message.sql || ''}
                                                            question={messages[index - 1]?.content || ''}
                                                            visualization={message.visualization as any || 'table'}
                                                        />
                                                    </div>
                                                )}

                                                {/* Botones para profundizar: Hallazgos clave + Recomendaciones */}
                                                {((message.key_insights && message.key_insights.length > 0) || (message.recommendations && message.recommendations.length > 0)) && (
                                                    <div className="mt-6 flex flex-wrap gap-2">
                                                        {message.key_insights && message.key_insights.length > 0 && (
                                                            <button
                                                                onClick={() => toggleInsights(index)}
                                                                className="inline-flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-full transition-all border bg-indigo-50 border-indigo-200 text-indigo-700 hover:bg-indigo-100 active:scale-95"
                                                            >
                                                                <Lightbulb className="w-3.5 h-3.5" />
                                                                <span>Hallazgos clave</span>
                                                                {expandedInsights[index] ? (
                                                                    <ChevronUp className="w-3.5 h-3.5" />
                                                                ) : (
                                                                    <ChevronDown className="w-3.5 h-3.5" />
                                                                )}
                                                            </button>
                                                        )}
                                                        {message.recommendations && message.recommendations.length > 0 && (
                                                            <button
                                                                onClick={() => toggleRecommendations(index)}
                                                                className="inline-flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-full transition-all border bg-emerald-50 border-emerald-200 text-emerald-700 hover:bg-emerald-100 active:scale-95"
                                                            >
                                                                <Target className="w-3.5 h-3.5" />
                                                                <span>Recomendaciones</span>
                                                                {expandedRecommendations[index] ? (
                                                                    <ChevronUp className="w-3.5 h-3.5" />
                                                                ) : (
                                                                    <ChevronDown className="w-3.5 h-3.5" />
                                                                )}
                                                            </button>
                                                        )}
                                                    </div>
                                                )}

                                                {/* Hallazgos clave - Desplegable */}
                                                {expandedInsights[index] && message.key_insights && message.key_insights.length > 0 && (
                                                    <div className="mt-4 bg-indigo-50 border border-indigo-100 p-4 rounded-2xl animate-in fade-in slide-in-from-top-2 duration-300">
                                                        <ul className="space-y-2">
                                                            {message.key_insights.map((insight, idx) => (
                                                                <li key={idx} className="text-[13px] text-slate-700 leading-snug flex items-start">
                                                                    <span className="inline-block w-1.5 h-1.5 bg-indigo-600 rounded-full mr-3 mt-1.5 flex-shrink-0" />
                                                                    <span>{insight}</span>
                                                                </li>
                                                            ))}
                                                        </ul>
                                                    </div>
                                                )}

                                                {/* Recomendaciones - Desplegable */}
                                                {expandedRecommendations[index] && message.recommendations && message.recommendations.length > 0 && (
                                                    <div className="mt-4 bg-emerald-50 border border-emerald-100 p-4 rounded-2xl animate-in fade-in slide-in-from-top-2 duration-300">
                                                        <ul className="space-y-2">
                                                            {message.recommendations.map((rec, idx) => (
                                                                <li key={idx} className="text-[13px] text-slate-700 leading-snug flex items-start">
                                                                    <span className="inline-block w-1.5 h-1.5 bg-emerald-600 rounded-full mr-3 mt-1.5 flex-shrink-0" />
                                                                    <span>{rec}</span>
                                                                </li>
                                                            ))}
                                                        </ul>
                                                    </div>
                                                )}

                                                {/* Reportes sugeridos - Clickeables que navegan */}
                                                {message.suggested_reports && message.suggested_reports.length > 0 && (
                                                    <div className="mt-8 pt-6 border-t border-slate-100 animate-in fade-in duration-700 delay-400">
                                                        <span className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400 block mb-4">Reportes para profundizar</span>
                                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                                            {message.suggested_reports.map((report, idx) => (
                                                                <button
                                                                    key={idx}
                                                                    onClick={() => navigateToReport(report.path)}
                                                                    disabled={!report.path}
                                                                    className="group/report text-left bg-slate-50 hover:bg-indigo-50 disabled:hover:bg-slate-50 disabled:cursor-not-allowed p-3 rounded-2xl border border-slate-100 hover:border-indigo-200 transition-all active:scale-95"
                                                                >
                                                                    <div className="flex items-start justify-between gap-2">
                                                                        <div className="flex-1 min-w-0">
                                                                            <p className="text-xs font-bold text-slate-800 group-hover/report:text-indigo-700 mb-1 flex items-center gap-1.5">
                                                                                📊 {report.report_name}
                                                                            </p>
                                                                            <p className="text-[11px] text-slate-500 leading-snug">{report.reason}</p>
                                                                        </div>
                                                                        {report.path && (
                                                                            <ExternalLink className="w-3.5 h-3.5 text-slate-400 group-hover/report:text-indigo-600 flex-shrink-0 mt-0.5" />
                                                                        )}
                                                                    </div>
                                                                </button>
                                                            ))}
                                                        </div>
                                                    </div>
                                                )}

                                                {message.suggestedQuestions && message.suggestedQuestions.length > 0 && (
                                                    <div className="mt-8 pt-6 border-t border-slate-100 animate-in fade-in duration-700 delay-500">
                                                        <span className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400 block mb-4">Continuar el análisis</span>
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
