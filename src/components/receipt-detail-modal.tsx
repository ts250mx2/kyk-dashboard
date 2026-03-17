"use client";

import { useState, useEffect } from 'react';
import { 
    X, Check, ExternalLink, Search
} from 'lucide-react';
import { LoadingScreen } from './ui/loading-screen';
import { cn } from '@/lib/utils';

interface ReceiptDetailItem {
    CodigoInterno: string;
    CodigoBarras: string;
    Descripcion: string;
    MedidaCompra: string;
    MedidaVenta: string;
    MedidaGranel: string;
    Pedido: number;
    Rec: number;
    RecGranel: number;
    Costo: number;
    Desc0: number;
    Desc1: number;
    Desc2: number;
    Desc3: number;
    Desc4: number;
    Factor: number;
    Total: number;
}

interface ReceiptReturnItem {
    CodigoInterno: string;
    CodigoBarras: string;
    Descripcion: string;
    MedidaVenta: string;
    Rec: number;
    Costo: number;
    Total: number;
}

interface ReceiptData {
    header: {
        folioRecibo: string;
        FechaRecibo: string;
        Usuario: string;
        UUID: string;
    };
    receiptItems: ReceiptDetailItem[];
    returnItems: ReceiptReturnItem[];
}

interface ReceiptDetailModalProps {
    isOpen: boolean;
    onClose: () => void;
    folioRecibo: string | null;
    storeName?: string;
    providerName?: string;
}

