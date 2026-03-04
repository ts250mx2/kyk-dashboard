import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { openai } from '@/lib/ai';

async function getParetoData(fechaInicio: string, fechaFin: string, storeId: string | null, groupBy: string) {
    const startStr = `'${fechaInicio} 00:00:00'`;
    const endStr = `'${fechaFin} 23:59:59'`;

    let storeFilter = '';
    if (storeId && storeId !== 'undefined' && storeId !== 'null') {
        storeFilter = `AND v.IdTienda = ${storeId}`;
    }

    let selectFields = '';
    let groupByFields = '';

    if (groupBy === 'departamento') {
        selectFields = `d.Depto as Descripcion, d.Depto as Departamento, '' as CodigoBarras, '' as Familia`;
        groupByFields = `d.Depto`;
    } else if (groupBy === 'familia') {
        selectFields = `ISNULL(NULLIF(a.Familia, ''), 'SIN FAMILIA') as Descripcion, '' as Departamento, '' as CodigoBarras, ISNULL(NULLIF(a.Familia, ''), 'SIN FAMILIA') as Familia`;
        groupByFields = `a.Familia`;
    } else {
        selectFields = `a.CodigoBarras, a.Descripcion, a.Familia, d.Depto as Departamento`;
        groupByFields = `a.CodigoBarras, a.Descripcion, a.Familia, d.Depto`;
    }

    const sql = `
        WITH SalesByItem AS (
            SELECT 
                ${selectFields},
                SUM(dv.PrecioVenta * dv.Cantidad) as TotalItemVenta,
                SUM(dv.Cantidad) as CantidadVendida,
                COUNT(DISTINCT v.IdVenta) as Operaciones
            FROM tblVentas v
            JOIN tblDetalleVentas dv ON v.IdVenta = dv.IdVenta AND v.IdTienda = dv.IdTienda AND v.IdComputadora = dv.IdComputadora
            JOIN tblArticulos a ON dv.CodigoInterno = a.CodigoInterno
            JOIN tblDeptos d ON a.IdDepto = d.IdDepto
            WHERE v.FechaVenta >= ${startStr} AND v.FechaVenta <= ${endStr}
              ${storeFilter}
            GROUP BY ${groupByFields}
        ),
        TotalSales AS (
            SELECT SUM(TotalItemVenta) as GrandTotal FROM SalesByItem
        ),
        ParetoCalculation AS (
            SELECT 
                s.*,
                SUM(s.TotalItemVenta) OVER (ORDER BY s.TotalItemVenta DESC) as CumulativeSales,
                t.GrandTotal
            FROM SalesByItem s, TotalSales t
        ),
        ParetoResult AS (
            SELECT 
                p.*,
                (p.CumulativeSales / CASE WHEN p.GrandTotal = 0 THEN 1 ELSE p.GrandTotal END) * 100 as CumulativePercentage,
                (p.TotalItemVenta / CASE WHEN p.GrandTotal = 0 THEN 1 ELSE p.GrandTotal END) * 100 as IndividualPercentage
            FROM ParetoCalculation p
        )
        SELECT * 
        FROM ParetoResult 
        ORDER BY TotalItemVenta DESC
    `;

    return await query(sql);
}

