import { NextResponse } from 'next/server';
import { generateText } from '@/lib/llm';
import { ANTHROPIC_MODEL } from '@/lib/anthropic';

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { fechaInicio, fechaFin, avgPerStore, topCajeros, topSupervisores, perStore, hourly, model } = body;

        const avg = avgPerStore || {};
        const cajTxt = (topCajeros || []).slice(0, 10).map((c: any, i: number) =>
            `${i+1}. ${c.Cajero} (${c.Tienda}) — ${c.Cantidad} canc, $${Math.round(c.Total).toLocaleString()}`
        ).join('\n');
        const supTxt = (topSupervisores || []).slice(0, 10).map((s: any, i: number) =>
            `${i+1}. ${s.Supervisor} (${s.Tienda}) — ${s.Cantidad} canc, $${Math.round(s.Total).toLocaleString()}`
        ).join('\n');
        const storeTxt = (perStore || []).map((s: any) =>
            `- ${s.Tienda}: ${s.Cantidad} canc, $${Math.round(s.Total).toLocaleString()}`
        ).join('\n');
        const hourTxt = (hourly || []).map((h: any) =>
            `- ${h.Hora}:00 hrs: ${h.Cantidad} canc ($${Math.round(h.Total).toLocaleString()})`
        ).join('\n');

        const systemPrompt = `Eres un Auditor de Operaciones experto en prevención de pérdidas y análisis de cancelaciones en cadenas de retail.
Tu tarea es generar un informe de ALERTAS Y RECOMENDACIONES basado en datos de cancelaciones.

ESTRUCTURA (Markdown):
1. **🚨 Resumen de Alertas**: Párrafo ejecutivo sobre el estado general de cancelaciones.
2. **👤 Cajeros de Mayor Riesgo**: Analiza los cajeros con más cancelaciones por CANTIDAD de operaciones. Indica quién requiere atención inmediata.
3. **🛡️ Supervisores que Más Autorizan**: Analiza patrones por cantidad.
4. **🏪 Sucursales Críticas**: Qué tiendas están por encima del promedio en cantidad de cancelaciones.
5. **⏰ Horarios de Mayor Riesgo**: En qué horas se concentran las cancelaciones.
6. **📋 Acciones Recomendadas**: 5 acciones concretas priorizadas por urgencia.

TONO: Directo, de auditoría. Usa emojis para prioridades. Sé específico con nombres y cifras.
La CANTIDAD de operaciones canceladas es el indicador principal de alerta.
PERIODO: ${fechaInicio} al ${fechaFin}`;

        const userPrompt = `DATOS DE CANCELACIONES:
- Total cancelado: $${Math.round(avg.GranTotal || 0).toLocaleString()}
- Total operaciones canceladas: ${avg.GranCantidad || 0}
- Promedio por sucursal (monto): $${Math.round(avg.PromedioTotalPorTienda || 0).toLocaleString()}
- Promedio por sucursal (cantidad): ${Math.round(avg.PromedioCantidadPorTienda || 0)}
- Sucursales activas: ${avg.NumTiendas || 0}

TOP 10 CAJEROS:
${cajTxt || 'Sin datos'}

TOP 10 SUPERVISORES:
${supTxt || 'Sin datos'}

POR SUCURSAL:
${storeTxt || 'Sin datos'}

POR HORA DEL DÍA:
${hourTxt || 'Sin datos'}`;

        const { text: summary, model: usedModel } = await generateText({
            model,
            fallback: ANTHROPIC_MODEL,
            system: systemPrompt,
            prompt: userPrompt,
            maxTokens: 4096,
            temperature: 0.7,
        });

        return NextResponse.json({ summary, model: usedModel });

    } catch (error: any) {
        console.error('Cancellation AI Summary Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