export function ReceiptDetailModal({
    isOpen,
    onClose,
    folioRecibo,
    storeName,
    providerName
}: ReceiptDetailModalProps) {
    const [receiptData, setReceiptData] = useState<ReceiptData | null>(null);
    const [loading, setLoading] = useState(false);
    const [activeTab, setActiveTab] = useState<'recibo' | 'devoluciones'>('recibo');

    useEffect(() => {
        if (isOpen && folioRecibo) {
            fetchReceiptDetails(folioRecibo);
        } else if (!isOpen) {
            setReceiptData(null);
            setActiveTab('recibo');
        }
    }, [isOpen, folioRecibo]);

    const fetchReceiptDetails = async (folio: string) => {
        setLoading(true);
        try {
            const res = await fetch(`/api/purchases/receipts/details?folioRecibo=${folio}`);
            const data = await res.json();
            if (data.error) {
                console.error('API Error:', data.error);
            } else {
                setReceiptData(data);
                // Switch to returns tab if there are no receipt items but there are return items
                if (data.receiptItems?.length === 0 && data.returnItems?.length > 0) {
                    setActiveTab('devoluciones');
                } else {
                    setActiveTab('recibo');
                }
            }
        } catch (error) {
            console.error('Error fetching receipt details:', error);
        } finally {
            setLoading(false);
        }
    };

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

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[10005] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white w-full max-w-6xl h-[85vh] shadow-2xl border border-slate-200 flex flex-col animate-in slide-in-from-bottom-4 duration-300">
                {/* Modal Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-white">
                    <div className="flex flex-col">
                        <h2 className="text-lg font-black text-slate-800 uppercase tracking-tight flex items-center gap-2">
                            <Check className="text-emerald-600" size={20} />
                            Detalle de Recibo: {folioRecibo}
                        </h2>
                        <div className="flex flex-wrap items-center gap-3 mt-1">
                            {storeName && (
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{storeName}</p>
                            )}
                            {storeName && providerName && <div className="w-1 h-1 rounded-full bg-slate-300" />}
                            {providerName && (
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{providerName}</p>
                            )}
                            <div className="w-1 h-1 rounded-full bg-slate-300" />
                            <p className="text-[10px] font-black text-emerald-600 uppercase tracking-widest">Fecha: {formatDate(receiptData?.header.FechaRecibo || '')}</p>
                            <div className="w-1 h-1 rounded-full bg-slate-300" />
                            <p className="text-[10px] font-black text-[#4050B4] uppercase tracking-widest">Recibe: {receiptData?.header.Usuario || 'N/A'}</p>
                            {receiptData?.header.UUID && (
                                <>
                                    <div className="w-1 h-1 rounded-full bg-slate-300" />
                                    <a 
                                        href={receiptData.header.UUID} 
                                        target="_blank" 
                                        rel="noopener noreferrer"
                                        className="text-[10px] font-black text-amber-600 uppercase tracking-widest hover:underline flex items-center gap-1"
                                    >
                                        UUID <ExternalLink size={10} />
                                    </a>
                                </>
                            )}
                        </div>
                    </div>
                    <button 
                        onClick={onClose}
                        className="p-2 hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Tabs Navigation */}
                <div className="flex bg-slate-50 border-b border-slate-100 px-6">
                    <button
                        onClick={() => setActiveTab('recibo')}
                        className={cn(
                            "px-6 py-3 text-[11px] font-black uppercase tracking-widest transition-all border-b-2",
                            activeTab === 'recibo' 
                                ? "border-emerald-500 text-emerald-600 bg-white" 
                                : "border-transparent text-slate-400 hover:text-slate-600"
                        )}
                    >
                        Recibo ({receiptData?.receiptItems.length || 0})
                    </button>
                    {receiptData?.returnItems && receiptData.returnItems.length > 0 && (
                        <button
                            onClick={() => setActiveTab('devoluciones')}
                            className={cn(
                                "px-6 py-3 text-[11px] font-black uppercase tracking-widest transition-all border-b-2",
                                activeTab === 'devoluciones' 
                                    ? "border-rose-500 text-rose-600 bg-white" 
                                    : "border-transparent text-slate-400 hover:text-slate-600"
                            )}
                        >
                            Devoluciones ({receiptData?.returnItems.length || 0})
                        </button>
                    )}
                </div>

                {/* Modal Content - Tab Panels */}
                <div className="flex-1 overflow-auto custom-scrollbar p-6 bg-slate-50/30">
                    {loading ? (
                        <div className="h-full flex flex-col items-center justify-center space-y-4">
                            <div className="w-10 h-10 border-4 border-slate-200 border-t-emerald-500 rounded-full animate-spin" />
                            <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest animate-pulse">Consultando recibo...</p>
                        </div>
                    ) : (
                        <table className="w-full text-left border-collapse bg-white shadow-sm border border-slate-200">
                            <thead className="bg-slate-50 border-b border-slate-200 sticky top-0 z-10">
                                <tr>
                                    {activeTab === 'recibo' ? (
                                        <>
                                            <th className="p-2 text-[9px] font-black uppercase tracking-widest text-slate-400 text-right w-16">Pedido</th>
                                            <th className="p-2 text-[9px] font-black uppercase tracking-widest text-slate-400 text-right w-16">Rec</th>
                                            <th className="p-2 text-[9px] font-black uppercase tracking-widest text-slate-400 w-24">Medida Compra</th>
                                            <th className="p-2 text-[9px] font-black uppercase tracking-widest text-slate-400 text-right w-16">Kgs</th>
                                            <th className="p-2 text-[9px] font-black uppercase tracking-widest text-slate-400 w-20">MedidaGranel</th>
                                            <th className="p-2 text-[9px] font-black uppercase tracking-widest text-slate-400 w-32">Codigo Barras</th>
                                            <th className="p-2 text-[9px] font-black uppercase tracking-widest text-slate-400">Descripcion</th>
                                            <th className="p-2 text-[9px] font-black uppercase tracking-widest text-slate-400 text-right w-24">Costo</th>
                                            <th className="p-2 text-[9px] font-black uppercase tracking-widest text-slate-400 text-right w-12">D1</th>
                                            <th className="p-2 text-[9px] font-black uppercase tracking-widest text-slate-400 text-right w-12">D2</th>
                                            <th className="p-2 text-[9px] font-black uppercase tracking-widest text-slate-400 text-right w-12">D3</th>
                                            <th className="p-2 text-[9px] font-black uppercase tracking-widest text-slate-400 text-right w-12">D4</th>
                                            <th className="p-2 text-[9px] font-black uppercase tracking-widest text-slate-400 text-right w-12">D5</th>
                                            <th className="p-2 text-[9px] font-black uppercase tracking-widest text-slate-400 text-right w-16">Volumen</th>
                                            <th className="p-2 text-[9px] font-black uppercase tracking-widest text-slate-400 text-right w-28">Total</th>
                                        </>
                                    ) : (
                                        <>
                                            <th className="p-2 text-[9px] font-black uppercase tracking-widest text-slate-400 text-right w-16">Dev</th>
                                            <th className="p-2 text-[9px] font-black uppercase tracking-widest text-slate-400 w-24">Medida</th>
                                            <th className="p-2 text-[9px] font-black uppercase tracking-widest text-slate-400 w-32">Codigo Barras</th>
                                            <th className="p-2 text-[9px] font-black uppercase tracking-widest text-slate-400">Descripcion</th>
                                            <th className="p-2 text-[9px] font-black uppercase tracking-widest text-slate-400 text-right w-24">Costo</th>
                                            <th className="p-2 text-[9px] font-black uppercase tracking-widest text-slate-400 text-right w-28">Total</th>
                                        </>
                                    )}
                                </tr>
                            </thead>
                            <tbody className="text-slate-700">
                                {(activeTab === 'recibo' ? receiptData?.receiptItems : receiptData?.returnItems)?.map((item, idx) => (
                                    <tr key={idx} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                                        {activeTab === 'recibo' ? (
                                            <>
                                                <td className="p-2 text-[11px] text-right font-bold text-slate-400">{(item as ReceiptDetailItem).Pedido}</td>
                                                <td className="p-2 text-[11px] text-right font-black text-[#4050B4]">{(item as ReceiptDetailItem).Rec}</td>
                                                <td className="p-2 text-[10px] font-black text-slate-400 uppercase">{(item as ReceiptDetailItem).MedidaCompra}</td>
                                                <td className="p-2 text-[11px] text-right font-bold text-emerald-600">{(item as ReceiptDetailItem).RecGranel.toFixed(3)}</td>
                                                <td className="p-2 text-[10px] font-black text-slate-400 uppercase italic">{(item as ReceiptDetailItem).MedidaGranel}</td>
                                                <td className="p-2 text-[10px] font-mono font-bold text-slate-500">{item.CodigoBarras}</td>
                                                <td className="p-2 text-[11px] font-bold uppercase tracking-tight truncate max-w-[150px]" title={item.Descripcion}>{item.Descripcion}</td>
                                                <td className="p-2 text-[11px] text-right font-bold text-slate-600">{formatCurrency(item.Costo)}</td>
                                                <td className="p-2 text-[10px] text-right font-bold text-slate-400">{(item as ReceiptDetailItem).Desc0}</td>
                                                <td className="p-2 text-[10px] text-right font-bold text-slate-400">{(item as ReceiptDetailItem).Desc1}</td>
                                                <td className="p-2 text-[10px] text-right font-bold text-slate-400">{(item as ReceiptDetailItem).Desc2}</td>
                                                <td className="p-2 text-[10px] text-right font-bold text-slate-400">{(item as ReceiptDetailItem).Desc3}</td>
                                                <td className="p-2 text-[10px] text-right font-bold text-slate-400">{(item as ReceiptDetailItem).Desc4}</td>
                                                <td className="p-2 text-[10px] text-right font-bold text-amber-600">{(item as ReceiptDetailItem).Factor}</td>
                                                <td className="p-2 text-[11px] text-right font-black text-slate-900">{formatCurrency(item.Total)}</td>
                                            </>
                                        ) : (
                                            <>
                                                <td className="p-2 text-[11px] text-right font-black text-rose-600">{(item as ReceiptReturnItem).Rec}</td>
                                                <td className="p-2 text-[10px] font-black text-slate-400 uppercase">{(item as ReceiptReturnItem).MedidaVenta}</td>
                                                <td className="p-2 text-[10px] font-mono font-bold text-slate-500">{item.CodigoBarras}</td>
                                                <td className="p-2 text-[11px] font-bold uppercase tracking-tight">{item.Descripcion}</td>
                                                <td className="p-2 text-[11px] text-right font-bold text-slate-600">{formatCurrency(item.Costo)}</td>
                                                <td className="p-2 text-[11px] text-right font-black text-rose-900">{formatCurrency(item.Total)}</td>
                                            </>
                                        )}
                                    </tr>
                                ))}
                                {((activeTab === 'recibo' ? receiptData?.receiptItems : receiptData?.returnItems)?.length === 0) && (
                                    <tr>
                                        <td colSpan={activeTab === 'recibo' ? 15 : 6} className="p-10 text-center">
                                            <p className="text-[11px] font-bold uppercase text-slate-400 tracking-widest italic">No hay partidas registradas en esta sección</p>
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                            <tfoot className="bg-slate-50 border-t-2 border-slate-200 sticky bottom-0">
                                <tr>
                                    <td colSpan={activeTab === 'recibo' ? 14 : 5} className="p-4 text-right text-[11px] font-black uppercase text-slate-500 tracking-widest">
                                        Total {activeTab === 'recibo' ? 'Recibido' : 'Devolución'}
                                    </td>
                                    <td className={cn(
                                        "p-4 text-right text-base font-black",
                                        activeTab === 'recibo' ? "text-emerald-600" : "text-rose-600"
                                    )}>
                                        {formatCurrency((activeTab === 'recibo' ? receiptData?.receiptItems : receiptData?.returnItems)?.reduce((acc, item) => acc + item.Total, 0) || 0)}
                                    </td>
                                </tr>
                            </tfoot>
                        </table>
                    )}
                </div>

                {/* Modal Footer */}
                <div className="px-6 py-4 border-t border-slate-100 bg-white flex justify-end">
                    <button 
                        onClick={onClose}
                        className="px-8 py-2.5 bg-slate-800 text-white text-[11px] font-black uppercase tracking-widest hover:bg-slate-700 transition-all shadow-lg"
                    >
                        Cerrar
                    </button>
                </div>
            </div>
        </div>
    );
}
