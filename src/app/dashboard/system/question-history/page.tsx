"use client";

import React, { useState, useEffect } from "react";
import {
    Calendar,
    User,
    MessageSquare,
    Search,
    RefreshCw,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface QuestionLog {
    IdLogPregunta: number;
    Pregunta: string;
    Resultado: string;
    FechaPregunta: string;
    IdUsuario: string;
    Error: number;
    ConsultaSQL: string | null;
    MensajeError: string | null;
    Usuario: string;
}

export default function QuestionHistoryPage() {
    const [logs, setLogs] = useState<QuestionLog[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState("");

    // Date filters - Default to last 7 days
    const [startDate, setStartDate] = useState(new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]);
    const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);

    const fetchLogs = async () => {
        setLoading(true);
        try {
            const url = new URL("/api/system/question-history", window.location.origin);
            if (startDate) url.searchParams.append("startDate", startDate);
            if (endDate) url.searchParams.append("endDate", endDate);

            const res = await fetch(url.toString());
            const data = await res.json();
            if (Array.isArray(data)) {
                setLogs(data);
            }
        } catch (error) {
            console.error("Error fetching question history:", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchLogs();
    }, []);

    const filteredLogs = logs.filter(log =>
        log.Pregunta.toLowerCase().includes(searchTerm.toLowerCase()) ||
        log.Usuario.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const formatDate = (dateStr: string) => {
        const date = new Date(dateStr);
        return date.toLocaleString('es-MX', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
        });
    };

    return (
        <div className="p-6 bg-slate-50 min-h-screen">
            {/* Header Section */}
            <div className="mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                    <span className="text-4xl drop-shadow-sm">📜</span>
                    <div>
                        <h1 className="text-2xl font-black text-slate-800 uppercase tracking-tight">Historial de Preguntas</h1>
                        <p className="text-slate-500 text-sm font-medium">Registro de interacciones con la IA</p>
                    </div>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                    <div className="flex items-center bg-white border border-slate-200 p-1 rounded-none shadow-sm">
                        <div className="flex items-center px-2 py-1 gap-2 border-r border-slate-100">
                            <span className="text-[10px] font-bold text-slate-400 uppercase">De</span>
                            <input
                                type="date"
                                value={startDate}
                                onChange={(e) => setStartDate(e.target.value)}
                                className="text-xs font-semibold text-slate-700 outline-none"
                            />
                        </div>
                        <div className="flex items-center px-2 py-1 gap-2">
                            <span className="text-[10px] font-bold text-slate-400 uppercase">A</span>
                            <input
                                type="date"
                                value={endDate}
                                onChange={(e) => setEndDate(e.target.value)}
                                className="text-xs font-semibold text-slate-700 outline-none"
                            />
                        </div>
                        <button
                            onClick={fetchLogs}
                            className="ml-1 p-1.5 bg-[#4050B4] text-white hover:bg-[#35449e] transition-colors"
                            title="Filtrar"
                        >
                            <RefreshCw className={cn("w-3.5 h-3.5", loading && "animate-spin")} />
                        </button>
                    </div>

                    <div className="relative group">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-[#4050B4] transition-colors" />
                        <input
                            type="text"
                            placeholder="Buscar en el historial..."
                            className="pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-none w-64 focus:outline-none focus:ring-2 focus:ring-[#4050B4]/20 focus:border-[#4050B4] transition-all text-sm font-medium"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                </div>
            </div>

            {/* Table Container */}
            <div className="bg-white border border-slate-200 shadow-xl rounded-none overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-slate-50 border-b border-slate-200">
                                <th className="px-6 py-4 text-[11px] font-bold text-slate-500 uppercase tracking-widest">[Fecha Pregunta]</th>
                                <th className="px-6 py-4 text-[11px] font-bold text-slate-500 uppercase tracking-widest">[Usuario]</th>
                                <th className="px-6 py-4 text-[11px] font-bold text-slate-500 uppercase tracking-widest">[Pregunta]</th>
                                <th className="px-6 py-4 text-[11px] font-bold text-slate-500 uppercase tracking-widest text-center">Estado</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {loading ? (
                                Array(5).fill(0).map((_, i) => (
                                    <tr key={i} className="animate-pulse">
                                        <td colSpan={4} className="px-6 py-8 h-16 bg-slate-50/50"></td>
                                    </tr>
                                ))
                            ) : filteredLogs.length > 0 ? (
                                filteredLogs.map((log) => (
                                    <tr key={log.IdLogPregunta} className="group hover:bg-slate-50 transition-colors">
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-2">
                                                <Calendar className="w-4 h-4 text-slate-400" />
                                                <span className="text-sm font-semibold text-slate-700 whitespace-nowrap">
                                                    {formatDate(log.FechaPregunta)}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-2">
                                                <div className="w-7 h-7 bg-[#4050B4]/10 rounded-none flex items-center justify-center border border-[#4050B4]/20">
                                                    <User className="w-3.5 h-3.5 text-[#4050B4]" />
                                                </div>
                                                <span className="text-sm font-bold text-slate-800">
                                                    {log.Usuario}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 min-w-[300px]">
                                            <div className="flex items-start gap-2">
                                                <MessageSquare className="w-4 h-4 text-slate-400 mt-0.5 flex-shrink-0" />
                                                <p className="text-sm text-slate-600 leading-relaxed max-w-2xl">
                                                    {log.Pregunta}
                                                </p>
                                            </div>
                                            {log.Error === 1 && log.MensajeError && (
                                                <div className="mt-2 pl-6">
                                                    <div className="p-2 bg-rose-50 border-l-4 border-rose-400 text-rose-700 text-[11px] font-medium">
                                                        <span className="font-bold">ERROR:</span> {log.MensajeError}
                                                    </div>
                                                </div>
                                            )}
                                            {log.ConsultaSQL && (
                                                <div className="mt-2 pl-6">
                                                    <details className="cursor-pointer">
                                                        <summary className="text-[10px] font-bold text-[#4050B4] uppercase hover:underline">Ver Consulta SQL</summary>
                                                        <pre className="mt-2 p-3 bg-slate-900 text-slate-300 text-[11px] rounded-none overflow-x-auto font-mono whitespace-pre-wrap">
                                                            {log.ConsultaSQL}
                                                        </pre>
                                                    </details>
                                                </div>
                                            )}
                                        </td>
                                        <td className="px-6 py-4 text-center">
                                            {log.Error === 0 ? (
                                                <div className="inline-flex items-center justify-center w-8 h-8 bg-emerald-100/50 text-emerald-600 rounded-none border border-emerald-200" title="Éxito">
                                                    <span className="text-lg">✅</span>
                                                </div>
                                            ) : (
                                                <div className="inline-flex items-center justify-center w-8 h-8 bg-rose-100/50 text-rose-600 rounded-none border border-rose-200" title="Error">
                                                    <span className="text-lg">❌</span>
                                                </div>
                                            )}
                                        </td>
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan={4} className="px-6 py-20 text-center">
                                        <div className="flex flex-col items-center gap-2">
                                            <Calendar className="w-10 h-10 text-slate-200" />
                                            <p className="text-slate-400 font-medium">No se encontraron registros para este rango de fechas</p>
                                        </div>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
