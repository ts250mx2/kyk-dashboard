"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import {
    Warehouse, RefreshCcw, Loader2, X, Search, TruckIcon, PackageCheck, PackageX,
    ArrowDownToLine, ArrowUpFromLine, Undo2, Clock, Boxes, AlertTriangle,
} from "lucide-react";
import {
    ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Legend,
} from "recharts";
import { cn } from "@/lib/utils";
import { LoadingScreen } from "@/components/ui/loading-screen";

// ---------- Tipos ----------
interface Kpis {
    recibos: { count: number; total: number };
    salidas: { count: number; total: number; tiendas: number };
    entradas: { count: number; total: number };
    enTransito: { count: number; total: number };
    diasPromedioRecepcion: number | null;
    inventario: { skus: number; unidades: number; valor: number };
}

interface Summary {
    kpis: Kpis;
    serie: { fecha: string; recibido: number; enviado: number }[];
    porTienda: { idTienda: number; tienda: string; envios: number; valor: number; enTransito: number; valorTransito: number }[];
    topProductos: { codigoInterno: string; codigoBarras: string | null; descripcion: string; unidades: number; valor: number }[];
    transitoAntiguo: { folio: string; tienda: string; fechaSalida: string; dias: number; valor: number; esFactura: boolean }[];
    stockSinMovimiento: { codigoInterno: string; descripcion: string; existencia: number; costo: number; valor: number }[];
    fillRateProveedores: { proveedor: string; ordenes: number; ordenesRecibidas: number; pedido: number; recibido: number; fillRate: number | null }[];
}

interface ReplenishmentSuggestion {
    codigoInterno: string;
    descripcion: string;
    idTienda: number;
    tienda: string;
    ventaDiaria: number;
    venta30: number;
    exiTienda: number;
    coberturaDias: number;
    exiCedis: number;
    sugerido: number;
    valorSugerido: number;
}

interface Movement {
    tipo: "RECIBO" | "SALIDA" | "ENTRADA";
    id: number;
    folio: string;
    fecha: string;
    contraparte: string;
    usuario: string | null;
    renglones: number;
    total: number;
    estado: string;
    esFactura: boolean;
    idOrdenCompra: number | null;
}

interface DetailItem {
    codigoBarras: string | null;
    descripcion: string;
    cantidad: number;
    piezasPedido: number | null;
    piezasRecibo: number | null;
    costo: number;
    total: number;
}

type TipoFiltro = "TODOS" | "RECIBO" | "SALIDA" | "ENTRADA";

// ---------- Helpers ----------
const money = (v: number) =>
    v.toLocaleString("es-MX", { style: "currency", currency: "MXN", maximumFractionDigits: 0 });
const intFmt = (v: number) => v.toLocaleString("es-MX", { maximumFractionDigits: 0 });

function firstDayOfMonth(): string {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}
function today(): string {
    return new Date().toLocaleDateString("sv-SE");
}

const TIPO_STYLE: Record<Movement["tipo"], { label: string; cls: string; icon: typeof ArrowDownToLine }> = {
    RECIBO: { label: "Recibo OC", cls: "bg-emerald-100 text-emerald-700", icon: ArrowDownToLine },
    SALIDA: { label: "Salida", cls: "bg-[#4050B4]/10 text-[#4050B4]", icon: ArrowUpFromLine },
    ENTRADA: { label: "Devolución", cls: "bg-amber-100 text-amber-700", icon: Undo2 },
};

function estadoCls(estado: string): string {
    if (estado === "En tránsito") return "bg-amber-100 text-amber-700";
    if (estado.startsWith("Cancelad")) return "bg-red-100 text-red-600";
    return "bg-emerald-100 text-emerald-700";
}

