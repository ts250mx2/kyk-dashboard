import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import fs from 'fs';
import path from 'path';

const CACHE_FILE = path.join(process.cwd(), 'tmp', 'trends_cache.json');

export async function GET(req: Request) {
    try {
        const { searchParams } = new URL(req.url);
        const idTienda = searchParams.get('idTienda');
        const forceRefresh = searchParams.get('refresh') === 'true';

        // 1. Check Cache (Daily Only)
        const today = new Date().toISOString().split('T')[0];
        if (!forceRefresh && fs.existsSync(CACHE_FILE)) {
            const cache = JSON.parse(fs.readFileSync(CACHE_FILE, 'utf8'));
            if (cache.date === today && (!idTienda || cache.idTienda === idTienda)) {
                return NextResponse.json(cache.data);
            }
        }

        const tiendaFilter = idTienda ? `AND v.IdTienda = ${idTienda}` : '';
        const tiendaFilterCancelaciones = idTienda ? `AND IdTienda = ${idTienda}` : '';

        // 2. Discoveries Logic

        // A. Sales Trends (Today vs Same Weekday last 4 weeks)
        const salesTrendsSql = `
            WITH WeeklySales AS (
                SELECT 
                    DATEDIFF(week, FechaVenta, GETDATE()) as WeeksAgo,
                    SUM(Total) as TotalVentas
                FROM tblVentas
                WHERE 
                    DATEPART(weekday, FechaVenta) = DATEPART(weekday, GETDATE())
                    AND FechaVenta >= DATEADD(week, -5, GETDATE())
                    ${idTienda ? `AND IdTienda = ${idTienda}` : ''}
                GROUP BY DATEDIFF(week, FechaVenta, GETDATE())
            )
            SELECT * FROM WeeklySales ORDER BY WeeksAgo DESC
        `;

        // B. Cancellation Anomalies (Supervisors & Cashiers Today) - ALWAYS GLOBAL
        const cancelAnomaliesSql = `
            SELECT TOP 50
                Supervisor,
                Cajero,
                COUNT(*) as Cantidad,
                SUM(Total) as MontoTotal
            FROM Cancelaciones
            WHERE CAST([Fecha Cancelacion] AS DATE) = CAST(GETDATE() AS DATE)
            GROUP BY Supervisor, Cajero
            ORDER BY MontoTotal DESC
        `;

        // C. Hourly Patterns (Average over last 30 days)
        const hourlyPatternsSql = `
            SELECT 
                DATEPART(hour, FechaVenta) as Hora,
                AVG(Total) as PromedioVenta
            FROM tblVentas
            WHERE FechaVenta >= DATEADD(day, -30, GETDATE())
            ${idTienda ? `AND IdTienda = ${idTienda}` : ''}
            GROUP BY DATEPART(hour, FechaVenta)
            ORDER BY Hora
        `;

        // D. Consecutive Alza Products (Last 4 Weeks) - Store Specific
        const alzaProductsSql = `
            SELECT TOP 50
                t.Tienda,
                Descripcion,
                SUM(CASE WHEN DATEDIFF(week, FechaVenta, GETDATE()) = 4 THEN d.Total ELSE 0 END) as W4,
                SUM(CASE WHEN DATEDIFF(week, FechaVenta, GETDATE()) = 3 THEN d.Total ELSE 0 END) as W3,
                SUM(CASE WHEN DATEDIFF(week, FechaVenta, GETDATE()) = 2 THEN d.Total ELSE 0 END) as W2,
                SUM(CASE WHEN DATEDIFF(week, FechaVenta, GETDATE()) = 1 THEN d.Total ELSE 0 END) as W1
            FROM tblDetalleVentas d
            JOIN tblVentas v ON d.IdVenta = v.IdVenta AND d.IdTienda = v.IdTienda
            JOIN tblArticulos a ON d.CodigoInterno = a.CodigoInterno
            JOIN tblTiendas t ON v.IdTienda = t.IdTienda
            WHERE v.FechaVenta >= DATEADD(week, -4, GETDATE())
            ${tiendaFilter}
            GROUP BY t.Tienda, Descripcion
            HAVING 
                SUM(CASE WHEN DATEDIFF(week, FechaVenta, GETDATE()) = 1 THEN d.Total ELSE 0 END) > 
                SUM(CASE WHEN DATEDIFF(week, FechaVenta, GETDATE()) = 2 THEN d.Total ELSE 0 END)
                AND SUM(CASE WHEN DATEDIFF(week, FechaVenta, GETDATE()) = 2 THEN d.Total ELSE 0 END) > 
                SUM(CASE WHEN DATEDIFF(week, FechaVenta, GETDATE()) = 3 THEN d.Total ELSE 0 END)
            ORDER BY W1 DESC
        `;

        // E. Consecutive Baja Products (Last 4 Weeks) - Store Specific
        const bajaProductsSql = `
            SELECT TOP 50
                t.Tienda,
                Descripcion,
                SUM(CASE WHEN DATEDIFF(week, FechaVenta, GETDATE()) = 4 THEN d.Total ELSE 0 END) as W4,
                SUM(CASE WHEN DATEDIFF(week, FechaVenta, GETDATE()) = 3 THEN d.Total ELSE 0 END) as W3,
                SUM(CASE WHEN DATEDIFF(week, FechaVenta, GETDATE()) = 2 THEN d.Total ELSE 0 END) as W2,
                SUM(CASE WHEN DATEDIFF(week, FechaVenta, GETDATE()) = 1 THEN d.Total ELSE 0 END) as W1
            FROM tblDetalleVentas d
            JOIN tblVentas v ON d.IdVenta = v.IdVenta AND d.IdTienda = v.IdTienda
            JOIN tblArticulos a ON d.CodigoInterno = a.CodigoInterno
            JOIN tblTiendas t ON v.IdTienda = t.IdTienda
            WHERE v.FechaVenta >= DATEADD(week, -4, GETDATE())
            ${tiendaFilter}
            GROUP BY t.Tienda, Descripcion
            HAVING 
                SUM(CASE WHEN DATEDIFF(week, FechaVenta, GETDATE()) = 1 THEN d.Total ELSE 0 END) < 
                SUM(CASE WHEN DATEDIFF(week, FechaVenta, GETDATE()) = 2 THEN d.Total ELSE 0 END)
                AND SUM(CASE WHEN DATEDIFF(week, FechaVenta, GETDATE()) = 2 THEN d.Total ELSE 0 END) < 
                SUM(CASE WHEN DATEDIFF(week, FechaVenta, GETDATE()) = 3 THEN d.Total ELSE 0 END)
                AND SUM(CASE WHEN DATEDIFF(week, FechaVenta, GETDATE()) = 1 THEN d.Total ELSE 0 END) > 0
            ORDER BY W1 ASC
        `;

        // F. Top Users by Cancellation Count (Last 7 Days) - ALWAYS GLOBAL
        const cancelUsersSql = `
            SELECT TOP 50
                Cajero as Usuario,
                COUNT(*) as Cantidad
            FROM Cancelaciones
            WHERE [Fecha Cancelacion] >= DATEADD(day, -7, GETDATE())
            GROUP BY Cajero
            ORDER BY Cantidad DESC
        `;

        const [salesTrends, cancelAnomalies, hourlyPatterns, alzaProducts, bajaProducts, cancelUsers] = await Promise.all([
            query(salesTrendsSql),
            query(cancelAnomaliesSql),
            query(hourlyPatternsSql),
            query(alzaProductsSql),
            query(bajaProductsSql),
            query(cancelUsersSql)
        ]);

        const data = {
            salesTrends,
            cancelAnomalies,
            hourlyPatterns,
            alzaProducts,
            bajaProducts,
            cancelUsers,
            generatedAt: new Date().toISOString()
        };

        // Cache the result
        if (!fs.existsSync(path.join(process.cwd(), 'tmp'))) {
            fs.mkdirSync(path.join(process.cwd(), 'tmp'), { recursive: true });
        }
        fs.writeFileSync(CACHE_FILE, JSON.stringify({ date: today, idTienda, data }));

        return NextResponse.json(data);

    } catch (error) {
        console.error('Trends API Error:', error);
        return NextResponse.json({ error: 'Failed to fetch trends' }, { status: 500 });
    }
}
