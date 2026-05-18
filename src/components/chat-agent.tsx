"use client";

import { useState, useRef, useEffect, useCallback } from 'react';
import { ChatInput } from '@/components/chat-input';
import { AgentDataView } from '@/components/agent-data-view';
import { InlineMarkdown } from '@/components/inline-markdown';
import { readSseStream } from '@/lib/sse-client';
import { cn } from '@/lib/utils';
import {
    X,
    Maximize2,
    Trash2,
    Lightbulb,
    Target,
    ChevronDown,
    ChevronUp,
    ExternalLink,
    AlertCircle,
    TrendingUp,
    Sparkles,
    RefreshCw,
    BarChart3
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
    conversational?: boolean;
    key_insights?: string[];
    recommendations?: string[];
    suggested_reports?: Array<{
        report_name: string;
        reason: string;
        expected_action?: string;
        path?: string;
    }>;
    // Streaming state
    streaming?: boolean;
    streamPhase?: 'thinking' | 'querying' | 'correcting-sql' | 'analyzing' | 'finalizing';
    awaitingMetadata?: boolean;
}

const STREAM_PHASE_LABELS: Record<NonNullable<Message['streamPhase']>, string> = {
    'thinking': 'Pensando...',
    'querying': 'Consultando datos...',
    'correcting-sql': 'Ajustando consulta...',
    'analyzing': 'Analizando resultados...',
    'finalizing': 'Preparando análisis...'
};

interface DailyInsight {
    id: string;
    question: string;
    severity: 'critical' | 'opportunity' | 'info';
    area: string;
    summary: string;
}

const SEVERITY_STYLES: Record<DailyInsight['severity'], { bar: string; dot: string; icon: any; label: string }> = {
    critical: { bar: 'bg-rose-500', dot: 'bg-rose-500', icon: AlertCircle, label: 'Crítico' },
    opportunity: { bar: 'bg-emerald-500', dot: 'bg-emerald-500', icon: TrendingUp, label: 'Oportunidad' },
    info: { bar: 'bg-indigo-400', dot: 'bg-indigo-400', icon: Sparkles, label: 'Insight' }
};

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

interface ChatAgentProps {
    /**
     * - 'floating': widget flotante (botón en esquina inferior derecha)
     * - 'embedded': ocupa todo el contenedor padre, sin botón ni overlay
     */
    mode?: 'floating' | 'embedded';
}

