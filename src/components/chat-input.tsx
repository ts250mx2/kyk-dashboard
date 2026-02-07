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
                className="p-3 rounded-full bg-card border border-border text-muted-foreground hover:bg-destructive hover:text-destructive-foreground transition-all shadow-lg active:scale-90"
                title="Limpiar pantalla"
                type="button"
            >
                <span className="text-xl">🗑️</span>
            </button>
            <form onSubmit={handleSubmit} className="relative flex-1">
                <div className="relative flex items-center">
                    <input
                        type="text"
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        placeholder="Hazme una pregunta..."
                        className={cn(
                            "w-full px-6 py-4 text-lg bg-card border border-border rounded-full shadow-lg",
                            "focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent",
                            "placeholder:text-muted-foreground text-foreground transition-all duration-200",
                            isLoading && "opacity-50 cursor-not-allowed"
                        )}
                        disabled={isLoading}
                    />
                    <button
                        type="submit"
                        disabled={!input.trim() || isLoading}
                        className={cn(
                            "absolute right-2 p-3 rounded-full bg-primary text-primary-foreground",
                            "hover:opacity-90 transition-opacity duration-200 shadow-md",
                            "disabled:opacity-50 disabled:cursor-not-allowed active:scale-95"
                        )}
                    >
                        {isLoading ? (
                            <Loader2 className="w-5 h-5 animate-spin" />
                        ) : (
                            <span className="text-xl">🚀</span>
                        )}
                    </button>
                </div>
            </form>
        </div>
    );
}
