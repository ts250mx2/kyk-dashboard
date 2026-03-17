'use client';

import React from 'react';
import { cn } from '@/lib/utils';

interface LoadingScreenProps {
    message?: string;
    className?: string;
}

export function LoadingScreen({ message = "Cargando...", className }: LoadingScreenProps) {
    return (
        <div className={cn(
            "absolute inset-0 z-50 bg-white/60 backdrop-blur-[1px] flex flex-col items-center justify-center space-y-3",
            className
        )}>
            <div className="w-8 h-8 border-4 border-slate-200 border-t-[#4050B4] rounded-full animate-spin" />
            <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest animate-pulse">
                {message}
            </p>
        </div>
    );
}
