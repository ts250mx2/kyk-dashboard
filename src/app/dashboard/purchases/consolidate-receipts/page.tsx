"use client";

import React, { useState, useRef } from "react";
import { 
    Receipt, 
    Combine, 
    ArrowRight, 
    PlayCircle, 
    Search, 
    Calendar, 
    Filter, 
    FileText, 
    ShoppingCart, 
    CheckCircle2, 
    Clock, 
    AlertCircle,
    MoreVertical,
    Link2,
    X,
    Maximize2,
    Minimize2,
    Upload,
    Loader2,
    FileUp,
    GitCompareArrows,
    ChevronDown,
    ChevronUp,
    Equal,
    AlertTriangle,
    Info,
    Package,
    Eye,
    EyeOff
} from "lucide-react";
import { cn } from "@/lib/utils";

// --- Types ---
interface KanbanItem {
    id: string;
    folio: string;
    date: string;
    provider: string;
    total: number;
    status: string;
    store?: string;
    itemsCount?: number;
    linkedTo?: string[];
    type: 'factura' | 'recibo' | 'orden';
    preview?: string | null;
    originalData?: any;
    notFound?: boolean;
    uuid?: string;
    groupId?: string;
}

interface ConsolidatedRow {
    groupId: string;
    factura: KanbanItem;
    recibo: KanbanItem;
    orden: KanbanItem;
    facturaItems?: any[];
    lookupMethod?: string;
}

interface CompareItem {
    Descripcion: string;
    facturaCantidad?: number;
    facturaPrecio?: number;
    facturaImporte?: number;
    reciboCantidad?: number;
    reciboPrecio?: number;
    reciboImporte?: number;
    ordenCantidad?: number;
    ordenPrecio?: number;
    ordenImporte?: number;
    hasDifference?: boolean;
}

