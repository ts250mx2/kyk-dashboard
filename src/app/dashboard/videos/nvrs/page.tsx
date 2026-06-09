"use client";

import { useState, useEffect, useCallback } from "react";
import {
    Video, Plus, Pencil, Trash2, X, Eye, EyeOff,
    RefreshCcw, Server, Search, Wifi, WifiOff, ExternalLink, Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { LoadingScreen } from "@/components/ui/loading-screen";

interface Store { IdTienda: number; Tienda: string; }

interface Nvr {
    IdNVR: number;
    IdTienda: number;
    Tienda: string | null;
    Descripcion: string | null;
    IP: string | null;
    Usuario: string | null;
    Passwd: string | null;
    FechaAct: string | null;
    Status: number;
}

type FormState = {
    IdNVR: number | null;
    IdTienda: number | "";
    Descripcion: string;
    IP: string;
    Usuario: string;
    Passwd: string;
    Status: number;
};

const EMPTY_FORM: FormState = {
    IdNVR: null,
    IdTienda: "",
    Descripcion: "",
    IP: "",
    Usuario: "",
    Passwd: "",
    Status: 0,
};

function statusLabel(status: number) {
    return status === 0 ? "Activo" : "Inactivo";
}

interface NvrPing { online: boolean; ms: number; port: number | null; }

export default function NvrsPage() {
    const [nvrs, setNvrs] = useState<Nvr[]>([]);
    const [stores, setStores] = useState<Store[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState("");

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [form, setForm] = useState<FormState>(EMPTY_FORM);
    const [showPass, setShowPass] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Estado en vivo (alcanzabilidad por IP).
    const [pings, setPings] = useState<Record<number, NvrPing>>({});
    const [pinging, setPinging] = useState(false);

    const fetchStatus = useCallback(async () => {
        setPinging(true);
        try {
            const res = await fetch("/api/nvr/status");
            const data = await res.json();
            if (Array.isArray(data)) {
                const map: Record<number, NvrPing> = {};
                for (const s of data) map[s.IdNVR] = { online: s.online, ms: s.ms, port: s.port };
                setPings(map);
            }
        } catch (e) {
            console.error(e);
        } finally {
            setPinging(false);
        }
    }, []);

    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            const [nvrRes, storeRes] = await Promise.all([
                fetch("/api/nvr"),
                fetch("/api/nvr/stores"),
            ]);
            const nvrData = await nvrRes.json();
            const storeData = await storeRes.json();
            setNvrs(Array.isArray(nvrData) ? nvrData : []);
            setStores(Array.isArray(storeData) ? storeData : []);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    // Verifica el estado en cuanto se cargan los NVR's.
    useEffect(() => {
        if (nvrs.length > 0) fetchStatus();
    }, [nvrs, fetchStatus]);

    const openCreate = () => {
        setForm(EMPTY_FORM);
        setError(null);
        setShowPass(false);
        setIsModalOpen(true);
    };

    const openEdit = (nvr: Nvr) => {
        setForm({
            IdNVR: nvr.IdNVR,
            IdTienda: nvr.IdTienda,
            Descripcion: nvr.Descripcion ?? "",
            IP: nvr.IP ?? "",
            Usuario: nvr.Usuario ?? "",
            Passwd: nvr.Passwd ?? "",
            Status: nvr.Status,
        });
        setError(null);
        setShowPass(false);
        setIsModalOpen(true);
    };

    // Al elegir tienda, si la descripción está vacía la pre-llenamos con el nombre.
    const handleStoreChange = (value: string) => {
        const id = value ? Number(value) : "";
        setForm((prev) => {
            const store = stores.find((s) => s.IdTienda === id);
            const shouldFill = !prev.Descripcion.trim();
            return {
                ...prev,
                IdTienda: id,
                Descripcion: shouldFill && store ? store.Tienda : prev.Descripcion,
            };
        });
    };

    const handleSave = async () => {
        if (!form.IdTienda) {
            setError("Selecciona una tienda.");
            return;
        }
        setSaving(true);
        setError(null);
        try {
            const isEdit = form.IdNVR != null;
            const res = await fetch(isEdit ? `/api/nvr/${form.IdNVR}` : "/api/nvr", {
                method: isEdit ? "PUT" : "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    IdTienda: form.IdTienda,
                    Descripcion: form.Descripcion,
                    IP: form.IP,
                    Usuario: form.Usuario,
                    Passwd: form.Passwd,
                    Status: form.Status,
                }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || "Error al guardar");
            setIsModalOpen(false);
            await fetchData();
        } catch (e: any) {
            setError(e.message);
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (nvr: Nvr) => {
        const name = nvr.Descripcion || nvr.Tienda || `NVR #${nvr.IdNVR}`;
        if (!confirm(`¿Eliminar el NVR "${name}"? Esta acción no se puede deshacer.`)) return;
        try {
            const res = await fetch(`/api/nvr/${nvr.IdNVR}`, { method: "DELETE" });
            if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                throw new Error(data.error || "Error al eliminar");
            }
            await fetchData();
        } catch (e: any) {
            alert(e.message);
        }
    };

    const filtered = nvrs.filter((n) => {
        const q = search.toLowerCase();
        return (
            (n.Descripcion ?? "").toLowerCase().includes(q) ||
            (n.Tienda ?? "").toLowerCase().includes(q) ||
            (n.IP ?? "").toLowerCase().includes(q)
        );
    });

    if (loading) return <LoadingScreen />;

    return (
        <div className="space-y-6 pb-20">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-none bg-[#4050B4] text-white flex items-center justify-center shadow-lg">
                        <Video size={22} />
                    </div>
                    <div>
                        <h1 className="text-2xl md:text-3xl font-black text-slate-900 dark:text-white uppercase tracking-tighter">
                            NVR&apos;s
                        </h1>
                        <p className="text-slate-500 text-sm font-medium">
                            Administración de grabadores de video en red por tienda.
                        </p>
                    </div>
                </div>
                <div className="flex gap-2">
                    <button
                        onClick={fetchStatus}
                        disabled={pinging}
                        className="flex items-center gap-2 px-4 py-3 bg-white dark:bg-slate-800 text-slate-500 border border-slate-200 dark:border-slate-700 font-black text-xs uppercase tracking-widest hover:bg-slate-50 transition-all disabled:opacity-50"
                        title="Verificar estado en vivo"
                    >
                        {pinging ? <Loader2 size={16} className="animate-spin" /> : <Wifi size={16} />}
                        <span className="hidden sm:inline">Estado</span>
                    </button>
                    <button
                        onClick={fetchData}
                        className="flex items-center gap-2 px-4 py-3 bg-white dark:bg-slate-800 text-slate-500 border border-slate-200 dark:border-slate-700 font-black text-xs uppercase tracking-widest hover:bg-slate-50 transition-all"
                        title="Recargar"
                    >
                        <RefreshCcw size={16} />
                    </button>
                    <button
                        onClick={openCreate}
                        className="flex items-center gap-3 px-6 py-3 bg-[#4050B4] text-white font-black text-xs uppercase tracking-[0.2em] hover:bg-[#344199] transition-all shadow-xl shadow-[#4050B4]/20"
                    >
                        <Plus size={16} />
                        Nuevo NVR
                    </button>
                </div>
            </div>

            {/* Search */}
            <div className="relative max-w-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <input
                    type="text"
                    placeholder="Buscar por tienda, descripción o IP..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 py-2.5 pl-10 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-[#4050B4]/30"
                />
            </div>

            {/* Table */}
            <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 overflow-x-auto">
                <table className="w-full text-sm">
                    <thead>
                        <tr className="bg-slate-50 dark:bg-slate-900/50 text-left text-[11px] font-black uppercase tracking-widest text-slate-500 border-b border-slate-200 dark:border-slate-700">
                            <th className="px-4 py-3">Tienda</th>
                            <th className="px-4 py-3">Descripción</th>
                            <th className="px-4 py-3">IP</th>
                            <th className="px-4 py-3">Usuario</th>
                            <th className="px-4 py-3">Status</th>
                            <th className="px-4 py-3">Conexión</th>
                            <th className="px-4 py-3 text-right">Acciones</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                        {filtered.length === 0 ? (
                            <tr>
                                <td colSpan={7} className="px-4 py-12 text-center text-slate-400">
                                    <Server className="mx-auto mb-2 opacity-40" size={28} />
                                    No hay NVR&apos;s registrados.
                                </td>
                            </tr>
                        ) : (
                            filtered.map((nvr) => (
                                <tr key={nvr.IdNVR} className="hover:bg-slate-50 dark:hover:bg-slate-900/30 transition-colors">
                                    <td className="px-4 py-3 font-semibold text-slate-700 dark:text-slate-200">
                                        {nvr.Tienda ?? `#${nvr.IdTienda}`}
                                    </td>
                                    <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{nvr.Descripcion}</td>
                                    <td className="px-4 py-3 font-mono text-slate-500">{nvr.IP || "—"}</td>
                                    <td className="px-4 py-3 text-slate-500">{nvr.Usuario || "—"}</td>
                                    <td className="px-4 py-3">
                                        <span
                                            className={cn(
                                                "inline-flex items-center px-2.5 py-1 text-[10px] font-black uppercase tracking-widest",
                                                nvr.Status === 0
                                                    ? "bg-emerald-100 text-emerald-700"
                                                    : "bg-slate-200 text-slate-500"
                                            )}
                                        >
                                            {statusLabel(nvr.Status)}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3">
                                        {(() => {
                                            if (!nvr.IP) return <span className="text-slate-300 text-xs">Sin IP</span>;
                                            const p = pings[nvr.IdNVR];
                                            if (pinging && !p)
                                                return (
                                                    <span className="inline-flex items-center gap-1.5 text-slate-400 text-xs font-semibold">
                                                        <Loader2 size={13} className="animate-spin" /> Probando…
                                                    </span>
                                                );
                                            if (!p) return <span className="text-slate-300 text-xs">—</span>;
                                            return p.online ? (
                                                <span className="inline-flex items-center gap-1.5 text-emerald-600 text-xs font-bold" title={`Puerto ${p.port} · ${p.ms} ms`}>
                                                    <Wifi size={14} /> En línea
                                                </span>
                                            ) : (
                                                <span className="inline-flex items-center gap-1.5 text-red-500 text-xs font-bold" title="No responde">
                                                    <WifiOff size={14} /> Sin conexión
                                                </span>
                                            );
                                        })()}
                                    </td>
                                    <td className="px-4 py-3">
                                        <div className="flex items-center justify-end gap-2">
                                            {nvr.IP && (
                                                <a
                                                    href={`http://${nvr.IP}`}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="p-2 text-slate-400 hover:text-[#4050B4] hover:bg-[#4050B4]/10 transition-all"
                                                    title="Abrir web del equipo"
                                                >
                                                    <ExternalLink size={16} />
                                                </a>
                                            )}
                                            <button
                                                onClick={() => openEdit(nvr)}
                                                className="p-2 text-slate-400 hover:text-[#4050B4] hover:bg-[#4050B4]/10 transition-all"
                                                title="Editar"
                                            >
                                                <Pencil size={16} />
                                            </button>
                                            <button
                                                onClick={() => handleDelete(nvr)}
                                                className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 transition-all"
                                                title="Eliminar"
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            {/* Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
                    <div className="w-full max-w-lg bg-white dark:bg-slate-800 shadow-2xl border border-slate-200 dark:border-slate-700">
                        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-700 bg-[#4050B4] text-white">
                            <h2 className="font-black uppercase tracking-widest text-sm">
                                {form.IdNVR != null ? "Editar NVR" : "Nuevo NVR"}
                            </h2>
                            <button onClick={() => setIsModalOpen(false)} className="hover:opacity-70">
                                <X size={20} />
                            </button>
                        </div>

                        <div className="p-6 space-y-4">
                            {error && (
                                <div className="px-4 py-2.5 bg-red-50 border border-red-200 text-red-700 text-sm">
                                    {error}
                                </div>
                            )}

                            <div>
                                <label className="block text-xs font-black uppercase tracking-widest text-slate-500 mb-1">
                                    Tienda
                                </label>
                                <select
                                    value={form.IdTienda}
                                    onChange={(e) => handleStoreChange(e.target.value)}
                                    className="w-full border border-slate-300 dark:border-slate-600 dark:bg-slate-900 py-2.5 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#4050B4]/30"
                                >
                                    <option value="">— Selecciona una tienda —</option>
                                    {stores.map((s) => (
                                        <option key={s.IdTienda} value={s.IdTienda}>
                                            {s.Tienda}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label className="block text-xs font-black uppercase tracking-widest text-slate-500 mb-1">
                                    Descripción
                                </label>
                                <input
                                    type="text"
                                    value={form.Descripcion}
                                    onChange={(e) => setForm({ ...form, Descripcion: e.target.value })}
                                    placeholder="Por default = nombre de la tienda"
                                    className="w-full border border-slate-300 dark:border-slate-600 dark:bg-slate-900 py-2.5 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#4050B4]/30"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-black uppercase tracking-widest text-slate-500 mb-1">
                                        IP
                                    </label>
                                    <input
                                        type="text"
                                        value={form.IP}
                                        onChange={(e) => setForm({ ...form, IP: e.target.value })}
                                        placeholder="192.168.1.x"
                                        className="w-full border border-slate-300 dark:border-slate-600 dark:bg-slate-900 py-2.5 px-3 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-[#4050B4]/30"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-black uppercase tracking-widest text-slate-500 mb-1">
                                        Status
                                    </label>
                                    <select
                                        value={form.Status}
                                        onChange={(e) => setForm({ ...form, Status: Number(e.target.value) })}
                                        className="w-full border border-slate-300 dark:border-slate-600 dark:bg-slate-900 py-2.5 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#4050B4]/30"
                                    >
                                        <option value={0}>Activo</option>
                                        <option value={2}>Inactivo</option>
                                    </select>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-black uppercase tracking-widest text-slate-500 mb-1">
                                        Usuario
                                    </label>
                                    <input
                                        type="text"
                                        value={form.Usuario}
                                        onChange={(e) => setForm({ ...form, Usuario: e.target.value })}
                                        autoComplete="off"
                                        className="w-full border border-slate-300 dark:border-slate-600 dark:bg-slate-900 py-2.5 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#4050B4]/30"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-black uppercase tracking-widest text-slate-500 mb-1">
                                        Contraseña
                                    </label>
                                    <div className="relative">
                                        <input
                                            type={showPass ? "text" : "password"}
                                            value={form.Passwd}
                                            onChange={(e) => setForm({ ...form, Passwd: e.target.value })}
                                            autoComplete="new-password"
                                            className="w-full border border-slate-300 dark:border-slate-600 dark:bg-slate-900 py-2.5 pl-3 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-[#4050B4]/30"
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setShowPass(!showPass)}
                                            className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                                        >
                                            {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="flex justify-end gap-3 px-6 py-4 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50">
                            <button
                                onClick={() => setIsModalOpen(false)}
                                className="px-5 py-2.5 text-sm font-black uppercase tracking-widest text-slate-500 hover:bg-slate-200 transition-all"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={handleSave}
                                disabled={saving}
                                className="px-6 py-2.5 bg-[#4050B4] text-white text-sm font-black uppercase tracking-widest hover:bg-[#344199] transition-all disabled:opacity-50"
                            >
                                {saving ? "Guardando..." : "Guardar"}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
