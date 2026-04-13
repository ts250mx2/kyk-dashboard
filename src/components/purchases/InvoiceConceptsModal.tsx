"use client";

import { useState, useEffect } from 'react';
import { 
    X, Receipt, Search, FileText
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { InvoiceConcept } from '@/types/purchases';

interface InvoiceConceptsModalProps {
    isOpen: boolean;
    onClose: () => void;
    uuid: string | null;
    serie?: string;
    folio?: string;
}

export function InvoiceConceptsModal({
    isOpen,
    onClose,
    uuid,
    serie,
    folio
}: InvoiceConceptsModalProps) {
    const [concepts, setConcepts] = useState<InvoiceConcept[]>([]);
    const [loading, setLoading] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');

    useEffect(() => {
        if (isOpen && uuid) {
            fetchConcepts(uuid);
        } else if (!isOpen) {
            setConcepts([]);
            setSearchTerm('');
        }
    }, [isOpen, uuid]);

    const fetchConcepts = async (uuid: string) => {
        setLoading(true);
        try {
            const res = await fetch(`/api/purchases/invoices/concepts?uuid=${uuid}`);
            const data = await res.json();
            if (res.ok) {
                setConcepts(data);
            } else {
                console.error('API Error:', data.error);
            }
        } catch (error) {
            console.error('Error fetching concepts:', error);
        } finally {
            setLoading(false);
        }
    };

    const formatCurrency = (val: number) => {
        return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(val);
    };

    const filteredConcepts = concepts.filter(c => 
        c.Descripcion.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.NoIdentificacion?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[10030] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white w-full max-w-6xl h-[85vh] shadow-2xl border border-slate-200 flex flex-col animate-in slide-in-from-bottom-4 duration-300">
                {/* Modal Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-white">
                    <div className="flex flex-col">
                        <h2 className="text-lg font-black text-slate-800 uppercase tracking-tight flex items-center gap-2">
                            <FileText className="text-purple-600" size={20} />
                            Conceptos de Factura: {serie}{folio}
                        </h2>
                        <div className="flex items-center gap-3 mt-1">
                            <p className="text-[10px] font-mono text-slate-400 uppercase tracking-widest">{uuid}</p>
                        </div>
                    </div>
                    <button 
                        onClick={onClose}
                        className="p-2 hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Search Bar */}
                <div className="px-6 py-3 bg-slate-50 border-b border-slate-100">
                    <div className="relative max-w-md">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                        <input 
                            type="text"
                            placeholder="BUSCAR CONCEPTO..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-9 pr-4 py-2 bg-white border border-slate-200 text-[11px] font-bold uppercase tracking-widest focus:outline-none focus:border-purple-500 transition-colors"
                        />
                    </div>
                </div>

                {/* Modal Content - Table */}
                <div className="flex-1 overflow-auto custom-scrollbar p-6 bg-slate-50/30">
                    {loading ? (
                        <div className="h-full flex flex-col items-center justify-center space-y-4">
                            <div className="w-10 h-10 border-4 border-slate-200 border-t-purple-600 rounded-full animate-spin" />
                            <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest animate-pulse">Consultando conceptos...</p>
                        </div>
                    ) : (
                        <table className="w-full text-left border-collapse bg-white shadow-sm border border-slate-200">
                            <thead className="bg-slate-50 border-b border-slate-200 sticky top-0 z-10">
                                <tr>
                                    <th className="p-2 text-[9px] font-black uppercase tracking-widest text-slate-400 text-right w-16">Cant</th>
                                    <th className="p-2 text-[9px] font-black uppercase tracking-widest text-slate-400 w-16">Unidad</th>
                                    <th className="p-2 text-[9px] font-black uppercase tracking-widest text-slate-400 w-24">Clave SAT</th>
                                    <th className="p-2 text-[9px] font-black uppercase tracking-widest text-slate-400 w-32">Identificación</th>
                                    <th className="p-2 text-[9px] font-black uppercase tracking-widest text-slate-400">Descripción</th>
                                    <th className="p-2 text-[9px] font-black uppercase tracking-widest text-slate-400 text-right w-24">Precio Unit.</th>
                                    <th className="p-2 text-[9px] font-black uppercase tracking-widest text-slate-400 text-right w-16">Desc.</th>
                                    <th className="p-2 text-[9px] font-black uppercase tracking-widest text-slate-400 text-right w-28">Importe</th>
                                </tr>
                            </thead>
                            <tbody className="text-slate-700">
                                {filteredConcepts.map((item, idx) => (
                                    <tr key={idx} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                                        <td className="p-2 text-[11px] text-right font-black text-purple-600">{item.Cantidad}</td>
                                        <td className="p-2 text-[10px] font-black text-slate-400 uppercase">{item.Unidad}</td>
                                        <td className="p-2 text-[10px] font-mono text-slate-400">{item.ClaveProdServ}</td>
                                        <td className="p-2 text-[10px] font-mono text-slate-500">{item.NoIdentificacion}</td>
                                        <td className="p-2 text-[11px] font-bold uppercase tracking-tight truncate max-w-[250px]" title={item.Descripcion}>{item.Descripcion}</td>
                                        <td className="p-2 text-[11px] text-right font-bold text-slate-600">{formatCurrency(item.ValorUnitario)}</td>
                                        <td className="p-2 text-[10px] text-right font-bold text-rose-500">{item.Descuento > 0 ? formatCurrency(item.Descuento) : '-'}</td>
                                        <td className="p-2 text-[11px] text-right font-black text-slate-900">{formatCurrency(item.Importe)}</td>
                                    </tr>
                                ))}
                                {filteredConcepts.length === 0 && (
                                    <tr>
                                        <td colSpan={8} className="p-10 text-center">
                                            <p className="text-[11px] font-bold uppercase text-slate-400 tracking-widest italic">No se encontraron conceptos para esta factura</p>
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                            <tfoot className="bg-slate-50 border-t-2 border-slate-200 sticky bottom-0">
                                <tr>
                                    <td colSpan={7} className="p-4 text-right text-[11px] font-black uppercase text-slate-500 tracking-widest">
                                        Total Facturado (Conceptos)
                                    </td>
                                    <td className="p-4 text-right text-base font-black text-purple-600">
                                        {formatCurrency(concepts.reduce((acc, item) => acc + item.Importe, 0))}
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
