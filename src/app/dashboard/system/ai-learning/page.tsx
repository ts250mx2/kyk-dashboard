"use client";

import React, { useState, useEffect } from "react";
import {
    Plus,
    Trash2,
    Save,
    RefreshCw,
    Search,
    Brain,
    Calendar,
    Hash,
    Type,
    CheckCircle2,
    XCircle,
    ChevronUp,
    ChevronDown,
    ScrollText,
    X,
    MessageSquare
} from "lucide-react";
import { cn } from "@/lib/utils";

interface Keyword {
    IdPalabraClave: number;
    PalabraClave: string;
    FechaAct: string;
    Status: number;
    Consecutivo: number;
}

interface Rule {
    IdReglaPalabraClave: number;
    IdPalabraClave: number;
    Regla: string;
    Consecutivo: number;
    FechaAct: string;
    Status: number;
}

export default function AILearningPage() {
    const [keywords, setKeywords] = useState<Keyword[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState("");
    const [newKeyword, setNewKeyword] = useState("");
    const [editingId, setEditingId] = useState<number | null>(null);
    const [editingValues, setEditingValues] = useState<{ PalabraClave: string; Consecutivo: number } | null>(null);

    // Modal state
    const [isRulesModalOpen, setIsRulesModalOpen] = useState(false);
    const [selectedKeyword, setSelectedKeyword] = useState<Keyword | null>(null);
    const [rules, setRules] = useState<Rule[]>([]);
    const [rulesLoading, setRulesLoading] = useState(false);
    const [newRule, setNewRule] = useState("");
    const [editingRuleId, setEditingRuleId] = useState<number | null>(null);
    const [editingRuleValue, setEditingRuleValue] = useState("");

    // Action states
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [isAddingKeyword, setIsAddingKeyword] = useState(false);
    const [isAddingRule, setIsAddingRule] = useState(false);
    const [actionLoading, setActionLoading] = useState<number | null>(null); // For individual row actions

    const fetchKeywords = async () => {
        setLoading(true);
        try {
            const res = await fetch("/api/system/ai-learning");
            if (!res.ok) {
                const errorData = await res.json();
                throw new Error(errorData.error || `Error ${res.status}: ${res.statusText}`);
            }
            const data = await res.json();
            if (Array.isArray(data)) {
                setKeywords(data);
            }
        } catch (error: any) {
            console.error("Error fetching keywords:", error);
            alert("Error al cargar palabras clave: " + error.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchKeywords();
    }, []);

    const handleAdd = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newKeyword.trim() || isAddingKeyword) return;

        setIsAddingKeyword(true);
        try {
            const res = await fetch("/api/system/ai-learning", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ PalabraClave: newKeyword }),
            });

            if (res.ok) {
                setNewKeyword("");
                setIsAddModalOpen(false);
                await fetchKeywords();
            } else {
                const errorData = await res.json();
                alert(`Error al agregar palabra: ${errorData.error || res.statusText}`);
            }
        } catch (error: any) {
            console.error("Error adding keyword:", error);
            alert("Error de conexión al agregar palabra clave");
        } finally {
            setIsAddingKeyword(false);
        }
    };

    const handleUpdate = async (id: number) => {
        if (!editingValues) return;

        setActionLoading(id);
        try {
            const res = await fetch("/api/system/ai-learning", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    IdPalabraClave: id,
                    ...editingValues
                }),
            });
            if (res.ok) {
                setEditingId(null);
                setEditingValues(null);
                await fetchKeywords();
            } else {
                const errorData = await res.json();
                alert("Error al actualizar: " + (errorData.error || res.statusText));
            }
        } catch (error: any) {
            console.error("Error updating keyword:", error);
            alert("Error de conexión al actualizar");
        } finally {
            setActionLoading(null);
        }
    };

    const handleDelete = async (id: number) => {
        if (!confirm("¿Estás seguro de eliminar esta palabra clave?")) return;

        setActionLoading(id);
        try {
            const res = await fetch(`/api/system/ai-learning?id=${id}`, {
                method: "DELETE",
            });
            if (res.ok) {
                await fetchKeywords();
            } else {
                const errorData = await res.json();
                alert("Error al eliminar: " + (errorData.error || res.statusText));
            }
        } catch (error: any) {
            console.error("Error deleting keyword:", error);
            alert("Error de conexión al eliminar");
        } finally {
            setActionLoading(null);
        }
    };

    const handleReorder = async (currentIndex: number, direction: 'up' | 'down') => {
        const targetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
        if (targetIndex < 0 || targetIndex >= keywords.length) return;

        const kw1 = keywords[currentIndex];
        const kw2 = keywords[targetIndex];

        try {
            const res = await fetch("/api/system/ai-learning", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    id1: kw1.IdPalabraClave,
                    cons1: kw1.Consecutivo,
                    id2: kw2.IdPalabraClave,
                    cons2: kw2.Consecutivo
                }),
            });
            if (res.ok) {
                fetchKeywords();
            }
        } catch (error) {
            console.error("Error reordering keywords:", error);
        }
    };

    const startEditing = (kw: Keyword) => {
        setEditingId(kw.IdPalabraClave);
        setEditingValues({ PalabraClave: kw.PalabraClave, Consecutivo: kw.Consecutivo });
    };

    // Rules logic
    const fetchRules = async (keywordId: number) => {
        setRulesLoading(true);
        try {
            const res = await fetch(`/api/system/ai-learning/rules?idPalabraClave=${keywordId}`);
            const data = await res.json();
            if (Array.isArray(data)) {
                setRules(data);
            }
        } catch (error) {
            console.error("Error fetching rules:", error);
        } finally {
            setRulesLoading(false);
        }
    };

    const handleOpenRules = (kw: Keyword) => {
        setSelectedKeyword(kw);
        setIsRulesModalOpen(true);
        fetchRules(kw.IdPalabraClave);
    };

    const handleAddRule = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newRule.trim() || !selectedKeyword || isAddingRule) return;

        setIsAddingRule(true);
        try {
            const res = await fetch("/api/system/ai-learning/rules", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ IdPalabraClave: selectedKeyword.IdPalabraClave, Regla: newRule }),
            });
            if (res.ok) {
                setNewRule("");
                await fetchRules(selectedKeyword.IdPalabraClave);
            } else {
                const errorData = await res.json();
                alert("Error al agregar regla: " + (errorData.error || res.statusText));
            }
        } catch (error: any) {
            console.error("Error adding rule:", error);
            alert("Error de conexión al agregar regla");
        } finally {
            setIsAddingRule(false);
        }
    };

    const handleUpdateRule = async (ruleId: number) => {
        try {
            const res = await fetch("/api/system/ai-learning/rules", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ IdReglaPalabraClave: ruleId, Regla: editingRuleValue }),
            });
            if (res.ok) {
                setEditingRuleId(null);
                setEditingRuleValue("");
                if (selectedKeyword) fetchRules(selectedKeyword.IdPalabraClave);
            }
        } catch (error) {
            console.error("Error updating rule:", error);
        }
    };

    const handleDeleteRule = async (ruleId: number) => {
        if (!confirm("¿Estás seguro de eliminar esta regla?")) return;

        try {
            const res = await fetch(`/api/system/ai-learning/rules?id=${ruleId}`, {
                method: "DELETE",
            });
            if (res.ok) {
                if (selectedKeyword) fetchRules(selectedKeyword.IdPalabraClave);
            }
        } catch (error) {
            console.error("Error deleting rule:", error);
        }
    };

    const handleToggleRuleStatus = async (rule: Rule) => {
        const newStatus = rule.Status === 1 ? 0 : 1;
        try {
            const res = await fetch("/api/system/ai-learning/rules", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    IdReglaPalabraClave: rule.IdReglaPalabraClave,
                    Status: newStatus,
                    Regla: rule.Regla,
                    Consecutivo: rule.Consecutivo
                }),
            });
            if (res.ok) {
                if (selectedKeyword) fetchRules(selectedKeyword.IdPalabraClave);
            }
        } catch (error) {
            console.error("Error toggling rule status:", error);
        }
    };

    const handleReorderRules = async (currentIndex: number, direction: 'up' | 'down') => {
        const targetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
        if (targetIndex < 0 || targetIndex >= rules.length) return;

        const r1 = rules[currentIndex];
        const r2 = rules[targetIndex];

        try {
            const res = await fetch("/api/system/ai-learning/rules", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    id1: r1.IdReglaPalabraClave,
                    cons1: r1.Consecutivo,
                    id2: r2.IdReglaPalabraClave,
                    cons2: r2.Consecutivo
                }),
            });
            if (res.ok) {
                if (selectedKeyword) fetchRules(selectedKeyword.IdPalabraClave);
            }
        } catch (error) {
            console.error("Error reordering rules:", error);
        }
    };

    const filteredKeywords = keywords.filter(kw =>
        kw.PalabraClave.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                    <span className="text-3xl">🧠</span>
                    <div>
                        <h1 className="text-2xl font-black text-slate-800 tracking-tight flex items-center gap-2">
                            Aprendizaje IA
                        </h1>
                        <p className="text-sm text-slate-500 font-medium">Gestiona palabras clave y su orden de prioridad para el entrenamiento.</p>
                    </div>
                </div>

                <div className="px-5 py-2.5 bg-white border-2 border-slate-100 rounded-none shadow-sm flex items-center gap-3">
                    <div className="flex flex-col items-end">
                        <span className="text-[10px] uppercase font-black tracking-widest text-slate-400">Total Keywords</span>
                        <span className="text-lg font-black text-blue-600">{keywords.length}</span>
                    </div>
                    <div className="w-1 h-8 bg-slate-100 rounded-none" />
                    <button
                        onClick={fetchKeywords}
                        className="p-2 hover:bg-slate-50 text-slate-400 hover:text-blue-600 transition-all rounded-none active:scale-95"
                    >
                        <RefreshCw size={20} className={cn(loading && "animate-spin")} />
                    </button>
                </div>
            </div>


            {/* Grid */}
            <div className="bg-white rounded-none shadow-sm border border-slate-100 overflow-hidden">
                <div className="p-6 border-b border-slate-100 bg-slate-50/50 flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="relative flex-1 max-w-md">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
                        <input
                            type="text"
                            placeholder="Buscar en el historial..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full bg-white border-2 border-slate-200/60 rounded-none py-2.5 pl-12 pr-4 text-sm font-bold focus:outline-none focus:ring-4 focus:ring-blue-600/5 focus:border-blue-600/20 transition-all shadow-sm placeholder:text-slate-300"
                        />
                    </div>
                    <button
                        onClick={() => setIsAddModalOpen(true)}
                        className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-2.5 rounded-none shadow-lg shadow-blue-600/20 flex items-center justify-center gap-2 font-black tracking-tight transition-all active:scale-95 whitespace-nowrap group"
                    >
                        <Plus size={18} />
                        AGREGAR PALABRA
                    </button>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead>
                            <tr className="bg-slate-50 border-b border-slate-100">
                                <th className="px-8 py-5 text-[10px] font-black uppercase tracking-widest text-slate-400">
                                    <div className="flex items-center gap-2">
                                        <Type size={12} />
                                        Palabra Clave
                                    </div>
                                </th>
                                <th className="px-8 py-5 text-[10px] font-black uppercase tracking-widest text-slate-400 text-center">
                                    <div className="flex items-center justify-center gap-2">
                                        <Hash size={12} />
                                        Consecutivo
                                    </div>
                                </th>
                                <th className="px-8 py-5 text-[10px] font-black uppercase tracking-widest text-slate-400">
                                    <div className="flex items-center gap-2">
                                        <Calendar size={12} />
                                        Última Act.
                                    </div>
                                </th>
                                <th className="px-8 py-5 text-[10px] font-black uppercase tracking-widest text-slate-400 text-right">Acciones</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {filteredKeywords.map((kw) => (
                                <tr key={kw.IdPalabraClave} className="hover:bg-blue-50/30 transition-colors group">
                                    <td className="px-8 py-5">
                                        {editingId === kw.IdPalabraClave ? (
                                            <input
                                                type="text"
                                                value={editingValues?.PalabraClave}
                                                onChange={(e) => setEditingValues(prev => prev ? { ...prev, PalabraClave: e.target.value } : null)}
                                                className="bg-white border-2 border-blue-200 rounded-none px-4 py-2 text-sm font-bold focus:outline-none focus:ring-4 focus:ring-blue-600/5 transition-all w-64"
                                            />
                                        ) : (
                                            <span className="text-sm font-bold text-slate-700">{kw.PalabraClave}</span>
                                        )}
                                    </td>
                                    <td className="px-8 py-5 text-center">
                                        {editingId === kw.IdPalabraClave ? (
                                            <input
                                                type="number"
                                                value={editingValues?.Consecutivo}
                                                onChange={(e) => setEditingValues(prev => prev ? { ...prev, Consecutivo: parseInt(e.target.value) } : null)}
                                                className="bg-white border-2 border-blue-200 rounded-none px-4 py-2 text-sm font-bold focus:outline-none focus:ring-4 focus:ring-blue-600/5 transition-all w-24 text-center"
                                            />
                                        ) : (
                                            <div className="flex items-center justify-center gap-3">
                                                {!searchTerm && kw.IdPalabraClave !== 1 && (
                                                    <div className="flex flex-col gap-1">
                                                        <button
                                                            onClick={() => handleReorder(keywords.indexOf(kw), 'up')}
                                                            disabled={keywords.indexOf(kw) === 0 || keywords[keywords.indexOf(kw) - 1].IdPalabraClave === 1}
                                                            className="p-1 hover:bg-blue-100 text-blue-400 disabled:opacity-30 disabled:hover:bg-transparent rounded-none transition-all"
                                                        >
                                                            <ChevronUp size={14} />
                                                        </button>
                                                        <button
                                                            onClick={() => handleReorder(keywords.indexOf(kw), 'down')}
                                                            disabled={keywords.indexOf(kw) === keywords.length - 1}
                                                            className="p-1 hover:bg-blue-100 text-blue-400 disabled:opacity-30 disabled:hover:bg-transparent rounded-none transition-all"
                                                        >
                                                            <ChevronDown size={14} />
                                                        </button>
                                                    </div>
                                                )}
                                                <div className="inline-flex items-center justify-center px-4 py-1.5 bg-blue-50 text-blue-600 text-xs font-black rounded-none border border-blue-100 shadow-sm">
                                                    {kw.Consecutivo}
                                                </div>
                                            </div>
                                        )}
                                    </td>
                                    <td className="px-8 py-5">
                                        <span className="text-xs font-bold text-slate-500 flex items-center gap-2">
                                            <div className="w-1.5 h-1.5 bg-slate-300 rounded-full" />
                                            {new Date(kw.FechaAct).toLocaleString()}
                                        </span>
                                    </td>
                                    <td className="px-8 py-5">
                                        <div className="flex items-center justify-end gap-2 transition-all">
                                            {editingId === kw.IdPalabraClave ? (
                                                <>
                                                    <button
                                                        onClick={() => handleUpdate(kw.IdPalabraClave)}
                                                        className="p-1.5 hover:scale-125 transition-all active:scale-90 text-xl"
                                                        title="Guardar"
                                                    >
                                                        ✅
                                                    </button>
                                                    <button
                                                        onClick={() => { setEditingId(null); setEditingValues(null); }}
                                                        className="p-1.5 hover:scale-125 transition-all active:scale-90 text-xl"
                                                        title="Cancelar"
                                                    >
                                                        ❌
                                                    </button>
                                                </>
                                            ) : (
                                                <>
                                                    <button
                                                        onClick={() => handleOpenRules(kw)}
                                                        className="p-1.5 hover:scale-125 transition-all active:scale-90 text-xl"
                                                        title="Reglas"
                                                    >
                                                        📜
                                                    </button>
                                                    {kw.IdPalabraClave !== 1 && (
                                                        <>
                                                            <button
                                                                onClick={() => startEditing(kw)}
                                                                className="p-1.5 hover:scale-125 transition-all active:scale-90 text-xl"
                                                                title="Editar"
                                                            >
                                                                ✏️
                                                            </button>
                                                            <button
                                                                onClick={() => handleDelete(kw.IdPalabraClave)}
                                                                className="p-1.5 hover:scale-125 transition-all active:scale-90 text-xl"
                                                                title="Eliminar"
                                                            >
                                                                🗑️
                                                            </button>
                                                        </>
                                                    )}
                                                </>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Rules Modal */}
            {isRulesModalOpen && selectedKeyword && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setIsRulesModalOpen(false)} />
                    <div className="relative bg-white w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl border border-slate-200">
                        {/* Modal Header */}
                        <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50">
                            <div className="flex items-center gap-4">
                                <div className="p-3 text-slate-800 flex items-center justify-center text-4xl">
                                    📜
                                </div>
                                <div>
                                    <h2 className="text-xl font-black text-slate-800 tracking-tight">
                                        Reglas: <span className="text-blue-600">{selectedKeyword.PalabraClave}</span>
                                    </h2>
                                    <p className="text-xs text-slate-500 font-bold uppercase tracking-widest mt-1">Gestión de lógica por palabra clave</p>
                                </div>
                            </div>
                            <button
                                onClick={() => setIsRulesModalOpen(false)}
                                className="p-2 hover:bg-slate-200 text-slate-400 hover:text-slate-800 transition-all"
                            >
                                <X size={24} />
                            </button>
                        </div>

                        {/* Modal Body */}
                        <div className="flex-1 overflow-y-auto p-8 space-y-8 no-scrollbar">
                            {/* Add New Rule */}
                            <form onSubmit={handleAddRule} className="space-y-4">
                                <div className="flex flex-col gap-2">
                                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-2">
                                        <Plus size={12} /> Nueva Regla
                                    </label>
                                    <textarea
                                        rows={3}
                                        placeholder="Escriba la regla aquí (soporta múltiples líneas)..."
                                        value={newRule}
                                        onChange={(e) => setNewRule(e.target.value)}
                                        className="w-full bg-slate-50 border-2 border-slate-200 p-4 text-sm font-bold focus:outline-none focus:ring-4 focus:ring-blue-600/5 focus:bg-white focus:border-blue-600/20 transition-all placeholder:text-slate-300 resize-none"
                                    />
                                </div>
                                <div className="flex justify-end">
                                    <button
                                        type="submit"
                                        disabled={!newRule.trim() || isAddingRule}
                                        className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white px-8 py-3 rounded-none shadow-lg shadow-blue-600/20 flex items-center justify-center gap-2 font-black tracking-tight transition-all active:scale-95"
                                    >
                                        {isAddingRule ? <RefreshCw size={18} className="animate-spin" /> : <Plus size={18} />}
                                        {isAddingRule ? "GUARDANDO..." : "GUARDAR REGLA"}
                                    </button>
                                </div>
                            </form>

                            {/* Rules List */}
                            <div className="space-y-4">
                                <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-2">
                                    <ScrollText size={12} /> Reglas Existentes ({rules.length})
                                </h3>
                                {rulesLoading ? (
                                    <div className="flex flex-col items-center justify-center py-12 text-slate-300">
                                        <RefreshCw size={40} className="animate-spin mb-4" />
                                        <p className="font-bold text-xs uppercase tracking-widest">Cargando reglas...</p>
                                    </div>
                                ) : rules.length === 0 ? (
                                    <div className="py-12 text-center border-2 border-dashed border-slate-100 bg-slate-50/50">
                                        <MessageSquare size={40} className="mx-auto text-slate-200 mb-4" />
                                        <p className="text-sm font-bold text-slate-400">No hay reglas configuradas para esta palabra clave.</p>
                                    </div>
                                ) : (
                                    <div className="space-y-3">
                                        {rules.map((rule, idx) => (
                                            <div key={rule.IdReglaPalabraClave} className="group bg-white border border-slate-100 shadow-sm hover:border-blue-100 transition-all flex items-stretch">
                                                {/* Reorder Controls */}
                                                <div className="bg-slate-50 border-r border-slate-100 flex flex-col justify-center px-2 gap-2">
                                                    <button
                                                        onClick={() => handleReorderRules(idx, 'up')}
                                                        disabled={idx === 0}
                                                        className="p-1 hover:text-blue-600 disabled:opacity-20 transition-colors"
                                                    >
                                                        <ChevronUp size={16} />
                                                    </button>
                                                    <div className="text-xl font-black text-slate-400 text-center">{rule.Consecutivo}</div>
                                                    <button
                                                        onClick={() => handleReorderRules(idx, 'down')}
                                                        disabled={idx === rules.length - 1}
                                                        className="p-1 hover:text-blue-600 disabled:opacity-20 transition-colors"
                                                    >
                                                        <ChevronDown size={16} />
                                                    </button>
                                                </div>

                                                <div className="flex-1 p-5">
                                                    {editingRuleId === rule.IdReglaPalabraClave ? (
                                                        <textarea
                                                            rows={3}
                                                            value={editingRuleValue}
                                                            onChange={(e) => setEditingRuleValue(e.target.value)}
                                                            className="w-full bg-white border-2 border-blue-200 p-3 text-sm font-bold focus:outline-none focus:ring-4 focus:ring-blue-600/5 transition-all resize-none"
                                                        />
                                                    ) : (
                                                        <p className={cn(
                                                            "text-sm font-bold leading-relaxed transition-all whitespace-pre-wrap",
                                                            rule.Status === 1 ? "text-slate-300 line-through" : "text-slate-700"
                                                        )}>
                                                            {rule.Regla}
                                                        </p>
                                                    )}
                                                    <div className="flex items-center justify-between mt-4">
                                                        <div className="flex items-center gap-3">
                                                            <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1">
                                                                <Calendar size={10} /> {new Date(rule.FechaAct).toLocaleDateString()}
                                                            </div>
                                                        </div>
                                                        <div className="flex items-center gap-2 transition-all">
                                                            {editingRuleId === rule.IdReglaPalabraClave ? (
                                                                <>
                                                                    <button
                                                                        onClick={() => handleUpdateRule(rule.IdReglaPalabraClave)}
                                                                        className="p-1 hover:scale-125 active:scale-95 transition-all text-xl"
                                                                        title="Guardar"
                                                                    >
                                                                        ✅
                                                                    </button>
                                                                    <button
                                                                        onClick={() => { setEditingRuleId(null); setEditingRuleValue(""); }}
                                                                        className="p-1 hover:scale-125 active:scale-95 transition-all text-xl"
                                                                        title="Cancelar"
                                                                    >
                                                                        ❌
                                                                    </button>
                                                                </>
                                                            ) : (
                                                                <>
                                                                    <button
                                                                        onClick={() => { setEditingRuleId(rule.IdReglaPalabraClave); setEditingRuleValue(rule.Regla); }}
                                                                        className="p-1 hover:scale-125 active:scale-95 transition-all text-xl"
                                                                        title="Editar"
                                                                    >
                                                                        ✏️
                                                                    </button>
                                                                    <button
                                                                        onClick={() => handleToggleRuleStatus(rule)}
                                                                        className="p-1 hover:scale-125 active:scale-95 transition-all text-xl"
                                                                        title={rule.Status === 1 ? "Habilitar" : "Deshabilitar"}
                                                                    >
                                                                        {rule.Status === 1 ? "⚪" : "🚫"}
                                                                    </button>
                                                                    <button
                                                                        onClick={() => handleDeleteRule(rule.IdReglaPalabraClave)}
                                                                        className="p-1 hover:scale-125 active:scale-95 transition-all text-xl"
                                                                        title="Eliminar"
                                                                    >
                                                                        🗑️
                                                                    </button>
                                                                </>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Modal Footer */}
                        <div className="p-6 border-t border-slate-100 bg-slate-50 flex justify-end">
                            <button
                                onClick={() => setIsRulesModalOpen(false)}
                                className="px-8 py-3 bg-slate-200 hover:bg-slate-300 text-slate-700 font-black text-sm tracking-tight transition-all active:scale-95"
                            >
                                CERRAR PANEL
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Add Keyword Modal */}
            {isAddModalOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setIsAddModalOpen(false)} />
                    <div className="relative bg-white w-full max-w-lg shadow-2xl border border-slate-200 overflow-hidden flex flex-col">
                        <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50">
                            <div className="flex items-center gap-4">
                                <div className="w-12 h-12 bg-blue-600 flex items-center justify-center text-white text-2xl shadow-lg shadow-blue-600/20">
                                    <Plus size={24} />
                                </div>
                                <div>
                                    <h2 className="text-xl font-black text-slate-800 tracking-tight uppercase">
                                        Agregar Palabra
                                    </h2>
                                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">Nueva Palabra Clave</p>
                                </div>
                            </div>
                            <button
                                onClick={() => setIsAddModalOpen(false)}
                                className="p-2 hover:bg-slate-200 text-slate-400 hover:text-slate-800 transition-all"
                            >
                                <X size={24} />
                            </button>
                        </div>

                        <form onSubmit={handleAdd} className="p-8 space-y-6">
                            <div className="space-y-2">
                                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-2">
                                    <Type size={12} /> Palabra Clave
                                </label>
                                <div className="relative">
                                    <input
                                        autoFocus
                                        type="text"
                                        placeholder="Ej: Ventas, Pagos, Usuarios..."
                                        value={newKeyword}
                                        onChange={(e) => setNewKeyword(e.target.value)}
                                        disabled={isAddingKeyword}
                                        className="w-full bg-slate-50 border-2 border-slate-200 p-4 text-sm font-bold focus:outline-none focus:ring-4 focus:ring-blue-600/5 focus:bg-white focus:border-blue-600/20 transition-all placeholder:text-slate-300"
                                    />
                                </div>
                            </div>

                            <div className="flex gap-3 pt-2">
                                <button
                                    type="button"
                                    onClick={() => setIsAddModalOpen(false)}
                                    className="flex-1 px-6 py-4 bg-slate-100 hover:bg-slate-200 text-slate-600 font-black text-xs uppercase tracking-widest transition-all active:scale-95"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    disabled={isAddingKeyword}
                                    className="flex-[2] bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-6 py-4 shadow-lg shadow-blue-600/20 flex items-center justify-center gap-2 font-black text-xs uppercase tracking-widest transition-all active:scale-95"
                                >
                                    {isAddingKeyword ? <RefreshCw size={18} className="animate-spin" /> : <CheckCircle2 size={18} />}
                                    {isAddingKeyword ? "Agregando..." : "Agregar"}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
