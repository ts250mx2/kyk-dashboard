'use client';

import React from 'react';
import { cn } from '@/lib/utils';

interface LoadingScreenProps {
    message?: string;
    className?: string;
}

export function LoadingScreen({ message = "Sincronizando datos...", className }: LoadingScreenProps) {
    return (
        <div className={cn(
            "flex flex-col items-center justify-center p-12 min-h-[300px] w-full animate-in fade-in duration-500",
            className
        )}>
            <div className="relative mb-6">
                {/* Outer pulsing ring */}
                <div className="absolute inset-0 rounded-full bg-[#4050B4]/20 animate-ping" />

                {/* Animated border ring */}
                <div className="absolute -inset-4 rounded-full border-2 border-t-[#4050B4] border-r-transparent border-b-transparent border-l-transparent animate-spin duration-700" />
                <div className="absolute -inset-4 rounded-full border-2 border-slate-100 opacity-20" />

                {/* Logo Container */}
                <div className="relative w-20 h-20 bg-white rounded-full border border-slate-100 shadow-xl flex items-center justify-center p-4 z-10">
                    <img
                        src="/kesito.svg"
                        alt="KYK Loading"
                        className="w-full h-full object-contain animate-pulse"
                    />
                </div>
            </div>

            {/* Loading text */}
            <div className="flex flex-col items-center gap-1">
                <p className="text-[11px] font-black text-slate-900 uppercase tracking-[0.2em] animate-pulse">
                    {message}
                </p>
                <div className="flex gap-1">
                    <div className="w-1 h-1 bg-[#4050B4] rounded-full animate-bounce [animation-delay:-0.3s]" />
                    <div className="w-1 h-1 bg-[#4050B4] rounded-full animate-bounce [animation-delay:-0.15s]" />
                    <div className="w-1 h-1 bg-[#4050B4] rounded-full animate-bounce" />
                </div>
            </div>

            {/* Subtle branding hint */}
            <span className="text-[8px] font-bold text-slate-300 uppercase tracking-widest mt-8">Asistente de Análisis KYK</span>
        </div>
    );
}
