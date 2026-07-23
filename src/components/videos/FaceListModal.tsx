"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
    X, Loader2, Trash2, Upload, RefreshCcw, UserPlus, Copy, ZoomIn, ImagePlus, Phone, UserX, UserCheck,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface FaceRecord {
    id: number;
    lista: string;
    nombre: string;
    sexo: string;
    telefono: string | null;
    comentario: string | null;
    fechaAlta: string;
}

interface SyncReport {
    idNvr: number;
    nvr: string;
    ok: boolean;
    imported: number;
    added: number;
    removed: number;
    errors: string[];
}

export type FaceListKind = "black" | "white";

type Props = {
    list: FaceListKind;
    onClose: () => void;
};

/** Lado del marco de recorte en px (coincide con w-44/h-44 de Tailwind). */
const FRAME_PX = 176;
/** Lado del JPEG cuadrado que se guarda en SQL y se sube a los NVR's. */
const OUTPUT_PX = 600;
/** Tamaño máximo al normalizar la imagen original en memoria. */
const NORMALIZE_MAX = 1600;
const JPEG_QUALITY = 0.85;
const MIN_ZOOM = 1;
const MAX_ZOOM = 3;

interface ImgDims { w: number; h: number; }
interface Pan { x: number; y: number; }

/** Decodifica el archivo (respetando orientación EXIF) a un canvas normalizado. */
async function fileToCanvas(file: Blob): Promise<HTMLCanvasElement> {
    let bitmap: ImageBitmap;
    try {
        bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
    } catch {
        bitmap = await createImageBitmap(file);
    }
    const scale = Math.min(1, NORMALIZE_MAX / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("No se pudo procesar la imagen");
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    return canvas;
}

/** Escala mínima para que la imagen cubra el marco, multiplicada por el zoom. */
function coverScale(dims: ImgDims, zoom: number): number {
    return Math.max(FRAME_PX / dims.w, FRAME_PX / dims.h) * zoom;
}

/** Limita el paneo para que la imagen siempre cubra el marco completo. */
function clampPan(pan: Pan, dims: ImgDims, zoom: number): Pan {
    const scale = coverScale(dims, zoom);
    const maxX = Math.max(0, (dims.w * scale - FRAME_PX) / 2);
    const maxY = Math.max(0, (dims.h * scale - FRAME_PX) / 2);
    return {
        x: Math.min(maxX, Math.max(-maxX, pan.x)),
        y: Math.min(maxY, Math.max(-maxY, pan.y)),
    };
}

function sexLabel(sex: string) {
    if (sex === "Male") return "Hombre";
    if (sex === "Female") return "Mujer";
    return "—";
}

/** Resumen corto de un reporte de sincronización por NVR. */
function syncSummary(r: SyncReport): string {
    const parts: string[] = [];
    if (r.added) parts.push(`+${r.added} al NVR`);
    if (r.imported) parts.push(`${r.imported} importadas a SQL`);
    if (r.removed) parts.push(`−${r.removed} del NVR`);
    if (parts.length === 0 && r.ok) parts.push("sin cambios");
    return parts.join(" · ");
}

export function FaceListModal({ list, onClose }: Props) {
    const isWhite = list === "white";
    const listName = isWhite ? "lista blanca" : "lista negra";

    const [faces, setFaces] = useState<FaceRecord[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Formulario de alta.
    const [name, setName] = useState("");
    const [phone, setPhone] = useState("");
    const [sex, setSex] = useState<"Male" | "Female">("Female");
    const [saving, setSaving] = useState(false);
    const [formError, setFormError] = useState<string | null>(null);
    const [deleting, setDeleting] = useState<number | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Recortador: imagen normalizada + posición/zoom del encuadre.
    const [imgSrc, setImgSrc] = useState<string | null>(null);
    const [imgDims, setImgDims] = useState<ImgDims | null>(null);
    const [zoom, setZoom] = useState(1);
    const [pan, setPan] = useState<Pan>({ x: 0, y: 0 });
    const [dragOver, setDragOver] = useState(false);
    const sourceCanvasRef = useRef<HTMLCanvasElement | null>(null);
    const dragRef = useRef<{ startX: number; startY: number; panX: number; panY: number; active: boolean }>({
        startX: 0, startY: 0, panX: 0, panY: 0, active: false,
    });

    // Sincronización a NVR's.
    const [syncing, setSyncing] = useState(false);
    const [syncReports, setSyncReports] = useState<SyncReport[] | null>(null);
    const [syncError, setSyncError] = useState<string | null>(null);

    const fetchData = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const res = await fetch(`/api/faces?type=${list}`);
            const json = await res.json();
            if (!res.ok) throw new Error(json.error || "Error al consultar la lista");
            setFaces(Array.isArray(json.faces) ? json.faces : []);
        } catch (e: any) {
            setError(e.message);
            setFaces([]);
        } finally {
            setLoading(false);
        }
    }, [list]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const handleFile = useCallback(async (file: File | Blob | null) => {
        setFormError(null);
        if (!file) return;
        try {
            const canvas = await fileToCanvas(file);
            sourceCanvasRef.current = canvas;
            setImgDims({ w: canvas.width, h: canvas.height });
            setImgSrc(canvas.toDataURL("image/jpeg", 0.9));
            setZoom(1);
            setPan({ x: 0, y: 0 });
        } catch {
            setFormError("No se pudo leer la imagen; usa un archivo JPG o PNG.");
        }
    }, []);

    // Pegar imagen desde el portapapeles (ej. Herramienta Recortes con Ctrl+V).
    useEffect(() => {
        const onPaste = (e: ClipboardEvent) => {
            const items = e.clipboardData?.items;
            if (!items) return;
            for (const item of items) {
                if (item.type.startsWith("image/")) {
                    const file = item.getAsFile();
                    if (file) {
                        e.preventDefault();
                        handleFile(file);
                    }
                    return;
                }
            }
        };
        window.addEventListener("paste", onPaste);
        return () => window.removeEventListener("paste", onPaste);
    }, [handleFile]);

    /** Exporta el área visible del marco como JPEG cuadrado. */
    const exportCrop = (): Promise<Blob> => {
        return new Promise((resolve, reject) => {
            const src = sourceCanvasRef.current;
            const dims = imgDims;
            if (!src || !dims) return reject(new Error("Selecciona la foto del rostro."));
            const scale = coverScale(dims, zoom);
            const side = FRAME_PX / scale;
            let sx = dims.w / 2 - pan.x / scale - side / 2;
            let sy = dims.h / 2 - pan.y / scale - side / 2;
            sx = Math.min(Math.max(0, sx), Math.max(0, dims.w - side));
            sy = Math.min(Math.max(0, sy), Math.max(0, dims.h - side));
            const out = document.createElement("canvas");
            out.width = OUTPUT_PX;
            out.height = OUTPUT_PX;
            const ctx = out.getContext("2d");
            if (!ctx) return reject(new Error("No se pudo procesar la imagen"));
            ctx.drawImage(src, sx, sy, side, side, 0, 0, OUTPUT_PX, OUTPUT_PX);
            out.toBlob(
                (blob) => (blob ? resolve(blob) : reject(new Error("No se pudo convertir la imagen a JPEG"))),
                "image/jpeg",
                JPEG_QUALITY
            );
        });
    };

    const resetForm = () => {
        setName("");
        setPhone("");
        setImgSrc(null);
        setImgDims(null);
        sourceCanvasRef.current = null;
        setZoom(1);
        setPan({ x: 0, y: 0 });
        if (fileInputRef.current) fileInputRef.current.value = "";
    };

    const handleAdd = async () => {
        if (!name.trim()) {
            setFormError("Escribe el nombre o descripción de la persona.");
            return;
        }
        if (isWhite && !phone.trim()) {
            setFormError("Escribe el teléfono de la persona.");
            return;
        }
        if (!imgSrc) {
            setFormError("Selecciona o arrastra la foto del rostro.");
            return;
        }
        setSaving(true);
        setFormError(null);
        setSyncReports(null);
        setSyncError(null);
        try {
            const photoBlob = await exportCrop();
            const fd = new FormData();
            fd.append("name", name.trim());
            fd.append("sex", sex);
            fd.append("type", list);
            if (phone.trim()) fd.append("phone", phone.trim());
            fd.append("photo", photoBlob, "face.jpg");
            const res = await fetch("/api/faces", { method: "POST", body: fd });
            const json = await res.json();
            if (!res.ok) throw new Error(json.error || "Error al dar de alta");
            resetForm();
            if (Array.isArray(json.sync)) setSyncReports(json.sync);
            await fetchData();
        } catch (e: any) {
            setFormError(e.message);
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (face: FaceRecord) => {
        if (!confirm(`¿Eliminar a "${face.nombre}" de la ${listName}? Se quitará también de los NVR's.`)) return;
        setDeleting(face.id);
        setSyncReports(null);
        setSyncError(null);
        try {
            const res = await fetch(`/api/faces/${face.id}`, { method: "DELETE" });
            const json = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(json.error || "Error al eliminar");
            if (Array.isArray(json.sync)) setSyncReports(json.sync);
            await fetchData();
        } catch (e: any) {
            alert(e.message);
        } finally {
            setDeleting(null);
        }
    };

    const handleSync = async () => {
        setSyncing(true);
        setSyncError(null);
        setSyncReports(null);
        try {
            const res = await fetch("/api/faces/sync", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ type: list }),
            });
            const json = await res.json();
            if (!res.ok) throw new Error(json.error || "Error al sincronizar");
            setSyncReports(json.reports || []);
            await fetchData();
        } catch (e: any) {
            setSyncError(e.message);
        } finally {
            setSyncing(false);
        }
    };

    // ---- Interacción del recortador ----
    const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
        if (!imgSrc) return;
        e.currentTarget.setPointerCapture(e.pointerId);
        dragRef.current = { startX: e.clientX, startY: e.clientY, panX: pan.x, panY: pan.y, active: true };
    };
    const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
        const d = dragRef.current;
        if (!d.active || !imgDims) return;
        const next = { x: d.panX + (e.clientX - d.startX), y: d.panY + (e.clientY - d.startY) };
        setPan(clampPan(next, imgDims, zoom));
    };
    const onPointerUp = () => {
        dragRef.current.active = false;
    };
    const handleZoom = (value: number) => {
        setZoom(value);
        if (imgDims) setPan((prev) => clampPan(prev, imgDims, value));
    };
    const onDrop = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        setDragOver(false);
        const file = e.dataTransfer.files?.[0];
        if (file) handleFile(file);
    };

    // Estilo de la imagen dentro del marco según zoom/paneo.
    const imgStyle = (() => {
        if (!imgDims) return undefined;
        const scale = coverScale(imgDims, zoom);
        const w = imgDims.w * scale;
        const h = imgDims.h * scale;
        return {
            width: w,
            height: h,
            maxWidth: "none" as const,
            left: FRAME_PX / 2 - w / 2 + pan.x,
            top: FRAME_PX / 2 - h / 2 + pan.y,
        };
    })();

    const HeaderIcon = isWhite ? UserCheck : UserX;

    return (
        <div className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <div className="w-full max-w-3xl max-h-[90vh] flex flex-col bg-white dark:bg-slate-800 shadow-2xl border border-slate-200 dark:border-slate-700">
                {/* Header */}
                <div
                    className={cn(
                        "flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-700 text-white",
                        isWhite ? "bg-emerald-700" : "bg-slate-900"
                    )}
                >
                    <div className="flex items-center gap-3">
                        <HeaderIcon size={20} />
                        <div>
                            <h2 className="font-black uppercase tracking-widest text-sm">
                                {isWhite ? "Lista blanca" : "Lista negra"}
                            </h2>
                            <p className="text-[11px] text-white/70 font-medium">
                                Guardada en SQL · se sincroniza a los NVR&apos;s ({faces.length} personas)
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
                    {/* Alta */}
                    <div className="p-6 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/40">
                        <p className="text-xs font-black uppercase tracking-widest text-slate-500 mb-3 flex items-center gap-2">
                            <UserPlus size={14} /> Dar de alta
                        </p>
                        {formError && (
                            <div className="mb-3 px-4 py-2.5 bg-red-50 border border-red-200 text-red-700 text-sm">
                                {formError}
                            </div>
                        )}
                        <div className="flex flex-col sm:flex-row gap-4">
                            {/* Zona de foto: dropzone vacía o recortador con imagen */}
                            <div className="shrink-0 space-y-2">
                                <div
                                    className={cn(
                                        "relative w-44 h-44 overflow-hidden bg-white dark:bg-slate-900 border-2",
                                        imgSrc
                                            ? "border-solid border-slate-300 dark:border-slate-600 cursor-move"
                                            : cn(
                                                "border-dashed cursor-pointer transition-all",
                                                dragOver
                                                    ? "border-[#4050B4] bg-[#4050B4]/5"
                                                    : "border-slate-300 dark:border-slate-600 hover:border-[#4050B4]"
                                            )
                                    )}
                                    style={{ touchAction: "none" }}
                                    onClick={() => !imgSrc && fileInputRef.current?.click()}
                                    onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                                    onDragLeave={() => setDragOver(false)}
                                    onDrop={onDrop}
                                    onPointerDown={onPointerDown}
                                    onPointerMove={onPointerMove}
                                    onPointerUp={onPointerUp}
                                    onPointerCancel={onPointerUp}
                                    title={imgSrc ? "Arrastra para acomodar el rostro" : "Clic, arrastra o pega una imagen aquí"}
                                >
                                    {imgSrc ? (
                                        // eslint-disable-next-line @next/next/no-img-element
                                        <img
                                            src={imgSrc}
                                            alt="Foto"
                                            draggable={false}
                                            className="absolute select-none pointer-events-none"
                                            style={imgStyle}
                                        />
                                    ) : (
                                        <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-400 gap-1.5 px-3 text-center">
                                            <ImagePlus size={22} />
                                            <span className="text-[10px] font-bold uppercase tracking-widest leading-relaxed">
                                                Clic, arrastra<br />o pega (Ctrl+V)
                                            </span>
                                        </div>
                                    )}
                                </div>
                                {imgSrc && (
                                    <>
                                        <div className="flex items-center gap-2">
                                            <ZoomIn size={14} className="text-slate-400 shrink-0" />
                                            <input
                                                type="range"
                                                min={MIN_ZOOM}
                                                max={MAX_ZOOM}
                                                step={0.01}
                                                value={zoom}
                                                onChange={(e) => handleZoom(Number(e.target.value))}
                                                className="w-full accent-[#4050B4]"
                                            />
                                        </div>
                                        <button
                                            onClick={() => fileInputRef.current?.click()}
                                            className="w-full flex items-center justify-center gap-1.5 py-1.5 text-[10px] font-black uppercase tracking-widest text-slate-500 border border-slate-300 dark:border-slate-600 hover:border-[#4050B4] hover:text-[#4050B4] transition-all"
                                        >
                                            <Upload size={12} /> Cambiar foto
                                        </button>
                                    </>
                                )}
                                <input
                                    ref={fileInputRef}
                                    type="file"
                                    accept="image/*"
                                    className="hidden"
                                    onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
                                />
                            </div>

                            <div className="flex-1 space-y-3">
                                <input
                                    type="text"
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    placeholder={
                                        isWhite
                                            ? "Nombre de la persona (ej. Juan Pérez - Proveedor)"
                                            : "Nombre o descripción (ej. Fardera pantalón azul)"
                                    }
                                    maxLength={63}
                                    className="w-full border border-slate-300 dark:border-slate-600 dark:bg-slate-900 py-2.5 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#4050B4]/30"
                                />
                                {isWhite && (
                                    <div className="relative">
                                        <Phone size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                        <input
                                            type="tel"
                                            value={phone}
                                            onChange={(e) => setPhone(e.target.value)}
                                            placeholder="Teléfono (ej. 8112345678) — solo se guarda en SQL"
                                            maxLength={20}
                                            className="w-full border border-slate-300 dark:border-slate-600 dark:bg-slate-900 py-2.5 pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#4050B4]/30"
                                        />
                                    </div>
                                )}
                                <div className="flex gap-3">
                                    <select
                                        value={sex}
                                        onChange={(e) => setSex(e.target.value as "Male" | "Female")}
                                        className="border border-slate-300 dark:border-slate-600 dark:bg-slate-900 py-2.5 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#4050B4]/30"
                                    >
                                        <option value="Female">Mujer</option>
                                        <option value="Male">Hombre</option>
                                    </select>
                                    <button
                                        onClick={handleAdd}
                                        disabled={saving || loading}
                                        className="flex items-center gap-2 px-6 py-2.5 bg-[#4050B4] text-white text-xs font-black uppercase tracking-widest hover:bg-[#344199] transition-all disabled:opacity-50"
                                    >
                                        {saving ? <Loader2 size={14} className="animate-spin" /> : <UserPlus size={14} />}
                                        {saving ? "Guardando..." : "Agregar"}
                                    </button>
                                </div>
                                <p className="text-[11px] text-slate-400">
                                    {imgSrc
                                        ? "Arrastra la foto para centrar el rostro y ajusta el zoom; se guarda el recuadro visible."
                                        : "Suelta una imagen en el recuadro, haz clic para elegir archivo, o pega un recorte con Ctrl+V. El alta se guarda en SQL y se sincroniza a los NVR's."}
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Sincronización */}
                    <div className="px-6 py-3 border-b border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800">
                        <div className="flex items-center justify-between gap-3">
                            <button
                                onClick={handleSync}
                                disabled={syncing || loading}
                                className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-slate-500 hover:text-[#4050B4] transition-all disabled:opacity-40"
                            >
                                {syncing ? <Loader2 size={14} className="animate-spin" /> : <Copy size={14} />}
                                {syncing ? "Sincronizando..." : "Sincronizar NVR's"}
                            </button>
                            <span className="text-[10px] text-slate-400 uppercase tracking-widest hidden sm:block">
                                SQL → NVR&apos;s activos
                            </span>
                        </div>
                        {syncError && (
                            <div className="mt-3 px-4 py-2.5 bg-red-50 border border-red-200 text-red-700 text-sm">
                                {syncError}
                            </div>
                        )}
                        {syncReports && syncReports.length > 0 && (
                            <div className="mt-3 px-4 py-3 bg-slate-50 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-700 text-sm space-y-1.5">
                                {syncReports.map((r) => (
                                    <div key={r.idNvr}>
                                        <p className={cn("font-bold", r.ok ? "text-slate-700 dark:text-slate-200" : "text-red-600")}>
                                            {r.ok ? "✓" : "✗"} {r.nvr}
                                            <span className="font-normal text-slate-400"> — {syncSummary(r) || "con errores"}</span>
                                        </p>
                                        {r.errors.map((err, i) => (
                                            <p key={i} className="text-xs text-red-600 pl-5">{err}</p>
                                        ))}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Listado */}
                    <div className="p-6">
                        {loading ? (
                            <div className="py-12 text-center text-slate-400">
                                <Loader2 size={24} className="mx-auto animate-spin mb-2" />
                                Cargando lista...
                            </div>
                        ) : error ? (
                            <div className="px-4 py-3 bg-red-50 border border-red-200 text-red-700 text-sm">
                                {error}
                            </div>
                        ) : faces.length === 0 ? (
                            <div className="py-12 text-center text-slate-400 text-sm">
                                No hay personas en la {listName}. Da de alta la primera, o usa &quot;Sincronizar NVR&apos;s&quot; para
                                importar lo que ya exista en los equipos.
                            </div>
                        ) : (
                            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                                {faces.map((face) => (
                                    <div
                                        key={face.id}
                                        className="border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900/40 overflow-hidden group"
                                    >
                                        <div className="aspect-square bg-slate-100 dark:bg-slate-900 relative">
                                            {/* eslint-disable-next-line @next/next/no-img-element */}
                                            <img
                                                src={`/api/faces/${face.id}/photo`}
                                                alt={face.nombre}
                                                loading="lazy"
                                                className="w-full h-full object-cover"
                                            />
                                            <button
                                                onClick={() => handleDelete(face)}
                                                disabled={deleting === face.id}
                                                className="absolute top-1.5 right-1.5 p-1.5 bg-white/90 dark:bg-slate-800/90 text-slate-400 hover:text-red-600 transition-all opacity-0 group-hover:opacity-100 disabled:opacity-100"
                                                title="Eliminar (SQL y NVR's)"
                                            >
                                                {deleting === face.id ? (
                                                    <Loader2 size={15} className="animate-spin" />
                                                ) : (
                                                    <Trash2 size={15} />
                                                )}
                                            </button>
                                        </div>
                                        <div className="px-3 py-2">
                                            <p className="text-xs font-bold text-slate-700 dark:text-slate-200 truncate" title={face.nombre}>
                                                {face.nombre}
                                            </p>
                                            <p className="text-[10px] text-slate-400 uppercase tracking-widest">
                                                {sexLabel(face.sexo)}
                                            </p>
                                            {isWhite && face.telefono && (
                                                <p className="flex items-center gap-1 text-[11px] text-slate-500 dark:text-slate-300 mt-0.5">
                                                    <Phone size={11} className="shrink-0" />
                                                    <span className="truncate" title={face.telefono}>{face.telefono}</span>
                                                </p>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