// ---------- Página ----------
export default function CedisAuditPage() {
    const [startDate, setStartDate] = useState(firstDayOfMonth());
    const [endDate, setEndDate] = useState(today());
    const [summary, setSummary] = useState<Summary | null>(null);
    const [movements, setMovements] = useState<Movement[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const [tipoFiltro, setTipoFiltro] = useState<TipoFiltro>("TODOS");
    const [search, setSearch] = useState("");

    // Modal de detalle de movimiento.
    const [detailMov, setDetailMov] = useState<Movement | null>(null);
    const [detailItems, setDetailItems] = useState<DetailItem[] | null>(null);
    const [detailError, setDetailError] = useState<string | null>(null);

    // Sugerencia de reparto (bajo demanda: cruza ventas de 30 días de todas las tiendas).
    const [replenishment, setReplenishment] = useState<ReplenishmentSuggestion[] | null>(null);
    const [replenishing, setReplenishing] = useState(false);
    const [replenishError, setReplenishError] = useState<string | null>(null);
    const [covThreshold, setCovThreshold] = useState(7);
    const [covTarget, setCovTarget] = useState(14);

    const fetchData = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const qs = `startDate=${startDate}&endDate=${endDate}`;
            const [sumRes, movRes] = await Promise.all([
                fetch(`/api/inventory/cedis/summary?${qs}`),
                fetch(`/api/inventory/cedis/movements?${qs}&tipo=TODOS`),
            ]);
            const sumJson = await sumRes.json();
            const movJson = await movRes.json();
            if (!sumRes.ok) throw new Error(sumJson.error || "Error al consultar el resumen");
            if (!movRes.ok) throw new Error(movJson.error || "Error al consultar los movimientos");
            setSummary(sumJson);
            setMovements(Array.isArray(movJson.movements) ? movJson.movements : []);
        } catch (e: any) {
            setError(e.message);
            setSummary(null);
            setMovements([]);
        } finally {
            setLoading(false);
        }
    }, [startDate, endDate]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const openDetail = async (mov: Movement) => {
        setDetailMov(mov);
        setDetailItems(null);
        setDetailError(null);
        try {
            const res = await fetch(`/api/inventory/cedis/movement-detail?tipo=${mov.tipo}&id=${mov.id}`);
            const json = await res.json();
            if (!res.ok) throw new Error(json.error || "Error al consultar el detalle");
            setDetailItems(json.items || []);
        } catch (e: any) {
            setDetailError(e.message);
        }
    };

    const runReplenishment = async () => {
        setReplenishing(true);
        setReplenishError(null);
        try {
            const res = await fetch(
                `/api/inventory/cedis/replenishment?coverageThreshold=${covThreshold}&coverageTarget=${covTarget}`
            );
            const json = await res.json();
            if (!res.ok) throw new Error(json.error || "Error al calcular la sugerencia");
            setReplenishment(json.suggestions || []);
        } catch (e: any) {
            setReplenishError(e.message);
            setReplenishment(null);
        } finally {
            setReplenishing(false);
        }
    };

    const filtered = useMemo(() => {
        const q = search.trim().toLowerCase();
        return movements.filter((m) => {
            if (tipoFiltro !== "TODOS" && m.tipo !== tipoFiltro) return false;
            if (!q) return true;
            return (
                m.folio.toLowerCase().includes(q) ||
                m.contraparte.toLowerCase().includes(q) ||
                (m.usuario ?? "").toLowerCase().includes(q) ||
                String(m.idOrdenCompra ?? "").includes(q)
            );
        });
    }, [movements, tipoFiltro, search]);

    const kpis = summary?.kpis;

    if (loading && !summary) return <LoadingScreen />;

    return (
        <div className="space-y-6 pb-20">
            {/* Header */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-none bg-[#4050B4] text-white flex items-center justify-center shadow-lg">
                        <Warehouse size={22} />
                    </div>
                    <div>
                        <h1 className="text-2xl md:text-3xl font-black text-slate-900 dark:text-white uppercase tracking-tighter">
                            Auditoría CEDIS
                        </h1>
                        <p className="text-slate-500 text-sm font-medium">
                            Movimientos del almacén central: recibos de proveedor, distribuciones a tiendas y devoluciones.
                        </p>
                    </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    <input
                        type="date"
                        value={startDate}
                        onChange={(e) => setStartDate(e.target.value)}
                        className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 py-2.5 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#4050B4]/30"
                    />
                    <span className="text-slate-400 text-sm">a</span>
                    <input
                        type="date"
                        value={endDate}
                        onChange={(e) => setEndDate(e.target.value)}
                        className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 py-2.5 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#4050B4]/30"
                    />
                    <button
                        onClick={fetchData}
                        disabled={loading}
                        className="flex items-center gap-2 px-4 py-2.5 bg-[#4050B4] text-white font-black text-xs uppercase tracking-widest hover:bg-[#344199] transition-all disabled:opacity-50"
                    >
                        {loading ? <Loader2 size={15} className="animate-spin" /> : <RefreshCcw size={15} />}
                        Actualizar
                    </button>
                </div>
            </div>

            {error && (
                <div className="px-4 py-3 bg-red-50 border border-red-200 text-red-700 text-sm">{error}</div>
            )}

            {/* KPIs */}
            {kpis && (
                <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
                    <KpiCard
                        icon={ArrowDownToLine} tone="text-emerald-600 bg-emerald-50 dark:bg-emerald-900/20"
                        label="Recibido de proveedores" value={money(kpis.recibos.total)}
                        sub={`${intFmt(kpis.recibos.count)} recibos`}
                    />
                    <KpiCard
                        icon={ArrowUpFromLine} tone="text-[#4050B4] bg-[#4050B4]/10"
                        label="Enviado a tiendas" value={money(kpis.salidas.total)}
                        sub={`${intFmt(kpis.salidas.count)} salidas · ${kpis.salidas.tiendas} tiendas`}
                    />
                    <KpiCard
                        icon={TruckIcon} tone="text-amber-600 bg-amber-50 dark:bg-amber-900/20"
                        label="En tránsito" value={money(kpis.enTransito.total)}
                        sub={`${intFmt(kpis.enTransito.count)} salidas sin recibir`}
                    />
                    <KpiCard
                        icon={Undo2} tone="text-orange-600 bg-orange-50 dark:bg-orange-900/20"
                        label="Devoluciones recibidas" value={money(kpis.entradas.total)}
                        sub={`${intFmt(kpis.entradas.count)} entradas`}
                    />
                    <KpiCard
                        icon={Clock} tone="text-sky-600 bg-sky-50 dark:bg-sky-900/20"
                        label="Días prom. de recepción"
                        value={kpis.diasPromedioRecepcion != null ? kpis.diasPromedioRecepcion.toFixed(1) : "—"}
                        sub="salida → entrada en tienda"
                    />
                    <KpiCard
                        icon={Boxes} tone="text-slate-600 bg-slate-100 dark:bg-slate-900/40"
                        label="Inventario actual CEDIS" value={money(kpis.inventario.valor)}
                        sub={`${intFmt(kpis.inventario.skus)} SKUs · ${intFmt(kpis.inventario.unidades)} unidades`}
                    />
                </div>
            )}

            {/* Flujo diario */}
            {summary && summary.serie.length > 0 && (
                <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-5">
                    <p className="text-xs font-black uppercase tracking-widest text-slate-500 mb-4">
                        Flujo diario ($): recibido vs enviado
                    </p>
                    <div className="h-64">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={summary.serie} margin={{ top: 4, right: 8, left: 8, bottom: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                                <XAxis dataKey="fecha" tick={{ fontSize: 11 }} tickFormatter={(v: string) => v.slice(5)} />
                                <YAxis tick={{ fontSize: 11 }} tickFormatter={(v: number) => `$${(v / 1000).toFixed(0)}k`} width={56} />
                                <Tooltip formatter={(v: number | string) => money(Number(v))} labelStyle={{ fontWeight: 700 }} />
                                <Legend />
                                <Bar dataKey="recibido" name="Recibido de proveedores" fill="#10b981" />
                                <Bar dataKey="enviado" name="Enviado a tiendas" fill="#4050B4" />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            )}

            {/* Por tienda + Top productos */}
            {summary && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                        <p className="text-xs font-black uppercase tracking-widest text-slate-500 px-5 pt-5 pb-3">
                            Distribución por tienda destino
                        </p>
                        <div className="overflow-x-auto max-h-80 overflow-y-auto">
                            <table className="w-full text-sm">
                                <thead className="sticky top-0 bg-slate-50 dark:bg-slate-900/80">
                                    <tr className="text-left text-[10px] font-black uppercase tracking-widest text-slate-500 border-b border-slate-200 dark:border-slate-700">
                                        <th className="px-5 py-2">Tienda</th>
                                        <th className="px-3 py-2 text-right">Envíos</th>
                                        <th className="px-3 py-2 text-right">Valor</th>
                                        <th className="px-5 py-2 text-right">En tránsito</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                                    {summary.porTienda.map((t) => (
                                        <tr key={t.idTienda} className="hover:bg-slate-50 dark:hover:bg-slate-900/30">
                                            <td className="px-5 py-2 font-semibold text-slate-700 dark:text-slate-200">{t.tienda}</td>
                                            <td className="px-3 py-2 text-right text-slate-500">{intFmt(t.envios)}</td>
                                            <td className="px-3 py-2 text-right font-bold text-slate-700 dark:text-slate-200">{money(t.valor)}</td>
                                            <td className="px-5 py-2 text-right">
                                                {t.enTransito > 0 ? (
                                                    <span className="text-amber-600 font-bold">{t.enTransito} · {money(t.valorTransito)}</span>
                                                ) : (
                                                    <span className="text-slate-300">—</span>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                        <p className="text-xs font-black uppercase tracking-widest text-slate-500 px-5 pt-5 pb-3">
                            Top productos enviados
                        </p>
                        <div className="overflow-x-auto max-h-80 overflow-y-auto">
                            <table className="w-full text-sm">
                                <thead className="sticky top-0 bg-slate-50 dark:bg-slate-900/80">
                                    <tr className="text-left text-[10px] font-black uppercase tracking-widest text-slate-500 border-b border-slate-200 dark:border-slate-700">
                                        <th className="px-5 py-2">Producto</th>
                                        <th className="px-3 py-2 text-right">Unidades</th>
                                        <th className="px-5 py-2 text-right">Valor</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                                    {summary.topProductos.map((p) => (
                                        <tr key={p.codigoInterno} className="hover:bg-slate-50 dark:hover:bg-slate-900/30">
                                            <td className="px-5 py-2">
                                                <p className="font-semibold text-slate-700 dark:text-slate-200 truncate max-w-[260px]" title={p.descripcion}>
                                                    {p.descripcion}
                                                </p>
                                                {p.codigoBarras && <p className="text-[10px] font-mono text-slate-400">{p.codigoBarras}</p>}
                                            </td>
                                            <td className="px-3 py-2 text-right text-slate-500">{intFmt(p.unidades)}</td>
                                            <td className="px-5 py-2 text-right font-bold text-slate-700 dark:text-slate-200">{money(p.valor)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}

            {/* Alertas: tránsito antiguo + stock sin movimiento */}
            {summary && (summary.transitoAntiguo.length > 0 || summary.stockSinMovimiento.length > 0) && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <div className="bg-white dark:bg-slate-800 border-2 border-amber-300 dark:border-amber-700">
                        <p className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-amber-700 px-5 pt-5 pb-3">
                            <AlertTriangle size={14} /> Salidas en tránsito con más de 3 días
                        </p>
                        {summary.transitoAntiguo.length === 0 ? (
                            <p className="px-5 pb-5 text-sm text-slate-400">Sin salidas atoradas. 👌</p>
                        ) : (
                            <div className="overflow-x-auto max-h-64 overflow-y-auto">
                                <table className="w-full text-sm">
                                    <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                                        {summary.transitoAntiguo.map((t) => (
                                            <tr key={t.folio} className="hover:bg-amber-50/50">
                                                <td className="px-5 py-2 font-mono text-xs text-slate-500">{t.folio}</td>
                                                <td className="px-3 py-2 font-semibold text-slate-700 dark:text-slate-200">{t.tienda}</td>
                                                <td className="px-3 py-2 text-right text-slate-500">{money(t.valor)}</td>
                                                <td className="px-5 py-2 text-right">
                                                    <span className="font-black text-amber-700">{t.dias} días</span>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>

                    <div className="bg-white dark:bg-slate-800 border-2 border-red-200 dark:border-red-900">
                        <p className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-red-600 px-5 pt-5 pb-3">
                            <PackageX size={14} /> Stock valioso sin salidas en el período
                        </p>
                        {summary.stockSinMovimiento.length === 0 ? (
                            <p className="px-5 pb-5 text-sm text-slate-400">Todo el inventario relevante tuvo movimiento. 👌</p>
                        ) : (
                            <div className="overflow-x-auto max-h-64 overflow-y-auto">
                                <table className="w-full text-sm">
                                    <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                                        {summary.stockSinMovimiento.map((s) => (
                                            <tr key={s.codigoInterno} className="hover:bg-red-50/40">
                                                <td className="px-5 py-2">
                                                    <p className="font-semibold text-slate-700 dark:text-slate-200 truncate max-w-[240px]" title={s.descripcion}>
                                                        {s.descripcion}
                                                    </p>
                                                </td>
                                                <td className="px-3 py-2 text-right text-slate-500">{intFmt(s.existencia)} u.</td>
                                                <td className="px-5 py-2 text-right font-bold text-red-600">{money(s.valor)}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Fill rate por proveedor */}
            {summary && summary.fillRateProveedores.length > 0 && (
                <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                    <p className="text-xs font-black uppercase tracking-widest text-slate-500 px-5 pt-5 pb-3">
                        Cumplimiento de proveedores (fill rate: recibido vs ordenado)
                    </p>
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="bg-slate-50 dark:bg-slate-900/50 text-left text-[10px] font-black uppercase tracking-widest text-slate-500 border-b border-slate-200 dark:border-slate-700">
                                    <th className="px-5 py-2.5">Proveedor</th>
                                    <th className="px-3 py-2.5 text-right">OCs</th>
                                    <th className="px-3 py-2.5 text-right">Recibidas</th>
                                    <th className="px-3 py-2.5 text-right">Ordenado</th>
                                    <th className="px-3 py-2.5 text-right">Recibido</th>
                                    <th className="px-5 py-2.5 text-right">Fill rate</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                                {summary.fillRateProveedores.map((f) => (
                                    <tr key={f.proveedor} className="hover:bg-slate-50 dark:hover:bg-slate-900/30">
                                        <td className="px-5 py-2 font-semibold text-slate-700 dark:text-slate-200 truncate max-w-[320px]" title={f.proveedor}>
                                            {f.proveedor}
                                        </td>
                                        <td className="px-3 py-2 text-right text-slate-500">{intFmt(f.ordenes)}</td>
                                        <td className="px-3 py-2 text-right text-slate-500">{intFmt(f.ordenesRecibidas)}</td>
                                        <td className="px-3 py-2 text-right text-slate-500">{money(f.pedido)}</td>
                                        <td className="px-3 py-2 text-right font-bold text-slate-700 dark:text-slate-200">{money(f.recibido)}</td>
                                        <td className="px-5 py-2 text-right">
                                            {f.fillRate == null ? (
                                                <span className="text-slate-300">—</span>
                                            ) : (
                                                <span
                                                    className={cn(
                                                        "inline-flex px-2 py-1 text-[11px] font-black",
                                                        f.fillRate < 85
                                                            ? "bg-red-100 text-red-600"
                                                            : f.fillRate < 95
                                                                ? "bg-amber-100 text-amber-700"
                                                                : "bg-emerald-100 text-emerald-700"
                                                    )}
                                                >
                                                    {f.fillRate.toFixed(0)}%
                                                </span>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* Sugerencia de reparto */}
            <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 px-5 pt-5 pb-3">
                    <div>
                        <p className="text-xs font-black uppercase tracking-widest text-slate-500">
                            Sugerencia de reparto CEDIS → tiendas
                        </p>
                        <p className="text-[11px] text-slate-400 mt-1">
                            Productos con existencia en el CEDIS cuyas tiendas traen pocos días de cobertura (según su venta de 30 días).
                        </p>
                    </div>
                    <div className="flex items-center gap-2">
                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                            Alerta &lt;
                            <input
                                type="number" min={1} max={30} value={covThreshold}
                                onChange={(e) => setCovThreshold(Number(e.target.value) || 7)}
                                className="w-14 ml-1 border border-slate-200 dark:border-slate-700 dark:bg-slate-900 py-1 px-2 text-xs"
                            /> días
                        </label>
                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                            Objetivo
                            <input
                                type="number" min={2} max={60} value={covTarget}
                                onChange={(e) => setCovTarget(Number(e.target.value) || 14)}
                                className="w-14 ml-1 border border-slate-200 dark:border-slate-700 dark:bg-slate-900 py-1 px-2 text-xs"
                            /> días
                        </label>
                        <button
                            onClick={runReplenishment}
                            disabled={replenishing}
                            className="flex items-center gap-2 px-4 py-2 bg-[#4050B4] text-white font-black text-xs uppercase tracking-widest hover:bg-[#344199] transition-all disabled:opacity-50"
                        >
                            {replenishing ? <Loader2 size={14} className="animate-spin" /> : <TruckIcon size={14} />}
                            {replenishing ? "Calculando..." : "Calcular"}
                        </button>
                    </div>
                </div>
                {replenishError && (
                    <div className="mx-5 mb-4 px-4 py-2.5 bg-red-50 border border-red-200 text-red-700 text-sm">{replenishError}</div>
                )}
                {replenishment !== null && (
                    replenishment.length === 0 ? (
                        <p className="px-5 pb-5 text-sm text-slate-400">
                            Ninguna tienda está por debajo de {covThreshold} días de cobertura en productos que el CEDIS tenga en existencia. 👌
                        </p>
                    ) : (
                        <div className="overflow-x-auto max-h-96 overflow-y-auto">
                            <table className="w-full text-sm">
                                <thead className="sticky top-0 bg-slate-50 dark:bg-slate-900/80">
                                    <tr className="text-left text-[10px] font-black uppercase tracking-widest text-slate-500 border-b border-slate-200 dark:border-slate-700">
                                        <th className="px-5 py-2.5">Tienda</th>
                                        <th className="px-3 py-2.5">Producto</th>
                                        <th className="px-3 py-2.5 text-right">Exi tienda</th>
                                        <th className="px-3 py-2.5 text-right">Venta/día</th>
                                        <th className="px-3 py-2.5 text-right">Cobertura</th>
                                        <th className="px-3 py-2.5 text-right">Exi CEDIS</th>
                                        <th className="px-3 py-2.5 text-right">Enviar</th>
                                        <th className="px-5 py-2.5 text-right">Valor</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                                    {replenishment.map((s, i) => (
                                        <tr key={i} className="hover:bg-slate-50 dark:hover:bg-slate-900/30">
                                            <td className="px-5 py-2 font-semibold text-slate-700 dark:text-slate-200 whitespace-nowrap">{s.tienda}</td>
                                            <td className="px-3 py-2">
                                                <p className="text-slate-600 dark:text-slate-300 truncate max-w-[280px]" title={s.descripcion}>
                                                    {s.descripcion}
                                                </p>
                                            </td>
                                            <td className="px-3 py-2 text-right text-slate-500">{intFmt(s.exiTienda)}</td>
                                            <td className="px-3 py-2 text-right text-slate-500">{s.ventaDiaria}</td>
                                            <td className="px-3 py-2 text-right">
                                                <span className={cn(
                                                    "font-black",
                                                    s.coberturaDias < 3 ? "text-red-600" : "text-amber-600"
                                                )}>
                                                    {s.coberturaDias} d
                                                </span>
                                            </td>
                                            <td className="px-3 py-2 text-right text-slate-500">{intFmt(s.exiCedis)}</td>
                                            <td className="px-3 py-2 text-right font-black text-[#4050B4]">{intFmt(s.sugerido)}</td>
                                            <td className="px-5 py-2 text-right font-bold text-slate-700 dark:text-slate-200">{money(s.valorSugerido)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )
                )}
            </div>

            {/* Bitácora de movimientos */}
            <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 px-5 pt-5 pb-3">
                    <p className="text-xs font-black uppercase tracking-widest text-slate-500">
                        Bitácora de movimientos ({intFmt(filtered.length)})
                    </p>
                    <div className="flex flex-wrap items-center gap-2">
                        {(["TODOS", "RECIBO", "SALIDA", "ENTRADA"] as TipoFiltro[]).map((t) => (
                            <button
                                key={t}
                                onClick={() => setTipoFiltro(t)}
                                className={cn(
                                    "px-3 py-1.5 text-[10px] font-black uppercase tracking-widest transition-all border",
                                    tipoFiltro === t
                                        ? "bg-[#4050B4] text-white border-[#4050B4]"
                                        : "text-slate-500 border-slate-200 dark:border-slate-700 hover:border-[#4050B4]"
                                )}
                            >
                                {t === "TODOS" ? "Todos" : TIPO_STYLE[t as Movement["tipo"]].label}
                            </button>
                        ))}
                        <div className="relative">
                            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                            <input
                                type="text"
                                placeholder="Folio, tienda, proveedor..."
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 py-1.5 pl-8 pr-3 text-xs w-52 focus:outline-none focus:ring-2 focus:ring-[#4050B4]/30"
                            />
                        </div>
                    </div>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="bg-slate-50 dark:bg-slate-900/50 text-left text-[10px] font-black uppercase tracking-widest text-slate-500 border-b border-slate-200 dark:border-slate-700">
                                <th className="px-5 py-3">Tipo</th>
                                <th className="px-3 py-3">Folio</th>
                                <th className="px-3 py-3">Fecha</th>
                                <th className="px-3 py-3">Contraparte</th>
                                <th className="px-3 py-3">Usuario</th>
                                <th className="px-3 py-3 text-right">Renglones</th>
                                <th className="px-3 py-3 text-right">Total</th>
                                <th className="px-5 py-3">Estado</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                            {filtered.length === 0 ? (
                                <tr>
                                    <td colSpan={8} className="px-5 py-12 text-center text-slate-400">
                                        <PackageCheck className="mx-auto mb-2 opacity-40" size={28} />
                                        No hay movimientos con esos filtros.
                                    </td>
                                </tr>
                            ) : (
                                filtered.map((m) => {
                                    const ts = TIPO_STYLE[m.tipo];
                                    return (
                                        <tr
                                            key={`${m.tipo}-${m.id}-${m.esFactura ? "F" : "N"}`}
                                            onClick={() => openDetail(m)}
                                            className="hover:bg-slate-50 dark:hover:bg-slate-900/30 cursor-pointer transition-colors"
                                        >
                                            <td className="px-5 py-2.5">
                                                <span className={cn("inline-flex items-center gap-1.5 px-2 py-1 text-[10px] font-black uppercase tracking-widest", ts.cls)}>
                                                    <ts.icon size={11} />
                                                    {ts.label}{m.esFactura ? " (fact.)" : ""}
                                                </span>
                                            </td>
                                            <td className="px-3 py-2.5 font-mono text-xs text-slate-500">{m.folio}</td>
                                            <td className="px-3 py-2.5 text-slate-500 whitespace-nowrap">{m.fecha}</td>
                                            <td className="px-3 py-2.5 font-semibold text-slate-700 dark:text-slate-200">{m.contraparte}</td>
                                            <td className="px-3 py-2.5 text-slate-500">{m.usuario || "—"}</td>
                                            <td className="px-3 py-2.5 text-right text-slate-500">{m.renglones || "—"}</td>
                                            <td className="px-3 py-2.5 text-right font-bold text-slate-700 dark:text-slate-200">{money(m.total)}</td>
                                            <td className="px-5 py-2.5">
                                                <span className={cn("inline-flex px-2 py-1 text-[10px] font-black uppercase tracking-widest", estadoCls(m.estado))}>
                                                    {m.estado}
                                                </span>
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Modal de detalle */}
            {detailMov && (
                <div className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
                    <div className="w-full max-w-3xl max-h-[85vh] flex flex-col bg-white dark:bg-slate-800 shadow-2xl border border-slate-200 dark:border-slate-700">
                        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-700 bg-[#4050B4] text-white">
                            <div>
                                <h2 className="font-black uppercase tracking-widest text-sm">
                                    {TIPO_STYLE[detailMov.tipo].label} · {detailMov.folio}
                                </h2>
                                <p className="text-[11px] text-white/70 font-medium">
                                    {detailMov.fecha} · {detailMov.contraparte}
                                    {detailMov.idOrdenCompra ? ` · OC #${detailMov.idOrdenCompra}` : ""}
                                </p>
                            </div>
                            <button onClick={() => setDetailMov(null)} className="p-2 hover:bg-white/10 transition-all">
                                <X size={20} />
                            </button>
                        </div>
                        <div className="flex-1 overflow-y-auto">
                            {detailError ? (
                                <div className="m-6 px-4 py-3 bg-red-50 border border-red-200 text-red-700 text-sm">{detailError}</div>
                            ) : detailItems === null ? (
                                <div className="py-16 text-center text-slate-400">
                                    <Loader2 size={24} className="mx-auto animate-spin mb-2" />
                                    Cargando renglones...
                                </div>
                            ) : (
                                <table className="w-full text-sm">
                                    <thead className="sticky top-0 bg-slate-50 dark:bg-slate-900/80">
                                        <tr className="text-left text-[10px] font-black uppercase tracking-widest text-slate-500 border-b border-slate-200 dark:border-slate-700">
                                            <th className="px-6 py-2.5">Artículo</th>
                                            <th className="px-3 py-2.5 text-right">Cantidad</th>
                                            <th className="px-3 py-2.5 text-right">Pzs pedido / recibo</th>
                                            <th className="px-3 py-2.5 text-right">Costo</th>
                                            <th className="px-6 py-2.5 text-right">Total</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                                        {detailItems.map((it, i) => {
                                            const discrepancia =
                                                it.piezasRecibo != null && it.piezasRecibo > 0 &&
                                                it.piezasPedido != null && it.piezasRecibo !== it.piezasPedido;
                                            return (
                                                <tr key={i} className={cn(discrepancia && "bg-amber-50/60 dark:bg-amber-900/10")}>
                                                    <td className="px-6 py-2">
                                                        <p className="font-semibold text-slate-700 dark:text-slate-200">{it.descripcion}</p>
                                                        {it.codigoBarras && <p className="text-[10px] font-mono text-slate-400">{it.codigoBarras}</p>}
                                                    </td>
                                                    <td className="px-3 py-2 text-right text-slate-600 dark:text-slate-300">{intFmt(it.cantidad)}</td>
                                                    <td className="px-3 py-2 text-right text-slate-500">
                                                        {it.piezasPedido ?? "—"} / {it.piezasRecibo ?? "—"}
                                                        {discrepancia && <AlertTriangle size={12} className="inline ml-1 text-amber-600" />}
                                                    </td>
                                                    <td className="px-3 py-2 text-right text-slate-500">{money(it.costo)}</td>
                                                    <td className="px-6 py-2 text-right font-bold text-slate-700 dark:text-slate-200">{money(it.total)}</td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                    <tfoot>
                                        <tr className="border-t-2 border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50">
                                            <td className="px-6 py-3 font-black uppercase tracking-widest text-xs text-slate-500">
                                                {detailItems.length} renglones
                                            </td>
                                            <td colSpan={3} />
                                            <td className="px-6 py-3 text-right font-black text-slate-800 dark:text-white">
                                                {money(detailItems.reduce((a, i) => a + i.total, 0))}
                                            </td>
                                        </tr>
                                    </tfoot>
                                </table>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

// ---------- Subcomponentes ----------
function KpiCard({ icon: Icon, tone, label, value, sub }: {
    icon: typeof Boxes;
    tone: string;
    label: string;
    value: string;
    sub: string;
}) {
    return (
        <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-4">
            <div className={cn("w-8 h-8 flex items-center justify-center mb-3", tone)}>
                <Icon size={16} />
            </div>
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 leading-tight">{label}</p>
            <p className="text-lg font-black text-slate-800 dark:text-white mt-1">{value}</p>
            <p className="text-[11px] text-slate-400 font-medium">{sub}</p>
        </div>
    );
}
