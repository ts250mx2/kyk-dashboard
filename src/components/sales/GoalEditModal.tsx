"use client";

import React, { useState, useEffect, useRef } from 'react';
import { X, Save, Plus, Trash2, Home, Package, BookOpen, Sparkles, Calculator, Calendar, ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { LoadingScreen } from '../ui/loading-screen';

interface GoalEditModalProps {
    isOpen: boolean;
    onClose: () => void;
    idMeta?: number | null;
    onSaved: () => void;
}

export function GoalEditModal({ isOpen, onClose, idMeta, onSaved }: GoalEditModalProps) {
    const [loading, setLoading] = useState(false);
    const [fetchingDetails, setFetchingDetails] = useState(false);
    
    // Header Fields
    const [metaName, setMetaName] = useState('');
    const [fechaInicio, setFechaInicio] = useState('');
    const [fechaFin, setFechaFin] = useState('');
    const [savedIdMeta, setSavedIdMeta] = useState<number | null>(null);

    // Detail Tabs Data
    const [concepts, setConcepts] = useState<any[]>([]);
    const [stores, setStores] = useState<any[]>([]);
    
    // Concept Selection
    const [tipoConcepto, setTipoConcepto] = useState<number>(0);
    const [catalog, setCatalog] = useState<any[]>([]);
    const [selectedConcept, setSelectedConcept] = useState<string>('');
    const [loadingCatalog, setLoadingCatalog] = useState(false);
    const [conceptSearch, setConceptSearch] = useState('');
    const [isCatalogOpen, setIsCatalogOpen] = useState(false);
    const catalogRef = useRef<HTMLDivElement>(null);
    
    // Suggest Goals Modal State
    const [isSuggestModalOpen, setIsSuggestModalOpen] = useState(false);
    const [suggestStartDate, setSuggestStartDate] = useState('');
    const [suggestEndDate, setSuggestEndDate] = useState('');
    const [incrementPercentage, setIncrementPercentage] = useState(5);
    const [suggestedGoals, setSuggestedGoals] = useState<any[]>([]);
    const [calculatingSuggestions, setCalculatingSuggestions] = useState(false);

    // Click outside handler for catalog dropdown
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (catalogRef.current && !catalogRef.current.contains(event.target as Node)) {
                setIsCatalogOpen(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    useEffect(() => {
        if (isOpen) {
            if (idMeta) {
                setSavedIdMeta(idMeta);
                fetchGoalDetails(idMeta);
            } else {
                setSavedIdMeta(null);
                setMetaName('');
                
                // Set default dates for new meta (current month)
                const now = new Date();
                const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
                const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
                
                setFechaInicio(firstDay.toISOString().split('T')[0]);
                setFechaFin(lastDay.toISOString().split('T')[0]);

                setConcepts([]);
                setStores([]);
            }
        }
    }, [isOpen, idMeta]);

    useEffect(() => {
        if (tipoConcepto > 0) {
            fetchCatalog();
            setConceptSearch('');
            setSelectedConcept('');
        } else {
            setCatalog([]);
            setSelectedConcept('');
            setConceptSearch('');
        }
    }, [tipoConcepto]);

    const filteredCatalog = catalog.filter(c => {
        const text = (c.Depto || c.Familia || c.Descripcion || c.CodigoBarras || '').toString().toLowerCase();
        return text.includes(conceptSearch.toLowerCase());
    });

    const fetchGoalDetails = async (id: number) => {
        setFetchingDetails(true);
        try {
            // First fetch the goal header if needed (though usually we pass it or fetch list)
            // For now assume we might need just details
            const res = await fetch(`/api/dashboard/sales/goals/details?idMeta=${id}`);
            const data = await res.json();
            setConcepts(data.concepts || []);
            setStores(data.stores || []);
            
            if (data.header) {
                setMetaName(data.header.Meta || '');
                if (data.header.FechaInicio) {
                    setFechaInicio(data.header.FechaInicio.split('T')[0]);
                }
                if (data.header.FechaFin) {
                    setFechaFin(data.header.FechaFin.split('T')[0]);
                }
            }
        } catch (error) {
            console.error(error);
        } finally {
            setFetchingDetails(false);
        }
    };

    const fetchCatalog = async () => {
        setLoadingCatalog(true);
        try {
            let type = '';
            if (tipoConcepto === 1) type = 'depto';
            else if (tipoConcepto === 2) type = 'familia';
            else if (tipoConcepto === 3) type = 'producto';
            
            const res = await fetch(`/api/dashboard/sales/goals/catalogs?type=${type}`);
            const data = await res.json();
            setCatalog(data);
        } catch (error) {
            console.error(error);
        } finally {
            setLoadingCatalog(false);
        }
    };

    const handleSaveHeader = async () => {
        if (!metaName || !fechaInicio || !fechaFin) {
            alert('Por favor complete todos los campos obligatorios');
            return;
        }

        setLoading(true);
        try {
            const res = await fetch('/api/dashboard/sales/goals', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    IdMeta: savedIdMeta,
                    Meta: metaName,
                    FechaInicio: fechaInicio,
                    FechaFin: fechaFin
                })
            });
            const data = await res.json();
            if (data.success) {
                setSavedIdMeta(data.IdMeta);
                if (!savedIdMeta) {
                    // It was new, now we can add concepts/stores
                    fetchGoalDetails(data.IdMeta);
                }
                onSaved();
            }
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    const handleAddConcept = async () => {
        if (!savedIdMeta) return;
        if (tipoConcepto === 0) return;
        if (!selectedConcept) {
            alert('Seleccione un concepto');
            return;
        }

        try {
            let body: any = { IdMeta: savedIdMeta, IdTipoConcepto: tipoConcepto };
            if (tipoConcepto === 1) body.IdConcepto = selectedConcept;
            else if (tipoConcepto === 2) body.Familia = selectedConcept;
            else if (tipoConcepto === 3) body.CodigoInterno = selectedConcept;

            const res = await fetch('/api/dashboard/sales/goals/concepts', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            });
            if (res.ok) {
                fetchGoalDetails(savedIdMeta);
                setSelectedConcept('');
                setConceptSearch('');
            }
        } catch (error) {
            console.error(error);
        }
    };

    const handleDeleteConcept = async (idMetaConcepto: number) => {
        if (!confirm('¿Desea eliminar este concepto?')) return;
        try {
            const res = await fetch(`/api/dashboard/sales/goals/concepts?idMetaConcepto=${idMetaConcepto}`, {
                method: 'DELETE'
            });
            if (res.ok) fetchGoalDetails(savedIdMeta!);
        } catch (error) {
            console.error(error);
        }
    };

    const handleUpdateStoreAmount = async (idMetaTienda: number, amount: number) => {
        try {
            await fetch('/api/dashboard/sales/goals/stores', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ IdMetaTienda: idMetaTienda, MontoMeta: amount })
            });
            // Update local state for immediate feedback
            setStores(prev => {
                const newStores = prev.map(s => s.IdMetaTienda === idMetaTienda ? { ...s, MontoMeta: amount } : s);
                return newStores;
            });
        } catch (error) {
            console.error(error);
        }
    };

    const handleSuggestPeriods = (type: 'previous' | 'last_year') => {
        if (!fechaInicio || !fechaFin) return;
        
        const start = new Date(fechaInicio + 'T00:00:00');
        const end = new Date(fechaFin + 'T00:00:00');
        
        if (type === 'previous') {
            const diffTime = Math.abs(end.getTime() - start.getTime());
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
            
            // Check if it's a full month
            const isFullMonth = start.getDate() === 1 && new Date(end.getFullYear(), end.getMonth() + 1, 0).getDate() === end.getDate();
            
            if (isFullMonth) {
                const prevMonth = new Date(start.getFullYear(), start.getMonth() - 1, 1);
                const prevMonthEnd = new Date(start.getFullYear(), start.getMonth(), 0);
                setSuggestStartDate(prevMonth.toISOString().split('T')[0]);
                setSuggestEndDate(prevMonthEnd.toISOString().split('T')[0]);
            } else {
                const newEnd = new Date(start.getTime());
                newEnd.setDate(newEnd.getDate() - 1);
                
                const newStart = new Date(newEnd.getTime());
                newStart.setDate(newStart.getDate() - (diffDays - 1));
                
                setSuggestStartDate(newStart.toISOString().split('T')[0]);
                setSuggestEndDate(newEnd.toISOString().split('T')[0]);
            }
        } else {
            const lastYearStart = new Date(start.getFullYear() - 1, start.getMonth(), start.getDate());
            const lastYearEnd = new Date(end.getFullYear() - 1, end.getMonth(), end.getDate());
            
            setSuggestStartDate(lastYearStart.toISOString().split('T')[0]);
            setSuggestEndDate(lastYearEnd.toISOString().split('T')[0]);
        }
    };

    const calculateSuggestedGoals = async () => {
        if (!suggestStartDate || !suggestEndDate) return;
        setCalculatingSuggestions(true);
        try {
            const res = await fetch(`/api/dashboard/sales/goals/suggest?idMeta=${savedIdMeta}&fechaInicio=${suggestStartDate}&fechaFin=${suggestEndDate}`);
            const data = await res.json();
            
            const suggested = data.map((s: any) => ({
                ...s,
                SuggestedAmount: s.Sales * (1 + incrementPercentage / 100)
            }));
            
            setSuggestedGoals(suggested);
        } catch (error) {
            console.error(error);
        } finally {
            setCalculatingSuggestions(false);
        }
    };

    const handleAssignSuggestedGoals = async () => {
        setLoading(true);
        try {
            // 1. Update local state first for immediate feedback
            const updatedStores = [...stores];
            const updatesToSync = [];

            for (const sug of suggestedGoals) {
                const index = updatedStores.findIndex(s => s.IdTienda === sug.IdTienda);
                if (index !== -1) {
                    updatedStores[index] = { ...updatedStores[index], MontoMeta: sug.SuggestedAmount };
                    updatesToSync.push({ 
                        IdMetaTienda: updatedStores[index].IdMetaTienda, 
                        MontoMeta: sug.SuggestedAmount 
                    });
                }
            }
            
            setStores(updatedStores);

            // 2. Sync with DB in background or sequentially
            for (const update of updatesToSync) {
                await fetch('/api/dashboard/sales/goals/stores', {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(update)
                });
            }

            setIsSuggestModalOpen(false);
            setSuggestedGoals([]);
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[12000] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <div className="bg-white shadow-2xl overflow-hidden flex flex-col w-full max-w-5xl max-h-[90vh] border border-slate-200 rounded-none">
                {/* Header */}
                <div className="flex items-center justify-between bg-white border-b border-slate-100 p-4 shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-slate-50 border border-slate-100">
                            <BookOpen size={18} className="text-[#4050B4]" />
                        </div>
                        <div>
                            <h3 className="font-black text-sm uppercase tracking-widest leading-none mb-1 text-slate-800">
                                {savedIdMeta ? `Editar Meta: ${savedIdMeta}` : 'Nueva Meta Comercial'}
                            </h3>
                            <p className="text-[10px] font-bold text-slate-400 uppercase">Configuración de objetivos y alcances</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-rose-50 text-rose-500 transition-colors">
                        <X size={20} />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-auto p-6 space-y-8 bg-slate-50/30">
                    {/* Step 1: Goal Header */}
                    <div className="bg-white border border-slate-200 p-6 shadow-sm space-y-4">
                        <div className="flex items-center gap-2 mb-4">
                            <span className="w-6 h-6 flex items-center justify-center bg-[#4050B4] text-white text-[10px] font-black">1</span>
                            <h4 className="text-[11px] font-black text-slate-900 uppercase tracking-widest">Información General</h4>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            <div className="space-y-1.5">
                                <label className="text-[9px] font-black text-slate-400 uppercase tracking-wider">Nombre de la Meta</label>
                                <input 
                                    type="text" 
                                    className="w-full bg-slate-50 border border-slate-200 p-2.5 text-xs font-bold focus:ring-1 focus:ring-[#4050B4] outline-none"
                                    value={metaName}
                                    onChange={(e) => setMetaName(e.target.value)}
                                    placeholder="EJ: META SEMANAL REFRIGERADOS"
                                />
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-[9px] font-black text-slate-400 uppercase tracking-wider">Fecha Inicio</label>
                                <input 
                                    type="date" 
                                    className="w-full bg-slate-50 border border-slate-200 p-2.5 text-xs font-bold focus:ring-1 focus:ring-[#4050B4] outline-none"
                                    value={fechaInicio}
                                    onChange={(e) => setFechaInicio(e.target.value)}
                                />
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-[9px] font-black text-slate-400 uppercase tracking-wider">Fecha Fin</label>
                                <input 
                                    type="date" 
                                    className="w-full bg-slate-50 border border-slate-200 p-2.5 text-xs font-bold focus:ring-1 focus:ring-[#4050B4] outline-none"
                                    value={fechaFin}
                                    onChange={(e) => setFechaFin(e.target.value)}
                                />
                            </div>
                        </div>
                        <div className="flex justify-end pt-2">
                            <button 
                                onClick={handleSaveHeader}
                                disabled={loading}
                                className="flex items-center gap-2 px-6 py-2.5 bg-[#4050B4] text-white text-[10px] font-black uppercase tracking-widest hover:bg-[#344199] transition-all disabled:opacity-50"
                            >
                                <Save size={14} />
                                {loading ? 'Guardando...' : (savedIdMeta ? 'Actualizar Meta' : 'Guardar para Continuar')}
                            </button>
                        </div>
                    </div>

                    {/* Step 2 & 3: Concepts and Stores (Locked until Header is saved) */}
                    {!savedIdMeta ? (
                        <div className="border-2 border-dashed border-slate-200 p-12 text-center rounded-none bg-white/50">
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] italic">Debe guardar la meta primero para configurar conceptos y montos por tienda</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                            {/* Concepts Section */}
                            <div className="bg-white border border-slate-200 shadow-sm flex flex-col h-[500px]">
                                <div className="p-4 border-b border-slate-50 flex items-center justify-between bg-slate-50/50">
                                    <div className="flex items-center gap-2">
                                        <span className="w-6 h-6 flex items-center justify-center bg-[#4050B4] text-white text-[10px] font-black">2</span>
                                        <h4 className="text-[11px] font-black text-slate-900 uppercase tracking-widest">Conceptos Analíticos</h4>
                                    </div>
                                </div>
                                
                                <div className="p-4 bg-slate-50 space-y-3">
                                    <div className="grid grid-cols-2 gap-3">
                                        <select 
                                            className="bg-white border border-slate-200 p-2 text-[10px] font-bold uppercase transition-all focus:ring-1 focus:ring-[#4050B4] outline-none"
                                            value={tipoConcepto}
                                            onChange={(e) => setTipoConcepto(Number(e.target.value))}
                                        >
                                            <option value={0}>Total Venta</option>
                                            <option value={1}>Por Departamento</option>
                                            <option value={2}>Por Familia</option>
                                            <option value={3}>Por Producto</option>
                                        </select>
                                        {tipoConcepto > 0 && (
                                            <div className="relative" ref={catalogRef}>
                                                <input 
                                                    type="text"
                                                    className="w-full bg-white border border-slate-200 p-2 text-[10px] font-bold uppercase transition-all focus:ring-1 focus:ring-[#4050B4] outline-none"
                                                    value={conceptSearch}
                                                    onChange={(e) => {
                                                        setConceptSearch(e.target.value);
                                                        setIsCatalogOpen(true);
                                                    }}
                                                    onFocus={() => setIsCatalogOpen(true)}
                                                    placeholder={loadingCatalog ? "CARGANDO..." : "BUSCAR CONCEPTO..."}
                                                    disabled={loadingCatalog}
                                                />
                                                {isCatalogOpen && filteredCatalog.length > 0 && (
                                                    <div className="absolute top-full left-0 w-full max-h-60 overflow-auto bg-white border border-slate-200 z-[100] shadow-xl divide-y divide-slate-50">
                                                        {filteredCatalog.slice(0, 100).map((c, i) => {
                                                            const val = c.IdDepto || c.Familia || c.CodigoInterno;
                                                            const text = c.Depto || c.Familia || c.Descripcion || c.CodigoBarras;
                                                            const sub = c.CodigoBarras ? ` - ${c.CodigoBarras}` : '';

                                                            return (
                                                                <button
                                                                    key={i}
                                                                    type="button"
                                                                    className={cn(
                                                                        "w-full text-left px-3 py-2 text-[10px] font-bold uppercase hover:bg-slate-50 transition-colors",
                                                                        selectedConcept === val.toString() ? "bg-[#4050B4]/5 text-[#4050B4]" : "text-slate-600"
                                                                    )}
                                                                    onClick={() => {
                                                                        setSelectedConcept(val.toString());
                                                                        setConceptSearch(text);
                                                                        setIsCatalogOpen(false);
                                                                    }}
                                                                >
                                                                    {text}{sub}
                                                                </button>
                                                            );
                                                        })}
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                    {tipoConcepto > 0 && (
                                        <button 
                                            onClick={handleAddConcept}
                                            className="w-full flex items-center justify-center gap-2 py-2 bg-emerald-600 text-white text-[10px] font-black uppercase tracking-widest hover:bg-emerald-700 transition-all border border-emerald-700/10"
                                        >
                                            <Plus size={14} /> Agregar Concepto
                                        </button>
                                    )}
                                </div>

                                <div className="flex-1 overflow-auto p-4 space-y-2">
                                    {concepts.length === 0 ? (
                                        <div className="h-full flex flex-col items-center justify-center text-slate-300 italic text-[10px] font-bold">
                                            Sin conceptos definidos
                                        </div>
                                    ) : (
                                        concepts.map((c, i) => (
                                            <div key={i} className="flex items-center justify-between p-3 bg-white border border-slate-100 hover:border-[#4050B4]/30 transition-all group">
                                                <div className="flex flex-col">
                                                    <span className="text-[11px] font-black text-slate-800 uppercase tracking-tight">
                                                        {c.Depto || c.Familia || c.Articulo || 'General'}
                                                    </span>
                                                    <span className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">
                                                        {c.IdDepto ? 'Departamento' : c.Familia ? 'Familia' : c.Articulo ? 'Producto' : 'Total Venta'}
                                                    </span>
                                                </div>
                                                <button 
                                                    onClick={() => handleDeleteConcept(c.IdMetaConcepto)}
                                                    className="p-1.5 text-slate-300 hover:text-rose-500 hover:bg-rose-50 transition-all rounded-none"
                                                >
                                                    <Trash2 size={14} />
                                                </button>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </div>

                            {/* Store Goal Grid */}
                            <div className="bg-white border border-slate-200 shadow-sm flex flex-col h-[500px]">
                                <div className="p-4 border-b border-slate-50 flex items-center justify-between bg-emerald-50/50">
                                    <div className="flex items-center gap-2">
                                        <span className="w-6 h-6 flex items-center justify-center bg-emerald-600 text-white text-[10px] font-black">3</span>
                                        <h4 className="text-[11px] font-black text-emerald-900 uppercase tracking-widest">Asignación por Sucursal</h4>
                                    </div>
                                    <button 
                                        onClick={() => setIsSuggestModalOpen(true)}
                                        className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 text-white text-[9px] font-black uppercase tracking-wider hover:bg-emerald-700 transition-all shadow-sm"
                                    >
                                        <Sparkles size={12} />
                                        Sugerir Metas
                                    </button>
                                </div>
                                <div className="flex-1 overflow-auto">
                                    <table className="w-full border-collapse">
                                        <thead className="sticky top-0 bg-white border-b border-slate-100 z-10">
                                            <tr>
                                                <th className="px-4 py-3 text-left text-[9px] font-black text-slate-400 uppercase tracking-widest">Sucursal</th>
                                                <th className="px-4 py-3 text-right text-[9px] font-black text-slate-400 uppercase tracking-widest w-40">Monto Meta ($)</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-50">
                                            {stores.map((s, i) => (
                                                <tr key={i} className="hover:bg-slate-50/50 transition-colors">
                                                    <td className="px-4 py-3">
                                                        <div className="flex items-center gap-2">
                                                            <Home size={12} className="text-slate-300" />
                                                            <span className="text-[11px] font-black text-slate-700 uppercase tracking-tighter">{s.Tienda}</span>
                                                        </div>
                                                    </td>
                                                    <td className="px-4 py-3 text-right">
                                                        <div className="relative">
                                                            <span className="absolute left-0 top-1/2 -translate-y-1/2 text-[11px] font-black text-emerald-600/50">$</span>
                                                            <input 
                                                                type="text"
                                                                className="w-full text-right bg-transparent border-b border-dashed border-slate-200 py-1 pl-4 text-[11px] font-black text-emerald-600 focus:border-emerald-600 focus:outline-none transition-all placeholder:text-slate-300"
                                                                value={s.MontoMeta.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                                onChange={(e) => {
                                                                    const rawVal = e.target.value.replace(/[^0-9.]/g, '');
                                                                    const val = parseFloat(rawVal) || 0;
                                                                    setStores(prev => prev.map(store => store.IdMetaTienda === s.IdMetaTienda ? { ...store, MontoMeta: val } : store));
                                                                }}
                                                                onBlur={(e) => {
                                                                    const rawVal = e.target.value.replace(/[^0-9.]/g, '');
                                                                    handleUpdateStoreAmount(s.IdMetaTienda, parseFloat(rawVal) || 0);
                                                                }}
                                                                placeholder="0.00"
                                                            />
                                                        </div>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-end gap-3">
                    <button 
                        onClick={onClose}
                        className="px-6 py-2 text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 hover:text-slate-800 transition-all"
                    >
                        Cerrar Ventana
                    </button>
                    {savedIdMeta && (
                        <button 
                            onClick={() => { onSaved(); onClose(); }}
                            className="px-8 py-2 bg-slate-900 text-white text-[10px] font-black uppercase tracking-[0.2em] hover:bg-slate-800 transition-all shadow-xl shadow-slate-900/20"
                        >
                            Finalizar Configuración
                        </button>
                    )}
                </div>
            </div>

            {/* Suggest Goals Modal */}
            {isSuggestModalOpen && (
                <div className="fixed inset-0 z-[13000] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-md">
                    <div className="bg-white shadow-2xl w-full max-w-2xl border border-slate-200 overflow-hidden flex flex-col">
                        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-emerald-50 border border-emerald-100 text-emerald-600">
                                    <Sparkles size={18} />
                                </div>
                                <div>
                                    <h4 className="font-black text-sm uppercase tracking-widest leading-none mb-1">Sugerir Metas</h4>
                                    <p className="text-[10px] font-bold text-slate-400 uppercase">Basado en histórico de ventas</p>
                                </div>
                            </div>
                            <button onClick={() => setIsSuggestModalOpen(false)} className="p-2 hover:bg-rose-50 text-rose-500">
                                <X size={20} />
                            </button>
                        </div>

                        <div className="p-6 space-y-6">
                            {/* Controls */}
                            <div className="grid grid-cols-2 gap-4">
                                <button 
                                    onClick={() => handleSuggestPeriods('previous')}
                                    className="flex flex-col items-center justify-center p-4 bg-slate-50 border border-slate-200 hover:border-emerald-500 hover:bg-emerald-50/50 transition-all group"
                                >
                                    <Calendar className="text-slate-400 group-hover:text-emerald-600 mb-2" size={20} />
                                    <span className="text-[10px] font-black uppercase tracking-wider">Periodo Inmediato Anterior</span>
                                </button>
                                <button 
                                    onClick={() => handleSuggestPeriods('last_year')}
                                    className="flex flex-col items-center justify-center p-4 bg-slate-50 border border-slate-200 hover:border-emerald-500 hover:bg-emerald-50/50 transition-all group"
                                >
                                    <Calendar className="text-slate-400 group-hover:text-emerald-600 mb-2" size={20} />
                                    <span className="text-[10px] font-black uppercase tracking-wider">Mismo Periodo Año Pasado</span>
                                </button>
                            </div>

                            <div className="grid grid-cols-3 gap-4 items-end">
                                <div className="space-y-1.5">
                                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-wider">Fecha Inicio</label>
                                    <input 
                                        type="date" 
                                        className="w-full bg-slate-50 border border-slate-200 p-2 text-xs font-bold focus:ring-1 focus:ring-[#4050B4] outline-none"
                                        value={suggestStartDate}
                                        onChange={(e) => setSuggestStartDate(e.target.value)}
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-wider">Fecha Fin</label>
                                    <input 
                                        type="date" 
                                        className="w-full bg-slate-50 border border-slate-200 p-2 text-xs font-bold focus:ring-1 focus:ring-[#4050B4] outline-none"
                                        value={suggestEndDate}
                                        onChange={(e) => setSuggestEndDate(e.target.value)}
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-wider">Incremento (+%)</label>
                                    <div className="relative">
                                        <input 
                                            type="number" 
                                            className="w-full bg-slate-50 border border-slate-200 p-2 text-xs font-bold focus:ring-1 focus:ring-[#4050B4] outline-none pr-8"
                                            value={incrementPercentage}
                                            onChange={(e) => setIncrementPercentage(Number(e.target.value))}
                                        />
                                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-black text-slate-400">%</span>
                                    </div>
                                </div>
                            </div>

                            <button 
                                onClick={calculateSuggestedGoals}
                                disabled={calculatingSuggestions || !suggestStartDate || !suggestEndDate}
                                className="w-full flex items-center justify-center gap-2 py-3 bg-slate-900 text-white text-[10px] font-black uppercase tracking-[0.2em] hover:bg-slate-800 transition-all disabled:opacity-50 shadow-xl shadow-slate-900/20"
                            >
                                <Calculator size={14} />
                                {calculatingSuggestions ? 'Calculando...' : 'Calcular Metas Basado en Ventas'}
                            </button>

                            {/* Results Table */}
                            {suggestedGoals.length > 0 && (
                                <div className="border border-slate-200 rounded-none overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-500">
                                    <div className="max-h-48 overflow-auto">
                                        <table className="w-full border-collapse">
                                            <thead className="sticky top-0 bg-slate-50 border-b border-slate-200">
                                                <tr>
                                                    <th className="px-4 py-2 text-left text-[8px] font-black text-slate-400 uppercase tracking-widest">Sucursal</th>
                                                    <th className="px-4 py-2 text-right text-[8px] font-black text-slate-400 uppercase tracking-widest">Venta Histórica</th>
                                                    <th className="px-4 py-2 text-right text-[8px] font-black text-slate-400 uppercase tracking-widest bg-emerald-50">Sugerido (+{incrementPercentage}%)</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-100">
                                                {suggestedGoals.map((s, i) => (
                                                    <tr key={i} className="hover:bg-slate-50/50">
                                                        <td className="px-4 py-2 text-[10px] font-bold text-slate-600 uppercase">{s.Tienda}</td>
                                                        <td className="px-4 py-2 text-right text-[10px] font-bold text-slate-400">${s.Sales.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                                                        <td className="px-4 py-2 text-right text-[11px] font-black text-emerald-600 bg-emerald-50/30">${s.SuggestedAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                    <div className="p-4 bg-emerald-50 border-t border-emerald-100 flex items-center justify-between">
                                        <div className="flex flex-col">
                                            <span className="text-[8px] font-black text-emerald-700 uppercase tracking-widest">Total Sugerido</span>
                                            <span className="text-sm font-black text-emerald-900">${suggestedGoals.reduce((acc, curr) => acc + curr.SuggestedAmount, 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                        </div>
                                        <button 
                                            onClick={handleAssignSuggestedGoals}
                                            disabled={loading}
                                            className="px-6 py-2.5 bg-emerald-600 text-white text-[10px] font-black uppercase tracking-widest hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-600/20 flex items-center gap-2"
                                        >
                                            <ArrowRight size={14} />
                                            Asignar a Sucursales
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