export function ChatAgent({ mode = 'floating' }: ChatAgentProps = {}) {
    const pathname = usePathname();
    const router = useRouter();
    const isEmbedded = mode === 'embedded';
    const [isOpen, setIsOpen] = useState(isEmbedded);
    const [messages, setMessages] = useState<Message[]>([]);
    const [defaultSuggestions, setDefaultSuggestions] = useState<string[]>([]);
    const [dailyInsights, setDailyInsights] = useState<DailyInsight[]>([]);
    const [briefing, setBriefing] = useState<string>('');
    const [loadingInsights, setLoadingInsights] = useState(false);
    const [isHistoryLoaded, setIsHistoryLoaded] = useState(false);
    const [loading, setLoading] = useState(false);
    const [expandedInsights, setExpandedInsights] = useState<Record<number, boolean>>({});
    const [expandedRecommendations, setExpandedRecommendations] = useState<Record<number, boolean>>({});
    const [expandedData, setExpandedData] = useState<Record<number, boolean>>({});
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const streamControllerRef = useRef<AbortController | null>(null);

    const fetchDailyInsights = useCallback(async (forceRefresh = false) => {
        const todayKey = new Date().toLocaleDateString('es-MX', { timeZone: 'America/Mexico_City' });
        const cacheKey = 'kyk_daily_insights';
        const briefingKey = 'kyk_daily_briefing';
        const cacheDateKey = 'kyk_daily_insights_date';

        const cachedDate = localStorage.getItem(cacheDateKey);
        if (cachedDate !== todayKey) {
            localStorage.removeItem(cacheKey);
            localStorage.removeItem(briefingKey);
            localStorage.setItem(cacheDateKey, todayKey);
        } else if (!forceRefresh) {
            const cached = localStorage.getItem(cacheKey);
            const cachedBriefing = localStorage.getItem(briefingKey);
            if (cached) {
                try {
                    const parsed = JSON.parse(cached);
                    if (Array.isArray(parsed) && parsed.length > 0) {
                        setDailyInsights(parsed);
                        if (cachedBriefing) setBriefing(cachedBriefing);
                        return;
                    }
                } catch { }
            }
        }

        setLoadingInsights(true);
        try {
            const url = forceRefresh ? '/api/agent/daily-insights?refresh=true&limit=6' : '/api/agent/daily-insights?limit=6';
            const response = await fetch(url);
            const data = await response.json();
            if (Array.isArray(data.insights)) {
                setDailyInsights(data.insights);
                localStorage.setItem(cacheKey, JSON.stringify(data.insights));
                localStorage.setItem(cacheDateKey, todayKey);
            }
            if (data.briefing) {
                setBriefing(data.briefing);
                localStorage.setItem(briefingKey, data.briefing);
            }
        } catch (e) {
            console.error('Error cargando hallazgos diarios:', e);
        } finally {
            setLoadingInsights(false);
        }
    }, []);

    const toggleData = (index: number) => {
        setExpandedData(prev => ({ ...prev, [index]: !prev[index] }));
    };

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

    useEffect(() => {
        if (isOpen && dailyInsights.length === 0 && !loadingInsights) {
            fetchDailyInsights(false);
        }
    }, [isOpen, dailyInsights.length, loadingInsights, fetchDailyInsights]);

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

        const selectedModel = typeof window !== 'undefined' ? localStorage.getItem('ai_query_model') || 'claude-opus-4-6' : 'claude-opus-4-6';
        const useStreaming = selectedModel.includes('claude');

        // Aborta cualquier stream previo
        if (streamControllerRef.current) {
            streamControllerRef.current.abort();
        }
        const controller = new AbortController();
        streamControllerRef.current = controller;

        // Crea el mensaje del asistente vacío que iremos llenando
        const assistantTimestamp = Date.now();
        let assistantIndex = -1;
        setMessages((prev) => {
            assistantIndex = prev.length;
            return [...prev, {
                role: 'assistant',
                content: '',
                timestamp: assistantTimestamp,
                streaming: useStreaming,
                streamPhase: useStreaming ? 'thinking' : undefined,
                ai_model: selectedModel
            }];
        });

        const updateAssistant = (patch: Partial<Message> | ((msg: Message) => Partial<Message>)) => {
            setMessages((prev) => {
                if (assistantIndex < 0 || assistantIndex >= prev.length) return prev;
                const copy = [...prev];
                const current = copy[assistantIndex];
                const updates = typeof patch === 'function' ? patch(current) : patch;
                copy[assistantIndex] = { ...current, ...updates };
                return copy;
            });
        };

        try {
            // Construir historial: los últimos N turnos previos al actual
            // (excluyendo el user que acabamos de agregar y el assistant vacío)
            const history = messages
                .filter(m => m.content && m.content.trim())
                .slice(-12)
                .map(m => ({ role: m.role, content: m.content }));

            const endpoint = useStreaming ? '/api/query?stream=true' : '/api/query';
            const response = await fetch(endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ prompt: finalPrompt, model: selectedModel, history }),
                signal: controller.signal
            });

            const isActuallyStreaming = useStreaming && !response.headers.get('content-type')?.includes('application/json');

            if (!response.ok && !isActuallyStreaming) {
                const data = await response.json().catch(() => ({}));
                let errorContent = `Error: ${data.error || 'No se pudo procesar la solicitud'}`;
                if (data.sql) errorContent += `\n\nConsulta SQL fallida:\n${data.sql}`;
                updateAssistant({
                    content: errorContent,
                    streaming: false,
                    streamPhase: undefined
                });
                return;
            }

            if (isActuallyStreaming) {
                let accumulatedText = '';
                let firstChunkReceived = false;

                for await (const evt of readSseStream(response, controller.signal)) {
                    switch (evt.event) {
                        case 'status': {
                            const phase = evt.data?.phase as Message['streamPhase'];
                            if (phase) updateAssistant({ streamPhase: phase });
                            break;
                        }
                        case 'text-delta': {
                            const chunk = evt.data?.text || '';
                            if (!firstChunkReceived) {
                                firstChunkReceived = true;
                                updateAssistant({ streamPhase: undefined });
                            }
                            accumulatedText += chunk;
                            updateAssistant({ content: accumulatedText });
                            break;
                        }
                        case 'clarification': {
                            updateAssistant({
                                content: evt.data?.message || '',
                                suggestedQuestions: evt.data?.suggested_questions || [],
                                ai_model: evt.data?.ai_model,
                                streaming: false,
                                streamPhase: undefined
                            });
                            break;
                        }
                        case 'metadata': {
                            updateAssistant({
                                sql: evt.data?.sql,
                                results: evt.data?.data,
                                visualization: evt.data?.visualization,
                                suggestedQuestions: evt.data?.suggested_questions || [],
                                key_insights: evt.data?.key_insights || [],
                                recommendations: evt.data?.recommendations || [],
                                suggested_reports: evt.data?.suggested_reports,
                                conversational: evt.data?.conversational === true,
                                ai_model: evt.data?.ai_model,
                                awaitingMetadata: false
                            });
                            break;
                        }
                        case 'error': {
                            updateAssistant({
                                content: accumulatedText
                                    ? `${accumulatedText}\n\n*(Error: ${evt.data?.message || 'fallo en el análisis'})*`
                                    : `Error: ${evt.data?.message || 'No se pudo procesar la solicitud'}`,
                                streaming: false,
                                streamPhase: undefined
                            });
                            break;
                        }
                        case 'done': {
                            updateAssistant({
                                streaming: false,
                                streamPhase: undefined,
                                awaitingMetadata: false
                            });
                            break;
                        }
                    }
                }
            } else {
                // Branch non-streaming (OpenAI o fallback)
                const data = await response.json();
                updateAssistant({
                    content: data.message || 'He procesado tu consulta.',
                    sql: data.sql,
                    visualization: data.visualization,
                    results: data.data,
                    suggestedQuestions: data.suggested_questions,
                    ai_model: data.ai_model,
                    conversational: data.conversational === true,
                    key_insights: data.key_insights,
                    recommendations: data.recommendations,
                    suggested_reports: data.suggested_reports,
                    streaming: false,
                    streamPhase: undefined
                });
            }
        } catch (err: any) {
            if (err?.name === 'AbortError') {
                updateAssistant({ streaming: false, streamPhase: undefined });
            } else {
                updateAssistant({
                    content: `Error de conexión: ${err?.message || 'desconocido'}`,
                    streaming: false,
                    streamPhase: undefined
                });
            }
        } finally {
            setLoading(false);
            if (streamControllerRef.current === controller) {
                streamControllerRef.current = null;
            }
        }
    };

    const handleClear = () => {
        if (streamControllerRef.current) {
            streamControllerRef.current.abort();
            streamControllerRef.current = null;
        }
        setMessages([]);
        localStorage.removeItem('kyk_integrated_chat_history');
        loadDefaultSuggestions();
    };

    return (
        <div
            className={cn(
                isEmbedded
                    ? "relative w-full h-full flex flex-col"
                    : "fixed z-[9999] flex flex-col items-end"
            )}
            style={isEmbedded ? undefined : {
                bottom: `calc(1.5rem + ${-position.y}px)`,
                right: `calc(1.5rem + ${-position.x}px)`,
                touchAction: 'none'
            }}
        >
            {/* Chat Trigger - solo en modo floating */}
            {!isEmbedded && !isOpen && (
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
                    "bg-slate-50 flex flex-col overflow-hidden",
                    isEmbedded
                        ? "w-full h-full"
                        : "border border-slate-200 shadow-2xl mb-4 transition-all duration-300 ease-in-out w-[380px] md:w-[850px] h-[500px] md:h-[85vh] rounded-[32px]"
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
                                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">En línea (Claude Priority)</span>
                                </div>
                            </div>
                        </div>
                        <div className="flex items-center space-x-2">
                            <button onClick={handleClear} className="p-2 hover:bg-slate-100 rounded-xl transition-colors text-slate-400" title="Limpiar chat">
                                <Trash2 className="w-5 h-5" />
                            </button>
                            {!isEmbedded && (
                                <>
                                    <button
                                        onClick={() => router.push('/dashboard/chat')}
                                        className="p-2 hover:bg-slate-100 rounded-xl transition-colors text-slate-400"
                                        title="Abrir en página completa"
                                    >
                                        <Maximize2 className="w-5 h-5" />
                                    </button>
                                    <button onClick={() => setIsOpen(false)} className="p-2 hover:bg-slate-100 rounded-xl transition-colors text-slate-400">
                                        <X className="w-6 h-6" />
                                    </button>
                                </>
                            )}
                        </div>
                    </div>

                    {/* Messages Area */}
                    <div className="flex-1 overflow-y-auto p-4 md:p-8 space-y-8 scroll-smooth scrollbar-hide" id="chat-messages">
                        {messages.length === 0 && (
                            <div className="flex flex-col h-full animate-in fade-in slide-in-from-bottom-4 duration-700">
                                {/* Briefing Narrativo Matutino */}
                                {briefing ? (
                                    <div className="bg-white rounded-[28px] border border-slate-100 shadow-sm overflow-hidden mb-6">
                                        <div className="px-6 pt-5 pb-2 flex items-center gap-2">
                                            <Sparkles className="w-4 h-4 text-indigo-500" />
                                            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-indigo-600">Briefing del día</span>
                                            <span className="ml-auto text-[10px] text-slate-400 font-medium">
                                                {new Date().toLocaleDateString('es-MX', { day: 'numeric', month: 'long' })}
                                            </span>
                                        </div>
                                        <div className="px-6 pb-6">
                                            <InlineMarkdown
                                                text={briefing}
                                                className="text-[15px] leading-relaxed text-slate-700 font-medium"
                                            />
                                        </div>
                                    </div>
                                ) : (
                                    <div className="flex flex-col items-center text-center mb-6 py-6">
                                        <div className="p-6 bg-white rounded-[32px] shadow-sm border border-slate-100 mb-4">
                                            <img src="/kesito.svg" alt="Kesito" className={cn("w-12 h-12 object-contain", loadingInsights && "animate-pulse")} />
                                        </div>
                                        <h2 className="text-2xl font-black tracking-tight text-slate-900">
                                            {loadingInsights ? 'Preparando briefing...' : 'Hola, soy Kesito'}
                                        </h2>
                                        <p className="text-slate-500 max-w-sm font-medium mt-2 text-sm">
                                            {loadingInsights
                                                ? 'Analizando los datos del día para tu resumen ejecutivo'
                                                : 'Tu consultor senior. Pregúntame lo que necesites del negocio o cualquier otro tema.'}
                                        </p>
                                    </div>
                                )}

                                {/* 6 Hallazgos del día como preguntas */}
                                {dailyInsights.length > 0 && (
                                    <div className="space-y-3">
                                        <div className="flex items-center justify-between px-2">
                                            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
                                                Hallazgos del día · {dailyInsights.length}
                                            </span>
                                            <button
                                                onClick={() => fetchDailyInsights(true)}
                                                disabled={loadingInsights}
                                                className="flex items-center gap-1.5 text-[10px] font-bold text-slate-500 hover:text-indigo-600 transition-colors disabled:opacity-50"
                                                title="Actualizar hallazgos"
                                            >
                                                <RefreshCw className={cn("w-3 h-3", loadingInsights && "animate-spin")} />
                                                Actualizar
                                            </button>
                                        </div>
                                        <div className="grid grid-cols-1 gap-2">
                                            {dailyInsights.slice(0, 6).map((insight, i) => {
                                                const sev = SEVERITY_STYLES[insight.severity];
                                                const SevIcon = sev.icon;
                                                return (
                                                    <button
                                                        key={insight.id || i}
                                                        onClick={() => handleSend(insight.question)}
                                                        className="group relative flex items-start gap-3 p-4 text-left bg-white border border-slate-100 rounded-2xl hover:border-indigo-300 hover:shadow-md transition-all animate-in fade-in slide-in-from-left-2 duration-300"
                                                        style={{ animationDelay: `${i * 50}ms` }}
                                                    >
                                                        <div className={cn("absolute left-0 top-3 bottom-3 w-1 rounded-full", sev.bar)} />
                                                        <div className="pl-2 flex items-start gap-3 flex-1 min-w-0">
                                                            <SevIcon className={cn(
                                                                "w-4 h-4 mt-0.5 flex-shrink-0",
                                                                insight.severity === 'critical' && 'text-rose-500',
                                                                insight.severity === 'opportunity' && 'text-emerald-500',
                                                                insight.severity === 'info' && 'text-indigo-400'
                                                            )} />
                                                            <div className="flex-1 min-w-0">
                                                                <p className="text-sm font-bold text-slate-800 group-hover:text-indigo-700 leading-snug">
                                                                    {insight.question}
                                                                </p>
                                                                {insight.summary && (
                                                                    <p className="text-[11px] text-slate-500 mt-1 leading-snug line-clamp-2">
                                                                        {insight.summary}
                                                                    </p>
                                                                )}
                                                                <div className="flex items-center gap-2 mt-2">
                                                                    <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400">
                                                                        {insight.area}
                                                                    </span>
                                                                    <span className="text-[9px] text-slate-300">·</span>
                                                                    <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400">
                                                                        {sev.label}
                                                                    </span>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </div>
                                )}

                                {/* Si no hay insights pero sí hay default suggestions */}
                                {dailyInsights.length === 0 && !loadingInsights && defaultSuggestions.length > 0 && (
                                    <div className="space-y-3">
                                        <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 px-2">
                                            Para empezar
                                        </span>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                            {defaultSuggestions.slice(0, 6).map((s, i) => (
                                                <button
                                                    key={i}
                                                    onClick={() => handleSend(s)}
                                                    className="p-4 text-left bg-white border border-slate-100 rounded-2xl hover:border-indigo-300 hover:shadow-md transition-all"
                                                >
                                                    <p className="text-sm font-bold text-slate-700 leading-snug">{s}</p>
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                )}
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
                                            {/* Contenido principal del mensaje */}
                                            <div className="px-6 py-5">
                                                {/* Indicador de fase streaming (antes de que llegue texto) */}
                                                {message.streaming && message.streamPhase && !message.content && (
                                                    <div className="flex items-center gap-2 text-slate-500 animate-in fade-in duration-200">
                                                        <div className="flex space-x-1">
                                                            <div className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-bounce [animation-delay:-0.3s]" />
                                                            <div className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-bounce [animation-delay:-0.15s]" />
                                                            <div className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-bounce" />
                                                        </div>
                                                        <span className="text-[11px] font-bold uppercase tracking-[0.15em] text-slate-400">
                                                            {STREAM_PHASE_LABELS[message.streamPhase]}
                                                        </span>
                                                    </div>
                                                )}

                                                {/* Model Annotation */}
                                                {message.ai_model && (
                                                    <div className="flex items-center justify-end mb-2">
                                                        <span className="px-2 py-0.5 bg-slate-100 border border-slate-200 rounded-md text-[9px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                                                            <Sparkles className="w-2.5 h-2.5 text-indigo-400" />
                                                            Modelo: {message.ai_model}
                                                        </span>
                                                    </div>
                                                )}

                                                {/* Respuesta conversacional con métricas inline */}
                                                {message.content && (
                                                    <div className="relative">
                                                        <InlineMarkdown
                                                            text={message.content}
                                                            className="text-[15px] leading-relaxed text-slate-700"
                                                        />
                                                        {message.streaming && (
                                                            <span className="inline-block w-1.5 h-4 ml-0.5 bg-indigo-500 align-middle animate-pulse" />
                                                        )}
                                                    </div>
                                                )}

                                                {/* Chips de acción contextuales — solo si NO es respuesta conversacional pura */}
                                                {!message.conversational && (
                                                    ((message.results && message.results.length > 0) ||
                                                        (message.key_insights && message.key_insights.length > 0) ||
                                                        (message.recommendations && message.recommendations.length > 0)) && (
                                                        <div className="mt-5 flex flex-wrap gap-2">
                                                            {message.results && message.results.length > 0 && !(message.results.length === 1 && Object.keys(message.results[0]).length === 1) && (
                                                                <button
                                                                    onClick={() => toggleData(index)}
                                                                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-bold rounded-full transition-all border bg-white border-slate-200 text-slate-700 hover:border-slate-300 hover:bg-slate-50 active:scale-95"
                                                                >
                                                                    <BarChart3 className="w-3.5 h-3.5 text-slate-500" />
                                                                    <span>{expandedData[index] ? 'Ocultar datos' : 'Ver datos'}</span>
                                                                    {expandedData[index] ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                                                                </button>
                                                            )}
                                                            {message.key_insights && message.key_insights.length > 0 && (
                                                                <button
                                                                    onClick={() => toggleInsights(index)}
                                                                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-bold rounded-full transition-all border bg-white border-indigo-200 text-indigo-700 hover:bg-indigo-50 active:scale-95"
                                                                >
                                                                    <Lightbulb className="w-3.5 h-3.5" />
                                                                    <span>Hallazgos</span>
                                                                    <span className="ml-0.5 px-1.5 bg-indigo-100 rounded-full text-[9px]">
                                                                        {message.key_insights.length}
                                                                    </span>
                                                                    {expandedInsights[index] ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                                                                </button>
                                                            )}
                                                            {message.recommendations && message.recommendations.length > 0 && (
                                                                <button
                                                                    onClick={() => toggleRecommendations(index)}
                                                                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-bold rounded-full transition-all border bg-white border-emerald-200 text-emerald-700 hover:bg-emerald-50 active:scale-95"
                                                                >
                                                                    <Target className="w-3.5 h-3.5" />
                                                                    <span>Acciones</span>
                                                                    <span className="ml-0.5 px-1.5 bg-emerald-100 rounded-full text-[9px]">
                                                                        {message.recommendations.length}
                                                                    </span>
                                                                    {expandedRecommendations[index] ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                                                                </button>
                                                            )}
                                                        </div>
                                                    )
                                                )}

                                                {/* Panel expandible: Datos crudos (tabla/gráfica/KPIs) */}
                                                {expandedData[index] && message.results && message.results.length > 0 && (
                                                    <div className="mt-4 animate-in fade-in slide-in-from-top-2 duration-300">
                                                        <AgentDataView
                                                            data={message.results}
                                                            suggestedViz={message.visualization as any}
                                                            question={messages[index - 1]?.content || ''}
                                                        />
                                                    </div>
                                                )}

                                                {/* Panel expandible: Hallazgos */}
                                                {expandedInsights[index] && message.key_insights && message.key_insights.length > 0 && (
                                                    <div className="mt-4 relative bg-indigo-50/50 border border-indigo-100 p-4 rounded-2xl animate-in fade-in slide-in-from-top-2 duration-300">
                                                        <div className="absolute left-0 top-3 bottom-3 w-1 bg-indigo-500 rounded-full" />
                                                        <ul className="space-y-2 pl-2">
                                                            {message.key_insights.map((insight, idx) => (
                                                                <li key={idx} className="text-[13px] text-slate-700 leading-snug flex items-start">
                                                                    <span className="inline-block w-1 h-1 bg-indigo-500 rounded-full mr-2.5 mt-2 flex-shrink-0" />
                                                                    <InlineMarkdown text={insight} className="flex-1" />
                                                                </li>
                                                            ))}
                                                        </ul>
                                                    </div>
                                                )}

                                                {/* Panel expandible: Recomendaciones */}
                                                {expandedRecommendations[index] && message.recommendations && message.recommendations.length > 0 && (
                                                    <div className="mt-4 relative bg-emerald-50/50 border border-emerald-100 p-4 rounded-2xl animate-in fade-in slide-in-from-top-2 duration-300">
                                                        <div className="absolute left-0 top-3 bottom-3 w-1 bg-emerald-500 rounded-full" />
                                                        <ul className="space-y-2 pl-2">
                                                            {message.recommendations.map((rec, idx) => (
                                                                <li key={idx} className="text-[13px] text-slate-700 leading-snug flex items-start">
                                                                    <span className="inline-block w-1 h-1 bg-emerald-500 rounded-full mr-2.5 mt-2 flex-shrink-0" />
                                                                    <InlineMarkdown text={rec} className="flex-1" />
                                                                </li>
                                                            ))}
                                                        </ul>
                                                    </div>
                                                )}
                                            </div>

                                            {/* Footer: reportes navegables + preguntas de continuación */}
                                            {((message.suggested_reports && message.suggested_reports.length > 0) ||
                                                (message.suggestedQuestions && message.suggestedQuestions.length > 0)) && (
                                                <div className="bg-slate-50/50 border-t border-slate-100 px-6 py-4 space-y-4">
                                                    {message.suggested_reports && message.suggested_reports.length > 0 && (
                                                        <div className="space-y-2">
                                                            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
                                                                Reportes relacionados
                                                            </span>
                                                            <div className="flex flex-wrap gap-2">
                                                                {message.suggested_reports.map((report, idx) => (
                                                                    <button
                                                                        key={idx}
                                                                        onClick={() => navigateToReport(report.path)}
                                                                        disabled={!report.path}
                                                                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-bold rounded-full transition-all border bg-white border-slate-200 text-slate-700 hover:border-indigo-300 hover:text-indigo-700 hover:bg-indigo-50 disabled:opacity-50 disabled:cursor-not-allowed active:scale-95"
                                                                        title={report.reason}
                                                                    >
                                                                        <span>{report.report_name}</span>
                                                                        {report.path && <ExternalLink className="w-3 h-3" />}
                                                                    </button>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    )}

                                                    {message.suggestedQuestions && message.suggestedQuestions.length > 0 && (
                                                        <div className="space-y-2">
                                                            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
                                                                Continuar
                                                            </span>
                                                            <div className="flex flex-wrap gap-2">
                                                                {message.suggestedQuestions.map((q, i) => (
                                                                    <button
                                                                        key={i}
                                                                        onClick={() => handleSend(q)}
                                                                        className="px-3 py-1.5 text-[11px] font-bold text-slate-700 bg-white hover:bg-slate-900 hover:text-white rounded-full transition-all border border-slate-200 hover:border-slate-900 active:scale-95"
                                                                    >
                                                                        {q}
                                                                    </button>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            )}
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

                        {/* Loader global: solo si NO hay un mensaje en streaming (que ya muestra el suyo) */}
                        {loading && !messages.some(m => m.streaming) && (
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