export async function GET(req: Request) {
    try {
        const { searchParams } = new URL(req.url);
        const fechaInicio = searchParams.get('fechaInicio');
        const fechaFin = searchParams.get('fechaFin');
        const storeId = searchParams.get('storeId');
        const storeName = searchParams.get('storeName') || 'Global';

        if (!fechaInicio || !fechaFin) {
            return NextResponse.json({ error: 'Missing required parameters' }, { status: 400 });
        }

        // Calculate previous period
        const currentStart = new Date(fechaInicio);
        const currentEnd = new Date(fechaFin);
        const durationMs = currentEnd.getTime() - currentStart.getTime();

        const prevEnd = new Date(currentStart.getTime() - 86400000); // 1 day before current start
        const prevStart = new Date(prevEnd.getTime() - durationMs);

        const prevFechaInicio = prevStart.toISOString().split('T')[0];
        const prevFechaFin = prevEnd.toISOString().split('T')[0];

        // Fetch data for all groupings (Current)
        const articles = await getParetoData(fechaInicio, fechaFin, storeId, 'articulo') as any[];
        const departments = await getParetoData(fechaInicio, fechaFin, storeId, 'departamento') as any[];
        const families = await getParetoData(fechaInicio, fechaFin, storeId, 'familia') as any[];

        // Fetch data for all groupings (Previous)
        const articlesPrev = await getParetoData(prevFechaInicio, prevFechaFin, storeId, 'articulo') as any[];
        const departmentsPrev = await getParetoData(prevFechaInicio, prevFechaFin, storeId, 'departamento') as any[];

        // Summarize data for the prompt
        const topArticles = articles.slice(0, 15).map(a => {
            const prev = articlesPrev.find(p => p.Descripcion === a.Descripcion);
            const trend = prev ? (a.TotalItemVenta > prev.TotalItemVenta ? '↑' : '↓') : 'NEW';
            return `- ${a.Descripcion}: $${a.TotalItemVenta.toLocaleString()} (${a.IndividualPercentage.toFixed(2)}%) ${trend}`;
        }).join('\n');

        const topDepts = departments.map(d => {
            const prev = departmentsPrev.find(p => p.Descripcion === d.Descripcion);
            const diff = prev ? ((d.TotalItemVenta - prev.TotalItemVenta) / prev.TotalItemVenta * 100).toFixed(1) : 'N/A';
            return `- ${d.Descripcion}: $${d.TotalItemVenta.toLocaleString()} (${d.IndividualPercentage.toFixed(2)}%) [Var: ${diff}%]`;
        }).join('\n');

        const topFamilies = families.slice(0, 10).map(f => `- ${f.Descripcion}: $${f.TotalItemVenta.toLocaleString()} (${f.IndividualPercentage.toFixed(2)}%)`).join('\n');

        const totalSales = departments.reduce((acc, d) => acc + d.TotalItemVenta, 0);
        const totalSalesPrev = departmentsPrev.reduce((acc, d) => acc + d.TotalItemVenta, 0);
        const salesVar = totalSalesPrev ? ((totalSales - totalSalesPrev) / totalSalesPrev * 100).toFixed(1) : 'N/A';

        const top80ArticlesCount = articles.filter(a => a.CumulativePercentage <= 80 || (a.CumulativePercentage - a.IndividualPercentage < 80)).length;

        const systemPrompt = `
Eres un Analista de Negocios Senior experto en Análisis de Participación (Pareto 80/20) y Análisis de Tendencias.
Tu tarea es generar un informe ejecutivo "Análisis de Participación e Inteligencia de Tendencias" basado en los datos proporcionados.

ESTRUCTURA DEL INFORME (Markdown):
1.  **Resumen Ejecutivo**: Un párrafo conciso sobre el desempeño general y la variación contra el periodo anterior.
2.  **Top 80/20 & Concentración**: Análisis de la concentración de ventas.
3.  **Análisis de Tendencias y Hallazgos**:
    *   **Departamentos**: Desempeño y variaciones porcentuales.
    *   **Artículos Estrella y Cambios**: Productos críticos y tendencias de crecimiento/caída.
4.  **Recomendaciones Estratégicas**: 3 puntos accionables basados en los datos y tendencias.

TONO: Profesional, analítico y directo.
ID TIENDA/NOMBRE: ${storeName}
PERIODO ACTUAL: ${fechaInicio} al ${fechaFin}
PERIODO ANTERIOR: ${prevFechaInicio} al ${prevFechaFin}
`;

        const userPrompt = `
DATOS DE PARTICIPACIÓN Y TENDENCIAS:
- Venta Total Actual: $${totalSales.toLocaleString()} [Variación: ${salesVar}%]
- Total Artículos: ${articles.length}
- Artículos que generan el 80% de la venta: ${top80ArticlesCount}

TOP ARTÍCULOS (Con tendencia vs periodo anterior):
${topArticles}

PARTICIPACIÓN POR DEPARTAMENTO (Con variación %):
${topDepts}

TOP FAMILIAS:
${topFamilies}
`;

        const completion = await openai.chat.completions.create({
            model: 'gpt-4o',
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: userPrompt },
            ],
            temperature: 0.7,
        });

        return NextResponse.json({
            summary: completion.choices[0].message.content,
            period: { fechaInicio, fechaFin, prevFechaInicio, prevFechaFin },
            store: storeName
        });

    } catch (error) {
        console.error('Error generating AI summary:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
