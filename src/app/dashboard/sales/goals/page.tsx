"use client";

import React, { useState, useEffect } from "react";
import { Target, Plus, Calendar, TrendingUp, Award, BarChart3, Edit3 } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { GoalEditModal } from "@/components/sales/GoalEditModal";
import { GoalGauge } from "@/components/sales/GoalGauge";
import { GoalDetailDrilldown } from "@/components/sales/GoalDetailDrilldown";
import { LoadingScreen } from "@/components/ui/loading-screen";

export default function GoalsPage() {
    const [goals, setGoals] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [selectedGoalId, setSelectedGoalId] = useState<number | null>(null);

    // Drilldown State
    const [isDrilldownOpen, setIsDrilldownOpen] = useState(false);
    const [drilldownGoalId, setDrilldownGoalId] = useState<number | null>(null);
    const [drilldownGoalName, setDrilldownGoalName] = useState("");

    useEffect(() => {
        fetchGoals();
    }, []);

    const fetchGoals = async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/dashboard/sales/goals');
            const data = await res.json();
            setGoals(data);
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    const handleAddClick = () => {
        setSelectedGoalId(null);
        setIsEditModalOpen(true);
    };

    const handleEditClick = (id: number) => {
        setSelectedGoalId(id);
        setIsEditModalOpen(true);
    };

    const handleGaugeClick = (id: number, name: string) => {
        setDrilldownGoalId(id);
        setDrilldownGoalName(name);
        setIsDrilldownOpen(true);
    };

    return (
        <div className="space-y-8 pb-20">
            {/* Header section with specialized add button */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-black text-slate-900 uppercase tracking-tighter">
                        Metas de Ventas
                    </h1>
                    <p className="text-slate-500 font-medium">
                        Planificación y seguimiento de objetivos comerciales dinámicos.
                    </p>
                </div>
                <div className="flex gap-3">
                    <button 
                        onClick={handleAddClick}
                        className="flex items-center gap-3 px-6 py-3 bg-[#4050B4] text-white font-black text-xs uppercase tracking-[0.2em] hover:bg-[#344199] transition-all shadow-xl shadow-[#4050B4]/20 border border-white/10"
                    >
                        <Plus size={16} />
                        Nueva Meta
                    </button>
                </div>
            </div>

            {loading ? (
                <div className="h-[400px] flex items-center justify-center bg-white border border-slate-100 italic font-bold text-slate-300 uppercase tracking-widest text-xs">
                    Cargando objetivos comerciales...
                </div>
            ) : goals.length === 0 ? (
                <div className="bg-white border border-slate-200 p-20 flex flex-col items-center justify-center text-center space-y-6">
                    <div className="w-20 h-20 bg-slate-50 rounded-none border border-slate-100 flex items-center justify-center">
                        <Target size={40} className="text-slate-300" />
                    </div>
                    <div className="max-w-md space-y-2">
                        <h2 className="text-xl font-black text-slate-900 uppercase tracking-tight">Cero Metas Activas</h2>
                        <p className="text-slate-500 text-sm">
                            Comienza configurando tu primera meta comercial para disparar el seguimiento de cumplimiento por sucursal y departamento.
                        </p>
                        <button 
                            onClick={handleAddClick}
                            className="mt-4 px-6 py-2 bg-slate-900 text-white font-black text-[10px] uppercase tracking-widest hover:bg-slate-800 transition-all"
                        >
                            Crear Meta Ahora
                        </button>
                    </div>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                    {goals.map((goal, i) => (
                        <div 
                            key={goal.IdMeta}
                            className="group relative bg-white border border-slate-200 hover:border-[#4050B4]/40 transition-all duration-300 flex flex-col shadow-sm hover:shadow-2xl hover:shadow-[#4050B4]/5"
                        >
                            {/* Decorative Top Accent */}
                            <div className="h-1 bg-[#4050B4]/10 group-hover:bg-[#4050B4] transition-colors" />
                            
                            <div className="p-4 space-y-4">
                                <div className="flex items-start justify-between">
                                    <div className="p-2 bg-slate-50 border border-slate-100 group-hover:bg-[#4050B4]/5 group-hover:border-[#4050B4]/10 transition-colors">
                                        <TrendingUp size={18} className="text-[#4050B4]" />
                                    </div>
                                    <button 
                                        onClick={() => handleEditClick(goal.IdMeta)}
                                        className="p-2 text-slate-300 hover:text-[#4050B4] hover:bg-slate-50 transition-all rounded-none"
                                    >
                                        <Edit3 size={16} />
                                    </button>
                                </div>
                                
                                <div className="space-y-1">
                                    <h3 className="text-base font-black text-slate-900 uppercase tracking-tighter line-clamp-1">
                                        {goal.Meta}
                                    </h3>
                                    <div className="flex items-center gap-2 text-slate-400">
                                        <Calendar size={12} />
                                        <span className="text-[10px] font-black uppercase tracking-wider">
                                            {format(new Date(goal.FechaInicio), "dd MMM yyyy", { locale: es })} - {format(new Date(goal.FechaFin), "dd MMM yyyy", { locale: es })}
                                        </span>
                                    </div>
                                </div>

                                {/* Progress Gauge */}
                                <div className="py-2 border-t border-slate-50">
                                    <GoalGauge 
                                        idMeta={goal.IdMeta} 
                                        onClick={() => handleGaugeClick(goal.IdMeta, goal.Meta)}
                                    />
                                </div>

                                <div className="pt-4 border-t border-slate-50 flex items-center justify-between">
                                    <div className="flex items-center gap-4 text-emerald-600">
                                        <BarChart3 size={14} />
                                        <span className="text-[10px] font-black uppercase tracking-[0.2em]">Listado de KPI</span>
                                    </div>
                                    <div className="text-[10px] font-bold text-slate-400 uppercase italic">
                                        ID: {goal.IdMeta}
                                    </div>
                                </div>
                            </div>

                            {/* View Button Overly or Reveal */}
                            <button 
                                onClick={() => handleGaugeClick(goal.IdMeta, goal.Meta)}
                                className="w-full bg-[#4050B4] text-white py-3 text-[10px] font-black uppercase tracking-[0.3em] opacity-0 group-hover:opacity-100 transition-opacity translate-y-2 group-hover:translate-y-0 duration-300"
                            >
                                Ver Detalle por Tienda
                            </button>
                        </div>
                    ))}
                    
                    {/* Ghost Card for Adding */}
                    <button 
                        onClick={handleAddClick}
                        className="border-2 border-dashed border-slate-200 hover:border-[#4050B4] hover:bg-[#4050B4]/5 transition-all p-12 flex flex-col items-center justify-center space-y-4 group"
                    >
                        <div className="w-12 h-12 rounded-full border-2 border-slate-200 flex items-center justify-center group-hover:border-[#4050B4] group-hover:bg-white transition-all">
                            <Plus size={24} className="text-slate-300 group-hover:text-[#4050B4]" />
                        </div>
                        <span className="text-[11px] font-black text-slate-400 uppercase tracking-widest group-hover:text-[#4050B4]">Nueva Meta</span>
                    </button>
                </div>
            )}

            <GoalEditModal 
                isOpen={isEditModalOpen}
                onClose={() => setIsEditModalOpen(false)}
                idMeta={selectedGoalId}
                onSaved={fetchGoals}
            />

            <GoalDetailDrilldown 
                isOpen={isDrilldownOpen}
                onClose={() => setIsDrilldownOpen(false)}
                idMeta={drilldownGoalId}
                metaName={drilldownGoalName}
            />
        </div>
    );
}
