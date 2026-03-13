"use client";

import React, { useState, useEffect } from "react";
// Removed unused Card imports
import { ChevronDown, Check, X, Map as MapIcon, RotateCcw, Footprints } from "lucide-react";
import { cn } from "@/lib/utils";
import dynamic from "next/dynamic";

const RouteMap = dynamic(() => import("@/components/dashboard/RouteMap"), {
    ssr: false,
    loading: () => <div className="h-[500px] w-full bg-slate-100 animate-pulse rounded-xl flex items-center justify-center text-slate-400">Cargando Mapa...</div>
});

interface Store {
    IdTienda: number;
    Tienda: string;
    Lat: number;
    Lng: number;
}

interface Point {
    lat: number;
    lng: number;
    name: string;
}

export default function RutasPage() {
    const [stores, setStores] = useState<Store[]>([]);
    const [loading, setLoading] = useState(true);
    const [origin, setOrigin] = useState<number | "">("");
    const [destinations, setDestinations] = useState<number[]>([]);
    const [isOriginOpen, setIsOriginOpen] = useState(false);
    const [isDestOpen, setIsDestOpen] = useState(false);
    const [optimizedRoute, setOptimizedRoute] = useState<Point[]>([]);
    const [isProcessing, setIsProcessing] = useState(false);
    const [metrics, setMetrics] = useState<{ distance: number; duration: number } | null>(null);

    useEffect(() => {
        const fetchStores = async () => {
            try {
                const response = await fetch("/api/stores");
                const data = await response.json();
                setStores(data);
            } catch (error) {
                console.error("Error fetching stores:", error);
            } finally {
                setLoading(false);
            }
        };
        fetchStores();
    }, []);

    const toggleDestination = (id: number) => {
        setDestinations(prev =>
            prev.includes(id)
                ? prev.filter(d => d !== id)
                : [...prev, id]
        );
        setOptimizedRoute([]); // Reset route when destinations change
        setMetrics(null);
    };

    const calculateDistance = (p1: Point, p2: Point) => {
        const R = 6371; // Earth's radius in km
        const dLat = (p2.lat - p1.lat) * Math.PI / 180;
        const dLon = (p2.lng - p1.lng) * Math.PI / 180;
        const a =
            Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(p1.lat * Math.PI / 180) * Math.cos(p2.lat * Math.PI / 180) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return R * c;
    };

    const processRoute = () => {
        if (!origin || destinations.length === 0) return;

        setIsProcessing(true);
        setMetrics(null);
        setTimeout(() => {
            const originStore = stores.find(s => s.IdTienda === origin)!;

            // Check if user wants to return to origin (if origin is in destinations)
            const shouldReturn = destinations.includes(originStore.IdTienda);

            // Filter destinations to exclude origin if it's there (we handle it manually)
            const destStores = stores.filter(s => destinations.includes(s.IdTienda) && s.IdTienda !== originStore.IdTienda);

            // Convert to Points
            const startPoint: Point = { lat: originStore.Lat, lng: originStore.Lng, name: originStore.Tienda };
            const remaining: Point[] = destStores.map(s => ({ lat: s.Lat, lng: s.Lng, name: s.Tienda }));

            // Nearest Neighbor Algorithm
            const route: Point[] = [startPoint];
            let current = startPoint;

            while (remaining.length > 0) {
                let nearestIdx = 0;
                let minDistance = calculateDistance(current, remaining[0]);

                for (let i = 1; i < remaining.length; i++) {
                    const dist = calculateDistance(current, remaining[i]);
                    if (dist < minDistance) {
                        minDistance = dist;
                        nearestIdx = i;
                    }
                }

                current = remaining.splice(nearestIdx, 1)[0];
                route.push(current);
            }

            // If return to origin is requested, add it at the end
            if (shouldReturn) {
                route.push({ ...startPoint, name: `${startPoint.name} (Regreso)` });
            }

            setOptimizedRoute(route);
            setIsProcessing(false);
        }, 800);
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-full">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#4050B4]"></div>
            </div>
        );
    }

    const selectedOriginStore = stores.find(s => s.IdTienda === origin);
    const originPoint: Point | null = selectedOriginStore ? { lat: selectedOriginStore.Lat, lng: selectedOriginStore.Lng, name: selectedOriginStore.Tienda } : null;
    const destPoints: Point[] = stores.filter(s => destinations.includes(s.IdTienda)).map(s => ({ lat: s.Lat, lng: s.Lng, name: s.Tienda }));

    return (
        <div className="p-6 space-y-6 max-w-5xl mx-auto">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800 tracking-tight">Optimización de Rutas Logísticas</h1>
                    <p className="text-slate-500 text-sm">Calcula el trayecto más eficiente entre sucursales.</p>
                </div>
                {optimizedRoute.length > 0 && (
                    <button
                        onClick={() => { setOrigin(""); setDestinations([]); setOptimizedRoute([]); setMetrics(null); }}
                        className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-slate-600 hover:text-[#4050B4] transition-colors"
                    >
                        <RotateCcw size={16} /> Limpiar Todo
                    </button>
                )}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-1 space-y-6">
                    <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-6">
                        {/* Sucursal Origen */}
                        <div className="space-y-2">
                            <label className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                                <div className="w-2 h-2 rounded-full bg-blue-500" /> Origen
                            </label>
                            <div className="relative">
                                <button
                                    onClick={() => setIsOriginOpen(!isOriginOpen)}
                                    className="w-full flex items-center justify-between px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl hover:border-[#4050B4] transition-all text-left group"
                                >
                                    <span className={cn("text-sm transition-colors", origin ? "text-slate-900 font-medium" : "text-slate-400")}>
                                        {selectedOriginStore ? selectedOriginStore.Tienda : "Seleccionar Origen..."}
                                    </span>
                                    <ChevronDown className={cn("h-4 w-4 text-slate-400 transition-transform group-hover:text-[#4050B4]", isOriginOpen && "rotate-180")} />
                                </button>
                                {isOriginOpen && (
                                    <div className="absolute z-50 w-full mt-2 bg-white border border-slate-200 rounded-xl shadow-2xl max-h-60 overflow-y-auto anima-in zoom-in duration-200">
                                        {stores.map((store) => (
                                            <button
                                                key={store.IdTienda}
                                                onClick={() => { setOrigin(store.IdTienda); setIsOriginOpen(false); setOptimizedRoute([]); setMetrics(null); }}
                                                className={cn(
                                                    "w-full px-4 py-3 text-left text-sm hover:bg-slate-50 transition-colors flex items-center justify-between",
                                                    origin === store.IdTienda ? "text-[#4050B4] font-bold bg-blue-50/50" : "text-slate-700"
                                                )}
                                            >
                                                {store.Tienda}
                                                {origin === store.IdTienda && <Check className="h-4 w-4" />}
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Sucursal Destino */}
                        <div className="space-y-2">
                            <label className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                                <div className="w-2 h-2 rounded-full bg-slate-300" /> Paradas de Destino
                            </label>
                            <div className="relative">
                                <button
                                    onClick={() => setIsDestOpen(!isDestOpen)}
                                    className="w-full flex items-center justify-between px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl hover:border-[#4050B4] transition-all text-left group"
                                >
                                    <span className={cn("text-sm transition-colors", destinations.length > 0 ? "text-slate-900 font-medium" : "text-slate-400")}>
                                        {destinations.length > 0
                                            ? `${destinations.length} seleccionada${destinations.length > 1 ? "s" : ""}`
                                            : "Seleccionar Paradas..."}
                                    </span>
                                    <ChevronDown className={cn("h-4 w-4 text-slate-400 transition-transform group-hover:text-[#4050B4]", isDestOpen && "rotate-180")} />
                                </button>
                                {isDestOpen && (
                                    <div className="absolute z-50 w-full mt-2 bg-white border border-slate-200 rounded-xl shadow-2xl max-h-60 overflow-y-auto anima-in zoom-in duration-200">
                                        {stores.map((store) => (
                                            <button
                                                key={store.IdTienda}
                                                onClick={() => toggleDestination(store.IdTienda)}
                                                className={cn(
                                                    "w-full px-4 py-3 text-left text-sm hover:bg-slate-50 transition-colors flex items-center justify-between",
                                                    destinations.includes(store.IdTienda) ? "text-[#4050B4] font-bold bg-blue-50/50" : "text-slate-700"
                                                )}
                                            >
                                                <div className="flex items-center gap-3">
                                                    <div className={cn(
                                                        "w-5 h-5 border rounded-lg flex items-center justify-center transition-all",
                                                        destinations.includes(store.IdTienda) ? "bg-[#4050B4] border-[#4050B4]" : "border-slate-300 bg-white"
                                                    )}>
                                                        {destinations.includes(store.IdTienda) && <Check className="h-3.5 w-3.5 text-white" />}
                                                    </div>
                                                    {store.Tienda}
                                                </div>
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>

                        <button
                            onClick={processRoute}
                            disabled={!origin || destinations.length === 0 || isProcessing}
                            className="w-full mt-4 flex items-center justify-center gap-2 px-6 py-3.5 bg-[#4050B4] text-white font-bold rounded-xl shadow-xl shadow-blue-500/20 hover:bg-[#324096] hover:scale-[1.02] transition-all disabled:opacity-50 disabled:grayscale disabled:scale-100"
                        >
                            {isProcessing ? (
                                <div className="flex items-center gap-2">
                                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                    <span>Calculando...</span>
                                </div>
                            ) : (
                                <>
                                    <MapIcon size={18} />
                                    <span>Calcular Ruta Óptima</span>
                                </>
                            )}
                        </button>
                    </div>

                    {/* Route Details Breakdown */}
                    {optimizedRoute.length > 0 && (
                        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                            <h3 className="text-sm font-bold text-slate-800 mb-4 flex items-center gap-2">
                                <Footprints size={16} className="text-[#4050B4]" /> Secuencia de Visitas
                            </h3>
                            <div className="space-y-4">
                                {optimizedRoute.map((point, idx) => (
                                    <div key={idx} className="relative flex items-center gap-3">
                                        {idx < optimizedRoute.length - 1 && (
                                            <div className="absolute left-3 top-6 w-0.5 h-6 bg-slate-100" />
                                        )}
                                        <div className={cn(
                                            "w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0",
                                            idx === 0 ? "bg-blue-500 text-white" : "bg-slate-100 text-slate-500"
                                        )}>
                                            {idx === 0 ? "O" : idx}
                                        </div>
                                        <span className={cn("text-xs font-medium truncate", idx === 0 ? "text-blue-600" : "text-slate-600")}>
                                            {point.name}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                <div className="lg:col-span-2 space-y-6">
                    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden min-h-[500px]">
                        <RouteMap
                            origin={originPoint}
                            destinations={destPoints}
                            optimizedRoute={optimizedRoute}
                            onRouteCalculated={(dist, dur) => setMetrics({ distance: dist, duration: dur })}
                        />
                    </div>

                    {/* Metrics Display */}
                    {metrics && (
                        <div className="grid grid-cols-2 gap-6">
                            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4">
                                <div className="w-12 h-12 bg-blue-50 rounded-xl flex items-center justify-center text-2xl">📏</div>
                                <div>
                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Distancia Total</p>
                                    <p className="text-xl font-bold text-slate-800">{(metrics.distance / 1000).toFixed(1)} km</p>
                                </div>
                            </div>
                            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4">
                                <div className="w-12 h-12 bg-blue-50 rounded-xl flex items-center justify-center text-2xl">⏱️</div>
                                <div>
                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Tiempo Estimado</p>
                                    <p className="text-xl font-bold text-slate-800">{Math.round(metrics.duration / 60)} min</p>
                                </div>
                            </div>
                        </div>
                    )}

                    <div className="bg-blue-50/50 border border-blue-100 p-6 rounded-2xl">
                        <div className="flex gap-4">
                            <div className="w-10 h-10 bg-white rounded-xl shadow-sm flex items-center justify-center shrink-0">
                                🛣️
                            </div>
                            <div>
                                <h4 className="text-sm font-bold text-blue-900">Sobre la optimización</h4>
                                <p className="text-xs text-blue-800/70 mt-1 leading-relaxed">
                                    El sistema utiliza un algoritmo de <strong>Vecino más Cercano</strong> para determinar la secuencia que minimiza el desplazamiento total.
                                    Recuerda que este cálculo se basa en distancias geográficas directas.
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
