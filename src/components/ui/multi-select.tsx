"use client";

import { useState, useRef, useEffect } from 'react';
import { Search, Check, X, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Option {
    label: string;
    value: string;
}

interface MultiSelectProps {
    options: Option[];
    selectedValues: string[];
    onChange: (values: string[]) => void;
    placeholder: string;
    icon?: React.ReactNode;
    className?: string;
}

export function MultiSelect({ options, selectedValues, onChange, placeholder, icon, className }: MultiSelectProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const containerRef = useRef<HTMLDivElement>(null);

    const filteredOptions = options.filter(opt => 
        opt.label.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const handleToggle = (value: string) => {
        const newValues = selectedValues.includes(value)
            ? selectedValues.filter(v => v !== value)
            : [...selectedValues, value];
        onChange(newValues);
    };

    const handleSelectAll = () => {
        if (selectedValues.length === options.length) {
            onChange([]);
        } else {
            onChange(options.map(o => o.value));
        }
    };

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const selectedLabels = options
        .filter(opt => selectedValues.includes(opt.value))
        .map(opt => opt.label);

    return (
        <div className={cn("relative w-full", className)} ref={containerRef}>
            <div 
                onClick={() => setIsOpen(!isOpen)}
                className={cn(
                    "flex items-center gap-2 bg-slate-800 text-white text-[11px] font-bold uppercase tracking-wider p-2 border border-slate-700 cursor-pointer transition-all",
                    isOpen ? "border-blue-500 ring-1 ring-blue-500" : "hover:border-slate-500"
                )}
            >
                {icon}
                <div className="flex-1 truncate">
                    {selectedValues.length === 0 ? (
                        <span className="text-slate-400">{placeholder}</span>
                    ) : (
                        <span className="text-blue-400">{selectedValues.length} SELECCIONADOS</span>
                    )}
                </div>
                <ChevronDown size={14} className={cn("transition-transform", isOpen && "rotate-180")} />
            </div>

            {isOpen && (
                <div className="absolute z-50 mt-1 w-64 bg-slate-900 border border-slate-700 shadow-2xl animate-in fade-in zoom-in duration-150">
                    <div className="p-2 border-b border-slate-800">
                        <div className="relative flex items-center">
                            <Search className="absolute left-2 text-slate-500" size={14} />
                            <input
                                type="text"
                                placeholder="BUSCAR..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full bg-slate-800 text-white text-[10px] pl-8 pr-2 py-2 outline-none border border-transparent focus:border-blue-500 uppercase font-bold"
                                autoFocus
                            />
                        </div>
                    </div>

                    <div className="max-h-60 overflow-y-auto no-scrollbar">
                        <div 
                            onClick={handleSelectAll}
                            className="flex items-center gap-2 p-2 hover:bg-slate-800 cursor-pointer border-b border-slate-800 transition-colors"
                        >
                            <div className={cn(
                                "w-4 h-4 border flex items-center justify-center transition-colors",
                                selectedValues.length === options.length ? "bg-blue-600 border-blue-600" : "border-slate-600"
                            )}>
                                {selectedValues.length === options.length && <Check size={12} className="text-white" />}
                            </div>
                            <span className="text-[10px] font-black text-white uppercase">TODOS</span>
                        </div>

                        {filteredOptions.length === 0 ? (
                            <div className="p-4 text-center text-slate-500 text-[10px] font-bold uppercase">
                                No se encontraron resultados
                            </div>
                        ) : (
                            filteredOptions.map((opt) => {
                                const isSelected = selectedValues.includes(opt.value);
                                return (
                                    <div 
                                        key={opt.value}
                                        onClick={() => handleToggle(opt.value)}
                                        className={cn(
                                            "flex items-center gap-2 p-2 hover:bg-slate-800 cursor-pointer transition-colors group",
                                            isSelected && "bg-blue-900/20"
                                        )}
                                    >
                                        <div className={cn(
                                            "w-4 h-4 border flex items-center justify-center transition-colors",
                                            isSelected ? "bg-blue-600 border-blue-600" : "border-slate-600 group-hover:border-slate-400"
                                        )}>
                                            {isSelected && <Check size={12} className="text-white" />}
                                        </div>
                                        <span className={cn(
                                            "text-[10px] font-bold uppercase transition-colors",
                                            isSelected ? "text-blue-400" : "text-slate-400 group-hover:text-white"
                                        )}>
                                            {opt.label}
                                        </span>
                                    </div>
                                );
                            })
                        )}
                    </div>

                    {selectedValues.length > 0 && (
                        <div className="p-2 bg-slate-950 border-t border-slate-800 flex justify-between items-center">
                            <span className="text-[9px] font-black text-slate-500 uppercase">{selectedValues.length} ITEMS</span>
                            <button 
                                onClick={() => onChange([])}
                                className="text-[9px] font-black text-rose-500 hover:text-rose-400 uppercase"
                            >
                                LIMPIAR
                            </button>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
