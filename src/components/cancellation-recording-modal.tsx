"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
    X, Video, ExternalLink, Play, Copy, Check, Download,
    Loader2, AlertTriangle, Clock, Search, Square, MonitorPlay,
} from "lucide-react";

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

interface Props {
    isOpen: boolean;
    onClose: () => void;
    idTienda?: number | string | null;
    storeName?: string;
    fechaCancelacion?: string;
    folio?: string;
    // Datos de la cancelación a mostrar.
    producto?: string;
    cantidad?: number;
    precio?: number;
    total?: number;
    cajero?: string;
    supervisor?: string;
    /** Minutos antes/después del evento. */
    windowMinutes?: number;
}

const pad = (n: number) => String(n).padStart(2, "0");
const dateStr = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const timeStr = (d: Date) => `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
const dahuaStamp = (d: Date) => `${dateStr(d)}_${timeStr(d)}`.replace(/[-:]/g, "_");

function fmtBytes(n: number): string {
    if (!n) return "—";
    const u = ["B", "KB", "MB", "GB"];
    let i = 0, v = n;
    while (v >= 1024 && i < u.length - 1) { v /= 1024; i++; }
    return `${v.toFixed(1)} ${u[i]}`;
}

const fmtCurrency = (v?: number) =>
    typeof v === "number" ? new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(v) : "—";

export function CancellationRecordingModal({
    isOpen, onClose, idTienda, storeName, fechaCancelacion, folio,
    producto, cantidad, precio, total, cajero, supervisor, windowMinutes = 2,
}: Props) {
    const [nvr, setNvr] = useState<Nvr | null>(null);
    const [loadingNvr, setLoadingNvr] = useState(false);
    const [channel, setChannel] = useState(1);
    const [copied, setCopied] = useState(false);

    const [clips, setClips] = useState<DahuaClip[]>([]);
    const [searching, setSearching] = useState(false);
    const [searched, setSearched] = useState(false);
    const [searchError, setSearchError] = useState<string | null>(null);
    const [copiedClip, setCopiedClip] = useState<string | null>(null);

    // Reproducción embebida (HLS vía ffmpeg).
    const videoRef = useRef<HTMLVideoElement | null>(null);
    const hlsRef = useRef<any>(null);
    const sessionRef = useRef<string | null>(null);
    const [playOpen, setPlayOpen] = useState(false);
    const [playLoading, setPlayLoading] = useState(false);
    const [playError, setPlayError] = useState<string | null>(null);

    const cleanupPlayback = useCallback(() => {
        if (hlsRef.current) { try { hlsRef.current.destroy(); } catch { /* */ } hlsRef.current = null; }
        const sid = sessionRef.current;
        if (sid) {
            sessionRef.current = null;
            fetch(`/api/nvr/play/${sid}`, { method: "DELETE", keepalive: true }).catch(() => { /* */ });
        }
        setPlayLoading(false);
    }, []);

    const base = fechaCancelacion ? new Date(fechaCancelacion) : null;
    const start = base ? new Date(base.getTime() - windowMinutes * 60_000) : null;
    const end = base ? new Date(base.getTime() + windowMinutes * 60_000) : null;

    // Limpia ffmpeg/HLS al desmontar.
    useEffect(() => () => cleanupPlayback(), [cleanupPlayback]);

    // Reset y carga del NVR al abrir.
    useEffect(() => {
        if (!isOpen) {
            setNvr(null); setClips([]); setSearched(false); setSearchError(null);
            cleanupPlayback(); setPlayOpen(false); setPlayError(null);
            return;
        }
        if (!idTienda) return;
        setLoadingNvr(true);
        fetch(`/api/nvr/by-store?idTienda=${idTienda}`)
            .then((r) => r.json())
            .then((d) => setNvr(d?.nvr ?? null))
            .catch(() => setNvr(null))
            .finally(() => setLoadingNvr(false));
    }, [isOpen, idTienda]);

    const rtspUrl = useCallback(() => {
        if (!nvr || !start || !end) return "";
        const auth = nvr.Usuario ? `${nvr.Usuario}:${nvr.Passwd ?? ""}@` : "";
        return `rtsp://${auth}${nvr.IP}:554/cam/playback?channel=${channel}&starttime=${dahuaStamp(start)}&endtime=${dahuaStamp(end)}`;
    }, [nvr, start, end, channel]);

    const handleCopy = async () => {
        const url = rtspUrl();
        if (!url) return;
        try { await navigator.clipboard.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 1800); } catch { /* */ }
    };

    // Descarga un playlist .m3u con el stream RTSP. VLC queda asociado a .m3u al
    // instalarse, así que abrir el archivo descargado lanza VLC y reproduce —
    // mucho más confiable que un enlace rtsp:// (que el navegador bloquea).
    const downloadPlaylist = (url: string, name: string) => {
        if (!url) return;
        const safe = name.replace(/[^\w.-]/g, "_");
        const content = `#EXTM3U\n#EXTINF:-1,${name}\n${url}\n`;
        const blob = new Blob([content], { type: "audio/x-mpegurl" });
        const href = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = href;
        a.download = `${safe || "grabacion"}.m3u`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(href), 2000);
    };

    const playInVlc = () => downloadPlaylist(rtspUrl(), `grabacion_${folio || "evento"}`);

    // ---- Reproducción embebida (HLS) ----
    const stopEmbedded = () => {
        cleanupPlayback();
        setPlayOpen(false);
        setPlayError(null);
    };

    // Espera a que ffmpeg genere el primer playlist (warmup ~2s) antes de entregárselo
    // a hls.js. Evita el 404 inicial (que hls.js no reintenta) y permite mostrar errores.
    const waitForPlaylist = async (url: string, session: string): Promise<void> => {
        const deadline = Date.now() + 30000;
        while (Date.now() < deadline) {
            if (sessionRef.current !== session) throw new Error("__cancelled__");
            try {
                const m = await fetch(url, { cache: "no-store" });
                if (m.ok) return;
            } catch { /* red intermitente */ }
            try {
                const st = await (await fetch(`/api/nvr/play/${session}`)).json();
                if (st?.error) throw new Error(st.error);
            } catch (e: any) {
                if (e?.message && e.message !== "Failed to fetch") throw e;
            }
            await new Promise((r) => setTimeout(r, 800));
        }
        throw new Error("El NVR no entregó video en esta ventana (¿hay grabación en esa cámara/horario?).");
    };

    const playEmbedded = async () => {
        if (!nvr || !start || !end) return;
        cleanupPlayback();
        setPlayOpen(true);
        setPlayError(null);
        setPlayLoading(true);
        try {
            const res = await fetch(`/api/nvr/${nvr.IdNVR}/play`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    channel,
                    start: `${dateStr(start)} ${timeStr(start)}`,
                    end: `${dateStr(end)} ${timeStr(end)}`,
                }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || "No se pudo iniciar la reproducción");
            sessionRef.current = data.session;

            // Esperar a que el playlist exista (warmup de ffmpeg).
            await waitForPlaylist(data.url, data.session);
            if (sessionRef.current !== data.session) return;

            const video = videoRef.current;
            if (!video) return;
            const Hls = (await import("hls.js")).default;

            if (Hls.isSupported()) {
                const hls = new Hls();
                hlsRef.current = hls;
                hls.loadSource(data.url);
                hls.attachMedia(video);
                hls.on(Hls.Events.MANIFEST_PARSED, () => { setPlayLoading(false); video.play().catch(() => { /* */ }); });
                hls.on(Hls.Events.ERROR, (_evt: any, d: any) => {
                    if (!d?.fatal) return;
                    if (d.type === Hls.ErrorTypes.MEDIA_ERROR) { try { hls.recoverMediaError(); } catch { /* */ } }
                    else if (d.type === Hls.ErrorTypes.NETWORK_ERROR) { try { hls.startLoad(); } catch { /* */ } }
                    else { setPlayError("Error de reproducción."); setPlayLoading(false); cleanupPlayback(); }
                });
            } else if (video.canPlayType("application/vnd.apple.mpegurl")) {
                video.src = data.url;
                video.addEventListener("loadeddata", () => setPlayLoading(false), { once: true });
                video.play().catch(() => { /* */ });
            } else {
                throw new Error("Tu navegador no soporta HLS.");
            }
            setPlayLoading(false);
        } catch (e: any) {
            if (e?.message === "__cancelled__") return;
            setPlayError(e.message);
            setPlayLoading(false);
            cleanupPlayback();
        }
    };

    const clipRtsp = (clip: DahuaClip): string => {
        if (!nvr) return "";
        const auth = nvr.Usuario ? `${nvr.Usuario}:${nvr.Passwd ?? ""}@` : "";
        return `rtsp://${auth}${nvr.IP}:554/cam/playback?channel=${clip.channel || channel}&starttime=${clip.startTime.replace(/[-: ]/g, "_")}&endtime=${clip.endTime.replace(/[-: ]/g, "_")}`;
    };

    const copyClip = async (clip: DahuaClip) => {
        try { await navigator.clipboard.writeText(clipRtsp(clip)); setCopiedClip(clip.filePath); setTimeout(() => setCopiedClip(null), 1800); } catch { /* */ }
    };

    const searchClips = async () => {
        if (!nvr || !start || !end) return;
        setSearching(true); setSearchError(null); setSearched(true); setClips([]);
        try {
            // Si la ventana cruza medianoche, acotamos al final del día de inicio.
            const sameDay = dateStr(start) === dateStr(end);
            const qs = new URLSearchParams({
                channel: String(channel),
                date: dateStr(start),
                from: timeStr(start),
                to: sameDay ? timeStr(end) : "23:59:59",
            });
            const res = await fetch(`/api/nvr/${nvr.IdNVR}/recordings?${qs}`);
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || "Error al consultar el NVR");
            setClips(Array.isArray(data.clips) ? data.clips : []);
        } catch (e: any) {
            setSearchError(e.message);
        } finally {
            setSearching(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[11050] flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-sm">
            <div className="bg-white shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col border border-slate-200">
                {/* Header */}
                <div className="flex items-center justify-between px-5 py-4 bg-[#4050B4] text-white shrink-0">
                    <div className="flex items-center gap-3">
                        <Video size={20} />
                        <div>
                            <h3 className="font-black text-sm uppercase tracking-widest leading-none">Ver grabación</h3>
                            <p className="text-[11px] text-white/70 mt-1">
                                {storeName || "Sucursal"} {folio ? `• Folio ${folio}` : ""}
                            </p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-1.5 hover:bg-white/10 transition-colors">
                        <X size={20} />
                    </button>
                </div>

                {/* Body */}
                <div className="flex-1 overflow-auto p-5 space-y-4">
                    {/* Ventana de tiempo */}
                    <div className="flex items-center gap-2 text-sm text-slate-600 bg-slate-50 border border-slate-200 px-4 py-3">
                        <Clock size={16} className="text-slate-400 shrink-0" />
                        {base && start && end ? (
                            <span>
                                Evento: <strong>{base.toLocaleString("es-MX")}</strong>
                                <span className="text-slate-400"> · ventana </span>
                                <strong>{timeStr(start)}</strong> – <strong>{timeStr(end)}</strong>
                                <span className="text-slate-400"> (±{windowMinutes} min)</span>
                            </span>
                        ) : (
                            <span className="text-slate-400">Sin fecha de cancelación.</span>
                        )}
                    </div>

                    {/* Datos de la cancelación (compacto) */}
                    <div className="border border-slate-200 text-[11px] leading-tight">
                        <div className="px-3 py-1.5 border-b border-slate-100">
                            <span className="text-[9px] font-black uppercase tracking-wider text-slate-400 mr-1.5">Producto</span>
                            <span className="font-bold text-slate-800">{producto || "—"}</span>
                        </div>
                        <div className="flex flex-wrap divide-x divide-slate-100">
                            {[
                                { l: "Cant", v: typeof cantidad === "number" ? String(cantidad) : "—" },
                                { l: "Precio", v: fmtCurrency(precio) },
                                { l: "Importe", v: fmtCurrency(total), cls: "text-rose-600" },
                                { l: "Cajero", v: cajero || "—" },
                                { l: "Supervisor", v: supervisor || "—", cls: "italic" },
                            ].map((f) => (
                                <div key={f.l} className="px-3 py-1.5 flex-1 min-w-[90px]">
                                    <span className="block text-[9px] font-black uppercase tracking-wider text-slate-400">{f.l}</span>
                                    <span className={`font-bold text-slate-800 ${f.cls ?? ""}`}>{f.v}</span>
                                </div>
                            ))}
                        </div>
                    </div>

                    {loadingNvr ? (
                        <div className="p-8 text-center text-slate-400">
                            <Loader2 className="mx-auto mb-2 animate-spin" size={22} /> Buscando NVR de la sucursal…
                        </div>
                    ) : !nvr ? (
                        <div className="flex gap-3 bg-amber-50 border border-amber-200 p-4 text-sm text-amber-800">
                            <AlertTriangle size={18} className="shrink-0 mt-0.5" />
                            <div>
                                No hay un NVR activo configurado para esta sucursal.{" "}
                                <a href="/dashboard/videos/nvrs" className="font-bold underline" target="_blank" rel="noreferrer">
                                    Configúralo en Videos → NVR&apos;s
                                </a>.
                            </div>
                        </div>
                    ) : (
                        <>
                            {/* NVR + canal */}
                            <div className="flex items-center justify-between gap-3 flex-wrap border border-slate-200 p-4">
                                <div>
                                    <div className="font-black text-slate-800">{nvr.Descripcion || nvr.Tienda}</div>
                                    <div className="text-sm text-slate-500 font-mono">{nvr.IP}</div>
                                </div>
                                <div className="flex items-end gap-3">
                                    <div>
                                        <label className="block text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1">Cámara</label>
                                        <input
                                            type="number" min={1} value={channel}
                                            onChange={(e) => setChannel(Math.max(1, Number(e.target.value) || 1))}
                                            className="w-20 border border-slate-300 py-2 px-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#4050B4]/30"
                                        />
                                    </div>
                                    <a
                                        href={`http://${nvr.IP}`} target="_blank" rel="noopener noreferrer"
                                        className="flex items-center gap-2 px-4 py-2.5 border border-slate-200 text-slate-600 text-xs font-black uppercase tracking-widest hover:bg-slate-50 transition-all"
                                    >
                                        <ExternalLink size={14} /> Web del equipo
                                    </a>
                                </div>
                            </div>

                            {/* Reproducir / RTSP */}
                            <div className="flex flex-wrap items-center gap-2">
                                <button
                                    onClick={playEmbedded}
                                    disabled={playLoading}
                                    className="flex items-center gap-2 px-5 py-3 bg-[#4050B4] text-white text-xs font-black uppercase tracking-widest hover:bg-[#344199] transition-all disabled:opacity-60"
                                    title="Reproduce la ventana del evento aquí mismo"
                                >
                                    {playLoading ? <Loader2 size={15} className="animate-spin" /> : <MonitorPlay size={15} />}
                                    Reproducir aquí
                                </button>
                                <button
                                    onClick={playInVlc}
                                    className="flex items-center gap-2 px-4 py-3 border border-slate-200 text-slate-600 text-xs font-bold hover:bg-slate-50 transition-all"
                                    title="Descarga un playlist .m3u para abrir en VLC"
                                >
                                    <Play size={14} /> VLC
                                </button>
                                <button
                                    onClick={handleCopy}
                                    className="flex items-center gap-2 px-4 py-3 border border-slate-200 text-slate-600 text-xs font-bold hover:bg-slate-50 transition-all"
                                >
                                    {copied ? <Check size={14} className="text-emerald-600" /> : <Copy size={14} />}
                                    {copied ? "Copiado" : "Copiar RTSP"}
                                </button>
                                <button
                                    onClick={searchClips}
                                    disabled={searching}
                                    className="flex items-center gap-2 px-4 py-3 border border-slate-200 text-slate-600 text-xs font-bold hover:bg-slate-50 transition-all disabled:opacity-50"
                                >
                                    {searching ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />}
                                    Buscar clips
                                </button>
                            </div>

                            {/* Reproductor embebido */}
                            {playOpen && (
                                <div className="relative bg-black border border-slate-800">
                                    <video
                                        ref={videoRef}
                                        controls
                                        playsInline
                                        className="w-full max-h-[50vh] bg-black"
                                    />
                                    {playLoading && !playError && (
                                        <div className="absolute inset-0 flex flex-col items-center justify-center text-white/80 gap-2 pointer-events-none">
                                            <Loader2 size={28} className="animate-spin" />
                                            <span className="text-xs">Iniciando transcodificación…</span>
                                        </div>
                                    )}
                                    {playError && (
                                        <div className="absolute inset-0 flex items-center justify-center p-6 text-center bg-black/80">
                                            <div className="flex flex-col items-center gap-2 text-rose-300 text-sm">
                                                <AlertTriangle size={24} />
                                                {playError}
                                            </div>
                                        </div>
                                    )}
                                    <button
                                        onClick={stopEmbedded}
                                        className="absolute top-2 right-2 flex items-center gap-1.5 px-2.5 py-1.5 bg-black/60 text-white text-xs font-bold hover:bg-black/80 transition-all"
                                    >
                                        <Square size={12} /> Detener
                                    </button>
                                </div>
                            )}

                            <p className="text-[11px] text-slate-400 -mt-1">
                                &quot;Reproducir aquí&quot; transcodifica el video del NVR en el servidor (ffmpeg) y lo muestra en el navegador.
                                El servidor debe tener alcance de red al NVR. &quot;VLC&quot; descarga un <code>.m3u</code> como alternativa.
                            </p>

                            {/* RTSP visible */}
                            <code className="block bg-slate-50 border border-slate-200 p-3 text-[11px] font-mono break-all text-slate-600">
                                {rtspUrl()}
                            </code>

                            {/* Resultados de clips */}
                            {searched && (
                                <div className="border border-slate-200">
                                    <div className="px-4 py-2.5 border-b border-slate-200 text-[11px] font-black uppercase tracking-widest text-slate-500">
                                        Clips en la ventana {!searching && !searchError ? `· ${clips.length}` : ""}
                                    </div>
                                    {searching ? (
                                        <div className="p-6 text-center text-slate-400 text-sm">
                                            <Loader2 className="mx-auto mb-2 animate-spin" size={20} /> Consultando el NVR…
                                        </div>
                                    ) : searchError ? (
                                        <div className="flex gap-2 m-3 bg-red-50 border border-red-200 p-3 text-sm text-red-700">
                                            <AlertTriangle size={16} className="shrink-0 mt-0.5" /> {searchError}
                                        </div>
                                    ) : clips.length === 0 ? (
                                        <div className="p-6 text-center text-slate-400 text-sm">
                                            No se encontraron clips en esa ventana. Prueba el botón Reproducir (VLC) o cambia de cámara.
                                        </div>
                                    ) : (
                                        <div className="divide-y divide-slate-100 max-h-64 overflow-y-auto">
                                            {clips.map((clip) => (
                                                <div key={clip.filePath} className="flex items-center justify-between gap-3 px-4 py-2.5 hover:bg-slate-50">
                                                    <div className="text-sm">
                                                        <div className="font-semibold text-slate-700">{clip.startTime?.slice(11)} – {clip.endTime?.slice(11)}</div>
                                                        <div className="text-xs text-slate-400">Canal {clip.channel} · {fmtBytes(clip.length)}</div>
                                                    </div>
                                                    <div className="flex items-center gap-1.5">
                                                        <button onClick={() => downloadPlaylist(clipRtsp(clip), `clip_${clip.startTime.replace(/[^\w]/g, "_")}`)} className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-bold text-[#4050B4] border border-[#4050B4]/30 hover:bg-[#4050B4]/10 transition-all" title="Reproducir en VLC (.m3u)">
                                                            <Play size={13} /> Ver
                                                        </button>
                                                        <button onClick={() => copyClip(clip)} className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-bold text-slate-500 border border-slate-200 hover:bg-slate-100 transition-all">
                                                            {copiedClip === clip.filePath ? <Check size={13} className="text-emerald-600" /> : <Copy size={13} />} RTSP
                                                        </button>
                                                        <a href={`/api/nvr/${nvr.IdNVR}/recordings/download?path=${encodeURIComponent(clip.filePath)}`} className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-bold text-white bg-[#4050B4] hover:bg-[#344199] transition-all">
                                                            <Download size={13} /> Descargar
                                                        </a>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}
