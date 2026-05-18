// Scripts SQL para detectar hallazgos clave en todas las áreas del negocio
// Cada scanner devuelve datos brutos que la IA interpretará para generar hallazgos accionables

export interface ScannerResult {
    area: string;
    label: string;
    data: any[];
    raw_sql: string;
}

export const INSIGHT_SCANNERS: Array<{
    id: string;
    area: 'ventas' | 'compras' | 'cancelaciones' | 'operacion' | 'productos';
    label: string;
    description: string;
    sql: string;
}> = [
    // =============== VENTAS ===============
    {
        id: 'ventas_dia_vs_promedio',
        area: 'ventas',
        label: 'Ventas de hoy vs promedio últimos 7 días',
        description: 'Detecta si las ventas de hoy están por debajo/encima del promedio reciente',
        sql: `
            SELECT
                CAST(GETDATE() AS DATE) AS Fecha,
                (SELECT ISNULL(SUM(Total),0) FROM Ventas WHERE CAST([Fecha Venta] AS DATE) = CAST(GETDATE() AS DATE)) AS VentaHoy,
                (SELECT ISNULL(AVG(VentaDia),0) FROM (
                    SELECT CAST([Fecha Venta] AS DATE) AS Dia, SUM(Total) AS VentaDia
                    FROM Ventas
                    WHERE [Fecha Venta] >= DATEADD(day, -7, CAST(GETDATE() AS DATE))
                      AND [Fecha Venta] < CAST(GETDATE() AS DATE)
                    GROUP BY CAST([Fecha Venta] AS DATE)
                ) sub) AS Promedio7d
        `
    },
    {
        id: 'ventas_sucursal_top_bottom',
        area: 'ventas',
        label: 'Sucursal líder y rezagada hoy',
        description: 'Identifica la mejor y peor sucursal del día',
        sql: `
            SELECT TOP 10 Tienda, SUM(Total) AS VentaHoy, COUNT(DISTINCT [Folio Venta]) AS Tickets
            FROM Ventas
            WHERE CAST([Fecha Venta] AS DATE) = CAST(GETDATE() AS DATE)
            GROUP BY Tienda
            ORDER BY VentaHoy DESC
        `
    },
    {
        id: 'ventas_depto_anomalias',
        area: 'ventas',
        label: 'Departamento con mayor variación vs ayer',
        description: 'Detecta departamentos con cambios drásticos en ventas',
        sql: `
            SELECT TOP 10
                hoy.Depto,
                ISNULL(hoy.VentaHoy, 0) AS VentaHoy,
                ISNULL(ayer.VentaAyer, 0) AS VentaAyer,
                CASE WHEN ISNULL(ayer.VentaAyer, 0) = 0 THEN NULL
                    ELSE ((ISNULL(hoy.VentaHoy, 0) - ISNULL(ayer.VentaAyer, 0)) * 100.0 / ayer.VentaAyer)
                END AS VariacionPct
            FROM (
                SELECT Depto, SUM(Total) AS VentaHoy
                FROM Ventas
                WHERE CAST([Fecha Venta] AS DATE) = CAST(GETDATE() AS DATE)
                GROUP BY Depto
            ) hoy
            FULL OUTER JOIN (
                SELECT Depto, SUM(Total) AS VentaAyer
                FROM Ventas
                WHERE CAST([Fecha Venta] AS DATE) = CAST(DATEADD(day, -1, GETDATE()) AS DATE)
                GROUP BY Depto
            ) ayer ON hoy.Depto = ayer.Depto
            WHERE hoy.Depto IS NOT NULL OR ayer.Depto IS NOT NULL
            ORDER BY ABS(VariacionPct) DESC
        `
    },
    {
        id: 'ticket_promedio_tendencia',
        area: 'ventas',
        label: 'Tendencia de ticket promedio últimos 7 días',
        description: 'Evolución del ticket promedio para detectar mejora o deterioro',
        sql: `
            SELECT
                CAST([Fecha Venta] AS DATE) AS Dia,
                SUM(Total) / NULLIF(COUNT(DISTINCT [Folio Venta]), 0) AS TicketPromedio,
                COUNT(DISTINCT [Folio Venta]) AS Tickets
            FROM Ventas
            WHERE [Fecha Venta] >= DATEADD(day, -7, CAST(GETDATE() AS DATE))
            GROUP BY CAST([Fecha Venta] AS DATE)
            ORDER BY Dia DESC
        `
    },
    {
        id: 'ventas_mes_vs_anterior',
        area: 'ventas',
        label: 'Mes actual vs mes anterior (acumulado)',
        description: 'Compara avance acumulado mes contra mes',
        sql: `
            SELECT
                (SELECT ISNULL(SUM(Total),0) FROM Ventas
                 WHERE IdMes = MONTH(GETDATE()) AND [Año] = YEAR(GETDATE())
                   AND CAST([Fecha Venta] AS DATE) <= CAST(GETDATE() AS DATE)) AS VentaMesActual,
                (SELECT ISNULL(SUM(Total),0) FROM Ventas
                 WHERE IdMes = MONTH(DATEADD(month, -1, GETDATE()))
                   AND [Año] = YEAR(DATEADD(month, -1, GETDATE()))
                   AND DAY([Fecha Venta]) <= DAY(GETDATE())) AS VentaMesAnterior
        `
    },

    // =============== CANCELACIONES ===============
    {
        id: 'cancelaciones_hoy',
        area: 'cancelaciones',
        label: 'Total cancelaciones de hoy',
        description: 'Volumen e impacto monetario de cancelaciones del día',
        sql: `
            SELECT
                COUNT(*) AS NumCancelaciones,
                ISNULL(SUM(Total), 0) AS MontoCancelado,
                COUNT(DISTINCT Tienda) AS SucursalesAfectadas
            FROM Cancelaciones
            WHERE CAST([Fecha Cancelacion] AS DATE) = CAST(GETDATE() AS DATE)
        `
    },
    {
        id: 'cancelaciones_sucursal',
        area: 'cancelaciones',
        label: 'Sucursales con más cancelaciones hoy',
        description: 'Identifica sucursales con cancelaciones anormales',
        sql: `
            SELECT TOP 5 Tienda,
                COUNT(*) AS NumCancelaciones,
                SUM(Total) AS MontoCancelado
            FROM Cancelaciones
            WHERE CAST([Fecha Cancelacion] AS DATE) = CAST(GETDATE() AS DATE)
            GROUP BY Tienda
            ORDER BY MontoCancelado DESC
        `
    },
    {
        id: 'cancelaciones_vs_promedio',
        area: 'cancelaciones',
        label: 'Cancelaciones hoy vs promedio 7 días',
        description: 'Detecta si las cancelaciones están sobre lo normal',
        sql: `
            SELECT
                (SELECT ISNULL(SUM(Total),0) FROM Cancelaciones
                 WHERE CAST([Fecha Cancelacion] AS DATE) = CAST(GETDATE() AS DATE)) AS CancelHoy,
                (SELECT ISNULL(AVG(CancelDia),0) FROM (
                    SELECT CAST([Fecha Cancelacion] AS DATE) AS Dia, SUM(Total) AS CancelDia
                    FROM Cancelaciones
                    WHERE [Fecha Cancelacion] >= DATEADD(day, -7, CAST(GETDATE() AS DATE))
                      AND [Fecha Cancelacion] < CAST(GETDATE() AS DATE)
                    GROUP BY CAST([Fecha Cancelacion] AS DATE)
                ) sub) AS PromedioCancel7d
        `
    },

    // =============== PRODUCTOS ===============
    {
        id: 'top_productos_dia',
        area: 'productos',
        label: 'Top 5 productos del día',
        description: 'Productos con mayor ingreso del día',
        sql: `
            SELECT TOP 5 Descripcion,
                SUM(Total) AS Ingreso,
                SUM(Cantidad) AS Unidades
            FROM Ventas
            WHERE CAST([Fecha Venta] AS DATE) = CAST(GETDATE() AS DATE)
              AND Descripcion IS NOT NULL
            GROUP BY Descripcion
            ORDER BY Ingreso DESC
        `
    },
    {
        id: 'productos_caida',
        area: 'productos',
        label: 'Productos con caída este mes vs anterior',
        description: 'Productos que están perdiendo tracción',
        sql: `
            SELECT TOP 10
                actual.Descripcion,
                actual.VentaActual,
                anterior.VentaAnterior,
                ((actual.VentaActual - anterior.VentaAnterior) * 100.0 / NULLIF(anterior.VentaAnterior, 0)) AS VariacionPct
            FROM (
                SELECT Descripcion, SUM(Total) AS VentaActual
                FROM Ventas
                WHERE IdMes = MONTH(GETDATE()) AND [Año] = YEAR(GETDATE())
                  AND Descripcion IS NOT NULL
                GROUP BY Descripcion
                HAVING SUM(Total) > 1000
            ) actual
            INNER JOIN (
                SELECT Descripcion, SUM(Total) AS VentaAnterior
                FROM Ventas
                WHERE IdMes = MONTH(DATEADD(month, -1, GETDATE()))
                  AND [Año] = YEAR(DATEADD(month, -1, GETDATE()))
                GROUP BY Descripcion
                HAVING SUM(Total) > 1000
            ) anterior ON actual.Descripcion = anterior.Descripcion
            WHERE anterior.VentaAnterior > actual.VentaActual
            ORDER BY VariacionPct ASC
        `
    },

    // =============== OPERACION ===============
    {
        id: 'horas_pico_hoy',
        area: 'operacion',
        label: 'Horas pico de ventas hoy',
        description: 'Horarios de mayor actividad',
        sql: `
            SELECT TOP 5
                DATEPART(HOUR, [Fecha Venta]) AS Hora,
                SUM(Total) AS Ingreso,
                COUNT(DISTINCT [Folio Venta]) AS Tickets
            FROM Ventas
            WHERE CAST([Fecha Venta] AS DATE) = CAST(GETDATE() AS DATE)
            GROUP BY DATEPART(HOUR, [Fecha Venta])
            ORDER BY Ingreso DESC
        `
    },
    {
        id: 'cajeros_destacados',
        area: 'operacion',
        label: 'Cajeros con mejor desempeño hoy',
        description: 'Top cajeros por venta del día',
        sql: `
            SELECT TOP 5 Cajero, Tienda,
                SUM(Total) AS VentaHoy,
                COUNT(DISTINCT [Folio Venta]) AS Tickets
            FROM Ventas
            WHERE CAST([Fecha Venta] AS DATE) = CAST(GETDATE() AS DATE)
              AND Cajero IS NOT NULL
            GROUP BY Cajero, Tienda
            ORDER BY VentaHoy DESC
        `
    }
];

export function getScannersByPriority(executedIds: string[] = []): typeof INSIGHT_SCANNERS {
    // Devuelve scanners no ejecutados, priorizando áreas críticas
    const priorityOrder = ['ventas', 'cancelaciones', 'productos', 'operacion', 'compras'];
    return INSIGHT_SCANNERS
        .filter(s => !executedIds.includes(s.id))
        .sort((a, b) => priorityOrder.indexOf(a.area) - priorityOrder.indexOf(b.area));
}
