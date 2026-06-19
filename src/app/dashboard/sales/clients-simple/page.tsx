'use client';

import { useEffect, useMemo, useState } from 'react';
import {
    Store, Calendar, ChevronRight, ArrowLeft, Loader2, Search,
    Wallet, CreditCard, UserCircle, FileMinus,
    Building, Home, Sparkles
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { DeepSummaryModal } from '@/components/dashboard/deep-summary-modal';
import type { PageSummaryContext } from '@/components/narrative-summary';

type Level = 'stores' | 'payment-types' | 'clients' | 'invoices';
type PaymentType = 'contado' | 'credito' | 'publico' | 'notas';

interface StoreCard {
    IdTienda: number | null;
    Tienda: string;
    VentaTotal: number;
    Contado: number;
    Credito: number;
    Publico: number;
    Notas: number;
    ClientesUnicos: number;
    Facturas: number;
}

interface PaymentTypeCard {
    key: PaymentType;
    label: string;
    monto: number;
    clientes: number;
    facturas: number;
}

interface ClientCard {
    RFC: string;
    ClienteConcepto: string;
    Monto: number;
    Facturas: number;
    PrimeraFactura: string;
    UltimaFactura: string;
}

interface Invoice {
    IdFactura: number;
    Serie: string;
    AlfaNumerico: string;
    FechaFactura: string;
    RFC: string;
    ClienteConcepto: string;
    Total: number;
    MetodoPago: string;
    FormaPago: string;
    Credito: number;
    Tienda: string;
    IdTienda: number;
}

const PAYMENT_COLORS: Record<PaymentType, { bg: string; text: string; border: string; icon: React.ReactNode }> = {
    contado: { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200', icon: <Wallet size={28} /> },
    credito: { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200', icon: <CreditCard size={28} /> },
    publico: { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200', icon: <UserCircle size={28} /> },
    notas: { bg: 'bg-rose-50', text: 'text-rose-700', border: 'border-rose-200', icon: <FileMinus size={28} /> }
};

const PAYMENT_LABELS: Record<PaymentType, string> = {
    contado: 'Contado',
    credito: 'Crédito',
    publico: 'Público General',
    notas: 'Nota de Crédito'
};

function fmtMoney(n: number): string {
    return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 }).format(n || 0);
}

function fmtNumber(n: number): string {
    return new Intl.NumberFormat('es-MX').format(n || 0);
}

function fmtDate(d: string | Date | null): string {
    if (!d) return '';
    const date = typeof d === 'string' ? new Date(d) : d;
    return date.toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' });
}

function mtyDate(offset = 0): string {
    const d = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Monterrey' }));
    d.setDate(d.getDate() + offset);
    return d.toLocaleDateString('en-CA');
}

function mtyMonth(monthOffset = 0): Date {
    const d = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Monterrey' }));
    d.setMonth(d.getMonth() + monthOffset);
    return d;
}

export default function ClientsSimplePage() {
    const [fechaInicio, setFechaInicio] = useState(() => {
        const d = mtyMonth(0); d.setDate(1); return d.toLocaleDateString('en-CA');
    });
    const [fechaFin, setFechaFin] = useState(mtyDate());

    // Drill-down state
    const [level, setLevel] = useState<Level>('stores');
    const [selectedStore, setSelectedStore] = useState<{ id: number | null; name: string } | null>(null);
    const [selectedType, setSelectedType] = useState<PaymentType | null>(null);
    const [selectedClient, setSelectedClient] = useState<{ rfc: string; name: string } | null>(null);

    // Data per level
    const [storesData, setStoresData] = useState<{ allStores: any; stores: StoreCard[] } | null>(null);
    const [paymentTypesData, setPaymentTypesData] = useState<PaymentTypeCard[]>([]);
    const [clientsData, setClientsData] = useState<ClientCard[]>([]);
    const [invoicesData, setInvoicesData] = useState<Invoice[]>([]);

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [deepSummaryOpen, setDeepSummaryOpen] = useState(false);

    // Fetch al cambiar level/selección/fechas
    useEffect(() => {
        const ctrl = new AbortController();
        const fetchLevel = async () => {
            setLoading(true);
            setError(null);
            setSearchTerm('');
            try {
                const params = new URLSearchParams({
                    level,
                    fechaInicio,
                    fechaFin
                });
                if (level === 'payment-types' && selectedStore && selectedStore.id !== null) {
                    params.set('idTienda', String(selectedStore.id));
                }
                if (level === 'clients') {
                    if (selectedStore && selectedStore.id !== null) params.set('idTienda', String(selectedStore.id));
                    if (selectedType) params.set('tipo', selectedType);
                }
                if (level === 'invoices') {
                    if (selectedStore && selectedStore.id !== null) params.set('idTienda', String(selectedStore.id));
                    if (selectedType) params.set('tipo', selectedType);
                    if (selectedClient) params.set('rfc', selectedClient.rfc);
                }

                const res = await fetch(`/api/dashboard/sales/clients-simple?${params}`, { signal: ctrl.signal });
                const json = await res.json();
                if (json.error) throw new Error(json.error);

                if (level === 'stores') setStoresData({ allStores: json.allStores, stores: json.stores });
                if (level === 'payment-types') setPaymentTypesData(json.paymentTypes);
                if (level === 'clients') setClientsData(json.clients);
                if (level === 'invoices') setInvoicesData(json.invoices);
            } catch (e: any) {
                if (e.name !== 'AbortError') setError(e.message);
            } finally {
                setLoading(false);
            }
        };
        fetchLevel();
        return () => ctrl.abort();
    }, [level, selectedStore, selectedType, selectedClient, fechaInicio, fechaFin]);

    // Navegación drill-down
    const goToStores = () => {
        setLevel('stores');
        setSelectedStore(null);
        setSelectedType(null);
        setSelectedClient(null);
    };

    const goToPaymentTypes = (store: { id: number | null; name: string }) => {
        setSelectedStore(store);
        setSelectedType(null);
        setSelectedClient(null);
        setLevel('payment-types');
    };

    const goToClients = (type: PaymentType) => {
        setSelectedType(type);
        setSelectedClient(null);
        setLevel('clients');
    };

    const goToInvoices = (client: { rfc: string; name: string }) => {
        setSelectedClient(client);
        setLevel('invoices');
    };

    const goBack = () => {
        if (level === 'invoices') {
            setSelectedClient(null);
            setLevel('clients');
        } else if (level === 'clients') {
            setSelectedType(null);
            setLevel('payment-types');
        } else if (level === 'payment-types') {
            setSelectedStore(null);
            setLevel('stores');
        }
    };

    // Quick periods
    const today = mtyDate();
    const periods = [
        { label: 'Hoy', start: today, end: today },
        { label: '7 días', start: mtyDate(-6), end: today },
        { label: 'Mes', start: (() => { const d = mtyMonth(0); d.setDate(1); return d.toLocaleDateString('en-CA'); })(), end: today },
        { label: 'Mes ant.', start: (() => { const d = mtyMonth(-1); d.setDate(1); return d.toLocaleDateString('en-CA'); })(), end: (() => { const d = mtyMonth(0); d.setDate(0); return d.toLocaleDateString('en-CA'); })() },
        { label: 'Año', start: `${new Date().getFullYear()}-01-01`, end: today }
    ];

    // Filtros de búsqueda
    const filteredClients = useMemo(() => {
        if (!searchTerm.trim()) return clientsData;
        const q = searchTerm.toLowerCase();
        return clientsData.filter(c =>
            c.ClienteConcepto.toLowerCase().includes(q) || c.RFC.toLowerCase().includes(q)
        );
    }, [clientsData, searchTerm]);

    const filteredInvoices = useMemo(() => {
        if (!searchTerm.trim()) return invoicesData;
        const q = searchTerm.toLowerCase();
        return invoicesData.filter(i =>
            (i.AlfaNumerico || '').toLowerCase().includes(q) ||
            (i.Serie || '').toLowerCase().includes(q) ||
            (i.MetodoPago || '').toLowerCase().includes(q)
        );
    }, [invoicesData, searchTerm]);

    // ¿Hay datos cargados para el nivel actual? (habilita el botón de Análisis IA)
    const hasData =
        (level === 'stores' && !!storesData) ||
        (level === 'payment-types' && paymentTypesData.length > 0) ||
        (level === 'clients' && clientsData.length > 0) ||
        (level === 'invoices' && invoicesData.length > 0);

    // Contexto para el Análisis Profundo IA: se adapta al nivel del drill-down activo
    const summaryContext: PageSummaryContext = useMemo(() => {
        const period = { fechaInicio, fechaFin };

        if (level === 'stores' && storesData) {
            const all = storesData.allStores || {};
            const total = all.VentaTotal || 0;
            const topStores = (storesData.stores || [])
                .slice()
                .sort((a, b) => (b.VentaTotal || 0) - (a.VentaTotal || 0))
                .slice(0, 10)
                .map(s => ({ name: s.Tienda, value: Math.round(s.VentaTotal || 0) }));

            const anomalies: string[] = [];
            if (total > 0) {
                if (all.Notas) anomalies.push(`Notas de crédito equivalen al ${((all.Notas / total) * 100).toFixed(1)}% de la venta (${fmtMoney(all.Notas)})`);
                if (all.Credito) anomalies.push(`Crédito representa el ${((all.Credito / total) * 100).toFixed(1)}% de la venta (${fmtMoney(all.Credito)})`);
            }

            return {
                pageContext: 'Ventas por Sucursal desglosadas por tipo de venta (contado, crédito, público general, notas de crédito)',
                period,
                scope: 'Todas las sucursales',
                kpis: {
                    'Venta Total': Math.round(total),
                    'Contado': Math.round(all.Contado || 0),
                    'Crédito': Math.round(all.Credito || 0),
                    'Público General': Math.round(all.Publico || 0),
                    'Notas de Crédito': Math.round(all.Notas || 0),
                    'Clientes únicos': all.ClientesUnicos || 0,
                    'Facturas': all.Facturas || 0,
                    'Sucursales': (storesData.stores || []).length
                },
                highlights: { topStores, anomalies }
            };
        }

        if (level === 'payment-types') {
            const total = paymentTypesData.reduce((a, p) => a + (p.monto || 0), 0);
            const kpis: Record<string, any> = { 'Venta Total': Math.round(total) };
            paymentTypesData.forEach(p => { kpis[p.label] = Math.round(p.monto || 0); });
            return {
                pageContext: `Tipos de venta de ${selectedStore?.name || 'sucursal'} (contado, crédito, público, notas)`,
                period,
                scope: selectedStore?.name || 'Sucursal',
                kpis,
                highlights: {
                    topItems: paymentTypesData
                        .slice()
                        .sort((a, b) => (b.monto || 0) - (a.monto || 0))
                        .map(p => ({ name: p.label, value: Math.round(p.monto || 0) }))
                }
            };
        }

        if (level === 'clients') {
            const total = clientsData.reduce((a, c) => a + (c.Monto || 0), 0);
            const topItems = clientsData
                .slice()
                .sort((a, b) => (b.Monto || 0) - (a.Monto || 0))
                .slice(0, 10)
                .map(c => ({ name: c.ClienteConcepto, value: Math.round(c.Monto || 0) }));
            return {
                pageContext: `Clientes en "${selectedType ? PAYMENT_LABELS[selectedType] : 'tipo de venta'}" · ${selectedStore?.name || 'todas las sucursales'}`,
                period,
                scope: selectedStore?.name || 'Todas las sucursales',
                kpis: {
                    'Monto Total': Math.round(total),
                    'Clientes': clientsData.length,
                    'Facturas': clientsData.reduce((a, c) => a + (c.Facturas || 0), 0)
                },
                highlights: { topItems }
            };
        }

        // invoices
        const totalInv = invoicesData.reduce((a, i) => a + (i.Total || 0), 0);
        return {
            pageContext: `Facturas del cliente "${selectedClient?.name || ''}"`,
            period,
            scope: selectedClient?.rfc || 'Cliente',
            kpis: {
                'Monto Total': Math.round(totalInv),
                'Facturas': invoicesData.length
            }
        };
    }, [level, storesData, paymentTypesData, clientsData, invoicesData, fechaInicio, fechaFin, selectedStore, selectedType, selectedClient]);

    return (
        <div className="p-6 pt-3 md:p-8 md:pt-4 max-w-[1600px] mx-auto min-h-screen">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-4 border border-slate-100 shadow-sm mb-4">
                <div>
                    <h1 className="text-xl font-black text-slate-900 tracking-tight flex items-center gap-2">
                        <Store className="text-[#4050B4]" size={24} />
                        Ventas Sucursales
                    </h1>
                    <p className="text-[11px] text-slate-500 font-bold mt-1">
                        Navegación drill-down: Sucursal → Tipo de venta → Cliente → Facturas
                    </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    <div className="flex bg-slate-100 border border-slate-200/60 p-0.5">
                        {periods.map(p => {
                            const active = fechaInicio === p.start && fechaFin === p.end;
                            return (
                                <button
                                    key={p.label}
                                    onClick={() => { setFechaInicio(p.start); setFechaFin(p.end); }}
                                    className={cn(
                                        'px-2 py-1 text-[9px] font-black uppercase tracking-widest transition-all whitespace-nowrap',
                                        active ? 'bg-[#4050B4] text-white shadow-sm' : 'text-slate-500 hover:text-slate-800 hover:bg-white'
                                    )}
                                >
                                    {p.label}
                                </button>
                            );
                        })}
                    </div>
                    <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 px-3 py-1.5">
                        <Calendar size={14} className="text-[#4050B4]" />
                        <input type="date" value={fechaInicio} onChange={e => setFechaInicio(e.target.value)}
                            className="bg-transparent text-xs font-bold text-slate-700 outline-none border-none p-0" />
                    </div>
                    <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 px-3 py-1.5">
                        <Calendar size={14} className="text-[#4050B4]" />
                        <input type="date" value={fechaFin} onChange={e => setFechaFin(e.target.value)}
                            className="bg-transparent text-xs font-bold text-slate-700 outline-none border-none p-0" />
                    </div>

                    <button
                        onClick={() => setDeepSummaryOpen(true)}
                        disabled={loading || !hasData}
                        className="inline-flex items-center gap-1.5 px-3 py-2 bg-[#4050B4] border border-[#4050B4] text-white hover:bg-[#344196] text-[10px] font-black uppercase tracking-widest transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                        title="Análisis profundo con IA de la vista actual (hallazgos, oportunidades, riesgos, acciones)"
                    >
                        <Sparkles size={13} />
                        <span className="hidden sm:inline">Análisis Profundo IA</span>
                    </button>
                </div>
            </div>

            {/* Breadcrumb */}
            <div className="flex items-center gap-2 bg-white border border-slate-100 px-4 py-2.5 shadow-sm mb-6 overflow-x-auto">
                {level !== 'stores' && (
                    <button
                        onClick={goBack}
                        className="flex items-center gap-1 px-2 py-1 text-[10px] font-black uppercase tracking-widest text-[#4050B4] hover:bg-[#4050B4]/5 transition-colors"
                        title="Volver"
                    >
                        <ArrowLeft size={12} /> Atrás
                    </button>
                )}
                <button onClick={goToStores} className="flex items-center gap-1 text-[11px] font-black text-slate-500 hover:text-[#4050B4] transition-colors">
                    <Home size={12} /> Sucursales
                </button>
                {selectedStore && (
                    <>
                        <ChevronRight size={12} className="text-slate-300" />
                        <button
                            onClick={() => goToPaymentTypes(selectedStore)}
                            className={cn(
                                "flex items-center gap-1 text-[11px] font-black hover:text-[#4050B4] transition-colors",
                                level === 'payment-types' ? "text-slate-900" : "text-slate-500"
                            )}
                        >
                            <Building size={12} /> {selectedStore.name}
                        </button>
                    </>
                )}
                {selectedType && (
                    <>
                        <ChevronRight size={12} className="text-slate-300" />
                        <button
                            onClick={() => goToClients(selectedType)}
                            className={cn(
                                "flex items-center gap-1 text-[11px] font-black hover:text-[#4050B4] transition-colors",
                                level === 'clients' ? "text-slate-900" : "text-slate-500"
                            )}
                        >
                            {PAYMENT_COLORS[selectedType].icon}{PAYMENT_LABELS[selectedType]}
                        </button>
                    </>
                )}
                {selectedClient && (
                    <>
                        <ChevronRight size={12} className="text-slate-300" />
                        <span className="flex items-center gap-1 text-[11px] font-black text-slate-900">
                            <UserCircle size={12} /> {selectedClient.name.slice(0, 40)}
                        </span>
                    </>
                )}
            </div>

            {error && (
                <div className="p-4 bg-rose-50 border border-rose-200 text-rose-700 text-sm font-bold mb-6">
                    Error: {error}
                </div>
            )}

            {loading && (
                <div className="flex flex-col items-center justify-center py-16 text-slate-400">
                    <Loader2 className="w-8 h-8 animate-spin text-[#4050B4] mb-3" />
                    <span className="text-xs font-black uppercase tracking-wider">Cargando...</span>
                </div>
            )}

            {/* NIVEL 1: STORES */}
            {!loading && level === 'stores' && storesData && (
                <div>
                    {/* Card "Todas las sucursales" destacada */}
                    <button
                        onClick={() => goToPaymentTypes({ id: null, name: 'Todas las sucursales' })}
                        className="w-full bg-gradient-to-br from-[#4050B4] to-[#5563d8] text-white p-6 mb-4 shadow-md hover:shadow-xl transition-all text-left group"
                    >
                        <div className="flex items-start justify-between">
                            <div>
                                <div className="flex items-center gap-2 mb-2">
                                    <Building size={28} />
                                    <h2 className="text-lg font-black uppercase tracking-tight">Todas las sucursales</h2>
                                </div>
                                <p className="text-3xl font-black tabular-nums mb-1">{fmtMoney(storesData.allStores.VentaTotal)}</p>
                                <p className="text-[11px] font-bold opacity-80 uppercase tracking-widest">
                                    {fmtNumber(storesData.allStores.ClientesUnicos)} clientes · {fmtNumber(storesData.allStores.Facturas)} facturas
                                </p>
                            </div>
                            <ChevronRight size={28} className="opacity-50 group-hover:opacity-100 group-hover:translate-x-1 transition-all" />
                        </div>
                        <div className="grid grid-cols-4 gap-3 mt-4 pt-4 border-t border-white/20">
                            <div>
                                <p className="text-[9px] font-black uppercase opacity-70 tracking-widest">Contado</p>
                                <p className="text-base font-black tabular-nums">{fmtMoney(storesData.allStores.Contado)}</p>
                            </div>
                            <div>
                                <p className="text-[9px] font-black uppercase opacity-70 tracking-widest">Crédito</p>
                                <p className="text-base font-black tabular-nums">{fmtMoney(storesData.allStores.Credito)}</p>
                            </div>
                            <div>
                                <p className="text-[9px] font-black uppercase opacity-70 tracking-widest">Público</p>
                                <p className="text-base font-black tabular-nums">{fmtMoney(storesData.allStores.Publico)}</p>
                            </div>
                            <div>
                                <p className="text-[9px] font-black uppercase opacity-70 tracking-widest">Notas</p>
                                <p className="text-base font-black tabular-nums">{fmtMoney(storesData.allStores.Notas)}</p>
                            </div>
                        </div>
                    </button>

                    {/* Cards de sucursales */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        {storesData.stores.map(s => (
                            <button
                                key={s.IdTienda}
                                onClick={() => goToPaymentTypes({ id: s.IdTienda as number, name: s.Tienda })}
                                className="bg-white border border-slate-200 hover:border-[#4050B4] hover:shadow-lg p-5 text-left transition-all group"
                            >
                                <div className="flex items-start justify-between mb-3">
                                    <div className="flex items-center gap-2">
                                        <div className="p-2 bg-[#4050B4]/10 text-[#4050B4]">
                                            <Store size={20} />
                                        </div>
                                        <h3 className="text-sm font-black text-slate-900">{s.Tienda}</h3>
                                    </div>
                                    <ChevronRight size={18} className="text-slate-300 group-hover:text-[#4050B4] group-hover:translate-x-1 transition-all" />
                                </div>
                                <p className="text-2xl font-black text-slate-900 tabular-nums mb-1">{fmtMoney(s.VentaTotal)}</p>
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3">
                                    {fmtNumber(s.ClientesUnicos)} clientes · {fmtNumber(s.Facturas)} facturas
                                </p>
                                <div className="grid grid-cols-4 gap-2 pt-3 border-t border-slate-100">
                                    <MiniStat label="Contado" value={s.Contado} color="text-emerald-700" />
                                    <MiniStat label="Crédito" value={s.Credito} color="text-blue-700" />
                                    <MiniStat label="Público" value={s.Publico} color="text-amber-700" />
                                    <MiniStat label="Notas" value={s.Notas} color="text-rose-700" />
                                </div>
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {/* NIVEL 2: PAYMENT TYPES */}
            {!loading && level === 'payment-types' && paymentTypesData.length > 0 && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {paymentTypesData.map(p => {
                        const c = PAYMENT_COLORS[p.key];
                        const isEmpty = p.facturas === 0;
                        return (
                            <button
                                key={p.key}
                                onClick={() => !isEmpty && goToClients(p.key)}
                                disabled={isEmpty}
                                className={cn(
                                    "border-2 p-6 text-left transition-all group",
                                    c.bg, c.border,
                                    isEmpty ? "opacity-40 cursor-not-allowed" : "hover:shadow-xl hover:scale-[1.02] cursor-pointer"
                                )}
                            >
                                <div className="flex items-start justify-between mb-4">
                                    <div className={cn("p-3", c.text)}>
                                        {c.icon}
                                    </div>
                                    {!isEmpty && (
                                        <ChevronRight size={24} className={cn(c.text, "opacity-50 group-hover:opacity-100 group-hover:translate-x-1 transition-all")} />
                                    )}
                                </div>
                                <h3 className={cn("text-base font-black uppercase tracking-tight mb-1", c.text)}>{p.label}</h3>
                                <p className={cn("text-3xl font-black tabular-nums mb-2", c.text)}>{fmtMoney(p.monto)}</p>
                                <div className="flex gap-4 text-[11px] font-bold uppercase tracking-widest text-slate-600">
                                    <span>{fmtNumber(p.clientes)} {p.key === 'publico' ? 'cliente' : 'clientes'}</span>
                                    <span>·</span>
                                    <span>{fmtNumber(p.facturas)} facturas</span>
                                </div>
                                {isEmpty && (
                                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mt-3">Sin operaciones en el periodo</p>
                                )}
                            </button>
                        );
                    })}
                </div>
            )}

            {/* NIVEL 3: CLIENTS */}
            {!loading && level === 'clients' && (
                <div>
                    <div className="flex items-center justify-between mb-4">
                        <div className="text-xs font-black uppercase tracking-widest text-slate-500">
                            {filteredClients.length} clientes · {selectedType && PAYMENT_LABELS[selectedType]}
                        </div>
                        <div className="relative w-72">
                            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                            <input
                                type="text"
                                placeholder="Buscar por nombre o RFC..."
                                value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                                className="w-full bg-white border border-slate-200 py-2 pl-9 pr-3 text-xs font-bold text-slate-700 focus:outline-none focus:border-[#4050B4]"
                            />
                        </div>
                    </div>
                    {filteredClients.length === 0 && (
                        <div className="bg-white border border-slate-200 p-12 text-center text-slate-400 text-xs font-black uppercase tracking-widest">
                            Sin clientes en este periodo
                        </div>
                    )}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                        {filteredClients.map((c, idx) => (
                            <button
                                key={c.RFC + idx}
                                onClick={() => goToInvoices({ rfc: c.RFC, name: c.ClienteConcepto })}
                                className="bg-white border border-slate-200 hover:border-[#4050B4] hover:shadow-md p-4 text-left transition-all group"
                            >
                                <div className="flex items-start justify-between mb-2">
                                    <div className="flex items-center gap-2 min-w-0 flex-1">
                                        <div className="p-1.5 bg-slate-100 text-slate-500 shrink-0">
                                            <UserCircle size={16} />
                                        </div>
                                        <div className="min-w-0">
                                            <h4 className="text-xs font-black text-slate-900 truncate">{c.ClienteConcepto}</h4>
                                            <p className="text-[10px] font-bold text-slate-400 truncate">{c.RFC}</p>
                                        </div>
                                    </div>
                                    <ChevronRight size={14} className="text-slate-300 group-hover:text-[#4050B4] shrink-0 ml-1" />
                                </div>
                                <p className="text-lg font-black text-slate-900 tabular-nums mt-2">{fmtMoney(c.Monto)}</p>
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                                    {fmtNumber(c.Facturas)} {c.Facturas === 1 ? 'factura' : 'facturas'}
                                </p>
                                {c.PrimeraFactura && c.UltimaFactura && (
                                    <p className="text-[9px] font-bold text-slate-400 mt-1">
                                        {fmtDate(c.PrimeraFactura)} → {fmtDate(c.UltimaFactura)}
                                    </p>
                                )}
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {/* NIVEL 4: INVOICES */}
            {!loading && level === 'invoices' && (
                <div>
                    {/* Resumen del cliente seleccionado */}
                    <div className="bg-white border border-slate-200 p-5 mb-4">
                        <div className="flex items-center justify-between flex-wrap gap-3">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-[#4050B4]/10 text-[#4050B4]">
                                    <UserCircle size={24} />
                                </div>
                                <div>
                                    <h3 className="text-sm font-black text-slate-900">{selectedClient?.name}</h3>
                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{selectedClient?.rfc}</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-6">
                                <div className="text-right">
                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Total facturas</p>
                                    <p className="text-lg font-black text-slate-900 tabular-nums">{invoicesData.length}</p>
                                </div>
                                <div className="text-right">
                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Monto total</p>
                                    <p className="text-lg font-black text-slate-900 tabular-nums">{fmtMoney(invoicesData.reduce((s, i) => s + i.Total, 0))}</p>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Buscador */}
                    <div className="flex items-center justify-between mb-3">
                        <div className="text-xs font-black uppercase tracking-widest text-slate-500">
                            {filteredInvoices.length} facturas
                        </div>
                        <div className="relative w-72">
                            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                            <input
                                type="text"
                                placeholder="Buscar por folio, serie, método..."
                                value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                                className="w-full bg-white border border-slate-200 py-2 pl-9 pr-3 text-xs font-bold text-slate-700 focus:outline-none focus:border-[#4050B4]"
                            />
                        </div>
                    </div>

                    {/* Tabla de facturas */}
                    <div className="bg-white border border-slate-200 overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="w-full text-xs">
                                <thead className="bg-slate-50 border-b border-slate-200">
                                    <tr>
                                        <th className="px-4 py-3 text-left font-black text-[10px] uppercase tracking-widest text-slate-500">Folio</th>
                                        <th className="px-4 py-3 text-left font-black text-[10px] uppercase tracking-widest text-slate-500">Fecha</th>
                                        <th className="px-4 py-3 text-left font-black text-[10px] uppercase tracking-widest text-slate-500">Sucursal</th>
                                        <th className="px-4 py-3 text-left font-black text-[10px] uppercase tracking-widest text-slate-500">Método</th>
                                        <th className="px-4 py-3 text-left font-black text-[10px] uppercase tracking-widest text-slate-500">Forma</th>
                                        <th className="px-4 py-3 text-right font-black text-[10px] uppercase tracking-widest text-slate-500">Total</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredInvoices.map(inv => (
                                        <tr key={inv.IdFactura} className="border-b border-slate-100 hover:bg-slate-50/70">
                                            <td className="px-4 py-3 font-black text-slate-900">
                                                {inv.Serie}-{inv.AlfaNumerico}
                                            </td>
                                            <td className="px-4 py-3 font-bold text-slate-600">{fmtDate(inv.FechaFactura)}</td>
                                            <td className="px-4 py-3 font-bold text-slate-600">{inv.Tienda}</td>
                                            <td className="px-4 py-3 font-bold text-slate-500">{inv.MetodoPago || '-'}</td>
                                            <td className="px-4 py-3 font-bold text-slate-500">{inv.FormaPago || '-'}</td>
                                            <td className="px-4 py-3 text-right tabular-nums font-black text-slate-900">{fmtMoney(inv.Total)}</td>
                                        </tr>
                                    ))}
                                    {filteredInvoices.length === 0 && (
                                        <tr>
                                            <td colSpan={6} className="text-center py-12 text-slate-400 font-black uppercase tracking-widest text-xs">
                                                Sin facturas en este periodo
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}

            <DeepSummaryModal
                open={deepSummaryOpen}
                onClose={() => setDeepSummaryOpen(false)}
                context={summaryContext}
            />
        </div>
    );
}

function MiniStat({ label, value, color }: { label: string; value: number; color: string }) {
    return (
        <div>
            <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-0.5">{label}</p>
            <p className={cn("text-xs font-black tabular-nums truncate", color)}>{fmtMoney(value)}</p>
        </div>
    );
}
