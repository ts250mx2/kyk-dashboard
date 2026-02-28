'use client';

import { useState } from 'react';
import { Send, Loader2, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ChatInputProps {
    onSend: (message: string) => void;
    onClear: () => void;
    isLoading: boolean;
}

export function ChatInput({ onSend, onClear, isLoading }: ChatInputProps) {
    const [input, setInput] = useState('');

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (input.trim() && !isLoading) {
            onSend(input);
            setInput('');
        }
    };

    return (
        <div className="flex gap-2 w-full max-w-3xl mx-auto px-4">
            <button
                onClick={onClear}
                className="p-2 h-10 w-10 flex items-center justify-center rounded-full bg-card border border-border text-muted-foreground hover:bg-destructive hover:text-destructive-foreground transition-all shadow-md active:scale-90 flex-shrink-0 self-end mb-1"
                title="Limpiar pantalla"
                type="button"
            >
                <span className="text-base">🗑️</span>
            </button>
            <form onSubmit={handleSubmit} className="flex-1 flex gap-2 items-end">
                <div className="relative flex-1">
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
                        placeholder="Hazme una pregunta..."
                        className={cn(
                            "w-full px-4 py-3 text-sm bg-card border border-border rounded-2xl shadow-lg",
                            "focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent",
                            "placeholder:text-muted-foreground text-foreground transition-all duration-200",
                            "resize-none min-h-[44px] max-h-[120px] overflow-y-auto",
                            isLoading && "opacity-50 cursor-not-allowed"
                        )}
                        disabled={isLoading}
                    />
                </div>
                <button
                    type="submit"
                    disabled={!input.trim() || isLoading}
                    className={cn(
                        "p-2 h-10 w-10 flex items-center justify-center rounded-full bg-primary text-primary-foreground mb-1",
                        "hover:opacity-90 transition-opacity duration-200 shadow-md",
                        "disabled:opacity-50 disabled:cursor-not-allowed active:scale-95 flex-shrink-0"
                    )}
                >
                    {isLoading ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                        <span className="text-lg">🚀</span>
                    )}
                </button>
            </form>
        </div>
    );
}
