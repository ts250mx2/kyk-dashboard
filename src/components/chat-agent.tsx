"use client";

import { useState, useRef, useEffect, useCallback } from 'react';
import { ChatInput } from '@/components/chat-input';
import { AgentDataView } from '@/components/agent-data-view';
import { InlineMarkdown } from '@/components/inline-markdown';
import { ConversationsDropdown } from '@/components/conversations-dropdown';
import { AlertsPanel, CreateAlertDraft } from '@/components/alerts-panel';
import { ShareMenu } from '@/components/share-menu';
import { PlaybooksPanel, PlaybookSummary } from '@/components/playbooks-panel';
import { ProactivePromptsBanner } from '@/components/proactive-prompts-banner';
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
    BarChart3,
    Copy,
    Check,
    RotateCw,
    ThumbsUp,
    ThumbsDown
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
    streamPhase?: 'thinking' | 'querying' | 'correcting-sql' | 'investigating' | 'reasoning-causal' | 'analyzing' | 'finalizing';
    streamPhaseDetail?: string;
    awaitingMetadata?: boolean;
    // Feedback
    messageId?: string;
    feedbackRating?: 'up' | 'down' | null;
}

const STREAM_PHASE_LABELS: Record<NonNullable<Message['streamPhase']>, string> = {
    'thinking': 'Pensando...',
    'querying': 'Consultando datos...',
    'correcting-sql': 'Ajustando consulta...',
    'investigating': 'Investigando causa...',
    'reasoning-causal': 'Evaluando hipótesis...',
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

/** Modelos seleccionables en Kesito. El backend respeta los Claude permitidos
 *  y cae a GPT-4o para cualquier otro. Se persiste en localStorage 'ai_query_model'. */
const CHAT_MODELS = [
    { id: 'claude-fable-5', label: 'Fable 5' },
    { id: 'claude-opus-4-8', label: 'Opus 4.8' },
    { id: 'claude-sonnet-4-6', label: 'Sonnet 4.6' },
    { id: 'gpt-4o', label: 'GPT-4o' },
];
const DEFAULT_CHAT_MODEL = 'claude-opus-4-8';

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
    const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
    const [conversationsRefreshKey, setConversationsRefreshKey] = useState(0);
    const [chatModel, setChatModel] = useState(DEFAULT_CHAT_MODEL);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const streamControllerRef = useRef<AbortController | null>(null);
    const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    /** Genera un ID de conversación nuevo (UUID v4 simplificado) */
    const generateConversationId = (): string => {
        return 'conv_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 10);
    };

    /** Guarda la conversación actual en el backend (debounced) */
    const saveCurrentConversation = useCallback((msgs: Message[], idOverride?: string) => {
        if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
        const userMessages = msgs.filter(m => m.role === 'user');
        if (userMessages.length === 0) return; // nada que guardar

        saveTimerRef.current = setTimeout(async () => {
            try {
                let convId = idOverride || activeConversationId;
                if (!convId) {
                    convId = generateConversationId();
                    setActiveConversationId(convId);
                }
                const r = await fetch('/api/agent/conversations', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ id: convId, messages: msgs })
                });
                if (r.ok) {
                    setConversationsRefreshKey(k => k + 1);
                }
            } catch (e) {
                console.error('Error guardando conversación:', e);
            }
        }, 800);
    }, [activeConversationId]);

    /** Carga una conversación existente desde el backend */
    const loadConversation = useCallback(async (id: string) => {
        if (streamControllerRef.current) {
            streamControllerRef.current.abort();
            streamControllerRef.current = null;
        }
        try {
            const r = await fetch(`/api/agent/conversations/${id}`);
            const data = await r.json();
            if (data.conversation) {
                setMessages(data.conversation.messages || []);
                setActiveConversationId(id);
                setExpandedInsights({});
                setExpandedRecommendations({});
                setExpandedData({});
            }
        } catch (e) {
            console.error('Error cargando conversación:', e);
        }
    }, []);

    /** Inicia una conversación nueva (limpia el estado) */
    const startNewConversation = useCallback(() => {
        if (streamControllerRef.current) {
            streamControllerRef.current.abort();
            streamControllerRef.current = null;
        }
        setMessages([]);
        setActiveConversationId(null);
        setExpandedInsights({});
        setExpandedRecommendations({});
        setExpandedData({});
        localStorage.removeItem('kyk_integrated_chat_history');
    }, []);

    /** Estado para el feedback visual "Copiado!" en la toolbar de mensajes */
    const [copiedMessageIdx, setCopiedMessageIdx] = useState<number | null>(null);

    /** Copia el contenido de un mensaje del asistente al clipboard */
    const handleCopyMessage = async (index: number) => {
        const msg = messages[index];
        if (!msg?.content) return;
        try {
            // Strip de markdown básico para copiar texto limpio
            const plain = msg.content.replace(/\*\*(.+?)\*\*/g, '$1').replace(/\*(.+?)\*/g, '$1');
            await navigator.clipboard.writeText(plain);
            setCopiedMessageIdx(index);
            setTimeout(() => setCopiedMessageIdx(null), 1500);
        } catch (e) {
            console.error('Clipboard error:', e);
        }
    };

    /**
     * Envía feedback (👍/👎) sobre una respuesta del agente. Si es 👎 pide razón.
     * Se guarda con el prompt original y el SQL para análisis posterior.
     */
    const [feedbackReasonFor, setFeedbackReasonFor] = useState<number | null>(null);
    const [feedbackReason, setFeedbackReason] = useState('');

    const handleFeedback = async (index: number, rating: 'up' | 'down', reason?: string) => {
        const msg = messages[index];
        if (!msg || msg.role !== 'assistant' || !msg.messageId) return;

        // Si ya tiene el mismo rating, toggle (lo quitamos del UI; el backend guarda historial)
        const isToggleOff = msg.feedbackRating === rating;
        const userPrev = index > 0 ? messages[index - 1] : null;
        const promptText = userPrev?.role === 'user' ? userPrev.content : null;

        setMessages(prev => prev.map((m, i) => i === index ? { ...m, feedbackRating: isToggleOff ? null : rating } : m));

        if (isToggleOff) return;

        try {
            await fetch('/api/agent/feedback', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    messageId: msg.messageId,
                    conversationId: activeConversationId,
                    rating,
                    reason: reason || null,
                    prompt: promptText,
                    response: msg.content,
                    sql: msg.sql || null,
                    aiModel: msg.ai_model || null
                })
            });
        } catch (e) {
            console.error('Feedback error:', e);
        }
    };

    const submitFeedbackReason = async () => {
        if (feedbackReasonFor == null) return;
        await handleFeedback(feedbackReasonFor, 'down', feedbackReason.trim() || undefined);
        setFeedbackReasonFor(null);
        setFeedbackReason('');
    };

    /**
     * Regenera la respuesta del asistente para el índice dado.
     * Elimina el mensaje actual del asistente y vuelve a enviar el último user.
     */
    const handleRegenerate = async (assistantIndex: number) => {
        if (assistantIndex <= 0) return;
        const userMsg = messages[assistantIndex - 1];
        if (userMsg?.role !== 'user') return;
        // Removemos el mensaje del asistente y todos los siguientes
        setMessages(prev => prev.slice(0, assistantIndex));
        // Pequeño delay para que el state se propague antes del nuevo send
        setTimeout(() => handleSend(userMsg.content), 50);
    };

    /**
     * Ejecuta un playbook: lanza cada paso en secuencia como si el usuario
     * los hubiera escrito uno tras otro. Espera a que termine el streaming
     * antes de mandar el siguiente.
     */
    const handleRunPlaybook = (pb: PlaybookSummary) => {
        // Iniciamos conversación nueva con un header del playbook
        startNewConversation();
        setIsOpen(true);
        // Pequeño delay para que el reset de estado se propague
        setTimeout(async () => {
            for (const step of pb.steps) {
                if (!step.prompt?.trim()) continue;
                // Esperar a que termine cualquier stream previo
                while (streamControllerRef.current) {
                    await new Promise(r => setTimeout(r, 200));
                }
                await handleSend(step.prompt);
            }
        }, 100);
    };

    /**
     * Escucha el evento global `kesito:ask` (despachado desde otros componentes
     * como DashboardCommandBar cuando una pregunta es analítica y no se puede
     * traducir a un filtro). Abre el chat y envía la pregunta automáticamente.
     */
    useEffect(() => {
        const handler = (e: Event) => {
            const detail = (e as CustomEvent).detail;
            const prompt = detail?.prompt;
            if (typeof prompt !== 'string' || !prompt.trim()) return;
            setIsOpen(true);
            setTimeout(async () => {
                // Esperar a que termine cualquier stream previo
                while (streamControllerRef.current) {
                    await new Promise(r => setTimeout(r, 200));
                }
                await handleSend(prompt);
            }, 100);
        };
        window.addEventListener('kesito:ask', handler);
        return () => window.removeEventListener('kesito:ask', handler);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

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

    // Cuando hay insights del día Y el chat está abierto, intentamos generar
    // prompts proactivos (el endpoint los rate-limita a 3/día por usuario)
    useEffect(() => {
        if (!isOpen || dailyInsights.length === 0) return;
        const generatedKey = `kyk_proactive_generated_${new Date().toLocaleDateString('es-MX')}`;
        if (localStorage.getItem(generatedKey)) return;

        fetch('/api/agent/proactive-prompts', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'generate', insights: dailyInsights })
        })
            .then(() => localStorage.setItem(generatedKey, '1'))
            .catch(err => console.error('Error generando prompts proactivos:', err));
    }, [isOpen, dailyInsights]);

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

        const savedModel = localStorage.getItem('ai_query_model');
        if (savedModel && CHAT_MODELS.some(m => m.id === savedModel)) {
            setChatModel(savedModel);
        }

        setIsHistoryLoaded(true);
    }, []);

    useEffect(() => {
        if (isHistoryLoaded) {
            localStorage.setItem('kyk_integrated_chat_history', JSON.stringify(messages));
            // Auto-save remoto: solo si hay mensajes completos (no en medio del streaming)
            const lastMsg = messages[messages.length - 1];
            const hasPendingStream = lastMsg?.streaming;
            if (messages.length > 0 && !hasPendingStream) {
                saveCurrentConversation(messages);
            }
        }
        scrollToBottom();
    }, [messages, isHistoryLoaded, saveCurrentConversation]);

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

        const selectedModel = typeof window !== 'undefined' ? localStorage.getItem('ai_query_model') || 'claude-opus-4-8' : 'claude-opus-4-8';
        const useStreaming = selectedModel.includes('claude');

        // Aborta cualquier stream previo
        if (streamControllerRef.current) {
            streamControllerRef.current.abort();
        }
        const controller = new AbortController();
        streamControllerRef.current = controller;

        // Crea el mensaje del asistente vacío que iremos llenando
        const assistantTimestamp = Date.now();
        const assistantMessageId = 'msg_' + assistantTimestamp.toString(36) + '_' + Math.random().toString(36).slice(2, 8);
        let assistantIndex = -1;
        setMessages((prev) => {
            assistantIndex = prev.length;
            return [...prev, {
                role: 'assistant',
                content: '',
                timestamp: assistantTimestamp,
                streaming: useStreaming,
                streamPhase: useStreaming ? 'thinking' : undefined,
                ai_model: selectedModel,
                messageId: assistantMessageId
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
                            const detail = evt.data?.detail as string | undefined;
                            if (phase) updateAssistant({ streamPhase: phase, streamPhaseDetail: detail });
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
        startNewConversation();
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
                    <div className="px-5 py-3.5 bg-white border-b border-slate-100 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="relative w-11 h-11 bg-white rounded-2xl flex items-center justify-center overflow-hidden">
                                <img src="/kesito.svg" alt="Kesito" className="w-9 h-9 object-contain" />
                                <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-emerald-500 border-2 border-white rounded-full" />
                            </div>
                            <div className="leading-tight">
                                <h3 className="text-[15px] font-bold text-slate-900 tracking-tight">Kesito</h3>
                                <p className="text-[11px] text-slate-500 font-medium mt-0.5">
                                    Tu analista digital · Disponible
                                </p>
                            </div>
                        </div>
                        <div className="flex items-center gap-0.5">
                            <select
                                value={chatModel}
                                onChange={(e) => {
                                    const v = e.target.value;
                                    setChatModel(v);
                                    try { localStorage.setItem('ai_query_model', v); } catch { }
                                }}
                                title="Modelo de IA que responde"
                                className="mr-0.5 text-[11px] font-semibold text-slate-600 bg-slate-50 border border-slate-200 rounded-lg px-2 py-1.5 outline-none hover:bg-slate-100 focus:border-indigo-300 cursor-pointer"
                            >
                                {CHAT_MODELS.map(m => (
                                    <option key={m.id} value={m.id}>{m.label}</option>
                                ))}
                            </select>
                            <AlertsPanel
                                compact
                                onCreateFromChat={() => {
                                    // Si el último mensaje del asistente tiene SQL, lo proponemos como base
                                    const lastAssistant = [...messages].reverse().find(m => m.role === 'assistant' && m.sql);
                                    if (!lastAssistant?.sql) return null;
                                    const lastUser = [...messages].reverse().find(m => m.role === 'user');
                                    const draft: CreateAlertDraft = {
                                        name: lastUser?.content?.slice(0, 80) || 'Alerta desde chat',
                                        sql: lastAssistant.sql,
                                        conditionType: 'gt',
                                        conditionValue: 0,
                                        frequency: 'hourly'
                                    };
                                    return draft;
                                }}
                            />
                            <PlaybooksPanel
                                compact
                                getCurrentChatPrompts={() =>
                                    messages.filter(m => m.role === 'user' && m.content.trim()).map(m => m.content)
                                }
                                onRunPlaybook={(pb: PlaybookSummary) => handleRunPlaybook(pb)}
                            />
                            <ConversationsDropdown
                                compact
                                activeId={activeConversationId}
                                onSelect={loadConversation}
                                onNew={startNewConversation}
                                refreshKey={conversationsRefreshKey}
                            />
                            <div className="w-px h-5 bg-slate-200 mx-0.5" />
                            <button onClick={handleClear} className="p-2 hover:bg-slate-100 rounded-lg transition-colors text-slate-400" title="Nueva conversación">
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
                                    <div className="bg-white rounded-2xl border border-slate-200/70 overflow-hidden mb-6">
                                        <div className="px-5 pt-4 pb-2 flex items-center gap-2">
                                            <div className="w-6 h-6 rounded-lg bg-indigo-50 flex items-center justify-center">
                                                <Sparkles className="w-3.5 h-3.5 text-indigo-500" />
                                            </div>
                                            <span className="text-[12px] font-semibold text-slate-700">Briefing del día</span>
                                            <span className="ml-auto text-[11px] text-slate-400 font-medium">
                                                {new Date().toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long' })}
                                            </span>
                                        </div>
                                        <div className="px-5 pb-5">
                                            <InlineMarkdown
                                                text={briefing}
                                                className="text-[14.5px] leading-relaxed text-slate-700"
                                            />
                                        </div>
                                    </div>
                                ) : (
                                    <div className="flex flex-col items-center text-center mb-6 py-8">
                                        <div className={cn(
                                            "p-5 bg-white rounded-3xl border border-slate-100 mb-4 transition-transform",
                                            loadingInsights ? "animate-pulse" : "hover:scale-105"
                                        )}>
                                            <img src="/kesito.svg" alt="Kesito" className="w-14 h-14 object-contain" />
                                        </div>
                                        <h2 className="text-xl font-bold tracking-tight text-slate-900">
                                            {loadingInsights ? 'Preparando tu briefing…' : '¡Hola! Soy Kesito'}
                                        </h2>
                                        <p className="text-slate-500 max-w-sm font-normal mt-1.5 text-[13.5px] leading-relaxed">
                                            {loadingInsights
                                                ? 'Analizando los datos del día para tu resumen ejecutivo.'
                                                : 'Tu analista digital. Pregúntame lo que necesites del negocio.'}
                                        </p>
                                    </div>
                                )}

                                {/* Pregunta inversa: prompts proactivos del agente */}
                                <div className="mb-4">
                                    <ProactivePromptsBanner
                                        onInvestigate={(action) => handleSend(action)}
                                    />
                                </div>

                                {/* 6 Hallazgos del día como preguntas */}
                                {dailyInsights.length > 0 && (
                                    <div className="space-y-2.5">
                                        <div className="flex items-center justify-between px-1">
                                            <span className="text-[12px] font-semibold text-slate-600">
                                                Hallazgos del día
                                                <span className="text-slate-400 font-normal ml-1">· {dailyInsights.length}</span>
                                            </span>
                                            <button
                                                onClick={() => fetchDailyInsights(true)}
                                                disabled={loadingInsights}
                                                className="flex items-center gap-1 text-[11px] font-medium text-slate-500 hover:text-indigo-600 transition-colors disabled:opacity-50 px-2 py-1 rounded-md hover:bg-slate-100"
                                                title="Actualizar hallazgos"
                                            >
                                                <RefreshCw className={cn("w-3 h-3", loadingInsights && "animate-spin")} />
                                                Actualizar
                                            </button>
                                        </div>
                                        <div className="grid grid-cols-1 gap-1.5">
                                            {dailyInsights.slice(0, 6).map((insight, i) => {
                                                const sev = SEVERITY_STYLES[insight.severity];
                                                const SevIcon = sev.icon;
                                                return (
                                                    <button
                                                        key={insight.id || i}
                                                        onClick={() => handleSend(insight.question)}
                                                        className="group relative flex items-start gap-3 p-3.5 text-left bg-white border border-slate-200/70 rounded-xl hover:border-indigo-300 hover:bg-indigo-50/30 transition-all animate-in fade-in slide-in-from-left-1 duration-300"
                                                        style={{ animationDelay: `${i * 40}ms` }}
                                                    >
                                                        <div className={cn("absolute left-0 top-3 bottom-3 w-0.5 rounded-full", sev.bar)} />
                                                        <div className="pl-2 flex items-start gap-2.5 flex-1 min-w-0">
                                                            <SevIcon className={cn(
                                                                "w-4 h-4 mt-0.5 flex-shrink-0",
                                                                insight.severity === 'critical' && 'text-rose-500',
                                                                insight.severity === 'opportunity' && 'text-emerald-500',
                                                                insight.severity === 'info' && 'text-indigo-400'
                                                            )} />
                                                            <div className="flex-1 min-w-0">
                                                                <p className="text-[13.5px] font-semibold text-slate-800 group-hover:text-indigo-700 leading-snug">
                                                                    {insight.question}
                                                                </p>
                                                                {insight.summary && (
                                                                    <p className="text-[11.5px] text-slate-500 mt-0.5 leading-snug line-clamp-2">
                                                                        {insight.summary}
                                                                    </p>
                                                                )}
                                                                <div className="flex items-center gap-1.5 mt-1.5">
                                                                    <span className="text-[10px] font-medium text-slate-500 capitalize">
                                                                        {insight.area}
                                                                    </span>
                                                                    <span className="text-[10px] text-slate-300">·</span>
                                                                    <span className="text-[10px] font-medium text-slate-500">
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
                                    <div className="space-y-2.5">
                                        <span className="text-[12px] font-semibold text-slate-600 px-1">
                                            Para empezar
                                        </span>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                            {defaultSuggestions.slice(0, 6).map((s, i) => (
                                                <button
                                                    key={i}
                                                    onClick={() => handleSend(s)}
                                                    className="p-3.5 text-left bg-white border border-slate-200/70 rounded-xl hover:border-indigo-300 hover:bg-indigo-50/30 transition-all animate-in fade-in duration-300"
                                                    style={{ animationDelay: `${i * 40}ms` }}
                                                >
                                                    <p className="text-[13.5px] font-medium text-slate-700 leading-snug">{s}</p>
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}

                        {messages.map((message, index) => (
                            <div key={index} className={cn("group/msg flex flex-col animate-in fade-in slide-in-from-bottom-2 duration-300", message.role === 'user' ? "items-end" : "items-start")}>
                                <div className={cn(
                                    "flex items-start gap-2.5 max-w-[90%]",
                                    message.role === 'user' ? "flex-row-reverse" : "flex-row"
                                )}>
                                    {/* Avatar (solo en mensajes del asistente) */}
                                    {message.role === 'assistant' && (
                                        <div className="flex-shrink-0 w-8 h-8 rounded-xl bg-white border border-slate-200/70 flex items-center justify-center overflow-hidden mt-0.5">
                                            <img src="/kesito.svg" alt="Kesito" className="w-6 h-6 object-contain" />
                                        </div>
                                    )}
                                <div className={cn(
                                    "overflow-hidden flex-1 min-w-0",
                                    message.role === 'user'
                                        ? "bg-indigo-50 border border-indigo-100 text-slate-800 rounded-2xl rounded-tr-md px-5 py-3"
                                        : "bg-white border border-slate-200/70 rounded-2xl rounded-tl-md"
                                )}>
                                    {message.role === 'assistant' ? (
                                        <div className="flex flex-col">
                                            {/* Contenido principal del mensaje */}
                                            <div className="px-6 py-5">
                                                {/* Indicador de fase streaming (antes de que llegue texto) */}
                                                {message.streaming && message.streamPhase && !message.content && (
                                                    <div className="flex flex-col gap-1 animate-in fade-in duration-200">
                                                        <div className="flex items-center gap-2 text-slate-500">
                                                            <div className="flex space-x-1">
                                                                <div className={cn(
                                                                    "w-1.5 h-1.5 rounded-full animate-bounce [animation-delay:-0.3s]",
                                                                    message.streamPhase === 'investigating' ? 'bg-amber-500'
                                                                        : message.streamPhase === 'reasoning-causal' ? 'bg-violet-500'
                                                                        : 'bg-indigo-500'
                                                                )} />
                                                                <div className={cn(
                                                                    "w-1.5 h-1.5 rounded-full animate-bounce [animation-delay:-0.15s]",
                                                                    message.streamPhase === 'investigating' ? 'bg-amber-500'
                                                                        : message.streamPhase === 'reasoning-causal' ? 'bg-violet-500'
                                                                        : 'bg-indigo-500'
                                                                )} />
                                                                <div className={cn(
                                                                    "w-1.5 h-1.5 rounded-full animate-bounce",
                                                                    message.streamPhase === 'investigating' ? 'bg-amber-500'
                                                                        : message.streamPhase === 'reasoning-causal' ? 'bg-violet-500'
                                                                        : 'bg-indigo-500'
                                                                )} />
                                                            </div>
                                                            <span className={cn(
                                                                "text-[11px] font-bold uppercase tracking-[0.15em]",
                                                                message.streamPhase === 'investigating' ? 'text-amber-600'
                                                                    : message.streamPhase === 'reasoning-causal' ? 'text-violet-600'
                                                                    : 'text-slate-400'
                                                            )}>
                                                                {STREAM_PHASE_LABELS[message.streamPhase]}
                                                            </span>
                                                        </div>
                                                        {message.streamPhaseDetail && (
                                                            <p className="text-[12px] text-slate-500 italic pl-5 mt-1 leading-snug">
                                                                {message.streamPhaseDetail}
                                                            </p>
                                                        )}
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

                                                {/* Respuesta conversacional con métricas inline (cifras citables) */}
                                                {message.content && (
                                                    <div className="relative">
                                                        <InlineMarkdown
                                                            text={message.content}
                                                            className="text-[15px] leading-relaxed text-slate-700"
                                                            onCite={
                                                                message.results && message.results.length > 0
                                                                    ? () => {
                                                                        setExpandedData(prev => ({ ...prev, [index]: true }));
                                                                        setTimeout(() => {
                                                                            const el = document.getElementById(`agent-data-${index}`);
                                                                            el?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                                                                        }, 100);
                                                                    }
                                                                    : undefined
                                                            }
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
                                                            {/* Compartir / Exportar */}
                                                            {!message.streaming && (
                                                                <ShareMenu
                                                                    variant="pill"
                                                                    payload={{
                                                                        question: messages[index - 1]?.content || '',
                                                                        analysis: message.content || '',
                                                                        keyInsights: message.key_insights,
                                                                        recommendations: message.recommendations,
                                                                        data: message.results,
                                                                        sql: message.sql,
                                                                        aiModel: message.ai_model,
                                                                        suggestedReports: message.suggested_reports?.map(r => ({
                                                                            report_name: r.report_name,
                                                                            reason: r.reason
                                                                        }))
                                                                    }}
                                                                />
                                                            )}
                                                        </div>
                                                    )
                                                )}

                                                {/* Panel expandible: Datos crudos (tabla/gráfica/KPIs) */}
                                                {expandedData[index] && message.results && message.results.length > 0 && (
                                                    <div
                                                        id={`agent-data-${index}`}
                                                        className="mt-4 animate-in fade-in slide-in-from-top-2 duration-300 scroll-mt-4"
                                                    >
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
                                                            <span className="text-[11px] font-semibold text-slate-500">
                                                                Reportes relacionados
                                                            </span>
                                                            <div className="flex flex-wrap gap-2">
                                                                {message.suggested_reports.map((report, idx) => (
                                                                    <button
                                                                        key={idx}
                                                                        onClick={() => navigateToReport(report.path)}
                                                                        disabled={!report.path}
                                                                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-medium rounded-full transition-all border bg-white border-slate-200 text-slate-700 hover:border-indigo-300 hover:text-indigo-700 hover:bg-indigo-50 disabled:opacity-50 disabled:cursor-not-allowed active:scale-95"
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
                                                            <span className="text-[11px] font-semibold text-slate-500">
                                                                Preguntas relacionadas
                                                            </span>
                                                            <div className="flex flex-wrap gap-2">
                                                                {message.suggestedQuestions.map((q, i) => (
                                                                    <button
                                                                        key={i}
                                                                        onClick={() => handleSend(q)}
                                                                        className="px-3 py-1.5 text-[12px] font-medium text-slate-700 bg-white hover:bg-indigo-50 hover:text-indigo-700 hover:border-indigo-200 rounded-full transition-all border border-slate-200 active:scale-95"
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
                                        <p className="text-[14.5px] font-medium leading-relaxed whitespace-pre-wrap text-slate-800">{message.content}</p>
                                    )}
                                </div>
                                </div>

                                {/* Toolbar al hover sobre mensajes del asistente (Copy + Regenerate + Feedback) */}
                                {message.role === 'assistant' && !message.streaming && message.content && (
                                    <div className="opacity-0 group-hover/msg:opacity-100 transition-opacity flex items-center gap-1 mt-1.5 ml-[42px]">
                                        <button
                                            onClick={() => handleCopyMessage(index)}
                                            className="inline-flex items-center gap-1 px-2 py-1 text-[10.5px] font-medium text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-md transition-colors"
                                            title="Copiar respuesta"
                                        >
                                            {copiedMessageIdx === index ? (
                                                <>
                                                    <Check className="w-3 h-3 text-emerald-600" />
                                                    <span className="text-emerald-600">Copiado</span>
                                                </>
                                            ) : (
                                                <>
                                                    <Copy className="w-3 h-3" />
                                                    <span>Copiar</span>
                                                </>
                                            )}
                                        </button>
                                        {index === messages.length - 1 && (
                                            <button
                                                onClick={() => handleRegenerate(index)}
                                                className="inline-flex items-center gap-1 px-2 py-1 text-[10.5px] font-medium text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-md transition-colors"
                                                title="Regenerar respuesta"
                                            >
                                                <RotateCw className="w-3 h-3" />
                                                <span>Regenerar</span>
                                            </button>
                                        )}
                                        <button
                                            onClick={() => handleFeedback(index, 'up')}
                                            className={cn(
                                                "inline-flex items-center gap-1 px-2 py-1 text-[10.5px] font-medium rounded-md transition-colors",
                                                message.feedbackRating === 'up'
                                                    ? "bg-emerald-50 text-emerald-700"
                                                    : "text-slate-500 hover:text-emerald-700 hover:bg-emerald-50"
                                            )}
                                            title="Buena respuesta"
                                        >
                                            <ThumbsUp className={cn("w-3 h-3", message.feedbackRating === 'up' && "fill-emerald-600")} />
                                        </button>
                                        <button
                                            onClick={() => setFeedbackReasonFor(index)}
                                            className={cn(
                                                "inline-flex items-center gap-1 px-2 py-1 text-[10.5px] font-medium rounded-md transition-colors",
                                                message.feedbackRating === 'down'
                                                    ? "bg-rose-50 text-rose-700"
                                                    : "text-slate-500 hover:text-rose-700 hover:bg-rose-50"
                                            )}
                                            title="Necesita mejorar"
                                        >
                                            <ThumbsDown className={cn("w-3 h-3", message.feedbackRating === 'down' && "fill-rose-600")} />
                                        </button>
                                        <span className="text-[10px] text-slate-300 ml-auto px-1 tabular-nums">
                                            {new Date(message.timestamp || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                        </span>
                                    </div>
                                )}

                                {/* Dialog de razón para 👎 */}
                                {feedbackReasonFor === index && (
                                    <div className="ml-[42px] mt-2 p-3 bg-rose-50 border border-rose-200 rounded-lg max-w-md">
                                        <p className="text-[11px] font-bold text-rose-800 mb-2">¿Qué falló? (opcional)</p>
                                        <textarea
                                            value={feedbackReason}
                                            onChange={e => setFeedbackReason(e.target.value)}
                                            placeholder="Ej: las cifras no coinciden, faltó contexto, periodo equivocado..."
                                            className="w-full bg-white border border-rose-200 px-2 py-1.5 text-xs text-slate-700 outline-none focus:border-rose-400 rounded-md resize-none"
                                            rows={2}
                                            autoFocus
                                        />
                                        <div className="flex gap-2 mt-2">
                                            <button
                                                onClick={submitFeedbackReason}
                                                className="px-3 py-1 bg-rose-600 hover:bg-rose-700 text-white text-[10px] font-black uppercase tracking-wider rounded-md"
                                            >
                                                Enviar
                                            </button>
                                            <button
                                                onClick={() => { setFeedbackReasonFor(null); setFeedbackReason(''); }}
                                                className="px-3 py-1 text-slate-500 hover:text-slate-700 text-[10px] font-black uppercase tracking-wider"
                                            >
                                                Cancelar
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        ))}

                        {/* Loader global: solo si NO hay un mensaje en streaming (que ya muestra el suyo) */}
                        {loading && !messages.some(m => m.streaming) && (
                            <div className="flex items-start animate-in fade-in duration-300">
                                <div className="px-4 py-3 bg-white border border-slate-200/70 rounded-2xl rounded-tl-md flex items-center gap-3">
                                    <div className="flex gap-1">
                                        <div className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-bounce [animation-delay:-0.3s]" />
                                        <div className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-bounce [animation-delay:-0.15s]" />
                                        <div className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-bounce" />
                                    </div>
                                    <span className="text-[12px] font-medium text-slate-500">Analizando…</span>
                                </div>
                            </div>
                        )}
                        <div ref={messagesEndRef} />
                    </div>

                    {/* Footer / Input Area */}
                    <div className="px-5 pt-3 pb-4 bg-white border-t border-slate-100">
                        <ChatInput
                            onSend={handleSend}
                            isLoading={loading}
                        />
                    </div>
                </div>
            )}
        </div>
    );
}
