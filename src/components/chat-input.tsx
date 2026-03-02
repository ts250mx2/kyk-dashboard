'use client';

import { useState } from 'react';
import { Send, Loader2, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ChatInputProps {
    onSend: (message: string) => void;
    isLoading: boolean;
}

export function ChatInput({ onSend, isLoading }: ChatInputProps) {
    const [input, setInput] = useState('');

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (input.trim() && !isLoading) {
            onSend(input);
            setInput('');
        }
    };

    return (
        <div className="flex gap-3 w-full max-w-4xl mx-auto px-2">
            <form onSubmit={handleSubmit} className="flex-1 flex gap-3 items-end">
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
                        placeholder="Hazme una consulta analítica..."
                        className={cn(
                            "w-full px-6 py-4 text-[15px] bg-white border border-slate-200 rounded-[24px] shadow-sm",
                            "focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent",
                            "placeholder:text-slate-400 text-slate-700 transition-all duration-300",
                            "resize-none min-h-[56px] max-h-[150px] overflow-y-auto font-medium",
                            isLoading && "opacity-50 cursor-not-allowed"
                        )}
                        disabled={isLoading}
                    />
                </div>
                <button
                    type="submit"
                    disabled={!input.trim() || isLoading}
                    className={cn(
                        "p-4 h-14 w-14 flex items-center justify-center rounded-[20px] bg-indigo-600 text-white mb-0.5",
                        "hover:bg-indigo-700 hover:shadow-lg transition-all duration-300 shadow-indigo-100",
                        "disabled:opacity-50 disabled:cursor-not-allowed active:scale-95 flex-shrink-0"
                    )}
                >
                    {isLoading ? (
                        <Loader2 className="w-6 h-6 animate-spin" />
                    ) : (
                        <Send className="w-6 h-6" />
                    )}
                </button>
            </form>
        </div>
    );
}
