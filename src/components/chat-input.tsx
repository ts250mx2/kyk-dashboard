'use client';

import { useState, useEffect, useRef } from 'react';
import { Send, Loader2, Mic, MicOff, Sparkles, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useVoiceRecognition } from '@/hooks/use-voice-recognition';

interface ChatInputProps {
    onSend: (message: string) => void;
    isLoading: boolean;
}

interface SimilarHit {
    id: string;
    prompt: string;
    response: string;
    sql: string | null;
    createdAt: string;
    similarity: number;
}

export function ChatInput({ onSend, isLoading }: ChatInputProps) {
    const [input, setInput] = useState('');
    const { isListening, transcript, startListening, stopListening, error } = useVoiceRecognition();

    // Memoria semántica: buscar preguntas similares previas
    const [similarHits, setSimilarHits] = useState<SimilarHit[]>([]);
    const [showSimilar, setShowSimilar] = useState(false);
    const debounceRef = useRef<NodeJS.Timeout | null>(null);

    useEffect(() => {
        if (transcript) {
            setInput(transcript);
        }
    }, [transcript]);

    // Debounced search de memoria semántica (800ms tras dejar de teclear)
    useEffect(() => {
        if (debounceRef.current) clearTimeout(debounceRef.current);
        if (input.trim().length < 8) {
            setSimilarHits([]);
            setShowSimilar(false);
            return;
        }
        debounceRef.current = setTimeout(async () => {
            try {
                const res = await fetch(`/api/agent/similar?q=${encodeURIComponent(input.trim())}`);
                const json = await res.json();
                if (Array.isArray(json.hits) && json.hits.length > 0) {
                    setSimilarHits(json.hits);
                    setShowSimilar(true);
                } else {
                    setSimilarHits([]);
                    setShowSimilar(false);
                }
            } catch {
                // silent
            }
        }, 800);
        return () => {
            if (debounceRef.current) clearTimeout(debounceRef.current);
        };
    }, [input]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (input.trim() && !isLoading) {
            onSend(input);
            setInput('');
            setSimilarHits([]);
            setShowSimilar(false);
            if (isListening) stopListening();
        }
    };

    const usePreviousQuestion = (prompt: string) => {
        setInput(prompt);
        setShowSimilar(false);
        setSimilarHits([]);
    };

    const toggleListening = () => {
        if (isListening) {
            stopListening();
        } else {
            startListening();
        }
    };

    const charCount = input.length;
    const isLong = charCount > 500;

    return (
        <div className="flex flex-col gap-1.5 w-full max-w-4xl mx-auto">
            {error && (
                <p className="text-[11px] text-rose-600 font-medium px-2">{error}</p>
            )}

            {/* Sugerencias de memoria semántica */}
            {showSimilar && similarHits.length > 0 && (
                <div className="bg-gradient-to-br from-indigo-50/80 to-white border border-indigo-200/60 rounded-xl p-3 shadow-sm animate-in fade-in slide-in-from-bottom-2 duration-200">
                    <div className="flex items-center justify-between mb-2">
                        <p className="text-[10px] font-black uppercase tracking-widest text-indigo-700 flex items-center gap-1.5">
                            <Sparkles className="w-3 h-3" />
                            Ya respondí preguntas similares ({similarHits.length})
                        </p>
                        <button
                            type="button"
                            onClick={() => setShowSimilar(false)}
                            className="text-[10px] font-bold text-slate-400 hover:text-slate-600"
                        >
                            ocultar
                        </button>
                    </div>
                    <div className="space-y-1.5">
                        {similarHits.map(hit => (
                            <button
                                key={hit.id}
                                type="button"
                                onClick={() => usePreviousQuestion(hit.prompt)}
                                className="w-full text-left bg-white border border-indigo-100 hover:border-indigo-300 hover:bg-indigo-50/50 px-3 py-2 rounded-lg transition-all group"
                                title="Reusar esta pregunta"
                            >
                                <div className="flex items-center justify-between gap-2">
                                    <p className="text-[12px] font-bold text-slate-700 truncate flex-1 group-hover:text-indigo-700">
                                        {hit.prompt}
                                    </p>
                                    <span className="text-[9px] font-black text-indigo-500 bg-indigo-50 px-1.5 py-0.5 rounded shrink-0">
                                        {Math.round(hit.similarity * 100)}%
                                    </span>
                                </div>
                                <p className="text-[10px] text-slate-400 flex items-center gap-1 mt-0.5">
                                    <Clock className="w-2.5 h-2.5" />
                                    {new Date(hit.createdAt).toLocaleString('es-MX', { dateStyle: 'short', timeStyle: 'short' })}
                                </p>
                            </button>
                        ))}
                    </div>
                </div>
            )}

            <form onSubmit={handleSubmit} className="flex-1 flex gap-2 items-end">
                <div className={cn(
                    "relative flex-1 bg-white border rounded-2xl transition-all overflow-hidden",
                    isListening ? "border-rose-300 ring-2 ring-rose-100" :
                    "border-slate-200 focus-within:border-indigo-400 focus-within:ring-2 focus-within:ring-indigo-100",
                    isLoading && "opacity-60"
                )}>
                    <textarea
                        rows={1}
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter' && !e.shiftKey) {
                                e.preventDefault();
                                handleSubmit(e);
                            }
                        }}
                        placeholder={isListening ? "Escuchando…" : "Escribe tu pregunta o pide un análisis…"}
                        className={cn(
                            "w-full px-4 py-3 pr-12 text-[14.5px] bg-transparent",
                            "focus:outline-none",
                            "placeholder:text-slate-400 text-slate-800",
                            "resize-none min-h-[48px] max-h-[180px] overflow-y-auto font-medium leading-relaxed"
                        )}
                        disabled={isLoading}
                    />
                    {/* Botón de voz inline (esquina interior) */}
                    <button
                        type="button"
                        onClick={toggleListening}
                        disabled={isLoading}
                        className={cn(
                            "absolute right-2 top-2 w-8 h-8 flex items-center justify-center rounded-lg transition-all",
                            isListening
                                ? "bg-rose-500 text-white"
                                : "text-slate-400 hover:bg-slate-100 hover:text-slate-600",
                            "disabled:opacity-40 disabled:cursor-not-allowed active:scale-95"
                        )}
                        title={isListening ? "Detener grabación" : "Dictar por voz"}
                    >
                        {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                    </button>
                </div>

                <button
                    type="submit"
                    disabled={!input.trim() || isLoading}
                    className={cn(
                        "h-12 w-12 flex items-center justify-center rounded-2xl transition-all flex-shrink-0",
                        input.trim() && !isLoading
                            ? "bg-indigo-600 text-white hover:bg-indigo-700 shadow-sm shadow-indigo-100"
                            : "bg-slate-100 text-slate-400",
                        "disabled:cursor-not-allowed active:scale-95"
                    )}
                    title="Enviar (Enter)"
                >
                    {isLoading ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                        <Send className="w-4 h-4" />
                    )}
                </button>
            </form>

            {/* Hint de atajos */}
            <div className="flex items-center justify-between px-1 text-[10.5px] text-slate-400">
                <div className="flex items-center gap-3">
                    <span>
                        <kbd className="font-mono font-semibold text-slate-500">Enter</kbd> enviar
                    </span>
                    <span className="text-slate-300">·</span>
                    <span>
                        <kbd className="font-mono font-semibold text-slate-500">Shift+Enter</kbd> nueva línea
                    </span>
                </div>
                {charCount > 0 && (
                    <span className={cn("tabular-nums", isLong && "text-amber-600 font-semibold")}>
                        {charCount}
                    </span>
                )}
            </div>
        </div>
    );
}
