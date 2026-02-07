import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

export async function POST(req: Request) {
    try {
        const { sucursalId, fechaInicio, fechaFin, groupBy } = await req.json();

        // Validate inputs slightly?
        const startStr = `'${fechaInicio}'`;
        const endStr = `'${fechaFin} 23:59:59'`;

        let whereClause = `WHERE FechaVenta >= ${startStr} AND FechaVenta <= ${endStr}`;

        if (sucursalId && sucursalId !== 'all') {
            whereClause += ` AND IdTienda = ${parseInt(sucursalId)}`;
        }

        let sql = '';
        let visualization = 'table';

        switch (groupBy) {
            case 'sucursal':
                sql = `
                    SELECT 
                        Tienda, 
                        COUNT(DISTINCT FolioVenta) as Tickets,
                        FORMAT(SUM(Total), 'C', 'es-MX') as TotalVenta 
                    FROM Ventas 
                    ${whereClause} 
                    GROUP BY Tienda 
                    ORDER BY SUM(Total) DESC
                `;
                break;
            case 'producto':
                sql = `
                    SELECT TOP 500
                        CodigoBarras, 
                        Descripcion, 
                        SUM(Cantidad) as Unidades, 
                        FORMAT(SUM(Total), 'C', 'es-MX') as TotalVenta 
                    FROM Ventas 
                    ${whereClause} 
                    GROUP BY CodigoBarras, Descripcion 
                    ORDER BY SUM(Total) DESC
                `;
                break;
            case 'departamento':
                // Join with Articulos and Deptos
                const whereAlias = whereClause.replace(/IdTienda/g, 'v.IdTienda').replace(/FechaVenta/g, 'v.FechaVenta');
                sql = `
                    SELECT 
                        d.Depto, 
                        FORMAT(SUM(v.Total), 'C', 'es-MX') as TotalVenta 
                    FROM Ventas v
                    JOIN tblArticulos a ON v.CodigoBarras = a.CodigoBarras
                    JOIN tblDeptos d ON a.IdDepto = d.IdDepto
                    ${whereAlias} 
                    GROUP BY d.Depto 
                    ORDER BY SUM(v.Total) DESC
                `;
                break;
            case 'proveedor':
                // Join with Articulos and Proveedores
                const whereAliasProv = whereClause.replace(/IdTienda/g, 'v.IdTienda').replace(/FechaVenta/g, 'v.FechaVenta');
                sql = `
                    SELECT 
                        p.Proveedor, 
                        FORMAT(SUM(v.Total), 'C', 'es-MX') as TotalVenta 
                    FROM Ventas v
                    JOIN tblArticulos a ON v.CodigoBarras = a.CodigoBarras
                    JOIN tblProveedores p ON a.IdProveedorDefault = p.IdProveedor
                    ${whereAliasProv} 
                    GROUP BY p.Proveedor 
                    ORDER BY SUM(v.Total) DESC
                `;
                break;
            case 'mes':
                sql = `
                    SELECT 
                        MesTexto, 
                        Anio, 
                        FORMAT(SUM(Total), 'C', 'es-MX') as TotalVenta 
                    FROM Ventas 
                    ${whereClause} 
                    GROUP BY MesTexto, Anio, Mes 
                    ORDER BY Anio DESC, Mes DESC
                `;
                break;
            case 'anio':
                sql = `
                    SELECT 
                        Anio, 
                        FORMAT(SUM(Total), 'C', 'es-MX') as TotalVenta 
                    FROM Ventas 
                    ${whereClause} 
                    GROUP BY Anio 
                    ORDER BY Anio DESC
                `;
                break;
            case 'dia_semana':
                sql = `
                    SELECT 
                        DiaSemanaTexto, 
                        FORMAT(SUM(Total), 'C', 'es-MX') as TotalVenta 
                    FROM Ventas 
                    ${whereClause} 
                    GROUP BY DiaSemanaTexto 
                    ORDER BY SUM(Total) DESC
                `;
                break;
            case 'hora':
                sql = `
                    SELECT 
                        DATEPART(HOUR, FechaVenta) as Hora, 
                        FORMAT(SUM(Total), 'C', 'es-MX') as TotalVenta 
                    FROM Ventas 
                    ${whereClause} 
                    GROUP BY DATEPART(HOUR, FechaVenta) 
                    ORDER BY Hora
                `;
                break;
            default: // detalle
                sql = `
                    SELECT TOP 2000 * 
                    FROM Tickets
                    ${whereClause}
                    ORDER BY FechaVenta DESC
                `;
                break;
        }

        const results = await query(sql);
        return NextResponse.json({ data: results, visualization });

    } catch (error: any) {
        console.error('Error fetching sales:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
