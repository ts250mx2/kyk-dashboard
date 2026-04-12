"use client";

import React, { useState, useEffect, useMemo } from 'react';
import { 
    X, 
    Maximize2, 
    Minimize2, 
    LayoutGrid, 
    FileSpreadsheet, 
    Check, 
    ExternalLink, 
    Search, 
    RotateCcw, 
    ArrowUpRight, 
    Clock, 
    Receipt,
    Filter,
    ArrowLeftRight,
    AlertTriangle,
    FileCode,
    FileText,
    Download
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { ReceiptDetailModal } from '@/components/receipt-detail-modal';
import { InvoiceConceptsModal } from '@/components/purchases/InvoiceConceptsModal';
import { generateInvoicePDF } from '@/utils/cfdi-pdf-renderer';
import { PurchaseOrder, DistributionItem, DistributionDetailItem, OrderDetail, InvoiceDetail } from '@/types/purchases';

interface PurchaseKanbanModalProps {
    isOpen: boolean;
    onClose: () => void;
    order: PurchaseOrder | null;
}

export function PurchaseKanbanModal({ isOpen, onClose, order }: PurchaseKanbanModalProps) {
    const [isMaximized, setIsMaximized] = useState(false);
    const [distributions, setDistributions] = useState<DistributionItem[]>([]);
    const [loadingDistributions, setLoadingDistributions] = useState(false);
    
    // Sub-modal states
    const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
    const [detailItems, setDetailItems] = useState<OrderDetail[]>([]);
    const [loadingDetails, setLoadingDetails] = useState(false);
    
    const [isReceiptModalOpen, setIsReceiptModalOpen] = useState(false);
    
    const [isDistDetailModalOpen, setIsDistDetailModalOpen] = useState(false);
    const [distDetailItems, setDistDetailItems] = useState<DistributionDetailItem[]>([]);
    const [loadingDistDetails, setLoadingDistDetails] = useState(false);
    const [selectedDistHeader, setSelectedDistHeader] = useState<{ tienda: string, folio: string | null, fecha: string | null } | null>(null);

    // Comparison states
    const [isComparisonModalOpen, setIsComparisonModalOpen] = useState(false);
    const [isInvoiceDetailModalOpen, setIsInvoiceDetailModalOpen] = useState(false);
    const [comparisonData, setComparisonData] = useState<{ orderItems: any[], receiptItems: any[], invoiceItems: any[] }>({ orderItems: [], receiptItems: [], invoiceItems: [] });
    const [relations, setRelations] = useState<any[]>([]);
    const [loadingComparison, setLoadingComparison] = useState(false);
    const [compareSearch, setCompareSearch] = useState('');
    const [invoiceSearch, setInvoiceSearch] = useState('');
    const [draggedInvoiceItem, setDraggedInvoiceItem] = useState<any | null>(null);
    const [dropTargetKey, setDropTargetKey] = useState<string | null>(null);

    // Invoice State
    const [invoiceData, setInvoiceData] = useState<InvoiceDetail | null>(null);
    const [loadingInvoice, setLoadingInvoice] = useState(false);
    const [loadingXml, setLoadingXml] = useState(false);

    const idComputadora = typeof window !== 'undefined' ? sessionStorage.getItem('kyk_id_computadora') : null;

    useEffect(() => {
        if (isOpen && order) {
            fetchDistributions(order.IdOrdenCompra);
            if (order.UUID && order.UUID !== '-') {
                fetchInvoiceData(order.UUID);
            } else {
                setInvoiceData(null);
            }
        }
    }, [isOpen, order]);

    const fetchDistributions = async (idOrdenCompra: number) => {
        if (!idOrdenCompra) {
            setDistributions([]);
            return;
        }
        setLoadingDistributions(true);
        try {
            const response = await fetch(`/api/purchases/orders/distributions?idOrdenCompra=${idOrdenCompra}`);
            const data = await response.json();
            if (response.ok) {
                setDistributions(data);
            } else {
                setDistributions([]);
            }
        } catch (error) {
            console.error('Error fetching distributions:', error);
            setDistributions([]);
        } finally {
            setLoadingDistributions(false);
        }
    };

    const fetchOrderDetails = async (idOrdenCompra: number) => {
        if (!idComputadora || !idOrdenCompra) return;
        setLoadingDetails(true);
        setIsDetailModalOpen(true);
        try {
            const res = await fetch(`/api/purchases/orders/details?idComputadora=${idComputadora}&idOrdenCompra=${idOrdenCompra}`);
            const data = await res.json();
            if (data.error) {
                console.error('API Error:', data.error);
            } else {
                setDetailItems(data);
            }
        } catch (error) {
            console.error('Error fetching order details:', error);
        } finally {
            setLoadingDetails(false);
        }
    };

    const fetchDistDetails = async (dist: DistributionItem) => {
        setLoadingDistDetails(true);
        setSelectedDistHeader({ 
            tienda: dist.TiendaDestino, 
            folio: dist.FolioSalida,
            fecha: dist.FechaSalida 
        });
        setIsDistDetailModalOpen(true);
        try {
            const originStoreId = order?.IdTienda || 0;
            const response = await fetch(`/api/purchases/orders/distributions/details?idOrdenCompra=${dist.IdOrdenCompra}&idTiendaDestino=${dist.IdTiendaDestino}&idTransferenciaSalida=${dist.IdTransferenciaSalida || 0}&idTiendaOrdenCompra=${originStoreId}`);
            const data = await response.json();
            if (response.ok) {
                setDistDetailItems(data);
            } else {
                setDistDetailItems([]);
            }
        } catch (error) {
            console.error('Error fetching distribution details:', error);
            setDistDetailItems([]);
        } finally {
            setLoadingDistDetails(false);
        }
    };

    const fetchComparisonData = async () => {
        if (!order) return;
        setLoadingComparison(true);
        setIsComparisonModalOpen(true);
        try {
            // 1. Fetch OC vs Receipt Items
            let ocRecPromise = Promise.resolve({ orderItems: [], receiptItems: [] });
            if (order.IdReciboMovil) {
                ocRecPromise = fetch(`/api/purchases/consolidate/compare?idReciboMovil=${order.IdReciboMovil}&idTienda=${order.IdTienda}&idOrdenCompra=${order.IdOrdenCompra || ''}`).then(r => r.json());
            }

            // 2. Fetch Invoice Items (if exists)
            let invoicePromise = Promise.resolve([]);
            if (order.UUID && order.UUID !== '-') {
                invoicePromise = fetch(`/api/purchases/invoices/concepts?uuid=${order.UUID}`).then(r => r.json());
            }

            // 3. Fetch Relations
            let relationsPromise = Promise.resolve([]);
            if (order.IdProveedor) {
                relationsPromise = fetch(`/api/purchases/invoices/relations?idProveedor=${order.IdProveedor}`).then(r => r.json());
            }

            const [ocRecData, invoiceData, relationsData] = await Promise.all([ocRecPromise, invoicePromise, relationsPromise]);
            
            setComparisonData({
                orderItems: ocRecData.orderItems || [],
                receiptItems: ocRecData.receiptItems || [],
                invoiceItems: invoiceData || []
            });
            setRelations(relationsData || []);

        } catch (error) {
            console.error('Error fetching comparison data:', error);
            setComparisonData({ orderItems: [], receiptItems: [], invoiceItems: [] });
        } finally {
            setLoadingComparison(false);
        }
    };

    const handleSaveRelation = async (codigoInterno: string, invoiceConcept: any) => {
        if (!order?.IdProveedor) return;
        try {
            const res = await fetch('/api/purchases/invoices/relations', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    CodigoInterno: codigoInterno,
                    IdProveedor: order.IdProveedor,
                    Descripcion: invoiceConcept.Descripcion,
                    NoIdentificacion: invoiceConcept.NoIdentificacion
                })
            });
            if (res.ok) {
                // Refresh relations
                const relRes = await fetch(`/api/purchases/invoices/relations?idProveedor=${order.IdProveedor}`);
                const relData = await relRes.json();
                setRelations(relData || []);
            }
        } catch (error) {
            console.error('Error saving relation:', error);
        }
    };

    const fetchInvoiceData = async (uuid: string) => {
        if (!uuid) return;
        setLoadingInvoice(true);
        try {
            const res = await fetch(`/api/purchases/invoices/details?uuid=${uuid}`);
            const data = await res.json();
            if (res.ok) {
                setInvoiceData(data);
            } else {
                console.error('Invoice fetch failed:', data.error);
                setInvoiceData(null);
            }
        } catch (error) {
            console.error('Error fetching invoice data:', error);
            setInvoiceData(null);
        } finally {
            setLoadingInvoice(false);
        }
    };

    const handleDownloadXml = async () => {
        if (!order?.UUID || order.UUID === '-') return;
        setLoadingXml(true);
        try {
            const res = await fetch(`/api/purchases/invoices/xml?uuid=${order.UUID}`);
            const data = await res.json();
            if (res.ok && data.xml) {
                const blob = new Blob([data.xml], { type: 'text/xml' });
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `${order.UUID}.xml`;
                document.body.appendChild(a);
                a.click();
                window.URL.revokeObjectURL(url);
                document.body.removeChild(a);
            } else {
                alert('No se pudo obtener el XML de esta factura.');
            }
        } catch (error) {
            console.error('Error downloading XML:', error);
            alert('Error al descargar el XML.');
        } finally {
            setLoadingXml(false);
        }
    };

    const handleViewPdf = async () => {
        if (!order?.UUID || order.UUID === '-') return;
        setLoadingXml(true);
        try {
            const res = await fetch(`/api/purchases/invoices/xml?uuid=${order.UUID}`);
            const data = await res.json();
            if (res.ok && data.xml) {
                const doc = await generateInvoicePDF(data.xml);
                const pdfBlob = doc.output('blob');
                const url = window.URL.createObjectURL(pdfBlob);
                window.open(url, '_blank');
            } else {
                alert('No se pudo obtener el XML para generar el PDF.');
            }
        } catch (error) {
            console.error('Error generating PDF:', error);
            alert('Error al generar la visualización del PDF.');
        } finally {
            setLoadingXml(false);
        }
    };

    const mergedComparison = useMemo(() => {
        const { orderItems, receiptItems, invoiceItems } = comparisonData;
        
        // Track matched invoice indices
        const matchedInvoiceIndices = new Set<number>();

        // SYSTEM ITEMS LIST
        const allInternalKeys = new Set([
            ...orderItems.map(i => i.CodigoInterno),
            ...receiptItems.map(i => i.CodigoInterno)
        ]);

        const system = Array.from(allInternalKeys).map(key => {
            const orderItem = orderItems.find(i => i.CodigoInterno === key);
            const receiptItem = receiptItems.find(i => i.CodigoInterno === key);
            
            // Try match
            let invoiceItem = invoiceItems.find((inv, idx) => {
                if (matchedInvoiceIndices.has(idx)) return false;
                const match = inv.NoIdentificacion === orderItem?.CodigoBarras || inv.NoIdentificacion === receiptItem?.CodigoBarras;
                if (match) matchedInvoiceIndices.add(idx);
                return match;
            });

            if (!invoiceItem) {
                const relation = relations.find(r => r.CodigoInterno === key);
                if (relation) {
                    invoiceItem = invoiceItems.find((inv, idx) => {
                        if (matchedInvoiceIndices.has(idx)) return false;
                        const match = inv.NoIdentificacion === relation.NoIdentificacion;
                        if (match) matchedInvoiceIndices.add(idx);
                        return match;
                    });
                }
            }

            return {
                CodigoInterno: key,
                CodigoBarras: orderItem?.CodigoBarras || receiptItem?.CodigoBarras,
                Descripcion: orderItem?.Descripcion || receiptItem?.Descripcion,
                Unidad: orderItem?.Unidad || receiptItem?.Unidad,
                CantidadOC: orderItem?.Cantidad || 0,
                CantidadRec: receiptItem?.Cantidad || 0,
                CantidadFact: invoiceItem?.Cantidad || 0,
                CostoOC: orderItem?.PrecioUnitario || 0,
                CostoRec: receiptItem?.PrecioUnitario || 0,
                CostoFact: invoiceItem?.ValorUnitario || 0,
                TotalOC: orderItem?.Total || 0,
                TotalRec: receiptItem?.Total || 0,
                TotalFact: invoiceItem?.Importe || 0,
                IsMatched: !!invoiceItem,
                IsInvoiceOnly: false
            };
        });

        // INVOICE ITEMS LIST (Filtered to unmatched)
        const invoiceOnly: any[] = [];
        invoiceItems.forEach((inv, idx) => {
            if (!matchedInvoiceIndices.has(idx)) {
                invoiceOnly.push({
                    CodigoInterno: 'FACT-' + idx,
                    CodigoBarras: inv.NoIdentificacion,
                    Descripcion: inv.Descripcion,
                    Unidad: inv.Unidad,
                    CantidadFact: inv.Cantidad,
                    CostoFact: inv.ValorUnitario,
                    TotalFact: inv.Importe,
                    IsMatched: false,
                    IsInvoiceOnly: true,
                    OriginalInvoiceItem: inv
                });
            }
        });

        return {
            system: system.filter(item => 
                item.Descripcion?.toLowerCase().includes(compareSearch.toLowerCase()) ||
                item.CodigoInterno?.toString().includes(compareSearch) ||
                item.CodigoBarras?.toLowerCase().includes(compareSearch.toLowerCase())
            ),
            invoiceOnly: invoiceOnly.filter(item =>
                item.Descripcion?.toLowerCase().includes(invoiceSearch.toLowerCase()) ||
                item.CodigoBarras?.toLowerCase().includes(invoiceSearch.toLowerCase())
            )
        };
    }, [comparisonData, relations, compareSearch, invoiceSearch]);

    const formatCurrency = (val: number) => {
        return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(val);
    };

    const formatDate = (dateStr: string) => {
        if (!dateStr) return "-";
        return new Date(dateStr).toLocaleDateString('es-MX', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric'
        });
    };

    const formatDateTime = (dateStr: string) => {
        if (!dateStr) return "-";
        return new Date(dateStr).toLocaleString('es-MX', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            hour12: false
        });
    };

    const getDaysDiff = (start: string | null | undefined, end: string | null | undefined) => {
        if (!start || !end) return null;
        const s = new Date(start);
        const e = new Date(end);
        const diffTime = e.getTime() - s.getTime();
        return Math.max(0, Math.floor(diffTime / (1000 * 60 * 60 * 24)));
    };

    if (!isOpen || !order) return null;

    return (
        <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-200">
            <div className={cn(
                "bg-white shadow-2xl border border-slate-200 flex flex-col animate-in slide-in-from-bottom-4 duration-300 transition-all",
                isMaximized ? "w-full h-full p-0 border-0 rounded-none" : "w-full max-w-7xl h-auto max-h-[90vh]"
            )}>
                {/* Modal Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-white shrink-0">
                    <div className="flex flex-col">
                        <h2 className="text-xl font-black text-slate-800 uppercase tracking-tight flex items-center gap-2">
                            <LayoutGrid className="text-[#4050B4]" size={24} />
                            Panel Kanban de Seguimiento
                            <span className="ml-2 px-2 py-0.5 bg-slate-100 text-slate-500 text-[11px] font-black tracking-widest border border-slate-200">
                                {order.Tienda}
                            </span>
                        </h2>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">
                            Orden #{order.IdOrdenCompra} — {order.Proveedor}
                        </p>
                    </div>
                    <div className="flex items-center gap-3">
                        {order.FolioReciboMovil && (
                            <button 
                                onClick={fetchComparisonData}
                                className="flex items-center gap-2 px-3 py-1.5 bg-emerald-50 text-emerald-600 hover:bg-emerald-600 hover:text-white transition-all text-[10px] font-black uppercase tracking-widest border border-emerald-200"
                            >
                                <ArrowLeftRight size={14} />
                                Comparativa OC vs Recibo
                            </button>
                        )}
                        <div className="flex items-center gap-2">
                            <button 
                                onClick={() => setIsMaximized(!isMaximized)}
                                className="p-2 hover:bg-slate-100 text-slate-400 hover:text-[#4050B4] transition-colors rounded-none"
                                title={isMaximized ? "Restaurar" : "Maximizar"}
                            >
                                {isMaximized ? <Minimize2 size={20} /> : <Maximize2 size={20} />}
                            </button>
                            <button 
                                onClick={onClose}
                                className="p-2 hover:bg-slate-100 text-slate-400 hover:text-rose-500 transition-colors rounded-none"
                            >
                                <X size={20} />
                            </button>
                        </div>
                    </div>
                </div>

                {/* Modal Content - Columns */}
                <div className={cn(
                    "p-6 grid gap-6 bg-slate-50/30 overflow-hidden relative transition-all",
                    distributions.length > 0 ? "grid-cols-1 lg:grid-cols-3" : "grid-cols-1 lg:grid-cols-3",
                    isMaximized ? "flex-1" : "h-[700px]"
                )}>
                    {/* Column 1: Orden de Compra */}
                    <div className="flex flex-col gap-4 overflow-hidden">
                        <div className="flex items-center justify-between gap-2 shrink-0">
                            <div className="flex items-center gap-2 px-3 py-1 bg-[#4050B4] text-white self-start">
                                <FileSpreadsheet size={14} />
                                <span className="text-[10px] font-black uppercase tracking-widest">Orden de Compra</span>
                            </div>
                            <button 
                                onClick={() => fetchOrderDetails(order.IdOrdenCompra)}
                                title="Ver Detalle de Artículos"
                                className="flex items-center justify-center px-4 py-1 bg-[#4050B4]/10 text-[#4050B4] hover:bg-[#4050B4] hover:text-white transition-all shadow-sm border border-[#4050B4]/20 text-[10px] font-black uppercase tracking-tighter gap-1.5"
                            >
                                <ExternalLink size={12} />
                                Detalle
                            </button>
                        </div>
                        <div className="flex-1 bg-white border-l-4 border-[#4050B4] p-5 shadow-sm space-y-4 overflow-y-auto custom-scrollbar">
                            <div className="grid grid-cols-2 gap-y-4 gap-x-6">
                                <KanbanItem label="Nombre Proveedor" value={order.Proveedor} colSpan={2} highlight color="text-slate-900" />
                                <KanbanItem label="Folio Interno" value={order.IdOrdenCompra} highlight color="text-[#4050B4]" />
                                <KanbanItem label="Fecha OC" value={formatDateTime(order.FechaOrdenCompra)} />
                                <KanbanItem label="Total OC" value={formatCurrency(order.TotalPedido)} highlight color="text-slate-900" />
                                <KanbanItem label="Comentarios" value={order.Coment || 'Sin comentarios'} colSpan={2} />
                            </div>
                        </div>
                    </div>

                    {/* Column 2: Recibo de Mercancía */}
                    <div className="flex flex-col gap-4 overflow-hidden">
                        <div className="flex items-center justify-between gap-2 shrink-0">
                            <div className="flex items-center gap-2 px-3 py-1 bg-emerald-600 text-white self-start">
                                <Receipt size={14} />
                                <span className="text-[10px] font-black uppercase tracking-widest">Recibo de Mercancía</span>
                            </div>
                            {order.FolioReciboMovil && (
                                <button 
                                    onClick={() => setIsReceiptModalOpen(true)}
                                    title="Ver Detalle de Recibo"
                                    className="flex items-center justify-center px-4 py-1 bg-emerald-600/10 text-emerald-600 hover:bg-emerald-600 hover:text-white transition-all shadow-sm border border-emerald-600/20 text-[10px] font-black uppercase tracking-tighter gap-1.5"
                                >
                                    <ExternalLink size={12} />
                                    Detalle
                                </button>
                            )}
                        </div>
                        <div className="flex-1 bg-white border-l-4 border-emerald-600 p-5 shadow-sm space-y-4 overflow-y-auto custom-scrollbar">
                            {order.FolioReciboMovil ? (
                                <div className="grid grid-cols-2 gap-y-4 gap-x-6">
                                    <KanbanItem label="Proveedor" value={`${order.Proveedor} (${order.RFCProveedor || '---'})`} colSpan={2} highlight color="text-slate-900" />
                                    <KanbanItem label="Folio Recibo" value={order.FolioReciboMovil} highlight color="text-emerald-600" />
                                    <KanbanItem label="Fecha Recibo" value={formatDateTime(order.FechaRecibo)} />
                                    <KanbanItem label="Total Recibido" value={formatCurrency(order.TotalRecibo)} highlight color="text-slate-900" />
                                    {order.UUID && <KanbanItem label="UUID Ref" value={order.UUID} colSpan={2} textSize="text-[10px] font-mono" />}
                                </div>
                            ) : (
                                <div className="h-full flex flex-col items-center justify-center text-center p-10 bg-slate-50 border border-dashed border-slate-200">
                                    <div className="w-12 h-12 bg-slate-100 flex items-center justify-center rounded-full mb-3 text-slate-400">
                                        <AlertTriangle size={24} />
                                    </div>
                                    <p className="text-slate-500 text-[11px] font-bold uppercase tracking-widest italic">No se ha registrado recibo móvil para esta orden</p>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Column 3: Factura Digital */}
                    <div className="flex flex-col gap-4 overflow-hidden">
                        <div className="flex items-center justify-between gap-2 shrink-0">
                            <div className="flex items-center gap-2 px-3 py-1 bg-purple-600 text-white self-start">
                                <Receipt size={14} />
                                <span className="text-[10px] font-black uppercase tracking-widest">Documento Digital (Factura)</span>
                            </div>
                            {invoiceData && (
                                <div className="flex items-center gap-1.5">
                                    <button 
                                        onClick={handleDownloadXml}
                                        disabled={loadingXml}
                                        title="Descargar XML"
                                        className="flex items-center justify-center p-1.5 bg-purple-600/10 text-purple-600 hover:bg-purple-600 hover:text-white transition-all shadow-sm border border-purple-600/20 disabled:opacity-50"
                                    >
                                        <FileCode size={14} />
                                    </button>
                                    <button 
                                        onClick={handleViewPdf}
                                        disabled={loadingXml}
                                        title="Visualizar PDF"
                                        className="flex items-center justify-center p-1.5 bg-purple-600/10 text-purple-600 hover:bg-purple-600 hover:text-white transition-all shadow-sm border border-purple-600/20 disabled:opacity-50"
                                    >
                                        <FileText size={14} />
                                    </button>
                                    <button 
                                        onClick={() => setIsInvoiceDetailModalOpen(true)}
                                        title="Ver Detalle Factura"
                                        className="flex items-center justify-center px-3 py-1 bg-purple-600/10 text-purple-600 hover:bg-purple-600 hover:text-white transition-all shadow-sm border border-purple-600/20 text-[10px] font-black uppercase tracking-tighter gap-1.5"
                                    >
                                        <ExternalLink size={12} />
                                        Detalle
                                    </button>
                                </div>
                            )}
                        </div>
                        <div className="flex-1 bg-white border-l-4 border-purple-600 p-5 shadow-sm space-y-4 overflow-y-auto custom-scrollbar">
                            {loadingInvoice ? (
                                <div className="h-full flex flex-col items-center justify-center text-center p-10">
                                    <div className="w-8 h-8 border-2 border-purple-200 border-t-purple-600 rounded-full animate-spin mb-3" />
                                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Consultando Factura...</p>
                                </div>
                            ) : invoiceData ? (
                                <div className="grid grid-cols-2 gap-y-4 gap-x-6">
                                    <KanbanItem label="Emisor" value={`${invoiceData.RFCEmisor} ${invoiceData.Emisor}`} colSpan={2} highlight color="text-slate-900" />
                                    <div className="col-span-2 flex items-center justify-between gap-3">
                                        <KanbanItem label="UUID" value={invoiceData.UUID} textSize="text-[10px] font-mono" />
                                        <div className={cn(
                                            "px-2 py-1 text-[8px] font-black uppercase tracking-widest shadow-sm border whitespace-nowrap",
                                            invoiceData.TipoComprobante === 'E' ? "bg-rose-100 text-rose-600 border-rose-200 animate-pulse" : "bg-purple-100 text-purple-600 border-purple-200"
                                        )}>
                                            {invoiceData.TipoComprobante === 'E' ? 'DEVOLUCIÓN / EGRESO' : 'INGRESO'}
                                        </div>
                                    </div>
                                    <KanbanItem label="Serie / Folio" value={`${invoiceData.Serie}${invoiceData.Folio}`} />
                                    <KanbanItem label="Fecha" value={formatDateTime(invoiceData.Fecha)} textSize="text-[11px]" />
                                    <KanbanItem label="Condiciones Pago" value={invoiceData.CondicionesPago || 'N/A'} colSpan={2} />
                                    <KanbanItem label="Subtotal" value={formatCurrency(invoiceData.Subtotal)} />
                                    <KanbanItem label="Descuento" value={formatCurrency(invoiceData.Descuento)} color="text-rose-500" />
                                    <KanbanItem 
                                        label="Total" 
                                        value={formatCurrency(invoiceData.Total)} 
                                        highlight 
                                        color={invoiceData.TipoComprobante === 'E' ? "text-rose-600" : "text-purple-600"} 
                                    />
                                    <KanbanItem label="Moneda" value={invoiceData.Moneda} />
                                    <KanbanItem label="Metodo Pago" value={invoiceData.MetodoPago} />
                                    <KanbanItem label="Lugar Expedición" value={invoiceData.LugarExpedicion} />
                                    <KanbanItem label="Uso CFDI" value={invoiceData.UsoCFDI} />
                                    <KanbanItem label="Receptor" value={`${invoiceData.RFCReceptor} ${invoiceData.Receptor}`} colSpan={2} />
                                </div>
                            ) : (
                                <div className="h-full flex flex-col items-center justify-center text-center p-10 bg-slate-50 border border-dashed border-slate-200">
                                    <div className="w-12 h-12 bg-slate-100 flex items-center justify-center rounded-full mb-3 text-slate-400">
                                        <AlertTriangle size={24} />
                                    </div>
                                    <p className="text-slate-500 text-[11px] font-bold uppercase tracking-widest italic">No se encontró información de factura (CFDI)</p>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Combined Distribution Section (Conditional) */}
                    {distributions.length > 0 && (
                        <div className="lg:col-span-3 flex flex-col gap-4 overflow-hidden relative mt-4">
                            <div className="flex items-center gap-2 px-3 py-1 bg-amber-500 text-white self-start">
                                <RotateCcw size={14} />
                                <span className="text-[10px] font-black uppercase tracking-widest">Distribución de Mercancía</span>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 overflow-y-auto custom-scrollbar pr-2 max-h-[400px]">
                                {distributions.map((dist, idx) => {
                                    const isPendingEntry = !dist.FolioEntrada;
                                    const diffSalidaEntrada = getDaysDiff(dist.FechaSalida, dist.FechaEntrada);
                                    
                                    return (
                                        <div key={idx} className="bg-white border-l-4 border-amber-500 p-4 shadow-sm space-y-3 relative group text-slate-800">
                                            {isPendingEntry && (
                                                <div className="absolute top-0 right-0 bg-rose-500 text-white px-2 py-0.5 text-[8px] font-black uppercase flex items-center gap-1 z-30">
                                                    <Filter size={8} /> Pendiente Entrada
                                                </div>
                                            )}
                                            
                                            <div className="grid grid-cols-2 gap-3 relative">
                                                {/* Lead Time Badge (Distribution -> Entry) */}
                                                {dist.FechaSalida && dist.FechaEntrada && diffSalidaEntrada !== null && (
                                                    <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-30 pointer-events-none">
                                                        <div className="w-10 h-10 rounded-full border-2 bg-white shadow-lg flex flex-col items-center justify-center border-emerald-500">
                                                            <span className="text-xs font-black leading-none text-emerald-900">+{diffSalidaEntrada}</span>
                                                            <span className="text-[6px] font-black uppercase text-slate-400">Días</span>
                                                        </div>
                                                    </div>
                                                )}

                                                <KanbanItem label="Destino" value={dist.TiendaDestino} colSpan={2} />
                                                <KanbanItem label="Artículos" value={dist.CantidadArticulos} />
                                                <KanbanItem label="Salida" value={dist.FolioSalida} />
                                                <KanbanItem label="Entrada" value={dist.FolioEntrada || '---'} color={isPendingEntry ? "text-rose-500 font-bold" : "text-emerald-600"} />
                                                <KanbanItem label="Fecha Mov" value={formatDateTime(dist.FechaSalida)} />
                                            </div>
                                            
                                            <button 
                                                onClick={() => fetchDistDetails(dist)}
                                                className="w-full py-1.5 bg-slate-50 hover:bg-amber-50 text-[10px] font-black uppercase tracking-widest text-slate-500 hover:text-amber-600 border border-slate-100 hover:border-amber-200 transition-all flex items-center justify-center gap-2 mt-2"
                                            >
                                                <ExternalLink size={12} /> Ver Detalle
                                            </button>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}
                </div>

                {/* Modal Footer */}
                <div className="px-6 py-4 border-t border-slate-100 bg-slate-100/50 flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex flex-wrap items-center gap-4">
                        <div className="flex items-center gap-2">
                             <div className="w-2 h-2 rounded-full bg-[#4050B4]" />
                             <span className="text-[10px] font-bold text-slate-500 uppercase">Orden</span>
                        </div>
                        <div className="flex items-center gap-2">
                             <div className="w-2 h-2 rounded-full bg-emerald-500" />
                             <span className="text-[10px] font-bold text-slate-500 uppercase">Recibo</span>
                        </div>
                        <div className="flex items-center gap-2">
                             <div className="w-2 h-2 rounded-full bg-purple-600" />
                             <span className="text-[10px] font-bold text-slate-500 uppercase">Factura</span>
                        </div>
                    </div>
                    <button 
                        onClick={onClose}
                        className="px-6 py-2 bg-slate-800 text-white text-[11px] font-black uppercase tracking-widest hover:bg-slate-700 transition-all shadow-md"
                    >
                        Cerrar
                    </button>
                </div>
            </div>

            {/* Sub-Modals */}
            <InvoiceConceptsModal 
                isOpen={isInvoiceDetailModalOpen}
                onClose={() => setIsInvoiceDetailModalOpen(false)}
                uuid={order?.UUID || null}
                serie={invoiceData?.Serie}
                folio={invoiceData?.Folio}
            />

            <ReceiptDetailModal 
                isOpen={isReceiptModalOpen}
                onClose={() => setIsReceiptModalOpen(false)}
                folioRecibo={order.FolioReciboMovil || ""}
                storeName={order.Tienda}
                providerName={order.Proveedor}
            />

            {/* Order Items Detail Modal */}
            {isDetailModalOpen && (
                <div className="fixed inset-0 z-[400] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-white w-full max-w-6xl h-[85vh] shadow-2xl border border-slate-200 flex flex-col animate-in slide-in-from-bottom-4 duration-300">
                        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-white">
                            <h2 className="text-lg font-black text-slate-800 uppercase tracking-tight flex items-center gap-2">
                                <FileSpreadsheet className="text-[#4050B4]" size={20} />
                                Detalle de Artículos
                            </h2>
                            <button onClick={() => setIsDetailModalOpen(false)} className="p-2 hover:bg-slate-100 text-slate-400 hover:text-rose-500">
                                <X size={20} />
                            </button>
                        </div>
                        <div className="flex-1 overflow-auto custom-scrollbar p-6 bg-slate-50/30">
                            {loadingDetails ? (
                                <div className="h-full flex flex-col items-center justify-center"><div className="w-10 h-10 border-4 border-t-[#4050B4] rounded-full animate-spin" /></div>
                            ) : (
                                <table className="w-full text-left border-collapse bg-white shadow-sm border border-slate-200">
                                    <thead className="bg-slate-50 border-b border-slate-200 sticky top-0 z-10">
                                        <tr>
                                            <th className="p-2 text-[9px] font-black uppercase tracking-widest text-slate-400 text-right">Cant</th>
                                            <th className="p-2 text-[9px] font-black uppercase tracking-widest text-slate-400">Unidad</th>
                                            <th className="p-2 text-[9px] font-black uppercase tracking-widest text-slate-400">Descripción</th>
                                            <th className="p-2 text-[9px] font-black uppercase tracking-widest text-slate-400 text-right">Importe</th>
                                        </tr>
                                    </thead>
                                    <tbody className="text-slate-700">
                                        {detailItems.map((item, idx) => (
                                            <tr key={idx} className="border-b border-slate-100 hover:bg-slate-50">
                                                <td className="p-2 text-[11px] text-right font-black text-[#4050B4]">{item.Cantidad}</td>
                                                <td className="p-2 text-[10px] font-black text-slate-400 uppercase">{item.Unidad}</td>
                                                <td className="p-2 text-[11px] font-bold uppercase tracking-tight truncate max-w-[400px]">{item.Descripcion}</td>
                                                <td className="p-2 text-[11px] text-right font-black text-slate-900">{formatCurrency(item.Importe)}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            )}
                        </div>
                        <div className="px-6 py-4 border-t border-slate-100 bg-white flex justify-end">
                            <button onClick={() => setIsDetailModalOpen(false)} className="px-8 py-2.5 bg-slate-800 text-white text-[11px] font-black uppercase tracking-widest">Cerrar</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Distribution Detail Modal */}
            {isDistDetailModalOpen && selectedDistHeader && (
                <div className="fixed inset-0 z-[500] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-white w-full max-w-4xl h-[70vh] shadow-2xl border border-slate-200 flex flex-col animate-in slide-in-from-bottom-4 duration-300">
                        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-white">
                            <h2 className="text-lg font-black text-slate-800 uppercase tracking-tight flex items-center gap-2">
                                <RotateCcw className="text-amber-500" size={20} />
                                Detalle de Distribución - {selectedDistHeader.tienda}
                            </h2>
                            <button onClick={() => setIsDistDetailModalOpen(false)} className="p-2 hover:bg-slate-100 text-slate-400"><X size={20} /></button>
                        </div>
                        <div className="flex-1 overflow-auto custom-scrollbar p-6">
                            {loadingDistDetails ? (
                                <div className="h-full flex flex-col items-center justify-center"><div className="w-10 h-10 border-4 border-t-amber-500 rounded-full animate-spin" /></div>
                            ) : (
                                <table className="w-full text-left border-collapse bg-white shadow-sm border border-slate-200">
                                    <thead className="bg-slate-50 border-b border-slate-200 sticky top-0 z-10">
                                        <tr>
                                            <th className="p-2 text-[9px] font-black uppercase tracking-widest text-slate-400 text-right">Cant</th>
                                            <th className="p-2 text-[9px] font-black uppercase tracking-widest text-slate-400">Unidad</th>
                                            <th className="p-2 text-[9px] font-black uppercase tracking-widest text-slate-400">Descripción</th>
                                            <th className="p-2 text-[9px] font-black uppercase tracking-widest text-slate-400 text-right">Importe</th>
                                        </tr>
                                    </thead>
                                    <tbody className="text-slate-700">
                                        {distDetailItems.map((item, idx) => (
                                            <tr key={idx} className="border-b border-slate-100 hover:bg-slate-50">
                                                <td className="p-2 text-[11px] text-right font-black text-amber-600">{item.Cantidad}</td>
                                                <td className="p-2 text-[10px] font-black text-slate-400 uppercase">{item.Unidad}</td>
                                                <td className="p-2 text-[11px] font-bold uppercase tracking-tight truncate max-w-[350px]">{item.Descripcion}</td>
                                                <td className="p-2 text-[11px] text-right font-black text-slate-900">{formatCurrency(item.Importe)}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            )}
                        </div>
                        <div className="px-6 py-4 border-t border-slate-100 bg-white flex justify-end">
                            <button onClick={() => setIsDistDetailModalOpen(false)} className="px-8 py-2.5 bg-slate-800 text-white text-[11px] font-black uppercase tracking-widest">Cerrar</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Comparison Modal */}
            {isComparisonModalOpen && (
                <div className="fixed inset-0 z-[500] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-white shadow-2xl border border-slate-200 flex flex-col animate-in slide-in-from-bottom-4 duration-300 w-full max-w-[95vw] h-[90vh]">
                        {/* Modal Header */}
                        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-white shrink-0">
                            <div className="flex flex-col">
                                <h2 className="text-xl font-black text-slate-800 uppercase tracking-tight flex items-center gap-2">
                                    <ArrowLeftRight className="text-[#4050B4]" size={24} /> 
                                    Consola de Mapeo: Factura vs Sistema
                                </h2>
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">
                                    Instrucciones: Arrastra un concepto de la izquierda hacia un artículo del sistema a la derecha para vincularlos
                                </p>
                            </div>
                            <button onClick={() => setIsComparisonModalOpen(false)} className="p-2 hover:bg-slate-100 text-slate-400 focus:outline-none"><X size={24} /></button>
                        </div>

                        {/* Modal Body - Two Columns */}
                        <div className="flex-1 flex overflow-hidden bg-slate-50/50">
                            {loadingComparison ? (
                                <div className="w-full flex flex-col items-center justify-center bg-white">
                                    <div className="w-10 h-10 border-4 border-t-[#4050B4] rounded-full animate-spin" />
                                    <p className="mt-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Cargando datos de comparación...</p>
                                </div>
                            ) : (
                                <>
                                    {/* Left Column: Invoice Concepts (Unmatched Only) */}
                                    <div className="w-[40%] flex flex-col border-r border-slate-100 bg-purple-50/10">
                                        <div className="p-4 border-b border-slate-100 bg-white/80 backdrop-blur-sm sticky top-0 z-10 space-y-3">
                                            <h3 className="text-[11px] font-black uppercase text-purple-600 flex items-center gap-2">
                                                <Receipt size={14} /> Factura: Conceptos Pendientes
                                                <span className="ml-auto px-2 py-0.5 bg-purple-100 rounded-full text-[9px] font-black">
                                                    {mergedComparison.invoiceOnly.length}
                                                </span>
                                            </h3>
                                            <div className="relative">
                                                <Search className="absolute left-2 top-1/2 -translate-y-1/2 text-purple-300" size={12} />
                                                <input 
                                                    type="text" 
                                                    placeholder="Buscar en factura..."
                                                    value={invoiceSearch}
                                                    onChange={(e) => setInvoiceSearch(e.target.value)}
                                                    className="w-full pl-7 pr-3 py-1 bg-purple-50 border border-purple-100 text-[10px] font-bold focus:outline-none focus:border-purple-400 placeholder-purple-300 text-purple-900"
                                                />
                                            </div>
                                        </div>
                                        <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
                                            {mergedComparison.invoiceOnly.length === 0 ? (
                                                <div className="h-full flex flex-col items-center justify-center text-center p-8 grayscale opacity-50">
                                                    <Check size={40} className="text-emerald-500 mb-2" />
                                                    <p className="text-[10px] font-black uppercase text-slate-500">Todo mapeado en esta vista</p>
                                                </div>
                                            ) : (
                                                mergedComparison.invoiceOnly.map((item, idx) => (
                                                    <div 
                                                        key={`inv-${idx}`}
                                                        draggable
                                                        className={cn(
                                                            "bg-white p-4 border-l-4 border-purple-500 shadow-sm border border-slate-200 transition-all duration-200 cursor-grab active:cursor-grabbing",
                                                            draggedInvoiceItem?.OriginalInvoiceItem?.NoIdentificacion === item.OriginalInvoiceItem.NoIdentificacion ? "opacity-40 grayscale" : "hover:shadow-md hover:border-purple-300"
                                                        )}
                                                        onDragStart={() => setDraggedInvoiceItem(item)}
                                                        onDragEnd={() => setDraggedInvoiceItem(null)}
                                                    >
                                                        <div className="flex flex-col gap-1">
                                                            <span className="text-[11px] font-black text-slate-800 uppercase leading-snug">{item.Descripcion}</span>
                                                            <div className="flex items-center justify-between mt-2">
                                                                <span className="text-[10px] font-bold text-slate-400 font-mono">{item.CodigoBarras || 'SIN CÓDIGO'}</span>
                                                                <div className="flex items-center gap-2">
                                                                    <span className="px-1.5 py-0.5 bg-purple-50 text-purple-600 text-[9px] font-black uppercase rounded border border-purple-100 italic">Pendiente</span>
                                                                    <span className="text-[11px] font-black text-purple-600">{item.CantidadFact} {item.Unidad}</span>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                ))
                                            )}
                                        </div>
                                    </div>

                                    {/* Right Column: System (All Matching Items) */}
                                    <div className="w-[60%] flex flex-col bg-white">
                                        <div className="p-4 border-b border-slate-100 bg-white/80 backdrop-blur-sm sticky top-0 z-10 flex items-center justify-between gap-4">
                                            <h3 className="text-[11px] font-black uppercase text-slate-600 flex items-center gap-2 shrink-0">
                                                <LayoutGrid size={14} className="text-[#4050B4]" /> Sistema: OC / Recibo
                                            </h3>
                                            <div className="relative flex-1 max-w-sm">
                                                <Search className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-300" size={12} />
                                                <input 
                                                    type="text" 
                                                    placeholder="Buscar artículo en sistema..."
                                                    value={compareSearch}
                                                    onChange={(e) => setCompareSearch(e.target.value)}
                                                    className="w-full pl-7 pr-3 py-1 bg-slate-50 border border-slate-200 text-[10px] font-bold focus:outline-none focus:border-[#4050B4]"
                                                />
                                            </div>
                                        </div>
                                        <div className="flex-1 overflow-y-auto p-4 space-y-2 custom-scrollbar">
                                            {mergedComparison.system.map((item, idx) => {
                                                const hasDiscrepancy = item.CantidadOC !== item.CantidadRec || (item.IsMatched && item.CantidadRec !== item.CantidadFact);
                                                const isManuallyRelated = relations.some(r => r.CodigoInterno === item.CodigoInterno);
                                                const isAutoRelated = item.IsMatched && !isManuallyRelated;
                                                const isTarget = dropTargetKey === item.CodigoInterno.toString();

                                                return (
                                                    <div 
                                                        key={`sys-${idx}`}
                                                        onDragOver={(e) => {
                                                            if (draggedInvoiceItem) e.preventDefault();
                                                        }}
                                                        onDragEnter={() => {
                                                            if (draggedInvoiceItem) setDropTargetKey(item.CodigoInterno.toString());
                                                        }}
                                                        onDragLeave={() => setDropTargetKey(null)}
                                                        onDrop={(e) => {
                                                            e.preventDefault();
                                                            if (draggedInvoiceItem && draggedInvoiceItem.OriginalInvoiceItem) {
                                                                handleSaveRelation(item.CodigoInterno.toString(), draggedInvoiceItem.OriginalInvoiceItem);
                                                            }
                                                            setDraggedInvoiceItem(null);
                                                            setDropTargetKey(null);
                                                        }}
                                                        className={cn(
                                                            "p-3 border-l-4 shadow-sm border border-slate-100 flex items-center gap-4 transition-all duration-200",
                                                            item.IsMatched ? "border-emerald-500 bg-emerald-50/10" : "border-[#4050B4] bg-white",
                                                            isTarget ? "ring-2 ring-emerald-500 ring-offset-2 bg-emerald-50" : "hover:shadow-md"
                                                        )}
                                                    >
                                                        <div className="flex-1 min-w-0">
                                                            <div className="flex items-center gap-2">
                                                                <span className="text-[11px] font-black text-slate-800 uppercase truncate">{item.Descripcion}</span>
                                                                {isAutoRelated && (
                                                                    <span className="flex items-center gap-1 px-1 py-0.5 bg-emerald-100 text-emerald-700 text-[7.5px] font-black uppercase rounded">
                                                                        <Check size={8} /> Autocruce
                                                                    </span>
                                                                )}
                                                                {isManuallyRelated && (
                                                                    <span className="flex items-center gap-1 px-1 py-0.5 bg-[#4050B4]/10 text-[#4050B4] text-[7.5px] font-black uppercase rounded">
                                                                        <ArrowLeftRight size={8} /> Mapeo
                                                                    </span>
                                                                )}
                                                            </div>
                                                            <div className="flex items-center gap-3 mt-1">
                                                                <span className="text-[9px] font-bold text-slate-400 font-mono">#{item.CodigoInterno}</span>
                                                                <span className="text-[9px] font-bold text-slate-400 font-mono">{item.CodigoBarras || '---'}</span>
                                                            </div>
                                                        </div>
                                                        
                                                        <div className="flex items-center gap-6 text-center shrink-0">
                                                            <div className="flex flex-col">
                                                                <span className="text-[8px] font-black uppercase text-slate-300 tracking-tighter">OC</span>
                                                                <span className="text-[12px] font-black text-slate-600">{item.CantidadOC}</span>
                                                            </div>
                                                            <div className="flex flex-col px-3 border-x border-slate-100">
                                                                <span className="text-[8px] font-black uppercase text-slate-300 tracking-tighter">REC</span>
                                                                <span className="text-[12px] font-black text-emerald-600">{item.CantidadRec}</span>
                                                            </div>
                                                            <div className="flex flex-col w-12">
                                                                <span className="text-[8px] font-black uppercase text-slate-300 tracking-tighter">FACT</span>
                                                                <span className={cn(
                                                                    "text-[12px] font-black",
                                                                    item.IsMatched ? "text-purple-600" : "text-slate-200"
                                                                )}>{item.IsMatched ? item.CantidadFact : 0}</span>
                                                            </div>
                                                            <div className="w-20 text-right">
                                                                <span className={cn(
                                                                    "text-[11px] font-black",
                                                                    hasDiscrepancy ? "text-rose-600" : "text-emerald-600"
                                                                )}>
                                                                    {formatCurrency(
                                                                        (item.CantidadFact > 0 ? item.CantidadFact * item.CostoFact : item.CantidadRec * item.CostoRec) - 
                                                                        (item.CantidadOC * item.CostoOC)
                                                                    )}
                                                                </span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                </>
                            )}
                        </div>

                        {/* Modal Footer */}
                        <div className="px-6 py-4 border-t border-slate-100 bg-white flex items-center justify-between shrink-0">
                            <div className="flex items-center gap-6">
                                <div className="flex items-center gap-2">
                                    <div className="w-3 h-3 bg-purple-500 rounded-sm" />
                                    <span className="text-[10px] font-black uppercase text-slate-400">Conceptos por Mapear</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <div className="w-3 h-3 bg-emerald-500 rounded-sm" />
                                    <span className="text-[10px] font-black uppercase text-slate-400">Relacionados</span>
                                </div>
                            </div>
                            <button 
                                onClick={() => setIsComparisonModalOpen(false)}
                                className="px-10 py-2.5 bg-slate-800 text-white text-[11px] font-black uppercase tracking-widest hover:bg-slate-700 transition-all shadow-xl"
                            >
                                Finalizar Comparativa
                            </button>
                        </div>
                    </div>
                </div>
            )}
