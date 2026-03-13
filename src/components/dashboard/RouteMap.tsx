"use client";

import React, { useEffect, useState, useCallback, useRef } from "react";
import { GoogleMap, useJsApiLoader, Marker, DirectionsService, DirectionsRenderer } from "@react-google-maps/api";

const containerStyle = {
    width: "100%",
    height: "100%"
};

const center = {
    lat: 20.6597,
    lng: -103.3496
};

interface Point {
    lat: number;
    lng: number;
    name: string;
}

interface RouteMapProps {
    origin: Point | null;
    destinations: Point[];
    optimizedRoute: Point[];
    onRouteCalculated?: (distance: number, duration: number) => void;
}

export default function RouteMap({ origin, destinations, optimizedRoute, onRouteCalculated }: RouteMapProps) {
    const { isLoaded } = useJsApiLoader({
        id: 'google-map-script',
        googleMapsApiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || ""
    });

    const [response, setResponse] = useState<google.maps.DirectionsResult | null>(null);
    const [map, setMap] = useState<google.maps.Map | null>(null);

    const directionsCallback = useCallback((res: google.maps.DirectionsResult | null, status: google.maps.DirectionsStatus) => {
        if (res !== null && status === 'OK') {
            setResponse(res);
            if (onRouteCalculated) {
                let totalDistance = 0;
                let totalDuration = 0;
                res.routes[0].legs.forEach(leg => {
                    totalDistance += leg.distance?.value || 0;
                    totalDuration += leg.duration?.value || 0;
                });
                onRouteCalculated(totalDistance, totalDuration);
            }
        } else {
            console.error(`Directions request failed: ${status}`);
        }
    }, [onRouteCalculated]);

    useEffect(() => {
        if (map && optimizedRoute.length > 0) {
            const bounds = new google.maps.LatLngBounds();
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

    if (!isLoaded) return <div className="h-[500px] w-full bg-slate-100 animate-pulse rounded-xl" />;

    return (
        <div className="h-[500px] w-full rounded-xl overflow-hidden border border-slate-200 shadow-inner group">
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
                {optimizedRoute.length >= 2 && (
                    <DirectionsService
                        options={{
                            origin: { lat: optimizedRoute[0].lat, lng: optimizedRoute[0].lng },
                            destination: { lat: optimizedRoute[optimizedRoute.length - 1].lat, lng: optimizedRoute[optimizedRoute.length - 1].lng },
                            waypoints: optimizedRoute.slice(1, -1).map(p => ({
                                location: { lat: p.lat, lng: p.lng },
                                stopover: true
                            })),
                            travelMode: google.maps.TravelMode.DRIVING,
                        }}
                        callback={directionsCallback}
                    />
                )}

                {response !== null && (
                    <DirectionsRenderer
                        options={{
                            directions: response,
                            suppressMarkers: true,
                            polylineOptions: {
                                strokeColor: "#4050B4",
                                strokeOpacity: 0.8,
                                strokeWeight: 6
                            }
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

                {destinations.map((dest, idx) => (
                    <Marker
                        key={idx}
                        position={{ lat: dest.lat, lng: dest.lng }}
                        label={{ text: (idx + 1).toString(), color: "white", fontWeight: "bold" }}
                        title={`Parada ${idx + 1}: ${dest.name}`}
                    />
                ))}
            </GoogleMap>
        </div>
    );
}
