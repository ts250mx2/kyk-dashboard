"use client";

import { useState, useEffect, useCallback } from "react";
import { X, ScanFace, Loader2, RefreshCcw, ImageOff, UserX, UserCheck, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

interface ViewPerson {
    uid: string;
    name: string;
    sex: string;
    synced: boolean;
    photo: string | null;
}

interface ViewList {
    group: { name: string; groupId: string; channels: number[] } | null;
    persons: ViewPerson[];
}

interface NvrFacesData {
    black: ViewList;
    white: ViewList;
}

type Props = {
    idNvr: number;
    nvrName: string;
    onClose: () => void;
};

function sexLabel(sex: string) {
    if (sex === "Male") return "Hombre";
    if (sex === "Female") return "Mujer";
    return "—";
}

/** Sección de solo lectura para una lista (negra o blanca) del equipo. */
function ListSection({ title, icon: Icon, list, accent }: {
    title: string;
    icon: typeof UserX;
    list: ViewList;
    accent: string;
}) {
    return (
        <div className="p-6 border-b border-slate-200 dark:border-slate-700 last:border-b-0">
            <div className="flex items-center gap-2 mb-4">
                <Icon size={16} className={accent} />
                <h3 className="text-xs font-black uppercase tracking-widest text-slate-600 dark:text-slate-300">
                    {title}
                </h3>
                <span className="text-[11px] text-slate-400 font-medium">
                    {list.group
                        ? `Grupo "${list.group.name}" · ${list.persons.length} personas` +
                          (list.group.channels.length ? ` · canales ${list.group.channels.join(", ")}` : " · sin canales asignados")
                        : "El equipo no tiene grupo de este tipo"}
                </span>
            </div>
            {list.persons.length === 0 ? (
                <p className="text-sm text-slate-400 py-4 text-center">Sin personas cargadas en el equipo.</p>
            ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
                    {list.persons.map((p) => (
                        <div
                            key={p.uid}
                            className="border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900/40 overflow-hidden"
                        >
                            <div className="aspect-square bg-slate-100 dark:bg-slate-900 relative">
                                {p.photo ? (
                                    // eslint-disable-next-line @next/next/no-img-element
                                    <img src={p.photo} alt={p.name} className="w-full h-full object-cover" />
                                ) : (
                                    <div className="w-full h-full flex items-center justify-center text-slate-300">
                                        <ImageOff size={24} />
                                    </div>
                                )}
                                {!p.synced && (
                                    <span
                                        className="absolute bottom-1 left-1 right-1 flex items-center justify-center gap-1 px-1 py-0.5 bg-amber-500/90 text-white text-[9px] font-black uppercase tracking-wider"
                                        title="Se dio de alta directamente en el equipo; una sincronización la importará a SQL"
                                    >
                                        <AlertTriangle size={9} /> Sin sincronizar
                                    </span>
                                )}
                            </div>
                            <div className="px-2 py-1.5">
                                <p className="text-[11px] font-bold text-slate-700 dark:text-slate-200 truncate" title={p.name}>
                                    {p.name}
                                </p>
                                <p className="text-[9px] text-slate-400 uppercase tracking-widest">{sexLabel(p.sex)}</p>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

/**
 * Visor de SOLO LECTURA de los rostros cargados en un NVR específico.
 * Las altas/bajas se hacen desde los modales de Lista negra / Lista blanca,
 * que guardan en SQL y sincronizan.
 */
export function NvrFacesViewModal({ idNvr, nvrName, onClose }: Props) {
    const [data, setData] = useState<NvrFacesData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchData = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const res = await fetch(`/api/nvr/${idNvr}/faces`);
            const json = await res.json();
            if (!res.ok) throw new Error(json.error || "Error al consultar el NVR");
            setData(json);
        } catch (e: any) {
            setError(e.message);
            setData(null);
        } finally {
            setLoading(false);
        }
    }, [idNvr]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    return (
        <div className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <div className="w-full max-w-4xl max-h-[90vh] flex flex-col bg-white dark:bg-slate-800 shadow-2xl border border-slate-200 dark:border-slate-700">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-700 bg-[#4050B4] text-white">
                    <div className="flex items-center gap-3">
                        <ScanFace size={20} />
                        <div>
                            <h2 className="font-black uppercase tracking-widest text-sm">Rostros en el equipo</h2>
                            <p className="text-[11px] text-white/70 font-medium">
                                {nvrName} · solo consulta; las altas se hacen en Lista negra / Lista blanca
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-1">
                        <button
                            onClick={fetchData}
                            disabled={loading}
                            className="p-2 hover:bg-white/10 transition-all disabled:opacity-50"
                            title="Recargar"
                        >
                            <RefreshCcw size={16} className={cn(loading && "animate-spin")} />
                        </button>
                        <button onClick={onClose} className="p-2 hover:bg-white/10 transition-all" title="Cerrar">
                            <X size={20} />
                        </button>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto">
                    {loading ? (
                        <div className="py-16 text-center text-slate-400">
                            <Loader2 size={24} className="mx-auto animate-spin mb-2" />
                            Consultando el NVR...
                        </div>
                    ) : error ? (
                        <div className="m-6 px-4 py-3 bg-red-50 border border-red-200 text-red-700 text-sm">
                            {error}
                        </div>
                    ) : data ? (
                        <>
                            <ListSection title="Lista negra" icon={UserX} list={data.black} accent="text-slate-700 dark:text-slate-200" />
                            <ListSection title="Lista blanca" icon={UserCheck} list={data.white} accent="text-emerald-600" />
                        </>
                    ) : null}
                </div>
            </div>
        </div>
    );
}
