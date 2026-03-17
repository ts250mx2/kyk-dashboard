"use client";

import { useState, useEffect, memo } from 'react';
import { X, Receipt, Monitor, Printer, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { LoadingScreen } from './ui/loading-screen';

interface ClosingTicketModalProps {
    isOpen: boolean;
    onClose: () => void;
    idTienda?: string;
    idCaja?: string;
    idApertura?: string | number;
    storeName?: string;
    zNumber?: string;
}

function ClosingTicketModalComponent({
    isOpen,
    onClose,
    idTienda,
    idCaja,
    idApertura,
    storeName,
    zNumber
}: ClosingTicketModalProps) {
    const [ticketText, setTicketText] = useState<string>('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (isOpen && idTienda && idCaja && idApertura) {
            fetchTicket();
        } else if (!isOpen) {
            setTicketText('');
            setError(null);
        }
    }, [isOpen, idTienda, idCaja, idApertura]);

    const fetchTicket = async () => {
        setLoading(true);
        setError(null);
        try {
            const res = await fetch(`/api/dashboard/closing-ticket?idTienda=${idTienda}&idCaja=${idCaja}&idApertura=${idApertura}`);
            const data = await res.json();
            if (data.error) throw new Error(data.error);
            setTicketText(data.ticket);
        } catch (err: any) {
            console.error('Error fetching closing ticket:', err);
            setError(err.message || 'Error al cargar el ticket');
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[12000] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white shadow-2xl overflow-hidden flex flex-col w-full max-w-lg max-h-[90vh] border border-slate-200">
                {/* Header */}
                <div className="flex items-center justify-between bg-white border-b border-slate-100 p-4 shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-indigo-50 rounded-none border border-indigo-100">
                            <Receipt size={18} className="text-indigo-600" />
                        </div>
                        <div>
                            <h3 className="font-black text-sm uppercase tracking-widest leading-none mb-1 text-slate-800">Ticket de Corte</h3>
                            <p className="text-[10px] font-bold text-slate-400 uppercase">
                                {storeName} • Terminal {idCaja} • Z {zNumber}
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-rose-50 text-rose-500 transition-colors"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-auto bg-slate-50 p-6 flex justify-center">
                    {loading ? (
                        <div className="h-64 flex items-center justify-center w-full">
                            <LoadingScreen message="Obteniendo ticket de corte..." />
                        </div>
                    ) : error ? (
                        <div className="flex flex-col items-center justify-center p-8 text-center gap-4">
                            <AlertCircle size={48} className="text-rose-500" />
                            <p className="text-xs font-black text-slate-400 uppercase tracking-widest leading-relaxed">
                                {error}
                            </p>
                        </div>
                    ) : (
                        <div className="bg-white shadow-inner p-8 border border-slate-200 w-full font-mono text-[11px] leading-relaxed whitespace-pre overflow-x-auto text-slate-700 select-all">
                            {ticketText}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="bg-white p-4 border-t border-slate-100 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <Printer size={14} className="text-slate-400" />
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Vista Previa de Corte</span>
                    </div>
                    <button
                        onClick={onClose}
                        className="px-6 py-2 bg-slate-900 text-white font-black text-[10px] uppercase tracking-widest hover:bg-slate-800 transition-colors"
                    >
                        CERRAR
                    </button>
                </div>
            </div>
        </div>
    );
}

export const ClosingTicketModal = memo(ClosingTicketModalComponent);
