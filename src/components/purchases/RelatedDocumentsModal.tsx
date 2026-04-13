"use client";

import { useState, useEffect } from 'react';
import { 
    X, FileText, Search, Download, Printer, FileCode, AlertTriangle, ExternalLink
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { InvoiceDetail } from '@/types/purchases';
import { generateInvoicePDF } from '@/utils/cfdi-pdf-renderer';
import { InvoiceConceptsModal } from '@/components/purchases/InvoiceConceptsModal';

interface RelatedDocumentsModalProps {
    isOpen: boolean;
    onClose: () => void;
    parentUuid: string | null;
}

export function RelatedDocumentsModal({
    isOpen,
    onClose,
    parentUuid
}: RelatedDocumentsModalProps) {
    const [documents, setDocuments] = useState<InvoiceDetail[]>([]);
    const [loading, setLoading] = useState(false);
    const [loadingAction, setLoadingAction] = useState<string | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    
    // State for nested detail modal
    const [selectedDocForDetail, setSelectedDocForDetail] = useState<InvoiceDetail | null>(null);
    const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);

    useEffect(() => {
        if (isOpen && parentUuid) {
            fetchRelatedDocuments(parentUuid);
        } else if (!isOpen) {
            setDocuments([]);
            setSearchTerm('');
        }
    }, [isOpen, parentUuid]);

    const fetchRelatedDocuments = async (uuid: string) => {
        setLoading(true);
        try {
            const res = await fetch(`/api/purchases/invoices/related?uuid=${uuid}`);
            const data = await res.json();
            if (res.ok) {
                setDocuments(data);
            } else {
                console.error('API Error:', data.error);
            }
        } catch (error) {
            console.error('Error fetching related documents:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleDownloadXml = async (uuid: string) => {
        setLoadingAction(uuid + '-xml');
        try {
            const res = await fetch(`/api/purchases/invoices/xml?uuid=${uuid}`);
            const data = await res.json();
            if (res.ok && data.xml) {
                const blob = new Blob([data.xml], { type: 'text/xml' });
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `${uuid}.xml`;
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
            setLoadingAction(null);
        }
    };

    const handleViewPdf = async (uuid: string) => {
        setLoadingAction(uuid + '-pdf');
        try {
            const res = await fetch(`/api/purchases/invoices/xml?uuid=${uuid}`);
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
            setLoadingAction(null);
        }
    };

    const formatCurrency = (val: number) => {
        return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(val);
    };

    const filteredDocs = documents.filter(doc => 
        doc.UUID.toLowerCase().includes(searchTerm.toLowerCase()) ||
        doc.Folio.toLowerCase().includes(searchTerm.toLowerCase()) ||
        doc.Emisor.toLowerCase().includes(searchTerm.toLowerCase()) ||
        doc.Receptor.toLowerCase().includes(searchTerm.toLowerCase())
    );

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[10020] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white w-full max-w-7xl h-[85vh] shadow-2xl border border-slate-200 flex flex-col animate-in slide-in-from-bottom-4 duration-300">
                {/* Modal Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-white">
                    <div className="flex flex-col">
                        <h2 className="text-lg font-black text-slate-800 uppercase tracking-tight flex items-center gap-2">
                            <FileText className="text-[#4050B4]" size={20} />
                            Documentos Relacionados
                        </h2>
                        <p className="text-[10px] font-mono text-slate-400 mt-1 uppercase tracking-widest">
                            Referencia Padre: {parentUuid}
                        </p>
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
                            placeholder="BUSCAR EN DOCUMENTOS..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-9 pr-4 py-2 bg-white border border-slate-200 text-[11px] font-bold uppercase focus:outline-none focus:border-[#4050B4] transition-colors"
                        />
                    </div>
                </div>

                {/* Modal Content - Table */}
                <div className="flex-1 overflow-auto custom-scrollbar p-6 bg-slate-50/30">
                    {loading ? (
                        <div className="h-full flex flex-col items-center justify-center space-y-4">
                            <div className="w-10 h-10 border-4 border-slate-200 border-t-[#4050B4] rounded-full animate-spin" />
                            <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest animate-pulse">Consultando relaciones...</p>
                        </div>
                    ) : documents.length === 0 ? (
                        <div className="h-full flex flex-col items-center justify-center text-center p-10 bg-white border border-dashed border-slate-200 rounded-lg">
                            <AlertTriangle size={48} className="text-slate-300 mb-4" />
                            <p className="text-slate-500 font-bold uppercase tracking-widest text-sm">No se encontraron documentos relacionados</p>
                            <p className="text-slate-400 text-[10px] mt-2 uppercase">Este UUID no tiene comprobantes vinculados en el sistema</p>
                        </div>
                    ) : (
                        <table className="w-full text-left border-collapse bg-white shadow-sm border border-slate-200">
                            <thead className="bg-slate-50 border-b border-slate-200 sticky top-0 z-10">
                                <tr>
                                    <th className="p-3 text-[9px] font-black uppercase text-slate-400 w-12">T.C.</th>
                                    <th className="p-3 text-[9px] font-black uppercase text-slate-400 w-32">Serie / Folio</th>
                                    <th className="p-3 text-[9px] font-black uppercase text-slate-400">Emisor</th>
                                    <th className="p-3 text-[9px] font-black uppercase text-slate-400">Receptor</th>
                                    <th className="p-3 text-[9px] font-black uppercase text-slate-400 text-right w-32">Total</th>
                                    <th className="p-3 text-[9px] font-black uppercase text-slate-400">UUID</th>
                                    <th className="p-3 text-[9px] font-black uppercase text-slate-400 text-center w-32">Acciones</th>
                                </tr>
                            </thead>
                            <tbody className="text-slate-700">
                                {filteredDocs.map((doc, idx) => (
                                    <tr key={idx} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                                        <td className="p-3">
                                            <span className={cn(
                                                "px-2 py-0.5 text-[9px] font-black rounded border whitespace-nowrap",
                                                doc.TipoComprobante === 'E' ? "bg-rose-50 text-rose-500 border-rose-100" : 
                                                doc.TipoComprobante === 'P' ? "bg-blue-50 text-blue-600 border-blue-100" :
                                                "bg-emerald-50 text-emerald-600 border-emerald-100"
                                            )}>
                                                {doc.TipoComprobante === 'E' ? 'NOTA DE CRÉDITO' : 
                                                 doc.TipoComprobante === 'P' ? 'PAGO' : 
                                                 doc.TipoComprobante === 'I' ? 'INGRESO' : doc.TipoComprobante}
                                            </span>
                                        </td>
                                        <td className="p-3">
                                            <div className="flex flex-col">
                                                <span className="text-[11px] font-black text-slate-800 uppercase">{doc.Serie}{doc.Folio}</span>
                                                <span className="text-[9px] text-slate-400 font-bold">{doc.MetodoPago} / {doc.Moneda}</span>
                                            </div>
                                        </td>
                                        <td className="p-3">
                                            <div className="flex flex-col">
                                                <span className="text-[11px] font-black text-slate-700 uppercase leading-snug truncate max-w-[200px]" title={doc.Emisor}>{doc.Emisor}</span>
                                                <span className="text-[9px] font-mono text-slate-400">{doc.RFCEmisor}</span>
                                            </div>
                                        </td>
                                        <td className="p-3">
                                            <div className="flex flex-col">
                                                <span className="text-[11px] font-black text-slate-700 uppercase leading-snug truncate max-w-[200px]" title={doc.Receptor}>{doc.Receptor}</span>
                                                <span className="text-[9px] font-mono text-slate-400">{doc.RFCReceptor}</span>
                                            </div>
                                        </td>
                                        <td className="p-3 text-right">
                                            <span className="text-[11px] font-black text-slate-900">{formatCurrency(doc.Total)}</span>
                                        </td>
                                        <td className="p-3">
                                            <span className="text-[10px] font-mono text-slate-400 break-all">{doc.UUID}</span>
                                        </td>
                                        <td className="p-3">
                                            <div className="flex items-center justify-center gap-2">
                                                <button 
                                                    onClick={() => {
                                                        setSelectedDocForDetail(doc);
                                                        setIsDetailModalOpen(true);
                                                    }}
                                                    title="Ver Detalle de Conceptos"
                                                    className="p-1.5 bg-slate-50 text-slate-400 hover:bg-purple-50 hover:text-purple-600 border border-slate-100 transition-all"
                                                >
                                                    <ExternalLink size={14} />
                                                </button>
                                                <button 
                                                    onClick={() => handleDownloadXml(doc.UUID)}
                                                    disabled={loadingAction === doc.UUID + '-xml'}
                                                    title="Descargar XML"
                                                    className="p-1.5 bg-slate-50 text-slate-400 hover:bg-emerald-50 hover:text-emerald-600 border border-slate-100 transition-all disabled:opacity-50"
                                                >
                                                    <FileCode size={14} className={cn(loadingAction === doc.UUID + '-xml' && "animate-pulse")} />
                                                </button>
                                                <button 
                                                    onClick={() => handleViewPdf(doc.UUID)}
                                                    disabled={loadingAction === doc.UUID + '-pdf'}
                                                    title="Imprimir PDF"
                                                    className="p-1.5 bg-slate-50 text-slate-400 hover:bg-[#4050B4] hover:text-white border border-slate-100 transition-all disabled:opacity-50"
                                                >
                                                    {loadingAction === doc.UUID + '-pdf' ? <div className="w-3.5 h-3.5 border-2 border-t-white rounded-full animate-spin" /> : <Printer size={14} />}
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>

                {/* Modal Footer */}
                <div className="px-6 py-4 border-t border-slate-100 bg-white flex justify-end">
                    <button 
                        onClick={onClose}
                        className="px-10 py-2.5 bg-slate-800 text-white text-[11px] font-black uppercase tracking-widest hover:bg-slate-700 transition-all shadow-xl"
                    >
                        Cerrar
                    </button>
                </div>
            </div>

            {/* Nested Invoice Detail Modal */}
            {isDetailModalOpen && selectedDocForDetail && (
                <InvoiceConceptsModal 
                    isOpen={isDetailModalOpen}
                    onClose={() => {
                        setIsDetailModalOpen(false);
                        setSelectedDocForDetail(null);
                    }}
                    uuid={selectedDocForDetail.UUID}
                    serie={selectedDocForDetail.Serie}
                    folio={selectedDocForDetail.Folio}
                />
            )}
        </div>
    );
}
