import { NextResponse } from 'next/server';

export async function GET(request: Request) {
    try {
        const params = new URLSearchParams({
            'usuario': 'kyk_integracion',
            'password': 'mercurio' // Changed from contraseña based on testing
        });

        const response = await fetch('https://ws.locatel.es/servicios/vehiculos/vehiculos.asmx/ListaVehiculosV2', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: params.toString(),
            cache: 'no-store'
        });

        if (!response.ok) {
            throw new Error(`Locatelia API responded with status: ${response.status}`);
        }

        const xmlText = await response.text();
        
        // Simple regex parser for flat XML schema
        const vehicles = [];
        const vehicleNodes = xmlText.match(/<M_Vehiculo>([\s\S]*?)<\/M_Vehiculo>/g) || [];

        for (const node of vehicleNodes) {
            const extract = (tag: string) => {
                const match = node.match(new RegExp(`<${tag}[^>]*>(.*?)<\\/${tag}>`));
                return match ? match[1].trim() : null;
            };

            const lat = parseFloat(extract('ult_latitud') || '0');
            const lng = parseFloat(extract('ult_longitud') || '0');

            if (lat !== 0 && lng !== 0) {
                vehicles.push({
                    id: parseInt(extract('vehiculo_id') || '0', 10),
                    alias: extract('alias') || 'Desconocido',
                    modelo: extract('modelo') || 'S/N',
                    matricula: extract('matricula') || '',
                    latitud: lat,
                    longitud: lng,
                    ultimaFecha: extract('ult_fecha') || ''
                });
            }
        }

        return NextResponse.json(vehicles);
        
    } catch (error: any) {
        console.error('Error fetching locatelia data:', error);
        return NextResponse.json({ error: 'Internal Server Error', details: error.message }, { status: 500 });
    }
}
