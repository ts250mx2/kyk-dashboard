"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { AgentDataView } from "@/components/agent-data-view";

interface ShareData {
    question: string;
    answer: string;
    viz: "table" | "bar" | "line" | "pie" | "area" | "treemap" | null;
    rows: Record<string, any>[];
    insights: string[];
    tool: string;
    fechaCreacion: string;
}

type LoadState = "loading" | "ok" | "notfound" | "expired" | "error";

export default function SharePage() {
    const params = useParams();
    const uuid = Array.isArray(params?.uuid) ? params.uuid[0] : params?.uuid;
    const [data, setData] = useState<ShareData | null>(null);
    const [state, setState] = useState<LoadState>("loading");

    useEffect(() => {
        if (!uuid) return;
        (async () => {
            try {
                const r = await fetch(`/api/share/${uuid}`);
                if (r.status === 404) return setState("notfound");
                if (r.status === 410) return setState("expired");
                if (!r.ok) return setState("error");
                setData(await r.json());
                setState("ok");
            } catch {
                setState("error");
            }
        })();
    }, [uuid]);

    return (
        <div className="min-h-screen bg-slate-50">
            {/* Encabezado */}
            <header className="bg-white border-b border-slate-100">
                <div className="max-w-3xl mx-auto px-4 py-3 flex items-center gap-2">
                    <span className="text-xl">🧀</span>
                    <span className="font-black tracking-tight text-slate-800">Kesito</span>
                    <span className="text-[11px] text-slate-400 font-medium ml-1">· reporte</span>
                </div>
            </header>

            <main className="max-w-3xl mx-auto px-4 py-6 space-y-5">
                {state === "loading" && (
                    <div className="space-y-4 animate-pulse">
                        <div className="h-6 w-3/4 bg-slate-200 rounded-lg" />
                        <div className="h-4 w-full bg-slate-100 rounded" />
                        <div className="h-[280px] bg-gradient-to-b from-slate-100 to-slate-50 rounded-2xl" />
                    </div>
                )}

                {(state === "notfound" || state === "expired" || state === "error") && (
                    <div className="bg-white rounded-3xl border border-slate-100 p-8 text-center mt-10">
                        <div className="text-4xl mb-3">{state === "expired" ? "⌛" : "🔍"}</div>
                        <h1 className="text-lg font-black text-slate-700">
                            {state === "expired" ? "Este enlace ya expiró" : state === "notfound" ? "Enlace no encontrado" : "No se pudo cargar el reporte"}
                        </h1>
                        <p className="text-slate-500 font-medium mt-1">
                            {state === "expired"
                                ? "Pídele a Kesito que vuelva a generar el reporte por WhatsApp."
                                : "Verifica el enlace o solicita uno nuevo por WhatsApp."}
                        </p>
                    </div>
                )}

                {state === "ok" && data && (
                    <>
                        {data.question && (
                            <h1 className="text-xl md:text-2xl font-black tracking-tight text-slate-900">{data.question}</h1>
                        )}
                        {data.answer && (
                            <p className="text-[15px] leading-relaxed text-slate-700 font-medium whitespace-pre-line">{data.answer}</p>
                        )}

                        <div className="bg-white rounded-3xl border border-slate-100 p-4 md:p-6">
                            {data.rows && data.rows.length > 0 ? (
                                <AgentDataView data={data.rows} suggestedViz={data.viz ?? undefined} question={data.question} />
                            ) : (
                                <p className="text-slate-400 font-medium py-8 text-center">Sin datos para mostrar.</p>
                            )}
                        </div>

                        {data.insights?.length > 0 && (
                            <div className="bg-white rounded-3xl border border-slate-100 p-5">
                                <h3 className="text-sm font-black uppercase tracking-wider text-slate-500 mb-3">Hallazgos</h3>
                                <ul className="space-y-2">
                                    {data.insights.map((it, i) => (
                                        <li key={i} className="text-slate-700 font-medium flex gap-2"><span className="text-indigo-400">•</span><span>{it}</span></li>
                                    ))}
                                </ul>
                            </div>
                        )}

                        <p className="text-[11px] text-slate-400 text-center pt-2">
                            Generado por Kesito · {new Date(data.fechaCreacion).toLocaleString("es-MX", { dateStyle: "medium", timeStyle: "short" })}
                        </p>
                    </>
                )}
            </main>
        </div>
    );
}
