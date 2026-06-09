"use client";

import { useState, useEffect, useMemo } from "react";
import {
    Film, ExternalLink, Copy, Check, Clapperboard, Info,
    Search, Loader2, Download, Clock, AlertTriangle,
} from "lucide-react";
import { LoadingScreen } from "@/components/ui/loading-screen";

interface Nvr {
    IdNVR: number;
    IdTienda: number;
    Tienda: string | null;
    Descripcion: string | null;
    IP: string | null;
    Usuario: string | null;
    Passwd: string | null;
    Status: number;
}

interface DahuaClip {
    channel: number;
    startTime: string;
    endTime: string;
    type: string;
    filePath: string;
    length: number;
}

function fmtBytes(n: number): string {
    if (!n) return "—";
    const u = ["B", "KB", "MB", "GB"];
    let i = 0;
    let v = n;
    while (v >= 1024 && i < u.length - 1) { v /= 1024; i++; }
    return `${v.toFixed(1)} ${u[i]}`;
}

// "2026-06-09 08:30:00" -> "2026_06_09_08_30_00" (RTSP playback Dahua)
function dahuaStamp(dt: string): string {
    return dt.replace(/[-: ]/g, "_");
}

type Marca = "hikvision" | "dahua" | "generico";

const MARCAS: { value: Marca; label: string }[] = [
    { value: "hikvision", label: "Hikvision" },
    { value: "dahua", label: "Dahua" },
    { value: "generico", label: "Genérico (RTSP)" },
];

// "2026-06-09" + "08:30" -> "20260609T083000Z" (Hikvision ISAPI)
function toHikTime(date: string, time: string): string {
    const [y, m, d] = date.split("-");
    const [hh, mm] = time.split(":");
    return `${y}${m}${d}T${hh}${mm}00Z`;
}

// "2026-06-09" + "08:30" -> "2026_06_09_08_30_00" (Dahua)
function toDahuaTime(date: string, time: string): string {
    const [y, m, d] = date.split("-");
    const [hh, mm] = time.split(":");
    return `${y}_${m}_${d}_${hh}_${mm}_00`;
}

function buildRtspUrl(
    marca: Marca,
    nvr: Nvr,
    channel: number,
    date: string,
    from: string,
    to: string,
    withCreds: boolean
): string {
    const ip = nvr.IP ?? "IP";
    const auth = withCreds && nvr.Usuario ? `${nvr.Usuario}:${nvr.Passwd ?? ""}@` : "";
    const base = `rtsp://${auth}${ip}:554`;

    if (marca === "hikvision") {
        // Canal 1 stream principal = track 101, canal 2 = 201, etc.
        const track = `${channel}01`;
        return `${base}/Streaming/tracks/${track}?starttime=${toHikTime(date, from)}&endtime=${toHikTime(date, to)}`;
    }
    if (marca === "dahua") {
        return `${base}/cam/playback?channel=${channel}&starttime=${toDahuaTime(date, from)}&endtime=${toDahuaTime(date, to)}`;
    }
    // Genérico: stream en vivo del canal (sin playback por tiempo estándar).
    return `${base}/Streaming/Channels/${channel}01`;
}

