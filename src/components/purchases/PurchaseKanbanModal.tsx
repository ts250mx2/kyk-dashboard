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
    Download,
    PlusCircle,
    Trash2,
    Sparkles,
    Target,
    Printer,
    CheckCircle2
} from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
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
    const [comparisonData, setComparisonData] = useState<{ orderItems: any[], receiptItems: any[], invoiceItems: any[], metadata?: any }>({ orderItems: [], receiptItems: [], invoiceItems: [] });
    const [relations, setRelations] = useState<any[]>([]);
    const [loadingComparison, setLoadingComparison] = useState(false);
    const [compareSearch, setCompareSearch] = useState('');
    const [invoiceSearch, setInvoiceSearch] = useState('');
    const [selectedInvoiceItem, setSelectedInvoiceItem] = useState<any | null>(null);
    const [systemHoverKey, setSystemHoverKey] = useState<string | null>(null);
    const [freshMetadata, setFreshMetadata] = useState<any>(null);

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
            // 1. Fetch OC vs Receipt Items (Always fetch to get fresh Provider Metadata)
            const ocRecPromise = fetch(`/api/purchases/consolidate/compare?idReciboMovil=${order.IdReciboMovil || ''}&idTienda=${order.IdTienda}&idOrdenCompra=${order.IdOrdenCompra || ''}&idProveedor=${order.IdProveedor || ''}`).then(r => r.json());

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

            const [ocRecData, invoiceData] = await Promise.all([ocRecPromise, invoicePromise]);
            
            // Use ID from metadata (guaranteed by DB join) or fallback to prop
            const finalIdProveedor = ocRecData.metadata?.IdProveedor || order.IdProveedor;

            // 3. Fetch Relations using the most accurate ID
            let relationsData = [];
            if (finalIdProveedor) {
                console.log(`[Reconciliation] Fetching relations for provider ID: ${finalIdProveedor}`);
                const relRes = await fetch(`/api/purchases/invoices/relations?idProveedor=${finalIdProveedor}`);
                relationsData = await relRes.json();
            } else {
                console.warn('[Reconciliation] No provider ID found for relation lookup');
            }

            setComparisonData({
                orderItems: ocRecData.orderItems || [],
                receiptItems: ocRecData.receiptItems || [],
                invoiceItems: invoiceData || [],
                metadata: ocRecData.metadata
            });
            setRelations(relationsData || []);
        } catch (error) {
            console.error('Error fetching comparison data:', error);
            setComparisonData({ orderItems: [], receiptItems: [], invoiceItems: [] });
        } finally {
            setLoadingComparison(false);
        }
    };

    const handlePrintPDF = () => {
        const doc = new jsPDF();
        const metadata = comparisonData.metadata;
        
        // Header
        doc.setFillColor(64, 80, 180); // #4050B4
        doc.rect(0, 0, 210, 35, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(18);
        doc.setFont('helvetica', 'bold');
        doc.text('REPORTE DE CONCILIACIÓN DE COMPRA', 14, 20);
        
        doc.setFontSize(8);
        doc.setFont('helvetica', 'normal');
        doc.text(`Generado el: ${new Date().toLocaleString()}`, 14, 28);

        // Metadata Header
        doc.setTextColor(60, 60, 60);
        doc.setFontSize(10);
        doc.setFont('helvetica', 'bold');
        doc.text('DATOS DEL SISTEMA', 14, 45);
        doc.setLineWidth(0.5);
        doc.line(14, 47, 60, 47);

        doc.setFontSize(8);
        doc.setFont('helvetica', 'normal');
        let currentY = 55;
        doc.text(`ID Orden Compra: #${order.IdOrdenCompra}`, 14, currentY); currentY += 5;
        doc.text(`Fecha OC: ${formatDate(order.FechaOrdenCompra)}`, 14, currentY); currentY += 5;
        doc.text(`Proveedor: ${metadata?.Proveedor || order.Proveedor}`, 14, currentY); currentY += 5;
        doc.text(`RFC: ${metadata?.RFCProveedor || order.RFCProveedor}`, 14, currentY); currentY += 5;
        
        if (order.FolioReciboMovil) {
            doc.text(`Folio Recibo: ${order.FolioReciboMovil}`, 14, currentY); currentY += 5;
            doc.text(`Fecha Recibo: ${formatDate(order.FechaRecibo)}`, 14, currentY); currentY += 5;
        }

        if (order.UUID || metadata?.UUID) {
            doc.setFont('helvetica', 'bold');
            doc.text('FACTURA VINCULADA', 120, 45);
            doc.setFont('helvetica', 'normal');
            doc.text(`UUID: ${order.UUID || metadata?.UUID}`, 120, 55, { maxWidth: 80 });
        }

        // Table
        const tableBody = mergedComparison.system.map(item => [
            item.Descripcion,
            item.CodigoInterno,
            item.CantidadOC,
            item.CantidadRec,
            item.IsMatched ? item.CantidadFact : '0',
            formatCurrency(item.CostoRec || 0),
            formatCurrency(item.IsMatched ? item.CostoFact : 0),
            formatCurrency((item.IsMatched ? item.TotalFact : 0) - item.TotalRec)
        ]);

        autoTable(doc, {
            startY: 75,
            head: [['Descripción', 'Código', 'Cant. OC', 'Cant. Rec', 'Cant. Fact', 'Costo Rec', 'Costo Fact', 'Diferencia']],
            body: tableBody,
            headStyles: { fillColor: [64, 80, 180], textColor: 255, fontSize: 8 },
            bodyStyles: { fontSize: 7 },
            theme: 'striped'
        });

        const finalY = (doc as any).lastAutoTable.finalY + 10;
        doc.setFontSize(10);
        doc.setFont('helvetica', 'bold');
        doc.text(`Diferencia Total Mapeada: ${formatCurrency(totals.diffRecFact)}`, 130, finalY);

        doc.save(`Conciliacion_${order.IdOrdenCompra}.pdf`);
    };

    const handleFinishReconciliation = async () => {
        // Find UUID from invoiceItems or existing metadata
        const activeUUID = comparisonData.invoiceItems?.[0]?.UUID || order.UUID || comparisonData.metadata?.UUID;
        
        if (!activeUUID || activeUUID === '-') {
            alert('No se puede finalizar sin una factura validada (UUID).');
            return;
        }

        setLoadingComparison(true);
        try {
            const res = await fetch('/api/purchases/invoices/finish', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    idReciboMovil: order.IdReciboMovil,
                    idTienda: order.IdTienda,
                    uuid: activeUUID
                })
            });

            if (res.ok) {
                setIsComparisonModalOpen(false);
                onClose();
            } else {
                const err = await res.json();
                alert(`Error: ${err.error}`);
            }
        } catch (error) {
            console.error('Error finishing reconciliation:', error);
        } finally {
            setLoadingComparison(false);
        }
    };

    const handleSaveRelation = async (codigoInterno: string, invoiceConcept: any) => {
        // Try getting ID from comparison metadata or fall back to order prop
        const currentIdProveedor = comparisonData.receiptItems?.[0]?.IdProveedor || order?.IdProveedor;

        if (!currentIdProveedor) {
            console.error('[PurchaseKanbanModal] Missing IdProveedor after all lookups');
            alert('Error: No se encontró el ID del Proveedor en el recibo. Por favor recarga la página.');
            return;
        }
        
        // Ensure we have an identification. If missing, use a sanitized description as fallback
        const noIdent = invoiceConcept.NoIdentificacion || `DESC-${invoiceConcept.Descripcion.trim().substring(0, 30)}`;
        
        console.log('[PurchaseKanbanModal] Saving relation:', { 
            codigoInterno, 
            IdProveedor: currentIdProveedor, 
            Descripcion: invoiceConcept.Descripcion, 
            NoIdentificacion: noIdent 
        });

        try {
            const res = await fetch('/api/purchases/invoices/relations', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    CodigoInterno: codigoInterno,
                    IdProveedor: currentIdProveedor,
                    Descripcion: invoiceConcept.Descripcion,
                    NoIdentificacion: noIdent
                })
            });
            
            if (res.ok) {
                console.log('[PurchaseKanbanModal] Relation saved successfully');
                // Refresh relations
                const relRes = await fetch(`/api/purchases/invoices/relations?idProveedor=${currentIdProveedor}`);
                const relData = await relRes.json();
                setRelations(relData || []);
                setSelectedInvoiceItem(null); 
            } else {
                const errData = await res.json();
                console.error('[PurchaseKanbanModal] API Error saving relation:', errData);
                alert(`Error al guardar: ${errData.error || 'Desconocido'}`);
            }
        } catch (error) {
            console.error('[PurchaseKanbanModal] Fetch Error saving relation:', error);
            alert('Error de conexión al intentar guardar la relación.');
        }
    };

    const handleDeleteRelation = async (noIdentificacion: string, descripcion: string) => {
        const currentIdProveedor = comparisonData.receiptItems?.[0]?.IdProveedor || order?.IdProveedor;
        if (!currentIdProveedor) return;

        try {
            const res = await fetch(`/api/purchases/invoices/relations?idProveedor=${currentIdProveedor}&noIdentificacion=${noIdentificacion}&Descripcion=${encodeURIComponent(descripcion)}`, {
                method: 'DELETE'
            });
            if (res.ok) {
                const relRes = await fetch(`/api/purchases/invoices/relations?idProveedor=${currentIdProveedor}`);
                const relData = await relRes.json();
                setRelations(relData || []);
            }
        } catch (error) {
            console.error('Error deleting relation:', error);
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

        const normalize = (val: any) => (val === null || val === undefined ? '' : String(val).trim().toLowerCase());

        // SYSTEM ITEMS LIST
        const allInternalKeys = new Set([
            ...orderItems.map(i => String(i.CodigoInterno)),
            ...receiptItems.map(i => String(i.CodigoInterno))
        ]);

        const system = Array.from(allInternalKeys).map(key => {
            const orderItem = orderItems.find(i => String(i.CodigoInterno) === key);
            const receiptItem = receiptItems.find(i => String(i.CodigoInterno) === key);
            
            const sysDesc = normalize(orderItem?.Descripcion || receiptItem?.Descripcion);
            const sysBarcode = normalize(orderItem?.CodigoBarras || receiptItem?.CodigoBarras);

            // 1. Try Manual Relation Match (PRIORITY: User Defined Concept)
            let invoiceItem = null;
            const relevantRelations = relations.filter(r => normalize(r.CodigoInterno) === normalize(key));
            
            for (const rel of relevantRelations) {
                invoiceItem = invoiceItems.find((inv, idx) => {
                    if (matchedInvoiceIndices.has(idx)) return false;
                    
                    const invDesc = normalize(inv.Descripcion);
                    const relDesc = normalize(rel.Descripcion);

                    // User Business Rule: "Solo mapeame por concepto"
                    const matchByConcept = invDesc === relDesc && invDesc !== '';

                    if (matchByConcept) {
                        console.log(`[Reconciliation] Manual concept match found for ${key}: ${invDesc}`);
                        matchedInvoiceIndices.add(idx);
                    }
                    return matchByConcept;
                });
                if (invoiceItem) break;
            }

            // 2. Try Auto-match (FALLBACK: Exact Concept Match in Order/Receipt)
            if (!invoiceItem) {
                invoiceItem = invoiceItems.find((inv, idx) => {
                    if (matchedInvoiceIndices.has(idx)) return false;
                    
                    const invDesc = normalize(inv.Descripcion);

                    // Auto-match Logic: Strictly by Concept
                    const matchByDesc = invDesc === sysDesc && invDesc !== '';
                    
                    if (matchByDesc) {
                        console.log(`[Reconciliation] Auto concept match found for ${key}: ${invDesc}`);
                        matchedInvoiceIndices.add(idx);
                    }
                    return matchByDesc;
                });
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

        // INVOICE ITEMS LIST (Filtered to unmatched only - to "clean" the view)
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
    
    const totals = useMemo(() => {
        const totalOC = (comparisonData.orderItems || []).reduce((s, i) => s + (i.Total || 0), 0);
        const totalRec = (comparisonData.receiptItems || []).reduce((s, i) => s + (i.Total || 0), 0);
        
        // Use the actual items displayed in the mapping console to sum differences
        const diffRecFact = mergedComparison.system.reduce((s, item) => {
            const factContribution = item.IsMatched ? item.TotalFact : 0;
            const recContribution = item.TotalRec || 0;
            return s + (factContribution - recContribution);
        }, 0);

        return {
            diffOCRec: totalRec - totalOC,
            diffRecFact: diffRecFact
        };
    }, [comparisonData, mergedComparison]);

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
                                COMPARATIVA OC VS RECIBO VS FACTURA
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
                                <KanbanItem 
                                    label="Nombre Proveedor" 
                                    value={`${(freshMetadata?.RFCProveedor || order.RFCProveedor) ? `${freshMetadata?.RFCProveedor || order.RFCProveedor} - ` : ''}${freshMetadata?.Proveedor || order.Proveedor}`} 
                                    colSpan={2} 
                                    highlight 
                                    color="text-slate-900" 
                                    textSize="text-[10.5px]"
                                />
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
                                    <KanbanItem 
                                        label="Proveedor" 
                                        value={`${(freshMetadata?.RFCProveedor || order.RFCProveedor) ? `${freshMetadata?.RFCProveedor || order.RFCProveedor} - ` : ''}${freshMetadata?.Proveedor || order.Proveedor}`} 
                                        colSpan={2} 
                                        highlight 
                                        color="text-slate-900" 
                                        textSize="text-[10.5px]"
                                    />
                                    <KanbanItem label="Folio Recibo" value={order.FolioReciboMovil} highlight color="text-emerald-600" />
                                    <KanbanItem label="Fecha Recibo" value={formatDateTime(order.FechaRecibo)} />
                                    <KanbanItem label="Total Recibido" value={formatCurrency(order.TotalRecibo)} highlight color="text-slate-900" />
                                    {(freshMetadata?.UUID || order.UUID) && (
                                        <KanbanItem label="UUID Ref" value={freshMetadata?.UUID || order.UUID} colSpan={2} textSize="text-[10px] font-mono" />
                                    )}
                                    {(freshMetadata?.UUID || order.UUID) && (freshMetadata?.UUID || order.UUID) !== '-' && (
                                        <KanbanItem 
                                            label="UUID validacion" 
                                            value={
                                                <a 
                                                    href={`https://verificacfdi.facturaelectronica.sat.gob.mx/default.aspx?id=${freshMetadata?.UUID || order.UUID}`} 
                                                    target="_blank" 
                                                    rel="noopener noreferrer"
                                                    className="text-[#4050B4] hover:underline flex items-center gap-1"
                                                >
                                                    Verificar en SAT <ExternalLink size={10} />
                                                </a>
                                            } 
                                            colSpan={2} 
                                        />
                                    )}
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
                                    {mergedComparison.invoiceOnly.length > 0 && (
                                        <div className="w-[45%] flex flex-col border-r border-slate-100 bg-purple-50/10">
                                        <div className="p-4 border-b border-slate-100 bg-white/80 backdrop-blur-sm sticky top-0 z-10 space-y-2">
                                            <div className="flex items-center justify-between">
                                                <h3 className="text-[11px] font-black uppercase text-purple-600 flex items-center gap-2">
                                                    <Receipt size={14} /> Factura: Pendientes
                                                    <span className="px-2 py-0.5 bg-purple-100 rounded-full text-[9px] font-black">
                                                        {mergedComparison.invoiceOnly.length}
                                                    </span>
                                                </h3>
                                                {selectedInvoiceItem && (
                                                    <button 
                                                        onClick={() => setSelectedInvoiceItem(null)}
                                                        className="text-[9px] font-black uppercase text-rose-500 hover:text-rose-700 transition-colors"
                                                    >
                                                        Cancelar Selección
                                                    </button>
                                                )}
                                            </div>

                                            {/* INVOICE METADATA HEADER */}
                                            {invoiceData && (
                                                <div className="p-2 bg-purple-50/50 border border-purple-100/50 rounded flex flex-col gap-1">
                                                    <div className="flex items-center justify-between gap-2">
                                                        <div className="flex flex-col">
                                                            <span className="text-[7px] font-black text-purple-400 uppercase tracking-widest">UUID</span>
                                                            <span className="text-[9px] font-bold text-slate-600 truncate max-w-[200px]">{invoiceData.UUID}</span>
                                                        </div>
                                                        <div className="flex flex-col text-right">
                                                            <span className="text-[7px] font-black text-purple-400 uppercase tracking-widest">Serie/Folio</span>
                                                            <span className="text-[9px] font-bold text-slate-700">{invoiceData.Serie}{invoiceData.Folio}</span>
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center justify-between gap-2 border-t border-purple-100/30 pt-1">
                                                        <div className="flex flex-col">
                                                            <span className="text-[7px] font-black text-purple-400 uppercase tracking-widest">RFC - Emisor</span>
                                                            <span className="text-[9px] font-bold text-slate-600 truncate max-w-[200px]">{invoiceData.RFCEmisor} — {invoiceData.Emisor}</span>
                                                        </div>
                                                        <div className="flex flex-col text-right">
                                                            <span className="text-[7px] font-black text-purple-400 uppercase tracking-widest">Fecha</span>
                                                            <span className="text-[9px] font-bold text-slate-700">{formatDate(invoiceData.Fecha)}</span>
                                                        </div>
                                                    </div>
                                                </div>
                                            )}

                                            <div className="relative">
                                                <Search className="absolute left-2 top-1/2 -translate-y-1/2 text-purple-300" size={12} />
                                                <input 
                                                    type="text" 
                                                    placeholder="Buscar en factura..."
                                                    value={invoiceSearch}
                                                    onChange={(e) => setInvoiceSearch(e.target.value)}
                                                    className="w-full pl-7 pr-3 py-1.5 bg-purple-50/50 border border-purple-100 text-[10px] font-bold focus:outline-none focus:border-purple-400 placeholder-purple-300 text-purple-900 shadow-inner"
                                                />
                                            </div>
                                        </div>
                                        <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
                                            {mergedComparison.invoiceOnly.length === 0 ? (
                                                <div className="h-full flex flex-col items-center justify-center text-center p-8 grayscale opacity-50">
                                                    <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mb-4 border-4 border-white shadow-sm">
                                                        <Check size={32} className="text-emerald-500" />
                                                    </div>
                                                    <p className="text-[10px] font-black uppercase text-slate-500 tracking-widest">Todo mapeado en esta vista</p>
                                                    <p className="text-[9px] font-bold text-slate-400 mt-1 uppercase">Limpieza de vista completada</p>
                                                </div>
                                            ) : (
                                                mergedComparison.invoiceOnly.map((item, idx) => (
                                                    <div 
                                                        key={`inv-${idx}`}
                                                        draggable
                                                        onDragStart={(e) => {
                                                            setSelectedInvoiceItem(item);
                                                            e.dataTransfer.setData('text/plain', JSON.stringify(item));
                                                        }}
                                                        onClick={() => setSelectedInvoiceItem(item)}
                                                        className={cn(
                                                            "bg-white p-4 border-l-4 shadow-sm border border-slate-200 transition-all duration-200 cursor-grab active:cursor-grabbing",
                                                            selectedInvoiceItem?.CodigoInterno === item.CodigoInterno 
                                                                ? "border-[#4050B4] bg-[#4050B4]/5 ring-2 ring-[#4050B4] scale-[1.02] shadow-xl z-10" 
                                                                : "border-purple-500 hover:shadow-md hover:border-purple-300"
                                                        )}
                                                    >
                                                        <div className="flex flex-col gap-1">
                                                            <div className="flex items-center justify-between">
                                                                <span className="text-[11px] font-black text-slate-800 uppercase leading-snug">{item.Descripcion}</span>
                                                                {selectedInvoiceItem?.CodigoInterno === item.CodigoInterno && (
                                                                    <div className="w-2 h-2 rounded-full bg-[#4050B4] animate-ping" />
                                                                )}
                                                            </div>
                                                            <div className="flex items-center justify-between mt-2">
                                                                <span className="text-[10px] font-bold text-slate-400 font-mono">{item.CodigoBarras || 'SIN CÓDIGO'}</span>
                                                                <div className="flex flex-col items-end">
                                                                    <span className="text-[11px] font-black text-purple-600">{item.CantidadFact} {item.Unidad}</span>
                                                                    <span className="text-[9px] font-black text-slate-400">{formatCurrency(item.CostoFact)}</span>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                ))
                                            )}
                                        </div>
                                    </div>
                                    )}

                                    <div className="flex-1 flex flex-col bg-white">
                                        <div className="p-4 border-b border-slate-100 bg-white/80 backdrop-blur-sm sticky top-0 z-10 space-y-2 flex flex-col">
                                            <div className="flex items-center justify-between">
                                                <h3 className="text-[11px] font-black uppercase text-slate-600 flex items-center gap-2 shrink-0">
                                                    <LayoutGrid size={14} className="text-[#4050B4]" /> Sistema: OC / Recibo
                                                </h3>
                                                <div className="flex items-center gap-2">
                                                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Tienda:</span>
                                                    <span className="text-[9px] font-black text-[#4050B4]">{order.Tienda}</span>
                                                </div>
                                            </div>

                                            {/* SYSTEM METADATA HEADER */}
                                            <div className="p-2 bg-slate-50 border border-slate-100 rounded flex flex-col gap-1">
                                                <div className="flex items-center justify-between gap-2">
                                                    <div className="flex flex-col">
                                                        <span className="text-[7px] font-black text-slate-400 uppercase tracking-widest">Id Orden de Compra</span>
                                                        <span className="text-[9px] font-bold text-slate-700">#{order.IdOrdenCompra} — {formatDate(order.FechaOrdenCompra)}</span>
                                                    </div>
                                                        <div className="flex flex-col text-right">
                                                            <span className="text-[7.5px] font-black text-slate-400 uppercase tracking-widest">
                                                                RFC — Proveedor (ID: {comparisonData.metadata?.IdProveedor || order.IdProveedor || '?'})
                                                            </span>
                                                            <span className="text-[9px] font-bold text-[#4050B4] truncate max-w-[170px] uppercase font-black tracking-tight">
                                                                {(comparisonData.metadata?.RFCProveedor || comparisonData.metadata?.RFC || order.RFCProveedor || 'RFC NO ENCONTRADO')} — {(comparisonData.metadata?.Proveedor || order.Proveedor || 'PROVEEDOR NO ENCONTRADO')}
                                                            </span>
                                                        </div>
                                                </div>
                                                {order.FolioReciboMovil && (
                                                    <div className="flex items-center justify-between gap-2 border-t border-slate-200 mt-1 pt-1">
                                                        <div className="flex flex-col">
                                                            <span className="text-[7px] font-black text-emerald-300 uppercase tracking-widest">Folio Recibo</span>
                                                            <span className="text-[9px] font-bold text-emerald-600">{order.FolioReciboMovil}</span>
                                                        </div>
                                                        <div className="flex flex-col text-right">
                                                            <span className="text-[7px] font-black text-emerald-300 uppercase tracking-widest">Fecha Recibo</span>
                                                            <span className="text-[9px] font-bold text-emerald-600">{formatDate(order.FechaRecibo)}</span>
                                                        </div>
                                                    </div>
                                                )}

                                                {(order.UUID || comparisonData.metadata?.UUID) && (
                                                    <div className="flex flex-col border-t border-slate-200 mt-1 pt-1">
                                                        <span className="text-[7px] font-black text-slate-400 uppercase tracking-widest">UUID Factura Vinculada</span>
                                                        <span className="text-[9px] font-mono text-slate-500 break-all leading-tight">
                                                            {order.UUID || comparisonData.metadata?.UUID}
                                                        </span>
                                                    </div>
                                                )}
                                            </div>

                                            <div className="relative">
                                                <Search className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-300" size={12} />
                                                <input 
                                                    type="text" 
                                                    placeholder="Buscar artículo..."
                                                    value={compareSearch}
                                                    onChange={(e) => setCompareSearch(e.target.value)}
                                                    className="w-full pl-7 pr-3 py-1.5 bg-slate-50 border border-slate-200 text-[10px] font-bold focus:outline-none focus:border-[#4050B4] transition-all shadow-inner"
                                                />
                                            </div>
                                        </div>
                                        <div className="flex-1 overflow-y-auto p-4 space-y-2 custom-scrollbar">
                                            {mergedComparison.system.map((item, idx) => {
                                                const hasDiscrepancy = item.CantidadOC !== item.CantidadRec || (item.IsMatched && item.CantidadRec !== item.CantidadFact);
                                                const manRelation = relations.find(r => String(r.CodigoInterno) === String(item.CodigoInterno));
                                                const isManuallyRelated = !!manRelation;
                                                const isAutoRelated = item.IsMatched && !isManuallyRelated;
                                                
                                                const handleItemClick = () => {
                                                    if (selectedInvoiceItem) {
                                                        handleSaveRelation(item.CodigoInterno.toString(), selectedInvoiceItem.OriginalInvoiceItem);
                                                    }
                                                };

                                                const isTargetSelected = selectedInvoiceItem && systemHoverKey === item.CodigoInterno.toString();

                                                // SMART MATCH SUGGESTIONS
                                                const isQuantityMatch = selectedInvoiceItem && !item.IsMatched && item.CantidadRec === selectedInvoiceItem.CantidadFact;
                                                const isPriceMatch = selectedInvoiceItem && !item.IsMatched && item.CostoRec === selectedInvoiceItem.CostoFact;
                                                const isPerfectMatch = isQuantityMatch && isPriceMatch;

                                                return (
                                                    <div 
                                                        key={`sys-${idx}`}
                                                        onClick={handleItemClick}
                                                        onDragOver={(e) => {
                                                            e.preventDefault();
                                                            setSystemHoverKey(item.CodigoInterno.toString());
                                                        }}
                                                        onDragLeave={() => setSystemHoverKey(null)}
                                                        onDrop={(e) => {
                                                            e.preventDefault();
                                                            setSystemHoverKey(null);
                                                            const data = e.dataTransfer.getData('text/plain');
                                                            if (data) {
                                                                const droppedItem = JSON.parse(data);
                                                                handleSaveRelation(item.CodigoInterno.toString(), droppedItem.OriginalInvoiceItem);
                                                            }
                                                        }}
                                                        onMouseEnter={() => setSystemHoverKey(item.CodigoInterno.toString())}
                                                        onMouseLeave={() => setSystemHoverKey(null)}
                                                        className={cn(
                                                            "p-3 border-l-4 shadow-sm border border-slate-100 flex items-center gap-4 transition-all duration-200 group relative overflow-hidden",
                                                            item.IsMatched ? "border-emerald-500 bg-emerald-50/10" : "border-[#4050B4] bg-white",
                                                            selectedInvoiceItem ? "cursor-pointer" : "",
                                                            isTargetSelected ? "bg-[#4050B4]/10 scale-[1.01] shadow-md ring-2 ring-[#4050B4]" : "",
                                                            // Highlights for suggested matches
                                                            !item.IsMatched && isPerfectMatch ? "ring-2 ring-amber-400 bg-amber-50/20 border-amber-500 scale-[1.01] shadow-lg z-10" : 
                                                            !item.IsMatched && isQuantityMatch ? "border-amber-300 bg-amber-50/5 ring-1 ring-amber-200" : ""
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
                                                                    <div className="flex items-center gap-2">
                                                                        <span className="flex items-center gap-1 px-1 py-0.5 bg-[#4050B4]/10 text-[#4050B4] text-[7.5px] font-black uppercase rounded">
                                                                            <ArrowLeftRight size={8} /> Mapeado
                                                                        </span>
                                                                        <button 
                                                                            onClick={(e) => {
                                                                                e.stopPropagation();
                                                                                handleDeleteRelation(manRelation.NoIdentificacion, manRelation.Descripcion);
                                                                            }}
                                                                            className="p-1 hover:bg-rose-100 text-rose-500 rounded transition-colors"
                                                                            title="Desvincular"
                                                                        >
                                                                            <Trash2 size={12} />
                                                                        </button>
                                                                    </div>
                                                                )}
                                                                {isPerfectMatch && (
                                                                    <span className="flex items-center gap-1 px-1 py-0.5 bg-amber-500 text-white text-[7.5px] font-black uppercase rounded animate-bounce shadow-sm">
                                                                        <Sparkles size={8} /> Sugerencia Localizada: Coincidencia Perfecta
                                                                    </span>
                                                                )}
                                                                {!isPerfectMatch && isQuantityMatch && (
                                                                    <span className="flex items-center gap-1 px-1 py-0.5 bg-amber-100 text-amber-600 text-[7.5px] font-black uppercase rounded">
                                                                        <Target size={8} /> Sugerencia: Misma Cantidad
                                                                    </span>
                                                                )}
                                                            </div>
                                                            <div className="flex items-center gap-3 mt-1">
                                                                <span className="text-[9px] font-bold text-slate-400 font-mono">#{item.CodigoInterno}</span>
                                                                <span className="text-[9px] font-bold text-slate-400 font-mono">{item.CodigoBarras || '---'}</span>
                                                                {selectedInvoiceItem && !item.IsMatched && (
                                                                    <span className="text-[8px] font-black uppercase text-[#4050B4] animate-pulse flex items-center gap-1">
                                                                        <PlusCircle size={8} /> Soltar o click para vincular
                                                                    </span>
                                                                )}
                                                            </div>
                                                        </div>
                                                        
                                                        <div className="flex items-center gap-6 text-center shrink-0">
                                                            <div className="flex flex-col w-12">
                                                                <span className="text-[8px] font-black uppercase text-slate-300 tracking-tighter">Cant. OC</span>
                                                                <span className="text-[12px] font-black text-slate-600">{item.CantidadOC}</span>
                                                                <span className="text-[9px] font-bold text-slate-400 mt-1">{formatCurrency(item.CostoOC)}</span>
                                                            </div>
                                                            <div className="flex flex-col px-3 border-x border-slate-100 w-16">
                                                                <span className="text-[8px] font-black uppercase text-slate-300 tracking-tighter">Recibido</span>
                                                                <span className="text-[12px] font-black text-emerald-600">{item.CantidadRec}</span>
                                                                <span className={cn(
                                                                    "text-[9px] font-bold mt-1",
                                                                    item.CostoRec > item.CostoOC ? "text-rose-500" : "text-slate-400"
                                                                )}>{formatCurrency(item.CostoRec)}</span>
                                                            </div>
                                                            <div className="flex flex-col w-16">
                                                                <span className="text-[8px] font-black uppercase text-slate-300 tracking-tighter">Factura</span>
                                                                <span className={cn(
                                                                    "text-[12px] font-black",
                                                                    item.IsMatched ? "text-purple-600" : "text-slate-200"
                                                                )}>{item.IsMatched ? item.CantidadFact : 0}</span>
                                                                <span className={cn(
                                                                    "text-[9px] font-bold mt-1",
                                                                    item.IsMatched && item.CostoFact > item.CostoOC ? "text-rose-600 font-black" : "text-slate-200"
                                                                )}>{item.IsMatched ? formatCurrency(item.CostoFact) : "$0.00"}</span>
                                                            </div>
                                                            <div className="w-20 text-right">
                                                                <span className="text-[8px] font-black uppercase text-slate-300 tracking-tighter block">Dif. OC/Rec</span>
                                                                <span className={cn(
                                                                    "text-[12px] font-black",
                                                                    (item.TotalRec - item.TotalOC) !== 0 ? "text-rose-600" : "text-emerald-600"
                                                                )}>
                                                                    {formatCurrency(item.TotalRec - item.TotalOC)}
                                                                </span>
                                                            </div>
                                                            <div className="w-20 text-right">
                                                                <span className="text-[8px] font-black uppercase text-slate-300 tracking-tighter block">Dif. Rec/Fac</span>
                                                                <span className={cn(
                                                                    "text-[12px] font-black",
                                                                    ((item.IsMatched ? item.TotalFact : 0) - item.TotalRec) !== 0 ? "text-rose-600" : "text-emerald-600"
                                                                )}>
                                                                    {formatCurrency((item.IsMatched ? item.TotalFact : 0) - item.TotalRec)}
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
                                <div className="flex items-center gap-2 pr-6 border-r border-slate-100">
                                    <div className="w-3 h-3 bg-emerald-500 rounded-sm" />
                                    <span className="text-[10px] font-black uppercase text-slate-400">Relacionados</span>
                                </div>
                                <div className="flex gap-8 pl-6 border-l border-slate-100">
                                    <div className="flex flex-col">
                                        <span className="text-[9px] font-black uppercase text-slate-300">Diferencia OC vs Rec</span>
                                        <span className={cn(
                                            "text-base font-black",
                                            totals.diffOCRec > 0 ? "text-rose-600" : (totals.diffOCRec < 0 ? "text-amber-600" : "text-emerald-600")
                                        )}>
                                            {formatCurrency(totals.diffOCRec)}
                                        </span>
                                    </div>
                                    <div className="flex flex-col">
                                        <span className="text-[9px] font-black uppercase text-slate-300">Diferencia Rec vs Fact</span>
                                        <span className={cn(
                                            "text-base font-black",
                                            totals.diffRecFact > 0 ? "text-rose-600" : (totals.diffRecFact < 0 ? "text-amber-600" : "text-emerald-600")
                                        )}>
                                            {formatCurrency(totals.diffRecFact)}
                                        </span>
                                    </div>
                                </div>
                            </div>
                            <div className="flex items-center gap-3">
                                <button 
                                    onClick={handlePrintPDF}
                                    className="px-6 py-2.5 bg-white border-2 border-slate-200 hover:border-[#4050B4] text-slate-600 hover:text-[#4050B4] text-[11px] font-black uppercase tracking-widest transition-all flex items-center gap-2 group"
                                >
                                    <Printer size={16} className="group-hover:scale-110 transition-transform" />
                                    Imprimir Reporte
                                </button>
                                
                                <button 
                                    onClick={handleFinishReconciliation}
                                    className="px-10 py-2.5 bg-[#4050B4] hover:bg-[#344299] text-white text-[11px] font-black uppercase tracking-widest shadow-xl hover:shadow-[#4050B4]/40 transition-all flex items-center gap-2 group"
                                >
                                    <CheckCircle2 size={16} className="group-hover:rotate-12 transition-transform" />
                                    Finalizar Comparativa
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

        </div>
    );
}

// Simple Helper Component for Kanban Items
function KanbanItem({ label, value, colSpan = 1, highlight = false, color = "text-slate-800", textSize = "text-[12px]" }: { label: string, value: any, colSpan?: number, highlight?: boolean, color?: string, textSize?: string }) {
    return (
        <div className={cn("flex flex-col gap-1", colSpan === 2 && "col-span-2")}>
            <span className="text-[9px] font-black uppercase text-slate-400 tracking-widest">{label}</span>
            <span className={cn(
                "uppercase truncate", 
                textSize,
                highlight ? "font-black text-sm" : "font-bold",
                color
            )}>
                {value || "-"}
            </span>
        </div>
    );
}
