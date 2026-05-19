'use client';

import { useState, useEffect } from 'react';
import { Send, Loader2, Mic, MicOff } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useVoiceRecognition } from '@/hooks/use-voice-recognition';

interface ChatInputProps {
    onSend: (message: string) => void;
    isLoading: boolean;
}

export function ChatInput({ onSend, isLoading }: ChatInputProps) {
    const [input, setInput] = useState('');
    const { isListening, transcript, startListening, stopListening, error } = useVoiceRecognition();

    useEffect(() => {
        if (transcript) {
            setInput(transcript);
        }
    }, [transcript]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (input.trim() && !isLoading) {
            onSend(input);
            setInput('');
            if (isListening) stopListening();
        }
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