export default function RecordingsPage() {
    const [nvrs, setNvrs] = useState<Nvr[]>([]);
    const [loading, setLoading] = useState(true);

    const [selectedId, setSelectedId] = useState<number | "">("");
    const [marca, setMarca] = useState<Marca>("dahua");
    const [channel, setChannel] = useState(1);
    const [date, setDate] = useState("");
    const [from, setFrom] = useState("00:00");
    const [to, setTo] = useState("23:59");
    const [withCreds, setWithCreds] = useState(true);
    const [copied, setCopied] = useState(false);

    // Listado de grabaciones (Dahua CGI).
    const [clips, setClips] = useState<DahuaClip[]>([]);
    const [searching, setSearching] = useState(false);
    const [searched, setSearched] = useState(false);
    const [searchError, setSearchError] = useState<string | null>(null);
    const [copiedClip, setCopiedClip] = useState<string | null>(null);

    useEffect(() => {
        (async () => {
            setLoading(true);
            try {
                const res = await fetch("/api/nvr");
                const data = await res.json();
                // Solo NVR's activos con IP.
                const list: Nvr[] = (Array.isArray(data) ? data : []).filter(
                    (n: Nvr) => n.Status === 0 && n.IP
                );
                setNvrs(list);
                if (list.length === 1) setSelectedId(list[0].IdNVR);
            } catch (e) {
                console.error(e);
            } finally {
                setLoading(false);
            }
        })();
    }, []);

    const selected = useMemo(
        () => nvrs.find((n) => n.IdNVR === selectedId) ?? null,
        [nvrs, selectedId]
    );

    const rtspUrl = useMemo(() => {
        if (!selected || !date) return "";
        return buildRtspUrl(marca, selected, channel, date, from, to, withCreds);
    }, [selected, marca, channel, date, from, to, withCreds]);

    const handleCopy = async () => {
        if (!rtspUrl) return;
        try {
            await navigator.clipboard.writeText(rtspUrl);
            setCopied(true);
            setTimeout(() => setCopied(false), 1800);
        } catch {
            /* ignore */
        }
    };

    // RTSP de playback exacto de un clip (rango propio del clip).
    const clipRtsp = (clip: DahuaClip): string => {
        if (!selected) return "";
        const auth = withCreds && selected.Usuario ? `${selected.Usuario}:${selected.Passwd ?? ""}@` : "";
        return `rtsp://${auth}${selected.IP}:554/cam/playback?channel=${clip.channel || channel}&starttime=${dahuaStamp(clip.startTime)}&endtime=${dahuaStamp(clip.endTime)}`;
    };

    const copyClip = async (clip: DahuaClip) => {
        try {
            await navigator.clipboard.writeText(clipRtsp(clip));
            setCopiedClip(clip.filePath);
            setTimeout(() => setCopiedClip(null), 1800);
        } catch {
            /* ignore */
        }
    };

    const searchRecordings = async () => {
        if (!selected || !date) return;
        setSearching(true);
        setSearchError(null);
        setSearched(true);
        setClips([]);
        try {
            const qs = new URLSearchParams({
                channel: String(channel),
                date,
                from,
                to,
            });
            const res = await fetch(`/api/nvr/${selected.IdNVR}/recordings?${qs}`);
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || "Error al consultar el NVR");
            setClips(Array.isArray(data.clips) ? data.clips : []);
        } catch (e: any) {
            setSearchError(e.message);
        } finally {
            setSearching(false);
        }
    };

    if (loading) return <LoadingScreen />;

    return (
        <div className="space-y-6 pb-20">
            {/* Header */}
            <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-none bg-[#4050B4] text-white flex items-center justify-center shadow-lg">
                    <Film size={22} />
                </div>
                <div>
                    <h1 className="text-2xl md:text-3xl font-black text-slate-900 dark:text-white uppercase tracking-tighter">
                        Grabaciones
                    </h1>
                    <p className="text-slate-500 text-sm font-medium">
                        Reproducción de grabaciones por NVR, cámara y rango de tiempo.
                    </p>
                </div>
            </div>

            {nvrs.length === 0 ? (
                <div className="bg-white dark:bg-slate-800 border border-dashed border-slate-300 dark:border-slate-700 p-10 text-center text-slate-400">
                    <Clapperboard className="mx-auto mb-3 opacity-40" size={32} />
                    No hay NVR&apos;s activos con IP registrada.
                    <div className="mt-1 text-sm">
                        Da de alta un NVR en{" "}
                        <a href="/dashboard/videos/nvrs" className="text-[#4050B4] font-semibold underline">
                            Videos → NVR&apos;s
                        </a>
                        .
                    </div>
                </div>
            ) : (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Filtros */}
                    <div className="lg:col-span-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-5 space-y-4 h-fit">
                        <h2 className="text-xs font-black uppercase tracking-widest text-slate-500">Parámetros</h2>

                        <div>
                            <label className="block text-xs font-black uppercase tracking-widest text-slate-500 mb-1">NVR</label>
                            <select
                                value={selectedId}
                                onChange={(e) => setSelectedId(e.target.value ? Number(e.target.value) : "")}
                                className="w-full border border-slate-300 dark:border-slate-600 dark:bg-slate-900 py-2.5 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#4050B4]/30"
                            >
                                <option value="">— Selecciona un NVR —</option>
                                {nvrs.map((n) => (
                                    <option key={n.IdNVR} value={n.IdNVR}>
                                        {n.Descripcion || n.Tienda} ({n.IP})
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="block text-xs font-black uppercase tracking-widest text-slate-500 mb-1">Marca</label>
                                <select
                                    value={marca}
                                    onChange={(e) => setMarca(e.target.value as Marca)}
                                    className="w-full border border-slate-300 dark:border-slate-600 dark:bg-slate-900 py-2.5 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#4050B4]/30"
                                >
                                    {MARCAS.map((m) => (
                                        <option key={m.value} value={m.value}>{m.label}</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs font-black uppercase tracking-widest text-slate-500 mb-1">Cámara</label>
                                <input
                                    type="number"
                                    min={1}
                                    value={channel}
                                    onChange={(e) => setChannel(Math.max(1, Number(e.target.value) || 1))}
                                    className="w-full border border-slate-300 dark:border-slate-600 dark:bg-slate-900 py-2.5 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#4050B4]/30"
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-xs font-black uppercase tracking-widest text-slate-500 mb-1">Fecha</label>
                            <input
                                type="date"
                                value={date}
                                onChange={(e) => setDate(e.target.value)}
                                className="w-full border border-slate-300 dark:border-slate-600 dark:bg-slate-900 py-2.5 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#4050B4]/30"
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="block text-xs font-black uppercase tracking-widest text-slate-500 mb-1">Desde</label>
                                <input
                                    type="time"
                                    value={from}
                                    onChange={(e) => setFrom(e.target.value)}
                                    className="w-full border border-slate-300 dark:border-slate-600 dark:bg-slate-900 py-2.5 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#4050B4]/30"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-black uppercase tracking-widest text-slate-500 mb-1">Hasta</label>
                                <input
                                    type="time"
                                    value={to}
                                    onChange={(e) => setTo(e.target.value)}
                                    className="w-full border border-slate-300 dark:border-slate-600 dark:bg-slate-900 py-2.5 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#4050B4]/30"
                                />
                            </div>
                        </div>

                        <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300 cursor-pointer">
                            <input
                                type="checkbox"
                                checked={withCreds}
                                onChange={(e) => setWithCreds(e.target.checked)}
                                className="accent-[#4050B4]"
                            />
                            Incluir usuario y contraseña en la URL
                        </label>

                        {marca === "dahua" && (
                            <button
                                onClick={searchRecordings}
                                disabled={!selected || !date || searching}
                                className="w-full flex items-center justify-center gap-2 px-5 py-3 bg-[#4050B4] text-white text-xs font-black uppercase tracking-widest hover:bg-[#344199] transition-all disabled:opacity-50"
                            >
                                {searching ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}
                                {searching ? "Buscando…" : "Buscar grabaciones"}
                            </button>
                        )}
                    </div>

                    {/* Resultado */}
                    <div className="lg:col-span-2 space-y-4">
                        {!selected ? (
                            <div className="bg-white dark:bg-slate-800 border border-dashed border-slate-300 dark:border-slate-700 p-10 text-center text-slate-400">
                                Selecciona un NVR para generar el enlace de reproducción.
                            </div>
                        ) : (
                            <>
                                <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-5">
                                    <div className="flex items-center justify-between gap-3 flex-wrap">
                                        <div>
                                            <div className="text-lg font-black text-slate-800 dark:text-white">
                                                {selected.Descripcion || selected.Tienda}
                                            </div>
                                            <div className="text-sm text-slate-500 font-mono">{selected.IP}</div>
                                        </div>
                                        <a
                                            href={`http://${selected.IP}`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="flex items-center gap-2 px-5 py-2.5 bg-[#4050B4] text-white text-xs font-black uppercase tracking-widest hover:bg-[#344199] transition-all"
                                        >
                                            <ExternalLink size={15} />
                                            Abrir reproducción en el equipo
                                        </a>
                                    </div>
                                </div>

                                <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-5 space-y-3">
                                    <div className="flex items-center justify-between">
                                        <h3 className="text-xs font-black uppercase tracking-widest text-slate-500">
                                            URL RTSP de reproducción
                                        </h3>
                                        <button
                                            onClick={handleCopy}
                                            disabled={!rtspUrl}
                                            className="flex items-center gap-2 px-3 py-1.5 text-xs font-bold text-slate-500 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 transition-all disabled:opacity-40"
                                        >
                                            {copied ? <Check size={14} className="text-emerald-600" /> : <Copy size={14} />}
                                            {copied ? "Copiado" : "Copiar"}
                                        </button>
                                    </div>
                                    {rtspUrl ? (
                                        <code className="block bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 p-3 text-xs font-mono break-all text-slate-700 dark:text-slate-200">
                                            {rtspUrl}
                                        </code>
                                    ) : (
                                        <p className="text-sm text-slate-400">Selecciona una fecha para generar la URL.</p>
                                    )}
                                    <p className="text-xs text-slate-400">
                                        Pégala en VLC (<span className="font-semibold">Medio → Abrir ubicación de red</span>) o en
                                        cualquier reproductor compatible con RTSP, estando en la misma red del equipo.
                                    </p>
                                </div>

                                {/* Listado de grabaciones (Dahua CGI) */}
                                {marca === "dahua" && (
                                    <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                                        <div className="flex items-center justify-between px-5 py-3 border-b border-slate-200 dark:border-slate-700">
                                            <h3 className="text-xs font-black uppercase tracking-widest text-slate-500">
                                                Grabaciones encontradas
                                            </h3>
                                            {searched && !searching && !searchError && (
                                                <span className="text-xs font-bold text-slate-400">{clips.length} clip(s)</span>
                                            )}
                                        </div>

                                        {searching ? (
                                            <div className="p-8 text-center text-slate-400">
                                                <Loader2 className="mx-auto mb-2 animate-spin" size={24} />
                                                Consultando el NVR…
                                            </div>
                                        ) : searchError ? (
                                            <div className="flex gap-3 m-4 bg-red-50 border border-red-200 p-4 text-sm text-red-700">
                                                <AlertTriangle size={18} className="shrink-0 mt-0.5" />
                                                <div>
                                                    {searchError}
                                                    <div className="text-xs mt-1 text-red-500">
                                                        Verifica que el servidor tenga alcance al NVR, que el puerto HTTP sea 80 y que
                                                        usuario/contraseña sean correctos.
                                                    </div>
                                                </div>
                                            </div>
                                        ) : !searched ? (
                                            <div className="p-8 text-center text-slate-400 text-sm">
                                                Pulsa <span className="font-semibold">Buscar grabaciones</span> para listar los clips del NVR.
                                            </div>
                                        ) : clips.length === 0 ? (
                                            <div className="p-8 text-center text-slate-400 text-sm">
                                                No se encontraron grabaciones para ese canal y rango.
                                            </div>
                                        ) : (
                                            <div className="divide-y divide-slate-100 dark:divide-slate-700 max-h-[480px] overflow-y-auto">
                                                {clips.map((clip) => (
                                                    <div key={clip.filePath} className="flex items-center justify-between gap-3 px-5 py-3 hover:bg-slate-50 dark:hover:bg-slate-900/30">
                                                        <div className="min-w-0">
                                                            <div className="flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-200">
                                                                <Clock size={14} className="text-slate-400 shrink-0" />
                                                                {clip.startTime?.slice(11)} – {clip.endTime?.slice(11)}
                                                            </div>
                                                            <div className="text-xs text-slate-400 truncate">
                                                                Canal {clip.channel} · {fmtBytes(clip.length)} · {clip.type}
                                                            </div>
                                                        </div>
                                                        <div className="flex items-center gap-1.5 shrink-0">
                                                            <button
                                                                onClick={() => copyClip(clip)}
                                                                className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-bold text-slate-500 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700 transition-all"
                                                                title="Copiar URL RTSP del clip"
                                                            >
                                                                {copiedClip === clip.filePath ? <Check size={13} className="text-emerald-600" /> : <Copy size={13} />}
                                                                RTSP
                                                            </button>
                                                            <a
                                                                href={`/api/nvr/${selected.IdNVR}/recordings/download?path=${encodeURIComponent(clip.filePath)}`}
                                                                className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-bold text-white bg-[#4050B4] hover:bg-[#344199] transition-all"
                                                                title="Descargar clip (.dav)"
                                                            >
                                                                <Download size={13} />
                                                                Descargar
                                                            </a>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                )}

                                <div className="flex gap-3 bg-amber-50 border border-amber-200 p-4 text-sm text-amber-800">
                                    <Info size={18} className="shrink-0 mt-0.5" />
                                    <div>
                                        El listado usa la API CGI de Dahua (<code className="text-xs">mediaFileFind</code>) desde el servidor.
                                        Requiere que el servidor del dashboard tenga alcance de red al NVR. Los clips <code className="text-xs">.dav</code>{" "}
                                        se reproducen en VLC o en el reproductor de Dahua; el botón RTSP da el enlace de playback exacto del clip.
                                    </div>
                                </div>
                            </>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
