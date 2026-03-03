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

        // B. Detailed Cancellation Audit - Cajeros (Last 7 Days)
        const cancelCajerosSql = `
            SELECT D.IdUsuario, E.IdTienda, D.Usuario AS Cajero, E.Tienda, COUNT(A.IdCancelacion) AS Cantidad, SUM(PrecioVenta*B.Cantidad) AS Total, SUM(PrecioVenta*B.Cantidad)/NULLIF(COUNT(A.IdCancelacion), 0) AS [Promedio Cancelacion]
            FROM tblCancelaciones A
            INNER JOIN tblDetalleCancelaciones B ON A.IdTienda = B.IdTienda AND A.IdComputadora = B.IdComputadora AND A.IdCancelacion = B.IdCancelacion
            INNER JOIN tblAperturasCierres C ON A.IdTienda = C.IdTienda AND A.IdComputadora = C.IdComputadora AND A.IdApertura = C.IdApertura
            INNER JOIN tblUsuarios D ON C.IdCajero = D.IdUsuario
            INNER JOIN tblTiendas E ON A.IdTienda = E.IdTienda
            WHERE FechaCancelacion >= DATEADD(day, -7, GETDATE())
            ${idTienda ? `AND A.IdTienda = ${idTienda}` : ''}
            GROUP BY D.Usuario, E.Tienda, D.IdUsuario, E.IdTienda
            ORDER BY COUNT(A.IdCancelacion) DESC
        `;

        // C. Detailed Cancellation Audit - Supervisores (Last 7 Days)
        const cancelSupervisoresSql = `
            SELECT D.IdUsuario, E.IdTienda, D.Usuario AS Supervisor, E.Tienda, COUNT(A.IdCancelacion) AS Cantidad, SUM(PrecioVenta*B.Cantidad) AS Total, SUM(PrecioVenta*B.Cantidad)/NULLIF(COUNT(A.IdCancelacion), 0) AS [Promedio Cancelacion]
            FROM tblCancelaciones A
            INNER JOIN tblDetalleCancelaciones B ON A.IdTienda = B.IdTienda AND A.IdComputadora = B.IdComputadora AND A.IdCancelacion = B.IdCancelacion
            INNER JOIN tblAperturasCierres C ON A.IdTienda = C.IdTienda AND A.IdComputadora = C.IdComputadora AND A.IdApertura = C.IdApertura
            INNER JOIN tblUsuarios D ON A.IdSupervisor = D.IdUsuario
            INNER JOIN tblTiendas E ON A.IdTienda = E.IdTienda
            WHERE FechaCancelacion >= DATEADD(day, -7, GETDATE())
            ${idTienda ? `AND A.IdTienda = ${idTienda}` : ''}
            GROUP BY D.Usuario, E.Tienda, D.IdUsuario, E.IdTienda
            ORDER BY COUNT(A.IdCancelacion) DESC
        `;

        // D. Hourly Patterns (Average over last 30 days)
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

        // E. Consecutive Alza Products (Last 4 Weeks) - Store Specific
        const alzaProductsSql = `
            SELECT TOP 50
                t.Tienda,
                Descripcion,
                SUM(CASE WHEN DATEDIFF(week, v.FechaVenta, GETDATE()) = 4 THEN (d.Cantidad * d.PrecioVenta) ELSE 0 END) as W4,
                SUM(CASE WHEN DATEDIFF(week, v.FechaVenta, GETDATE()) = 3 THEN (d.Cantidad * d.PrecioVenta) ELSE 0 END) as W3,
                SUM(CASE WHEN DATEDIFF(week, v.FechaVenta, GETDATE()) = 2 THEN (d.Cantidad * d.PrecioVenta) ELSE 0 END) as W2,
                SUM(CASE WHEN DATEDIFF(week, v.FechaVenta, GETDATE()) = 1 THEN (d.Cantidad * d.PrecioVenta) ELSE 0 END) as W1
            FROM tblDetalleVentas d
            JOIN tblVentas v ON d.IdVenta = v.IdVenta AND d.IdTienda = v.IdTienda AND d.IdComputadora = v.IdComputadora
            JOIN tblArticulos a ON d.CodigoInterno = a.CodigoInterno
            JOIN tblTiendas t ON v.IdTienda = t.IdTienda
            WHERE v.FechaVenta >= DATEADD(week, -4, GETDATE())
            ${idTienda ? `AND v.IdTienda = ${idTienda}` : ''}
            GROUP BY t.Tienda, Descripcion
            HAVING 
                SUM(CASE WHEN DATEDIFF(week, v.FechaVenta, GETDATE()) = 1 THEN (d.Cantidad * d.PrecioVenta) ELSE 0 END) > 
                SUM(CASE WHEN DATEDIFF(week, v.FechaVenta, GETDATE()) = 2 THEN (d.Cantidad * d.PrecioVenta) ELSE 0 END)
                AND SUM(CASE WHEN DATEDIFF(week, v.FechaVenta, GETDATE()) = 2 THEN (d.Cantidad * d.PrecioVenta) ELSE 0 END) > 
                SUM(CASE WHEN DATEDIFF(week, v.FechaVenta, GETDATE()) = 3 THEN (d.Cantidad * d.PrecioVenta) ELSE 0 END)
            ORDER BY W1 DESC
        `;

        // F. Consecutive Baja Products (Last 4 Weeks) - Store Specific
        const bajaProductsSql = `
            SELECT TOP 50
                t.Tienda,
                Descripcion,
                SUM(CASE WHEN DATEDIFF(week, v.FechaVenta, GETDATE()) = 4 THEN (d.Cantidad * d.PrecioVenta) ELSE 0 END) as W4,
                SUM(CASE WHEN DATEDIFF(week, v.FechaVenta, GETDATE()) = 3 THEN (d.Cantidad * d.PrecioVenta) ELSE 0 END) as W3,
                SUM(CASE WHEN DATEDIFF(week, v.FechaVenta, GETDATE()) = 2 THEN (d.Cantidad * d.PrecioVenta) ELSE 0 END) as W2,
                SUM(CASE WHEN DATEDIFF(week, v.FechaVenta, GETDATE()) = 1 THEN (d.Cantidad * d.PrecioVenta) ELSE 0 END) as W1
            FROM tblDetalleVentas d
            JOIN tblVentas v ON d.IdVenta = v.IdVenta AND d.IdTienda = v.IdTienda AND d.IdComputadora = v.IdComputadora
            JOIN tblArticulos a ON d.CodigoInterno = a.CodigoInterno
            JOIN tblTiendas t ON v.IdTienda = t.IdTienda
            WHERE v.FechaVenta >= DATEADD(week, -4, GETDATE())
            ${idTienda ? `AND v.IdTienda = ${idTienda}` : ''}
            GROUP BY t.Tienda, Descripcion
            HAVING 
                SUM(CASE WHEN DATEDIFF(week, v.FechaVenta, GETDATE()) = 1 THEN (d.Cantidad * d.PrecioVenta) ELSE 0 END) < 
                SUM(CASE WHEN DATEDIFF(week, v.FechaVenta, GETDATE()) = 2 THEN (d.Cantidad * d.PrecioVenta) ELSE 0 END)
                AND SUM(CASE WHEN DATEDIFF(week, v.FechaVenta, GETDATE()) = 2 THEN (d.Cantidad * d.PrecioVenta) ELSE 0 END) < 
                SUM(CASE WHEN DATEDIFF(week, v.FechaVenta, GETDATE()) = 3 THEN (d.Cantidad * d.PrecioVenta) ELSE 0 END)
                AND SUM(CASE WHEN DATEDIFF(week, v.FechaVenta, GETDATE()) = 1 THEN (d.Cantidad * d.PrecioVenta) ELSE 0 END) > 0
            ORDER BY W1 ASC
        `;

        const [salesTrends, cancelCajeros, cancelSupervisores, hourlyPatterns, alzaProducts, bajaProducts] = await Promise.all([
            query(salesTrendsSql),
            query(cancelCajerosSql),
            query(cancelSupervisoresSql),
            query(hourlyPatternsSql),
            query(alzaProductsSql),
            query(bajaProductsSql)
        ]);

        const data = {
            salesTrends,
            cancelCajeros,
            cancelSupervisores,
            hourlyPatterns,
            alzaProducts,
            bajaProducts,
            generatedAt: new Date().toISOString()
        };

        // Cache the result
        try {
            if (!fs.existsSync(path.join(process.cwd(), 'tmp'))) {
                fs.mkdirSync(path.join(process.cwd(), 'tmp'), { recursive: true });
            }
            fs.writeFileSync(CACHE_FILE, JSON.stringify({ date: today, idTienda, data }));
        } catch (cacheError) {
            // Non-blocking
        }

        return NextResponse.json(data);

    } catch (error: any) {
        console.error('Trends API Error:', error);
        return NextResponse.json({
            error: 'Failed to fetch trends',
            details: error.message
        }, { status: 500 });
    }
}
