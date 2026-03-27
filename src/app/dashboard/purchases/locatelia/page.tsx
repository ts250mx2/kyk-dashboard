"use client";

import React, { useEffect, useState, useMemo } from 'react';
import { GoogleMap, useJsApiLoader, MarkerF, InfoWindowF } from '@react-google-maps/api';
import { MapPin, Navigation, RefreshCcw, Car, Search } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Vehicle {
    id: number;
    alias: string;
    modelo: string;
    matricula: string;
    latitud: number;
    longitud: number;
    ultimaFecha: string;
}

const mapContainerStyle = {
    width: '100%',
    height: '100%',
    borderRadius: '12px',
};

// Initial center around Monterrey
const defaultCenter = {
    lat: 25.6866,
    lng: -100.3161
};

const LIBRARIES: ("geometry")[] = ["geometry"];

export default function LocateliaPage() {
    const [vehicles, setVehicles] = useState<Vehicle[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [selectedVehicle, setSelectedVehicle] = useState<Vehicle | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [mapRef, setMapRef] = useState<google.maps.Map | null>(null);

    const filteredVehicles = useMemo(() => {
        if (!searchQuery.trim()) return vehicles;
        const query = searchQuery.toLowerCase();
        return vehicles.filter(v => 
            v.alias.toLowerCase().includes(query) || 
            v.modelo.toLowerCase().includes(query) || 
            (v.matricula && v.matricula.toLowerCase().includes(query))
        );
    }, [vehicles, searchQuery]);

    const { isLoaded } = useJsApiLoader({
        id: 'google-map-script',
        googleMapsApiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || '',
        libraries: LIBRARIES
    });

    const fetchVehicles = async () => {
        setLoading(true);
        setError(null);
        try {
            const response = await fetch('/api/purchases/locatelia');
            if (!response.ok) {
                throw new Error('Error al obtener vehículos');
            }
            const data = await response.json();
            setVehicles(data);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchVehicles();
        // Refresh every 60 seconds automatically
        const interval = setInterval(fetchVehicles, 60000);
        return () => clearInterval(interval);
    }, []);

    // Calculate dynamic center based on active vehicles
    const initialCenter = useMemo(() => {
        if (vehicles.length === 0) return defaultCenter;
        const validVehicles = vehicles.filter(v => v.latitud !== 0 && v.longitud !== 0);
        if (validVehicles.length === 0) return defaultCenter;

        const sumLat = validVehicles.reduce((acc, v) => acc + v.latitud, 0);
        const sumLng = validVehicles.reduce((acc, v) => acc + v.longitud, 0);

        return {
            lat: sumLat / validVehicles.length,
            lng: sumLng / validVehicles.length
        };
    }, [vehicles.length === 0]); // Only recalculate if vehicles array goes from empty to populated

    const handleMarkerClick = (vehicle: Vehicle) => {
        setSelectedVehicle(vehicle);
        if (mapRef) {
            mapRef.panTo({ lat: vehicle.latitud, lng: vehicle.longitud });
            mapRef.setZoom(15);
            // We do not lock these values into React state to avoid map reset when closing info window
        }
    };

    const getVehicleIcon = (vehicle: Vehicle) => {
        const aliasLower = vehicle.alias.toLowerCase();
        const modeloLower = vehicle.modelo.toLowerCase();
        
        // Use Twitter Emoji (Twemoji) SVG CDN for guaranteed OS-independent premium rendering
        let iconUrl = 'https://cdnjs.cloudflare.com/ajax/libs/twemoji/14.0.2/svg/1f698.svg'; // 🚘 Oncoming Car
        if (aliasLower.includes('chevrolet') || modeloLower.includes('chevrolet')) {
            iconUrl = 'https://cdnjs.cloudflare.com/ajax/libs/twemoji/14.0.2/svg/1f69a.svg'; // 🚚 Delivery Truck
        } else if (aliasLower.includes('nissan') || modeloLower.includes('nissan')) {
            iconUrl = 'https://cdnjs.cloudflare.com/ajax/libs/twemoji/14.0.2/svg/1f6fb.svg'; // 🛻 Pickup Truck
        }
        
        return {
            url: iconUrl,
            scaledSize: new window.google.maps.Size(34, 34), // Explicit perfect size for the map
        };
    };

    return (
        <div className="flex flex-col h-[calc(100vh-80px)] p-6 bg-slate-50 space-y-4">
            
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-black text-[#4050B4] tracking-tighter uppercase flex items-center gap-2">
                        <span>🧭</span>
                        Rastreo Locatelia
                    </h1>
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">
                        Monitoreo en tiempo real de {vehicles.length} unidades
                    </p>
                </div>

                <div className="flex items-center gap-3">
                    <button 
                        onClick={fetchVehicles} 
                        disabled={loading}
                        className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 text-[#4050B4] font-bold text-xs uppercase tracking-widest rounded-lg shadow-sm hover:bg-slate-50 transition-colors disabled:opacity-50"
                    >
                        <RefreshCcw size={14} className={cn(loading && "animate-spin")} />
                        Actualizar
                    </button>
                </div>
            </div>

            {/* Error State */}
            {error && (
                <div className="bg-rose-50 border border-rose-200 text-rose-700 p-4 rounded-lg text-sm font-bold flex items-center gap-2">
                    <MapPin className="text-rose-500" />
                    {error}
                </div>
            )}

            {/* Main Content Area */}
            <div className="flex-1 flex gap-4 min-h-0">
                {/* List Sidebar */}
                <div className="w-80 bg-white rounded-xl shadow-sm border border-slate-200 flex flex-col overflow-hidden hidden md:flex shrink-0">
                    <div className="bg-slate-50 border-b border-slate-200 px-4 py-3 pb-3 flex flex-col gap-3">
                        <div className="font-black text-[#4050B4] flex items-center justify-between uppercase text-[10px] tracking-widest leading-none">
                            <div className="flex items-center gap-2">
                                <Car size={14} />
                                <span>Unidades Activas</span>
                            </div>
                            <span className="bg-[#4050B4]/10 text-[#4050B4] px-1.5 py-0.5 rounded-sm">{filteredVehicles.length}</span>
                        </div>
                        <div className="relative">
                            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" size={12} />
                            <input 
                                type="text"
                                placeholder="Buscar alias, modelo o placa..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full pl-7 pr-3 py-1.5 bg-white border border-slate-200 rounded-md text-xs outline-none focus:border-[#4050B4] focus:ring-1 focus:ring-[#4050B4] transition-all"
                            />
                        </div>
                    </div>
                    <div className="flex-1 overflow-y-auto custom-scrollbar p-2 space-y-2">
                        {loading && vehicles.length === 0 ? (
                            <p className="text-center text-xs text-slate-400 py-10 font-bold uppercase">Cargando unidades...</p>
                        ) : filteredVehicles.length === 0 ? (
                            <p className="text-center text-xs text-slate-400 py-10 font-bold uppercase">No hay coincidencias</p>
                        ) : filteredVehicles.map(vehicle => (
                            <div 
                                key={vehicle.id}
                                onClick={() => handleMarkerClick(vehicle)}
                                className={cn(
                                    "p-3 rounded-lg border transition-all cursor-pointer flex items-start gap-3",
                                    selectedVehicle?.id === vehicle.id 
                                        ? "bg-indigo-50 border-[#4050B4]/30" 
                                        : "bg-white border-slate-100 hover:border-slate-300 hover:shadow-sm"
                                )}
                            >
                                <div className={cn(
                                    "p-2 rounded-lg flex items-center justify-center shrink-0",
                                    selectedVehicle?.id === vehicle.id ? "bg-[#4050B4] text-white" : "bg-slate-100 text-slate-500"
                                )}>
                                    <Navigation size={16} className={selectedVehicle?.id === vehicle.id ? "animate-pulse" : ""} />
                                </div>
                                <div className="min-w-0">
                                    <h3 className="font-bold text-sm text-slate-800 truncate" title={vehicle.alias}>{vehicle.alias}</h3>
                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider truncate mb-1">{vehicle.modelo} {vehicle.matricula ? `· ${vehicle.matricula}` : ''}</p>
                                    <p className="text-[9px] text-slate-400 truncate">
                                        Actualizado: {vehicle.ultimaFecha ? new Date(vehicle.ultimaFecha).toLocaleString('es-MX') : 'Desconocido'}
                                    </p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Map Area */}
                <div className="flex-1 bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden relative">
                    {!isLoaded ? (
                        <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-50/50 backdrop-blur-sm z-10">
                            <div className="w-8 h-8 border-4 border-slate-200 border-t-[#4050B4] rounded-full animate-spin" />
                            <p className="mt-4 text-[10px] font-black uppercase tracking-widest text-[#4050B4]">Iniciando Google Maps...</p>
                        </div>
                    ) : (
                        <GoogleMap
                            mapContainerStyle={mapContainerStyle}
                            center={initialCenter}
                            zoom={10}
                            onLoad={(map) => setMapRef(map)}
                            options={{
                                gestureHandling: 'greedy',
                                disableDefaultUI: false,
                                zoomControl: true,
                                streetViewControl: false,
                                mapTypeControl: false,
                                fullscreenControl: true,
                                styles: [] // Can embed custom styles for a more minimal map later
                            }}
                        >
                            {vehicles.filter(v => v.latitud !== 0 && v.longitud !== 0).map((vehicle) => (
                                <MarkerF
                                    key={vehicle.id}
                                    position={{ lat: vehicle.latitud, lng: vehicle.longitud }}
                                    onClick={() => handleMarkerClick(vehicle)}
                                    icon={getVehicleIcon(vehicle)}
                                    animation={selectedVehicle?.id === vehicle.id ? window.google.maps.Animation.BOUNCE : undefined}
                                />
                            ))}

                            {selectedVehicle && (
                                <InfoWindowF
                                    position={{ lat: selectedVehicle.latitud, lng: selectedVehicle.longitud }}
                                    onCloseClick={() => setSelectedVehicle(null)}
                                >
                                    <div className="p-1 min-w-[200px]">
                                        <h3 className="font-bold text-sm text-[#4050B4] mb-1">{selectedVehicle.alias}</h3>
                                        <div className="text-xs text-slate-600 mb-2">
                                            <p><span className="font-bold text-slate-800">Modelo:</span> {selectedVehicle.modelo}</p>
                                            {selectedVehicle.matricula && <p><span className="font-bold text-slate-800">Placas:</span> {selectedVehicle.matricula}</p>}
                                        </div>
                                        <p className="text-[10px] text-slate-400 pt-2 border-t border-slate-100">
                                            Últ. reporte: {selectedVehicle.ultimaFecha ? new Date(selectedVehicle.ultimaFecha).toLocaleString('es-MX') : '--'}
                                        </p>
                                    </div>
                                </InfoWindowF>
                            )}
                        </GoogleMap>
                    )}
                </div>
            </div>

        </div>
    );
}
