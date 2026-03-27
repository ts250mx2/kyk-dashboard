"use client";

import React, { useState, useEffect } from "react";
import { ChevronDown, Check, X, Footprints, Plus, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import dynamic from "next/dynamic";

const RouteMap = dynamic(() => import("@/components/dashboard/RouteMap"), {
    ssr: false,
    loading: () => <div className="h-full w-full bg-slate-100 animate-pulse flex items-center justify-center text-slate-400">Cargando Mapa...</div>
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

interface RouteLeg {
    distance: number;
    duration: number;
    durationInTraffic: number;
}

interface RouteState {
    id: string;
    origin: number | "";
    destinations: number[];
    isOriginOpen: boolean;
    isDestOpen: boolean;
    optimizedRoute: Point[];
    isProcessing: boolean;
    metrics: { 
        distance: number; 
        duration: number; // Google Driving Time (Traffic)
        totalCombinedDuration: number; // Driving + Unloading
        legs: RouteLeg[];
        departureStr: string;
        arrivalStr: string;
    } | null;
    encodedPolyline: string | null;
    departureTime: string;
    unloadTimeMins: number;
}

export default function RutasPage() {
    const [stores, setStores] = useState<Store[]>([]);
    const [loading, setLoading] = useState(true);
    const [routes, setRoutes] = useState<RouteState[]>([
        { id: Date.now().toString(), origin: "", destinations: [], isOriginOpen: false, isDestOpen: false, optimizedRoute: [], isProcessing: false, metrics: null, encodedPolyline: null, departureTime: "08:00", unloadTimeMins: 60 }
    ]);
    const [activeMapRouteId, setActiveMapRouteId] = useState<string | null>(null);

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

    const updateRoute = (id: string, updates: Partial<RouteState>) => {
        setRoutes(prev => prev.map(r => r.id === id ? { ...r, ...updates } : r));
    };

    const addRoute = () => {
        setRoutes(prev => [
            ...prev,
            { id: Date.now().toString(), origin: "", destinations: [], isOriginOpen: false, isDestOpen: false, optimizedRoute: [], isProcessing: false, metrics: null, encodedPolyline: null, departureTime: "08:00", unloadTimeMins: 60 }
        ]);
    };

    const removeRoute = (id: string) => {
        setRoutes(prev => prev.filter(r => r.id !== id));
    };

    const toggleDestination = (routeId: string, storeId: number) => {
        setRoutes(prev => prev.map(r => {
            if (r.id === routeId) {
                const newDests = r.destinations.includes(storeId)
                    ? r.destinations.filter(d => d !== storeId)
                    : [...r.destinations, storeId];
                return { ...r, destinations: newDests, optimizedRoute: [], metrics: null, encodedPolyline: null };
            }
            return r;
        }));
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



    const fetchGoogleDirectionsBackend = async (orderedPoints: Point[], departureTimeSeconds?: number) => {
        try {
            const res = await fetch("/api/purchases/routes/directions", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ orderedPoints, departureTime: departureTimeSeconds })
            });
            if (!res.ok) throw new Error("Backend API error");
            const data = await res.json();
            if (data.status === "OK") return data;
            console.error("Directions REST API error:", data);
            return null;
        } catch (error) {
            console.error("Failed to fetch backend directions:", error);
            return null;
        }
    };

    const processRoute = async (routeId: string) => {
        const targetRoute = routes.find(r => r.id === routeId);
        if (!targetRoute || !targetRoute.origin || targetRoute.destinations.length === 0) return;

        updateRoute(routeId, { isProcessing: true, metrics: null, optimizedRoute: [], encodedPolyline: null });

        try {
            const originStore = stores.find(s => s.IdTienda === targetRoute.origin)!;
            const shouldReturn = true; // Always return to origin
            const destStores = stores.filter(s => targetRoute.destinations.includes(s.IdTienda) && s.IdTienda !== originStore.IdTienda);

            // Create initial points array starting with origin
            const startPoint: Point = { lat: originStore.Lat, lng: originStore.Lng, name: originStore.Tienda };
            const remaining: Point[] = destStores.map(s => ({ lat: s.Lat, lng: s.Lng, name: s.Tienda }));

            // 1. Determine Departure Timestamp for Google Maps (Must be in the future)
            let departureTimestampSeconds: number | undefined = undefined;
            if (targetRoute.departureTime) {
                const [hh, mm] = targetRoute.departureTime.split(':').map(Number);
                const now = new Date();
                const selectedDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hh, mm, 0);
                if (selectedDate.getTime() <= now.getTime()) {
                    selectedDate.setDate(selectedDate.getDate() + 1); // Push past times to tomorrow
                }
                departureTimestampSeconds = Math.floor(selectedDate.getTime() / 1000);
            }

            // 2. Nearest Neighbor Algorithm to build a logical physical sequence.
            // This is CRITICAL to pick the most logical "End Destination" for Google Maps to target.
            const nnOrderedRemaining: Point[] = [];
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
                nnOrderedRemaining.push(current);
            }

            // Create initial route array based on physical distance (Google API will micro-optimize traffic)
            const initialRoute: Point[] = [startPoint, ...nnOrderedRemaining];
            if (shouldReturn) {
                initialRoute.push({ ...startPoint, name: `${startPoint.name} (Regreso)` });
            }

            // Await Google Maps API Directions for Traffic/Distance Optimization
            const googleResponse = await fetchGoogleDirectionsBackend(initialRoute, departureTimestampSeconds);

            if (googleResponse && googleResponse.routes && googleResponse.routes.length > 0) {
                const mainRoute = googleResponse.routes[0];

                // 2. Reorder the waypoints based on Google's traffic optimization
                let finalOptimizedRoute = [...initialRoute];
                
                // The waypoints sent to Google are everything except the first (Origin) and last (Destination)
                const sentWaypoints = initialRoute.slice(1, -1);
                
                if (mainRoute.waypoint_order && mainRoute.waypoint_order.length === sentWaypoints.length) {
                    const optimizedWaypoints = mainRoute.waypoint_order.map((idx: number) => sentWaypoints[idx]);
                    finalOptimizedRoute = [
                        initialRoute[0], // Origin
                        ...optimizedWaypoints, // Optimized traffic waypoints
                        initialRoute[initialRoute.length - 1] // Fixed destination
                    ];
                }

                let totalDistance = 0;
                let totalDuration = 0;
                const legsInfo: RouteLeg[] = [];

                mainRoute.legs.forEach((leg: any) => {
                    totalDistance += leg.distance?.value || 0;
                    const legTrafficDuration = leg.duration_in_traffic?.value || leg.duration?.value || 0;
                    totalDuration += legTrafficDuration;
                    
                    legsInfo.push({
                        distance: leg.distance?.value || 0,
                        duration: leg.duration?.value || 0,
                        durationInTraffic: legTrafficDuration
                    });
                });

                // ETA Calculations
                let departureDate = new Date();
                if (targetRoute.departureTime) {
                    const [hh, mm] = targetRoute.departureTime.split(':').map(Number);
                    departureDate = new Date(new Date().getFullYear(), new Date().getMonth(), new Date().getDate(), hh, mm, 0);
                    if (departureDate.getTime() <= Date.now()) {
                        departureDate.setDate(departureDate.getDate() + 1);
                    }
                }
                const departureStr = departureDate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });

                const totalUnloadSeconds = targetRoute.destinations.length * targetRoute.unloadTimeMins * 60;
                const totalCombinedDuration = totalDuration + totalUnloadSeconds;

                const arrivalDate = new Date(departureDate.getTime() + totalCombinedDuration * 1000);
                const arrivalStr = arrivalDate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });

                const polyline = mainRoute.overview_polyline?.points || null;

                updateRoute(routeId, {
                    optimizedRoute: finalOptimizedRoute,
                    encodedPolyline: polyline,
                    metrics: { 
                        distance: totalDistance, 
                        duration: totalDuration, 
                        totalCombinedDuration,
                        legs: legsInfo,
                        departureStr,
                        arrivalStr
                    }
                });
            } else {
                // Fallback if google failed
                updateRoute(routeId, { optimizedRoute: initialRoute });
            }

        } catch (error) {
            console.error("Error processing route:", error);
        } finally {
            updateRoute(routeId, { isProcessing: false });
        }
    };

    // Close dropdowns when clicking outside (simple hack: close all when map starts or background clicked)
    // For simplicity, we manage state per route row toggle.

    if (loading) {
        return (
            <div className="flex items-center justify-center h-full">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#4050B4]"></div>
            </div>
        );
    }

    const activeRouteData = activeMapRouteId ? routes.find(r => r.id === activeMapRouteId) : null;

    return (
        <div className="p-6 space-y-8 max-w-7xl mx-auto">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800 tracking-tight">Optimización de Rutas</h1>
                    <p className="text-slate-500 text-sm">Calcula múltiples trayectos y analiza tiempos con tráfico real.</p>
                </div>
                <button
                    onClick={addRoute}
                    className="flex items-center gap-2 px-5 py-2.5 bg-blue-50 text-[#4050B4] font-bold rounded-xl hover:bg-blue-100 transition-colors shadow-sm"
                >
                    <Plus size={18} /> Agregar Nueva Ruta
                </button>
            </div>

            <div className="space-y-4">
                {routes.map((route, index) => {
                    const selectedOriginStore = stores.find(s => s.IdTienda === route.origin);
                    const canCalculate = route.origin !== "" && route.destinations.length > 0;

                    return (
                        <div key={route.id} className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 relative flex flex-col gap-4 transition-all">
                            
                            {/* Panel Superior: Entradas */}
                            <div className="flex flex-col xl:flex-row xl:items-start gap-4 w-full">
                            
                                <div className="absolute top-4 right-4 xl:static xl:order-last shrink-0 xl:mt-5">
                                <button 
                                    onClick={() => removeRoute(route.id)}
                                    className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                                    title="Eliminar ruta"
                                >
                                    <Trash2 size={18} />
                                </button>
                            </div>

                            {/* Origen */}
                            <div className="flex-1 min-w-[200px] z-20">
                                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 block">Origen</label>
                                <div className="relative">
                                    <button
                                        onClick={() => updateRoute(route.id, { isOriginOpen: !route.isOriginOpen, isDestOpen: false })}
                                        className="w-full flex items-center justify-between px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl hover:border-[#4050B4] transition-all text-left group"
                                    >
                                        <span className={cn("text-sm transition-colors truncate", route.origin ? "text-slate-900 font-medium" : "text-slate-400")}>
                                            {selectedOriginStore ? selectedOriginStore.Tienda : "Seleccionar..."}
                                        </span>
                                        <ChevronDown className={cn("h-4 w-4 text-slate-400 transition-transform shrink-0", route.isOriginOpen && "rotate-180")} />
                                    </button>
                                    {route.isOriginOpen && (
                                        <div className="absolute top-full left-0 z-50 w-full mt-2 bg-white border border-slate-200 rounded-xl shadow-2xl max-h-60 overflow-y-auto">
                                            {stores.map((store) => (
                                                <button
                                                    key={store.IdTienda}
                                                    onClick={() => updateRoute(route.id, { origin: store.IdTienda, isOriginOpen: false, optimizedRoute: [], metrics: null, encodedPolyline: null })}
                                                    className={cn(
                                                        "w-full px-4 py-3 text-left text-sm hover:bg-slate-50 transition-colors flex items-center justify-between",
                                                        route.origin === store.IdTienda ? "text-[#4050B4] font-bold bg-blue-50/50" : "text-slate-700"
                                                    )}
                                                >
                                                    {store.Tienda}
                                                    {route.origin === store.IdTienda && <Check className="h-4 w-4" />}
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Destinos */}
                            <div className="flex-1 min-w-[200px] z-10">
                                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 block">Paradas de Destino</label>
                                <div className="relative">
                                    <button
                                        onClick={() => updateRoute(route.id, { isDestOpen: !route.isDestOpen, isOriginOpen: false })}
                                        className="w-full flex items-center justify-between px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl hover:border-[#4050B4] transition-all text-left group"
                                    >
                                        <span className={cn("text-sm transition-colors truncate", route.destinations.length > 0 ? "text-slate-900 font-medium" : "text-slate-400")}>
                                            {route.destinations.length > 0 ? `${route.destinations.length} parada(s)` : "Seleccionar..."}
                                        </span>
                                        <ChevronDown className={cn("h-4 w-4 text-slate-400 transition-transform shrink-0", route.isDestOpen && "rotate-180")} />
                                    </button>
                                    {route.isDestOpen && (
                                        <div className="absolute top-full left-0 z-50 w-full mt-2 bg-white border border-slate-200 rounded-xl shadow-2xl max-h-60 overflow-y-auto">
                                            {stores.map((store) => (
                                                <button
                                                    key={store.IdTienda}
                                                    onClick={() => toggleDestination(route.id, store.IdTienda)}
                                                    className={cn(
                                                        "w-full px-4 py-3 text-left text-sm hover:bg-slate-50 transition-colors flex items-center justify-between",
                                                        route.destinations.includes(store.IdTienda) ? "text-[#4050B4] font-bold bg-blue-50/50" : "text-slate-700"
                                                    )}
                                                >
                                                    <div className="flex items-center gap-3">
                                                        <div className={cn(
                                                            "w-4 h-4 border rounded flex items-center justify-center transition-all",
                                                            route.destinations.includes(store.IdTienda) ? "bg-[#4050B4] border-[#4050B4]" : "border-slate-300 bg-white"
                                                        )}>
                                                            {route.destinations.includes(store.IdTienda) && <Check className="h-3 w-3 text-white" />}
                                                        </div>
                                                        {store.Tienda}
                                                    </div>
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Ajustes de Tiempo */}
                            <div className="flex items-center gap-3 flex-none z-0">
                                <div className="w-24">
                                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 block">Salida</label>
                                    <input 
                                        type="time" 
                                        value={route.departureTime}
                                        onChange={(e) => updateRoute(route.id, { departureTime: e.target.value })}
                                        className="w-full px-2 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-700 outline-none focus:border-[#4050B4] transition-all"
                                    />
                                </div>
                                <div className="w-28">
                                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 block truncate" title="Descarga por Parada (min)">Descarga (min)</label>
                                    <input 
                                        type="number" 
                                        min="0"
                                        step="5"
                                        value={route.unloadTimeMins}
                                        onChange={(e) => updateRoute(route.id, { unloadTimeMins: parseInt(e.target.value) || 0 })}
                                        className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-700 outline-none focus:border-[#4050B4] transition-all"
                                    />
                                </div>
                            </div>

                            {/* Calcular Botón */}
                            <div className="flex-none pt-[22px]">
                                <button
                                    onClick={() => processRoute(route.id)}
                                    disabled={!canCalculate || route.isProcessing}
                                    className="px-6 py-2.5 bg-[#4050B4] text-white font-bold rounded-xl shadow-md hover:bg-[#324096] transition-all disabled:opacity-50 flex items-center justify-center min-w-[120px]"
                                >
                                    {route.isProcessing ? (
                                        <div className="h-5 w-5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                                    ) : (
                                        "Calcular"
                                    )}
                                </button>
                            </div>
                        </div> {/* Fin Panel Superior */}

                            {/* Resultados (Métricas) en renglón abajo */}
                            {route.metrics && (
                                <div className="mt-2 flex-1 flex flex-col xl:flex-row items-start xl:items-center justify-between gap-4 px-4 py-3 bg-green-50 border border-green-200 rounded-xl text-green-900 shadow-sm">
                                    <div className="flex items-center gap-4">
                                        <div className="text-center xl:text-left bg-white px-3 py-1.5 rounded-lg border border-green-200 shadow-sm min-w-[80px]">
                                            <div className="text-[9px] uppercase font-bold text-green-600 tracking-wide">Salida</div>
                                            <div className="text-sm font-black text-slate-700">{route.metrics.departureStr}</div>
                                        </div>
                                        <span className="text-green-300">➡️</span>
                                        <div className="text-center xl:text-left bg-white px-3 py-1.5 rounded-lg border border-green-200 shadow-sm min-w-[80px]">
                                            <div className="text-[9px] uppercase font-bold text-[#4050B4] tracking-wide" title={`Incluye Tráfico + ${route.unloadTimeMins}m por parada`}>Llegada Est.</div>
                                            <div className="text-sm font-black text-[#4050B4]">{route.metrics.arrivalStr}</div>
                                        </div>
                                    </div>
                                    
                                    <div className="flex flex-wrap items-center gap-3 text-xs font-semibold text-slate-600">
                                        <span title="Tiempo de Manejo en Tráfico" className="whitespace-nowrap">🚗 {Math.round(route.metrics.duration / 60)}m</span>
                                        <span className="w-1 h-1 rounded-full bg-slate-300 shrink-0" />
                                        <span title="Tiempo Total de Descargas" className="whitespace-nowrap">📦 {Math.round((route.metrics.totalCombinedDuration - route.metrics.duration) / 60)}m</span>
                                        <span className="w-1 h-1 rounded-full bg-slate-300 shrink-0" />
                                        <span title="Distancia de Ruta" className="whitespace-nowrap">📏 {Math.max(0.1, route.metrics.distance / 1000).toFixed(1)} km</span>
                                    </div>

                                    <div className="ml-auto shrink-0">
                                        <button 
                                            onClick={() => setActiveMapRouteId(route.id)}
                                            className="h-10 w-10 bg-white border border-green-300 rounded-full flex items-center justify-center text-xl shadow hover:scale-110 transition-transform group"
                                            title="Ver detalle y mapa"
                                        >
                                            🗺️
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>

            {/* Modal de Mapa Flotante */}
            {activeMapRouteId && activeRouteData && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-white rounded-3xl shadow-2xl w-full max-w-5xl max-h-[90vh] flex flex-col overflow-hidden">
                        
                        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-white">
                            <div>
                                <h2 className="text-xl font-bold text-slate-800">Detalle de la Ruta</h2>
                                {activeRouteData.metrics && (
                                    <p className="text-sm text-slate-500 font-medium mt-1">
                                        Total: <span className="text-slate-800 font-bold">{Math.round(activeRouteData.metrics.duration / 60)} min</span> ({Math.max(0.1, activeRouteData.metrics.distance / 1000).toFixed(1)} km)
                                    </p>
                                )}
                            </div>
                            <button
                                onClick={() => setActiveMapRouteId(null)}
                                className="w-10 h-10 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-full flex items-center justify-center transition-colors"
                            >
                                <X size={20} />
                            </button>
                        </div>

                        <div className="flex-1 min-h-0 overflow-hidden flex flex-col md:flex-row">
                            {/* Panel Izquierdo: Secuencia */}
                            <div className="w-full md:w-80 border-r border-slate-100 bg-slate-50/50 p-6 overflow-y-auto">
                                <h3 className="text-sm font-bold text-slate-800 mb-6 flex items-center gap-2">
                                    <Footprints size={16} className="text-[#4050B4]" /> Secuencia de Visitas
                                </h3>
                                <div className="space-y-4">
                                    {(() => {
                                        let currentTime = new Date();
                                        if (activeRouteData.departureTime) {
                                            const [hh, mm] = activeRouteData.departureTime.split(':').map(Number);
                                            currentTime = new Date(new Date().getFullYear(), new Date().getMonth(), new Date().getDate(), hh, mm, 0);
                                            if (currentTime.getTime() <= Date.now()) {
                                                currentTime.setDate(currentTime.getDate() + 1);
                                            }
                                        }

                                        return activeRouteData.optimizedRoute.map((point, idx) => {
                                            const isOrigin = idx === 0;
                                            const isFinal = idx === activeRouteData.optimizedRoute.length - 1;
                                            
                                            // Record arrival time
                                            const arrivalTimeStr = currentTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
                                            
                                            // Add Unload Time if it's a destination stop
                                            let departureTimeStr = arrivalTimeStr;
                                            if (!isOrigin && !isFinal) {
                                                currentTime = new Date(currentTime.getTime() + (activeRouteData.unloadTimeMins * 60000));
                                                departureTimeStr = currentTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
                                            }

                                            // Advance time by transit leg to the NEXT stop
                                            if (activeRouteData.metrics && activeRouteData.metrics.legs[idx]) {
                                                currentTime = new Date(currentTime.getTime() + (activeRouteData.metrics.legs[idx].durationInTraffic * 1000));
                                            }

                                            return (
                                                <div key={idx} className="relative flex flex-col gap-1">
                                                    <div className="flex items-center gap-3">
                                                        {idx < activeRouteData.optimizedRoute.length - 1 && (
                                                            <div className="absolute left-3 top-6 w-0.5 h-[calc(100%+8px)] bg-slate-200 z-0" />
                                                        )}
                                                        <div className={cn(
                                                            "w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 z-10 shadow-sm",
                                                            isOrigin || isFinal ? "bg-[#4050B4] text-white" : "bg-white border border-slate-200 text-slate-600"
                                                        )}>
                                                            {isOrigin || isFinal ? "O" : idx}
                                                        </div>
                                                        <div className="flex flex-col">
                                                            <span className={cn("text-xs font-bold truncate", isOrigin || isFinal ? "text-[#4050B4]" : "text-slate-800")}>
                                                                {point.name}
                                                            </span>
                                                            <div className="flex flex-wrap items-center gap-1.5 mt-1 text-[9px] font-bold">
                                                                {isOrigin ? (
                                                                    <span className="bg-[#4050B4]/10 text-[#4050B4] px-1.5 py-0.5 rounded shadow-sm border border-[#4050B4]/20">Salida Base: {departureTimeStr}</span>
                                                                ) : (
                                                                    <>
                                                                        <span className="bg-green-50 text-green-700 px-1.5 py-0.5 rounded shadow-sm border border-green-200" title="Llegada Estimada">Llegada: {arrivalTimeStr}</span>
                                                                        {!isFinal && (
                                                                            <>
                                                                                <span className="text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded shadow-sm border border-amber-200" title="Tiempo Descarga Asignado">📦 {activeRouteData.unloadTimeMins}m</span>
                                                                                <span className="bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded shadow-sm border border-slate-200">Salida: {departureTimeStr}</span>
                                                                            </>
                                                                        )}
                                                                        {isFinal && (
                                                                            <span className="text-slate-500 font-semibold ml-1">(Fin de la Ruta)</span>
                                                                        )}
                                                                    </>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </div>
                                            
                                            {/* Tramo intermedio */}
                                            {activeRouteData.metrics && idx < activeRouteData.optimizedRoute.length - 1 && activeRouteData.metrics.legs[idx] && (() => {
                                                const leg = activeRouteData.metrics.legs[idx];
                                                const trafficMins = Math.round(leg.durationInTraffic / 60);
                                                const delayPct = leg.duration > 0 ? ((leg.durationInTraffic - leg.duration) / leg.duration) * 100 : 0;
                                                
                                                let TrafficIcon = "🚗";
                                                let bgClass = "bg-green-50/80 border-green-200/50";
                                                let textClass = "text-green-700 font-bold";
                                                
                                                if (delayPct > 20) {
                                                    bgClass = "bg-red-50 border-red-200";
                                                    textClass = "text-red-600 font-bold";
                                                    TrafficIcon = "🔴";
                                                } else if (delayPct > 5) {
                                                    bgClass = "bg-amber-50 border-amber-200";
                                                    textClass = "text-amber-600 font-bold";
                                                    TrafficIcon = "🟠";
                                                } else {
                                                    TrafficIcon = "🟢"; // Normal traffic
                                                }

                                                return (
                                                    <div className="ml-9 py-2 flex flex-col sm:flex-row sm:items-center gap-2 text-[10px] font-bold text-slate-400">
                                                        <div className={cn("flex items-center gap-1.5 px-2 py-1.5 rounded-md border shadow-sm transition-colors", bgClass)}>
                                                            <span className="text-[10px]">{TrafficIcon}</span> 
                                                            <span className={textClass}>{trafficMins} min</span>
                                                        </div>
                                                        <div className="flex items-center gap-1.5 bg-slate-100/80 px-2 py-1.5 rounded-md border border-slate-200/50 shadow-sm w-fit">
                                                            <span>📏</span> 
                                                            <span className="text-slate-700">{(leg.distance / 1000).toFixed(1)} km</span>
                                                        </div>
                                                    </div>
                                                );
                                            })()}
                                        </div>
                                            );
                                        });
                                    })()}
                                </div>
                            </div>

                            {/* Panel Derecho: Mapa */}
                            <div className="flex-1 h-[400px] md:h-auto min-h-[400px] bg-slate-200">
                                <RouteMap
                                    origin={
                                        activeRouteData.origin 
                                        ? (() => {
                                            const store = stores.find(s => s.IdTienda === activeRouteData.origin);
                                            return store ? { lat: store.Lat, lng: store.Lng, name: store.Tienda } : null;
                                        })() 
                                        : null
                                    }
                                    destinations={stores.filter(s => activeRouteData.destinations.includes(s.IdTienda)).map(s => ({ lat: s.Lat, lng: s.Lng, name: s.Tienda }))}
                                    optimizedRoute={activeRouteData.optimizedRoute}
                                    encodedPolyline={activeRouteData.encodedPolyline}
                                />
                            </div>
                        </div>

                    </div>
                </div>
            )}
        </div>
    );
}