export default function ConsolidarFacturasReciboPage() {
    const [searchTerm, setSearchTerm] = useState("");
    const [selectedItems, setSelectedItems] = useState<string[]>([]);
    const [isMaximized, setIsMaximized] = useState(false);
    
    // Unified State for Vertical Alignment
    const [rows, setRows] = useState<ConsolidatedRow[]>([]);
    const [isUploading, setIsUploading] = useState(false);
    const [isDragging, setIsDragging] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Compare modal state
    const [compareModalOpen, setCompareModalOpen] = useState(false);
    const [compareData, setCompareData] = useState<CompareItem[]>([]);
    const [compareLoading, setCompareLoading] = useState(false);
    const [compareGroupId, setCompareGroupId] = useState<string | null>(null);
    const [compareTotals, setCompareTotals] = useState<{factura: number, recibo: number, orden: number}>({factura: 0, recibo: 0, orden: 0});
    
    // Expanded factura items state
    const [expandedFacturaRows, setExpandedFacturaRows] = useState<Set<string>>(new Set());

    const toggleItemSelection = (id: string) => {
        setSelectedItems(prev => 
            prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
        );
    };

    const deleteRow = (groupId: string) => {
        setRows(prev => prev.filter(row => row.groupId !== groupId));
        setSelectedItems(prev => prev.filter(id => !id.includes(groupId)));
    };

    const handleFileUpload = async (file: File) => {
        setIsUploading(true);
        const groupId = `group-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        const formData = new FormData();
        formData.append('file', file);

        try {
            const response = await fetch('/api/purchases/consolidate/process', {
                method: 'POST',
                body: formData,
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Error al procesar el archivo');
            }

            // 1. Create Factura Item
            const facturaTotal = data.facturaTotalFromOCR || data.receipt?.Total || 
                (data.facturaItems?.reduce((s: number, i: any) => s + (i.Importe || 0), 0)) || 0;
            const newFactura: KanbanItem = {
                id: `f-${groupId}`,
                folio: data.facturaNumero || data.document.name,
                date: new Date().toLocaleDateString(),
                provider: data.facturaProveedor || data.receipt?.Proveedor || 'Proveedor no identificado',
                total: facturaTotal,
                status: 'Procesada',
                type: 'factura',
                preview: data.document.preview,
                uuid: data.uuid,
                groupId,
                originalData: data.document,
                itemsCount: data.facturaItems?.length || 0
            };

            // 2. Create Recibo Item
            let newRecibo: KanbanItem;
            if (data.receipt) {
                newRecibo = {
                    id: `r-${groupId}`,
                    folio: data.receipt.FolioReciboMovil,
                    date: data.receipt.FechaRecibo?.split('T')[0] || '',
                    provider: data.receipt.Proveedor,
                    total: data.receipt.Total,
                    status: data.lookupMethod === 'numero+proveedor' ? 'Encontrado (Número)' : 'Recibido',
                    store: data.receipt.Tienda,
                    type: 'recibo',
                    groupId,
                    originalData: data.receipt
                };
            } else {
                newRecibo = {
                    id: `r-not-found-${groupId}`,
                    folio: 'NO ENCONTRADO',
                    date: '--',
                    provider: 'Recibo no hallado',
                    total: 0,
                    status: 'Error',
                    type: 'recibo',
                    notFound: true,
                    groupId
                };
            }

            // 3. Create Orden Item
            let newOrden: KanbanItem;
            if (data.order) {
                newOrden = {
                    id: `o-${groupId}`,
                    folio: data.order.IdOrdenCompra,
                    date: data.order.FechaOrdenCompra?.split('T')[0] || '',
                    provider: data.order.Proveedor,
                    total: data.order.TotalPedido,
                    status: data.order.Status,
                    store: data.order.Tienda,
                    type: 'orden',
                    groupId,
                    originalData: data.order
                };
            } else {
                newOrden = {
                    id: `o-not-found-${groupId}`,
                    folio: 'NO ENCONTRADA',
                    date: '--',
                    provider: 'Orden no hallada',
                    total: 0,
                    status: 'Error',
                    type: 'orden',
                    notFound: true,
                    groupId
                };
            }

            // Update State with the new row including facturaItems
            setRows(prev => [{
                groupId,
                factura: newFactura,
                recibo: newRecibo,
                orden: newOrden,
                facturaItems: data.facturaItems || [],
                lookupMethod: data.lookupMethod || 'none'
            }, ...prev]);

            // Auto-expand the factura items table if items were extracted
            if (data.facturaItems && data.facturaItems.length > 0) {
                setExpandedFacturaRows(prev => new Set([...prev, groupId]));
            }

        } catch (error: any) {
            console.error('Upload Error:', error);
            alert(`Error: ${error.message}`);
        } finally {
            setIsUploading(false);
        }
    };

    const handleCompare = async (row: ConsolidatedRow) => {
        setCompareLoading(true);
        setCompareModalOpen(true);
        setCompareGroupId(row.groupId);

        try {
            const receipt = row.recibo.originalData;
            const order = row.orden.originalData;
            
            // Fetch detail items from backend
            const params = new URLSearchParams();
            if (receipt) {
                params.set('idReciboMovil', receipt.IdReciboMovil);
                params.set('idTienda', receipt.IdTienda);
            }
            if (order) {
                params.set('idOrdenCompra', order.IdOrdenCompra);
            }

            let receiptItems: any[] = [];
            let orderItems: any[] = [];

            if (receipt) {
                const res = await fetch(`/api/purchases/consolidate/compare?${params.toString()}`);
                const data = await res.json();
                receiptItems = data.receiptItems || [];
                orderItems = data.orderItems || [];
            }

            const facturaItems = row.facturaItems || [];

            // Merge all items by description (fuzzy match)
            const mergedMap = new Map<string, CompareItem>();

            // Add factura items
            facturaItems.forEach((item: any) => {
                const key = normalizeDesc(item.Descripcion);
                const existing: CompareItem = mergedMap.get(key) || { Descripcion: item.Descripcion };
                existing.facturaCantidad = item.Cantidad;
                existing.facturaPrecio = item.PrecioUnitario;
                existing.facturaImporte = item.Importe;
                mergedMap.set(key, existing);
            });

            // Add receipt items
            receiptItems.forEach((item: any) => {
                const key = normalizeDesc(item.Descripcion);
                const existing: CompareItem = mergedMap.get(key) || { Descripcion: item.Descripcion };
                existing.reciboCantidad = item.Cantidad;
                existing.reciboPrecio = item.PrecioUnitario;
                existing.reciboImporte = item.Total;
                mergedMap.set(key, existing);
            });

            // Add order items
            orderItems.forEach((item: any) => {
                const key = normalizeDesc(item.Descripcion);
                const existing: CompareItem = mergedMap.get(key) || { Descripcion: item.Descripcion };
                existing.ordenCantidad = item.Cantidad;
                existing.ordenPrecio = item.PrecioUnitario;
                existing.ordenImporte = item.Total;
                mergedMap.set(key, existing);
            });

            // Mark differences
            const merged = Array.from(mergedMap.values()).map(item => ({
                ...item,
                hasDifference: checkDifference(item)
            }));

            // Calculate totals
            const totals = {
                factura: facturaItems.reduce((s: number, i: any) => s + (i.Importe || 0), 0),
                recibo: receiptItems.reduce((s: number, i: any) => s + (i.Total || 0), 0),
                orden: orderItems.reduce((s: number, i: any) => s + (i.Total || 0), 0),
            };

            setCompareData(merged);
            setCompareTotals(totals);
        } catch (error: any) {
            console.error('Compare Error:', error);
            alert(`Error al comparar: ${error.message}`);
        } finally {
            setCompareLoading(false);
        }
    };

    const normalizeDesc = (desc: string): string => {
        return (desc || '').toLowerCase().replace(/[^a-z0-9]/g, '').substring(0, 30);
    };

    const checkDifference = (item: CompareItem): boolean => {
        const quantities = [item.facturaCantidad, item.reciboCantidad, item.ordenCantidad].filter(v => v !== undefined);
        if (quantities.length < 2) return quantities.length === 1; // Only in one source

        const uniqueQty = new Set(quantities.map(q => Math.round((q || 0) * 100)));
        return uniqueQty.size > 1;
    };

    const onDrop = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
            handleFileUpload(e.dataTransfer.files[0]);
        }
    };

    const onDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(true);
    };

    // Filter logic
    const filteredRows = rows.filter(row => {
        const search = searchTerm.toLowerCase();
        return (
            row.factura.folio.toLowerCase().includes(search) ||
            row.factura.provider.toLowerCase().includes(search) ||
            row.recibo.folio.toLowerCase().includes(search) ||
            row.orden.folio.toLowerCase().includes(search)
        );
    });

    const fmt = (v: number) => new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(v);

    return (
        <div className="flex flex-col h-screen bg-slate-50 relative overflow-hidden">
            {/* Header: Fixed Top */}
            <header className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between sticky top-0 z-40 shadow-sm">
                <div className="flex items-center gap-4">
                    <div className="p-2.5 bg-slate-100 rounded-none border border-slate-200">
                        <Combine size={24} className="text-[#4050B4]" />
                    </div>
                    <div>
                        <h1 className="text-xl font-black text-slate-800 tracking-tighter uppercase leading-none">Consolidación de Documentos</h1>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Sincronización de Facturas, Recibos y Ordenes</p>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                        <input 
                            type="search" 
                            placeholder="Buscar folio, proveedor o UUID..."
                            className="pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#4050B4]/20 focus:border-[#4050B4] w-64 transition-all"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                    <button 
                        onClick={() => fileInputRef.current?.click()}
                        disabled={isUploading}
                        className="flex items-center gap-2 bg-[#4050B4] hover:bg-[#344092] text-white px-4 py-2 text-xs font-black uppercase tracking-widest transition-all shadow-lg active:scale-95 disabled:opacity-50"
                    >
                        {isUploading ? <Loader2 size={16} className="animate-spin" /> : <FileUp size={16} />}
                        Cargar Factura
                    </button>
                    <input 
                        type="file" 
                        ref={fileInputRef} 
                        className="hidden" 
                        accept="image/*,.pdf,.xml"
                        onChange={(e) => e.target.files?.[0] && handleFileUpload(e.target.files[0])}
                    />
                </div>
            </header>

            {/* Main Content Area */}
            <main 
                className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar"
                onDrop={onDrop}
                onDragOver={onDragOver}
                onDragLeave={() => setIsDragging(false)}
            >
                {/* Column Headers: Row-Aligned */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 sticky top-0 z-30 bg-slate-50 py-2 border-b border-transparent">
                    <ColumnHeader title="Facturas" icon={<FileText size={18} />} color="border-purple-500" bgColor="bg-purple-100/50" />
                    <ColumnHeader title="Recibos Móvil" icon={<Receipt size={18} />} color="border-emerald-500" bgColor="bg-emerald-100/50" />
                    <ColumnHeader title="Ordenes de Compra" icon={<ShoppingCart size={18} />} color="border-[#4050B4]" bgColor="bg-blue-100/50" />
                </div>

                {/* Uploading Overlay */}
                {isUploading && (
                    <div className="w-full h-32 flex flex-col items-center justify-center bg-white border-2 border-dashed border-[#4050B4]/20 rounded-none animate-pulse">
                        <Loader2 className="w-8 h-8 text-[#4050B4] animate-spin mb-2" />
                        <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Analizando documento con Claude 3.5...</p>
                    </div>
                )}

                {/* Grid Rows */}
                <div className="space-y-6">
                    {filteredRows.length > 0 ? (
                        filteredRows.map((row) => (
                            <div key={row.groupId} className="space-y-2">
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-stretch border-b border-slate-100 pb-2 last:border-0 hover:bg-slate-100/30 transition-colors">
                                    <KanbanCard 
                                        item={row.factura} 
                                        isSelected={selectedItems.includes(row.factura.id)}
                                        onToggle={() => toggleItemSelection(row.factura.id)}
                                        onDelete={() => deleteRow(row.groupId)}
                                    />
                                    <KanbanCard 
                                        item={row.recibo} 
                                        isSelected={selectedItems.includes(row.recibo.id)}
                                        onToggle={() => toggleItemSelection(row.recibo.id)}
                                        onDelete={() => deleteRow(row.groupId)}
                                    />
                                    <KanbanCard 
                                        item={row.orden} 
                                        isSelected={selectedItems.includes(row.orden.id)}
                                        onToggle={() => toggleItemSelection(row.orden.id)}
                                        onDelete={() => deleteRow(row.groupId)}
                                    />
                                </div>
                                {/* Row action bar */}
                                <div className="flex items-center justify-between px-2">
                                    <div className="flex items-center gap-3">
                                        {row.lookupMethod && row.lookupMethod !== 'none' && (
                                            <div className="flex items-center gap-1.5 text-[10px]">
                                                <Info size={12} className={row.lookupMethod === 'uuid' ? 'text-emerald-500' : 'text-amber-500'} />
                                                <span className="font-bold text-slate-400 uppercase tracking-wider">
                                                    Encontrado por: {row.lookupMethod === 'uuid' ? 'UUID' : 'Número + Proveedor'}
                                                </span>
                                            </div>
                                        )}
                                        {row.facturaItems && row.facturaItems.length > 0 && (
                                            <button
                                                onClick={() => {
                                                    setExpandedFacturaRows(prev => {
                                                        const next = new Set(prev);
                                                        if (next.has(row.groupId)) next.delete(row.groupId);
                                                        else next.add(row.groupId);
                                                        return next;
                                                    });
                                                }}
                                                className="flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-black uppercase tracking-widest text-purple-700 bg-purple-50 border border-purple-200 hover:bg-purple-100 transition-all"
                                            >
                                                {expandedFacturaRows.has(row.groupId) ? <EyeOff size={12} /> : <Eye size={12} />}
                                                <Package size={12} />
                                                {row.facturaItems.length} Productos Factura
                                                {expandedFacturaRows.has(row.groupId) ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                                            </button>
                                        )}
                                    </div>
                                    <button
                                        onClick={() => handleCompare(row)}
                                        disabled={row.recibo.notFound && (!row.facturaItems || row.facturaItems.length === 0)}
                                        className={cn(
                                            "flex items-center gap-2 px-4 py-2 text-[10px] font-black uppercase tracking-widest transition-all",
                                            "border border-indigo-200 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 hover:border-indigo-300 active:scale-95",
                                            "disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-indigo-50"
                                        )}
                                    >
                                        <GitCompareArrows size={14} />
                                        Comparativa de Productos
                                    </button>
                                </div>
                                
                                {/* Expanded Factura Items Table */}
                                {expandedFacturaRows.has(row.groupId) && row.facturaItems && row.facturaItems.length > 0 && (
                                    <FacturaItemsTable items={row.facturaItems} />
                                )}
                            </div>
                        ))
                    ) : !isUploading && (
                        <div className="flex flex-col items-center justify-center p-20 text-center space-y-4 border-2 border-dashed border-slate-200">
                            <div className={cn(
                                "p-6 rounded-full transition-all duration-500",
                                isDragging ? "bg-purple-100 scale-125" : "bg-slate-100"
                            )}>
                                <Upload size={48} className={cn(isDragging ? "text-purple-500" : "text-slate-300")} />
                            </div>
                            <div className="max-w-xs space-y-2">
                                <h3 className="font-black text-slate-700 tracking-tight uppercase">No hay documentos procesados</h3>
                                <p className="text-xs text-slate-400 font-medium leading-relaxed uppercase tracking-tighter">
                                    {isDragging ? "¡Suéltalo ahora!" : "Arrastra tus facturas (XML, Imagen o PDF) aquí para comenzar la consolidación automática."}
                                </p>
                            </div>
                        </div>
                    )}
                </div>
            </main>

            {/* Float Actions */}
            <aside className="fixed bottom-8 right-8 z-50 flex items-center gap-3">
                {selectedItems.length > 0 && (
                    <button className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-3 text-xs font-black uppercase tracking-widest shadow-2xl transition-all scale-105">
                        <CheckCircle2 size={18} />
                        Consolidar Seleccionados ({selectedItems.length})
                    </button>
                )}
            </aside>

            {/* Compare Modal */}
            {compareModalOpen && (
                <div className="fixed inset-0 z-[10000] bg-slate-950/50 backdrop-blur-md flex items-center justify-center p-4 md:p-8 animate-in fade-in duration-200">
                    <div className="bg-white w-full max-w-6xl max-h-[90vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden">
                        {/* Modal Header */}
                        <div className="px-6 py-5 bg-gradient-to-r from-indigo-600 to-purple-600 text-white flex items-center justify-between shrink-0">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-white/20 backdrop-blur-sm rounded-lg">
                                    <GitCompareArrows size={22} />
                                </div>
                                <div>
                                    <h2 className="text-lg font-black uppercase tracking-tight leading-none">Comparativa de Productos</h2>
                                    <p className="text-[10px] font-bold text-white/70 uppercase tracking-widest mt-1">Factura vs Recibo Móvil vs Orden de Compra</p>
                                </div>
                            </div>
                            <button 
                                onClick={() => { setCompareModalOpen(false); setCompareData([]); setCompareGroupId(null); }}
                                className="p-2 hover:bg-white/20 rounded-lg transition-colors"
                            >
                                <X size={22} />
                            </button>
                        </div>

                        {/* Modal Body */}
                        <div className="flex-1 overflow-auto p-6">
                            {compareLoading ? (
                                <div className="flex flex-col items-center justify-center py-20 space-y-4">
                                    <Loader2 className="w-10 h-10 text-indigo-600 animate-spin" />
                                    <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest">Cargando detalle de productos...</p>
                                </div>
                            ) : compareData.length === 0 ? (
                                <div className="flex flex-col items-center justify-center py-20 space-y-4">
                                    <AlertCircle className="w-12 h-12 text-slate-300" />
                                    <p className="text-sm font-bold text-slate-400">No hay productos para comparar</p>
                                </div>
                            ) : (
                                <>
                                    {/* Summary Cards */}
                                    <div className="grid grid-cols-3 gap-4 mb-6">
                                        <div className="p-4 bg-purple-50 border border-purple-200">
                                            <span className="text-[9px] font-black text-purple-400 uppercase tracking-widest block">Total Factura</span>
                                            <span className="text-xl font-black text-purple-700">{fmt(compareTotals.factura)}</span>
                                        </div>
                                        <div className="p-4 bg-emerald-50 border border-emerald-200">
                                            <span className="text-[9px] font-black text-emerald-400 uppercase tracking-widest block">Total Recibo</span>
                                            <span className="text-xl font-black text-emerald-700">{fmt(compareTotals.recibo)}</span>
                                        </div>
                                        <div className="p-4 bg-blue-50 border border-blue-200">
                                            <span className="text-[9px] font-black text-blue-400 uppercase tracking-widest block">Total Orden</span>
                                            <span className="text-xl font-black text-blue-700">{fmt(compareTotals.orden)}</span>
                                        </div>
                                    </div>

                                    {/* Differences Badge */}
                                    {compareData.some(d => d.hasDifference) && (
                                        <div className="flex items-center gap-2 px-4 py-3 bg-amber-50 border border-amber-200 mb-4">
                                            <AlertTriangle size={16} className="text-amber-500" />
                                            <span className="text-[11px] font-black text-amber-700 uppercase tracking-wider">
                                                {compareData.filter(d => d.hasDifference).length} Producto(s) con diferencias detectadas
                                            </span>
                                        </div>
                                    )}

                                    {/* Table */}
                                    <div className="overflow-x-auto border border-slate-200">
                                        <table className="w-full text-left text-sm border-collapse">
                                            <thead>
                                                <tr className="bg-slate-50 border-b border-slate-200">
                                                    <th className="px-4 py-3 text-[9px] font-black text-slate-500 uppercase tracking-widest w-[30%]">Descripción</th>
                                                    {/* Factura */}
                                                    <th className="px-3 py-3 text-[9px] font-black text-purple-500 uppercase tracking-widest text-right bg-purple-50/50">Cant. Factura</th>
                                                    <th className="px-3 py-3 text-[9px] font-black text-purple-500 uppercase tracking-widest text-right bg-purple-50/50">P.U. Factura</th>
                                                    <th className="px-3 py-3 text-[9px] font-black text-purple-500 uppercase tracking-widest text-right bg-purple-50/50">Importe Factura</th>
                                                    {/* Recibo */}
                                                    <th className="px-3 py-3 text-[9px] font-black text-emerald-500 uppercase tracking-widest text-right bg-emerald-50/50">Cant. Recibo</th>
                                                    <th className="px-3 py-3 text-[9px] font-black text-emerald-500 uppercase tracking-widest text-right bg-emerald-50/50">P.U. Recibo</th>
                                                    <th className="px-3 py-3 text-[9px] font-black text-emerald-500 uppercase tracking-widest text-right bg-emerald-50/50">Importe Recibo</th>
                                                    {/* Orden */}
                                                    <th className="px-3 py-3 text-[9px] font-black text-blue-500 uppercase tracking-widest text-right bg-blue-50/50">Cant. Orden</th>
                                                    <th className="px-3 py-3 text-[9px] font-black text-blue-500 uppercase tracking-widest text-right bg-blue-50/50">P.U. Orden</th>
                                                    <th className="px-3 py-3 text-[9px] font-black text-blue-500 uppercase tracking-widest text-right bg-blue-50/50">Importe Orden</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-100">
                                                {compareData.map((item, i) => (
                                                    <tr key={i} className={cn(
                                                        "hover:bg-slate-50 transition-colors",
                                                        item.hasDifference && "bg-amber-50/40"
                                                    )}>
                                                        <td className="px-4 py-2.5 font-bold text-slate-800 text-[11px]">
                                                            <div className="flex items-center gap-2">
                                                                {item.hasDifference && <AlertTriangle size={12} className="text-amber-500 shrink-0" />}
                                                                <span className="truncate max-w-[250px]">{item.Descripcion}</span>
                                                            </div>
                                                        </td>
                                                        {/* Factura */}
                                                        <td className="px-3 py-2.5 text-right font-mono text-[11px] text-slate-700 bg-purple-50/20">
                                                            {item.facturaCantidad !== undefined ? item.facturaCantidad : <span className="text-slate-300">—</span>}
                                                        </td>
                                                        <td className="px-3 py-2.5 text-right font-mono text-[11px] text-slate-700 bg-purple-50/20">
                                                            {item.facturaPrecio !== undefined ? fmt(item.facturaPrecio) : <span className="text-slate-300">—</span>}
                                                        </td>
                                                        <td className="px-3 py-2.5 text-right font-mono text-[11px] font-bold text-purple-700 bg-purple-50/20">
                                                            {item.facturaImporte !== undefined ? fmt(item.facturaImporte) : <span className="text-slate-300">—</span>}
                                                        </td>
                                                        {/* Recibo */}
                                                        <td className="px-3 py-2.5 text-right font-mono text-[11px] text-slate-700 bg-emerald-50/20">
                                                            {item.reciboCantidad !== undefined ? item.reciboCantidad : <span className="text-slate-300">—</span>}
                                                        </td>
                                                        <td className="px-3 py-2.5 text-right font-mono text-[11px] text-slate-700 bg-emerald-50/20">
                                                            {item.reciboPrecio !== undefined ? fmt(item.reciboPrecio) : <span className="text-slate-300">—</span>}
                                                        </td>
                                                        <td className="px-3 py-2.5 text-right font-mono text-[11px] font-bold text-emerald-700 bg-emerald-50/20">
                                                            {item.reciboImporte !== undefined ? fmt(item.reciboImporte) : <span className="text-slate-300">—</span>}
                                                        </td>
                                                        {/* Orden */}
                                                        <td className="px-3 py-2.5 text-right font-mono text-[11px] text-slate-700 bg-blue-50/20">
                                                            {item.ordenCantidad !== undefined ? item.ordenCantidad : <span className="text-slate-300">—</span>}
                                                        </td>
                                                        <td className="px-3 py-2.5 text-right font-mono text-[11px] text-slate-700 bg-blue-50/20">
                                                            {item.ordenPrecio !== undefined ? fmt(item.ordenPrecio) : <span className="text-slate-300">—</span>}
                                                        </td>
                                                        <td className="px-3 py-2.5 text-right font-mono text-[11px] font-bold text-blue-700 bg-blue-50/20">
                                                            {item.ordenImporte !== undefined ? fmt(item.ordenImporte) : <span className="text-slate-300">—</span>}
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                            <tfoot>
                                                <tr className="bg-slate-100 border-t-2 border-slate-300">
                                                    <td className="px-4 py-3 text-[10px] font-black text-slate-600 uppercase tracking-widest">Totales</td>
                                                    <td colSpan={2} className="px-3 py-3 bg-purple-50/30"></td>
                                                    <td className="px-3 py-3 text-right font-mono text-sm font-black text-purple-700 bg-purple-50/30">{fmt(compareTotals.factura)}</td>
                                                    <td colSpan={2} className="px-3 py-3 bg-emerald-50/30"></td>
                                                    <td className="px-3 py-3 text-right font-mono text-sm font-black text-emerald-700 bg-emerald-50/30">{fmt(compareTotals.recibo)}</td>
                                                    <td colSpan={2} className="px-3 py-3 bg-blue-50/30"></td>
                                                    <td className="px-3 py-3 text-right font-mono text-sm font-black text-blue-700 bg-blue-50/30">{fmt(compareTotals.orden)}</td>
                                                </tr>
                                            </tfoot>
                                        </table>
                                    </div>
                                </>
                            )}
                        </div>

                        {/* Modal Footer */}
                        <div className="px-6 py-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between shrink-0">
                            <div className="flex items-center gap-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                <span>{compareData.length} Productos</span>
                                {compareData.some(d => d.hasDifference) && (
                                    <>
                                        <span className="w-px h-4 bg-slate-200" />
                                        <span className="text-amber-500">{compareData.filter(d => d.hasDifference).length} Con Diferencias</span>
                                    </>
                                )}
                            </div>
                            <button 
                                onClick={() => { setCompareModalOpen(false); setCompareData([]); setCompareGroupId(null); }}
                                className="px-6 py-2.5 bg-slate-900 text-white text-[10px] font-black uppercase tracking-widest hover:bg-slate-800 transition-colors"
                            >
                                Cerrar
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

function ColumnHeader({ title, icon, color, bgColor }: { title: string, icon: React.ReactNode, color: string, bgColor: string }) {
    return (
        <div className={cn("px-4 py-3 border-b-2 bg-white flex items-center justify-between shadow-sm", color)}>
            <div className="flex items-center gap-2">
                <span className="text-slate-600">{icon}</span>
                <h3 className="font-black text-[11px] uppercase tracking-widest text-slate-800">{title}</h3>
            </div>
        </div>
    );
}

function KanbanCard({ item, isSelected, onToggle, onDelete }: { item: KanbanItem, isSelected: boolean, onToggle: () => void, onDelete: () => void }) {
    const groupColor = item.groupId ? `hsl(${parseInt(item.groupId.split('-')[1]) % 360}, 60%, 50%)` : 'transparent';

    return (
        <div 
            onClick={onToggle}
            className={cn(
                "group relative bg-white border p-4 transition-all cursor-pointer select-none flex flex-col min-h-[260px] h-full",
                isSelected 
                    ? "border-[#4050B4] ring-2 ring-[#4050B4]/10 shadow-lg" 
                    : "border-slate-200 hover:border-slate-300 hover:shadow-md",
                item.notFound && "opacity-75 grayscale-[0.5] border-dashed border-rose-300 bg-rose-50/20"
            )}
            style={{ borderLeft: item.groupId ? `4px solid ${groupColor}` : undefined }}
        >
            {isSelected && (
                <div className="absolute top-0 right-0 p-1">
                    <CheckCircle2 size={14} className="text-[#4050B4]" />
                </div>
            )}
            
            {item.notFound && (
                <div className="absolute top-2 right-2 z-10">
                    <div className="flex items-center gap-1 bg-rose-500 text-white px-2 py-0.5 text-[8px] font-black uppercase tracking-tighter">
                        <AlertCircle size={8} />
                        No encontrado
                    </div>
                </div>
            )}
            
            {/* Header */}
            <div className="flex justify-between items-start shrink-0 pb-3 border-b border-slate-50 mb-3">
                <div className="space-y-0.5 w-[70%]">
                    <span className={cn(
                        "text-[9px] font-black uppercase tracking-widest",
                        item.notFound ? "text-rose-400" : "text-slate-400"
                    )}>
                        Folio / Documento
                    </span>
                    <div className={cn(
                        "text-sm font-black tracking-tight truncate",
                        item.notFound ? "text-rose-700 italic" : "text-slate-800"
                    )}>
                        {item.folio}
                    </div>
                </div>
                <div className="space-y-0.5 text-right flex-1">
                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Fecha</span>
                    <div className="text-[11px] font-bold text-slate-600">{item.date}</div>
                </div>
            </div>

            {/* Middle */}
            <div className="flex-1 flex flex-col gap-3">
                {item.preview && (
                    <div className="space-y-2">
                        <div className="relative w-full h-24 bg-slate-100 overflow-hidden border border-slate-100">
                            <img 
                                src={item.preview} 
                                alt="Preview" 
                                className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                            />
                            <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                <Maximize2 size={20} className="text-white" />
                            </div>
                        </div>
                        {item.uuid && (
                            <div className="bg-slate-50 p-2 border border-slate-200">
                                <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest block mb-1">Extracted UUID</span>
                                <code className="text-[9px] font-black text-[#4050B4] break-all block leading-tight">
                                    {item.uuid}
                                </code>
                            </div>
                        )}
                    </div>
                )}

                <div className="space-y-1">
                    <div>
                        <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block">Proveedor</span>
                        <div className={cn(
                            "text-[11px] font-black truncate uppercase",
                            item.notFound ? "text-rose-500" : "text-[#4050B4]"
                        )}>
                            {item.provider}
                        </div>
                    </div>

                    {item.store && (
                        <div className="flex items-center gap-1.5 text-slate-500">
                            <div className="w-1 h-1 rounded-full bg-slate-300" />
                            <span className="text-[10px] font-bold uppercase tracking-tight">{item.store}</span>
                        </div>
                    )}
                </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between pt-3 border-t border-slate-100 shrink-0 mt-3">
                <div className="flex items-center gap-2">
                    {item.itemsCount && (
                        <div className="flex items-center gap-1 text-slate-400">
                            <Link2 size={10} />
                            <span className="text-[9px] font-black">{item.itemsCount} Art.</span>
                        </div>
                    )}
                    <div className={cn(
                        "px-2 py-0.5 text-[8px] font-black uppercase tracking-tighter",
                        item.status === 'Pendiente' ? "bg-amber-100 text-amber-600" :
                        item.status === 'Recibido' ? "bg-emerald-100 text-emerald-600" :
                        item.status === 'Encontrado (Número)' ? "bg-amber-100 text-amber-600" :
                        item.status === 'Autorizada' ? "bg-blue-100 text-blue-600" :
                        item.status === 'Error' ? "bg-rose-100 text-rose-600" :
                        "bg-slate-100 text-slate-500"
                    )}>
                        {item.status}
                    </div>
                </div>
                <div className={cn(
                    "text-sm font-black text-right min-w-[70px]",
                    item.notFound ? "text-slate-300 line-through" : "text-slate-900"
                )}>
                    {new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(item.total)}
                </div>
            </div>
            
            {/* Actions */}
            <div className="absolute top-2 left-2 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1 bg-white/90 backdrop-blur-sm p-1 shadow-md border border-slate-200 z-50">
                <button 
                    onClick={(e) => {
                        e.stopPropagation();
                        if (confirm('¿Estás seguro de eliminar esta factura y sus registros vinculados?')) {
                            onDelete();
                        }
                    }}
                    className="p-1 hover:bg-rose-100 text-rose-500 transition-colors rounded-sm"
                >
                    <X size={14} strokeWidth={3} />
                </button>
            </div>
        </div>
    );
}

function FacturaItemsTable({ items }: { items: any[] }) {
    const fmt = (v: number) => new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(v);
    const total = items.reduce((s, i) => s + (i.Importe || 0), 0);
    
    return (
        <div className="bg-purple-50/50 border border-purple-200 overflow-hidden animate-in slide-in-from-top-2 duration-200">
            <div className="px-4 py-2.5 bg-purple-100/60 border-b border-purple-200 flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <Package size={14} className="text-purple-600" />
                    <span className="text-[10px] font-black text-purple-700 uppercase tracking-widest">Productos Extraídos de Factura</span>
                </div>
                <div className="flex items-center gap-3">
                    <span className="text-[10px] font-black text-purple-500 uppercase tracking-wider">{items.length} productos</span>
                    <span className="text-xs font-black text-purple-800">{fmt(total)}</span>
                </div>
            </div>
            <div className="overflow-x-auto max-h-[300px] overflow-y-auto">
                <table className="w-full text-left text-sm border-collapse">
                    <thead className="sticky top-0 z-10">
                        <tr className="bg-purple-100/80 border-b border-purple-200">
                            <th className="px-4 py-2 text-[9px] font-black text-purple-600 uppercase tracking-widest w-[8%]">#</th>
                            <th className="px-4 py-2 text-[9px] font-black text-purple-600 uppercase tracking-widest text-right w-[10%]">Cantidad</th>
                            <th className="px-4 py-2 text-[9px] font-black text-purple-600 uppercase tracking-widest w-[8%]">Unidad</th>
                            <th className="px-4 py-2 text-[9px] font-black text-purple-600 uppercase tracking-widest w-[40%]">Descripción</th>
                            <th className="px-4 py-2 text-[9px] font-black text-purple-600 uppercase tracking-widest text-right w-[14%]">P. Unitario</th>
                            <th className="px-4 py-2 text-[9px] font-black text-purple-600 uppercase tracking-widest text-right w-[10%]">Descuento</th>
                            <th className="px-4 py-2 text-[9px] font-black text-purple-600 uppercase tracking-widest text-right w-[14%]">Importe</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-purple-100">
                        {items.map((item: any, i: number) => (
                            <tr key={i} className="hover:bg-purple-100/40 transition-colors">
                                <td className="px-4 py-2 text-[10px] font-bold text-purple-400">{i + 1}</td>
                                <td className="px-4 py-2 text-right font-mono text-[11px] font-bold text-slate-800">
                                    {item.Cantidad}
                                </td>
                                <td className="px-4 py-2 text-[10px] font-bold text-slate-500 uppercase">
                                    {item.Unidad || '—'}
                                </td>
                                <td className="px-4 py-2 text-[11px] font-bold text-slate-800 max-w-[300px]">
                                    <span className="line-clamp-2">{item.Descripcion}</span>
                                </td>
                                <td className="px-4 py-2 text-right font-mono text-[11px] text-slate-700">
                                    {item.PrecioUnitario !== undefined ? fmt(item.PrecioUnitario) : '—'}
                                </td>
                                <td className="px-4 py-2 text-right font-mono text-[11px] text-rose-500">
                                    {item.Descuento && item.Descuento > 0 ? fmt(item.Descuento) : '—'}
                                </td>
                                <td className="px-4 py-2 text-right font-mono text-[11px] font-bold text-purple-700">
                                    {item.Importe !== undefined ? fmt(item.Importe) : '—'}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                    <tfoot>
                        <tr className="bg-purple-100/80 border-t-2 border-purple-300">
                            <td colSpan={6} className="px-4 py-2.5 text-[10px] font-black text-purple-600 uppercase tracking-widest text-right">Total</td>
                            <td className="px-4 py-2.5 text-right font-mono text-sm font-black text-purple-800">{fmt(total)}</td>
                        </tr>
                    </tfoot>
                </table>
            </div>
        </div>
    );
}
