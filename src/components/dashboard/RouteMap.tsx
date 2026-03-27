"use client";

import React, { useEffect, useState, useCallback, useMemo } from "react";
import { GoogleMap, useJsApiLoader, Marker, Polyline, TrafficLayer } from "@react-google-maps/api";

const containerStyle = {
    width: "100%",
    height: "100%"
};

const center = {
    lat: 20.6597,
    lng: -103.3496
};

// Define libraries array outside to prevent re-renders
const LIBRARIES: ("geometry")[] = ["geometry"];

interface Point {
    lat: number;
    lng: number;
    name: string;
}

interface RouteMapProps {
    origin: Point | null;
    destinations: Point[];
    optimizedRoute: Point[];
    encodedPolyline?: string | null;
}

export default function RouteMap({ origin, destinations, optimizedRoute, encodedPolyline }: RouteMapProps) {
    const { isLoaded } = useJsApiLoader({
        id: 'google-map-script',
        googleMapsApiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || "",
        libraries: LIBRARIES
    });

    const [map, setMap] = useState<google.maps.Map | null>(null);

    useEffect(() => {
        if (map && optimizedRoute.length > 0) {
            const bounds = new window.google.maps.LatLngBounds();
            optimizedRoute.forEach(p => bounds.extend({ lat: p.lat, lng: p.lng }));
            map.fitBounds(bounds);
        }
    }, [map, optimizedRoute]);

    const onLoad = useCallback(function callback(map: google.maps.Map) {
        setMap(map);
    }, []);

    const onUnmount = useCallback(function callback(map: google.maps.Map) {
        setMap(null);
    }, []);

    const decodedPath = useMemo(() => {
        if (!isLoaded || !encodedPolyline || !window.google?.maps?.geometry) return [];
        try {
            return window.google.maps.geometry.encoding.decodePath(encodedPolyline);
        } catch (e) {
            console.error("Failed to decode polyline", e);
            return [];
        }
    }, [isLoaded, encodedPolyline]);

    if (!isLoaded) return <div className="h-full w-full bg-slate-100 animate-pulse flex items-center justify-center text-slate-400">Cargando Mapa...</div>;

    return (
        <div className="h-full w-full rounded-xl overflow-hidden shadow-inner group relative">
            <GoogleMap
                mapContainerStyle={containerStyle}
                center={center}
                zoom={13}
                onLoad={onLoad}
                onUnmount={onUnmount}
                options={{
                    disableDefaultUI: false,
                    zoomControl: true,
                }}
            >
                {decodedPath.length > 0 && (
                    <TrafficLayer />
                )}

                {decodedPath.length > 0 && (
                    <Polyline
                        path={decodedPath}
                        options={{
                            strokeColor: "#4050B4",
                            strokeOpacity: 0.8,
                            strokeWeight: 6
                        }}
                    />
                )}

                {origin && (
                    <Marker
                        position={{ lat: origin.lat, lng: origin.lng }}
                        label={{ text: "O", color: "white", fontWeight: "bold" }}
                        title={`Origen: ${origin.name}`}
                    />
                )}

                {optimizedRoute.slice(1).map((point, idx) => {
                    // Skip drawing another marker if the destination is a return trip to origin
                    if (origin && point.lat === origin.lat && point.lng === origin.lng) return null;
                    
                    return (
                        <Marker
                            key={idx}
                            position={{ lat: point.lat, lng: point.lng }}
                            label={{ text: (idx + 1).toString(), color: "white", fontWeight: "bold" }}
                            title={`Parada ${idx + 1}: ${point.name}`}
                        />
                    );
                })}
            </GoogleMap>
        </div>
    );
}
