import { NextResponse } from "next/server";

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { orderedPoints, departureTime } = body;

        if (!orderedPoints || orderedPoints.length < 2) {
            return NextResponse.json({ error: "At least 2 points are required" }, { status: 400 });
        }

        const apiKey = process.env.DIRECTIONS_GOOGLE_MAPS_API_KEY;
        if (!apiKey) {
            return NextResponse.json({ error: "DIRECTIONS_GOOGLE_MAPS_API_KEY not found" }, { status: 500 });
        }

        const origin = `${orderedPoints[0].lat},${orderedPoints[0].lng}`;
        const destination = `${orderedPoints[orderedPoints.length - 1].lat},${orderedPoints[orderedPoints.length - 1].lng}`;
        
        const waypointsList = orderedPoints.slice(1, -1).map((p: any) => `${p.lat},${p.lng}`);
        const waypointsParam = waypointsList.length > 0 ? `optimize:true|${waypointsList.join('|')}` : "";

        const url = new URL("https://maps.googleapis.com/maps/api/directions/json");
        url.searchParams.append("origin", origin);
        url.searchParams.append("destination", destination);
        if (waypointsParam) {
            url.searchParams.append("waypoints", waypointsParam);
        }
        if (departureTime) {
            url.searchParams.append("departure_time", departureTime.toString());
        } else {
            url.searchParams.append("departure_time", "now");
        }
        url.searchParams.append("traffic_model", "best_guess");
        url.searchParams.append("key", apiKey);

        const response = await fetch(url.toString());
        const data = await response.json();

        return NextResponse.json(data);
    } catch (error) {
        console.error("Directions API Error:", error);
        return NextResponse.json({ error: "Failed to fetch directions" }, { status: 500 });
    }
}
