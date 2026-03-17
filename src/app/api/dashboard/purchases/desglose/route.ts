import { NextResponse } from 'next/server';
import { mysqlQuery } from '@/lib/mysql';

export async function GET(req: Request) {
    try {
        const { searchParams } = new URL(req.url);
        const fechaInicio = searchParams.get('fechaInicio');
        const fechaFin = searchParams.get('fechaFin') ? `${searchParams.get('fechaFin')} 23:59:59` : null;
        const tipo = searchParams.get('tipo'); // 'departamento' | 'familia'
        const storeId = searchParams.get('storeId');
        const metric = searchParams.get('metric') || 'compras';

        if (!fechaInicio || !fechaFin || !tipo) {
            return NextResponse.json({ error: 'Missing parameters (fechaInicio, fechaFin, tipo)' }, { status: 400 });
        }

        let storeFilter = '';
        const params = [fechaInicio, fechaFin];
        if (storeId && storeId !== 'undefined' && storeId !== 'null') {
            storeFilter = `AND v.IdTienda = ?`;
            params.push(storeId);
        }

        let sql = '';

        if (metric === 'compras') {
            if (tipo === 'departamento') {
                sql = `
                    SELECT d.IdDepto, d.Depto AS Departamento,
                        SUM(dv.Costo * CASE WHEN dv.RecGranel > 0 THEN dv.RecGranel ELSE dv.Rec END) as Total,
                        COUNT(*) as Operaciones
                    FROM tblReciboMovil v
                    JOIN tblDetalleReciboMovil dv ON v.IdReciboMovil = dv.IdReciboMovil AND v.IdTienda = dv.IdTienda
                    JOIN tblArticulosSAP a ON dv.CodigoInterno = a.CodigoInterno
                    JOIN tblDeptos d ON a.IdDepto = d.IdDepto
                    WHERE dv.Devolucion = 0 AND v.FechaRecibo >= ? AND v.FechaRecibo <= ? ${storeFilter}
                    GROUP BY d.IdDepto, d.Depto
                    ORDER BY Total DESC
                    LIMIT 20
                `;
            } else if (tipo === 'familia') {
                sql = `
                    SELECT 
                        CASE WHEN a.Familia = '' OR a.Familia IS NULL THEN 'Sin Familia' ELSE a.Familia END AS Familia,
                        SUM(dv.Costo * CASE WHEN dv.RecGranel > 0 THEN dv.RecGranel ELSE dv.Rec END) as Total,
                        COUNT(*) as Operaciones
                    FROM tblReciboMovil v
                    JOIN tblDetalleReciboMovil dv ON v.IdReciboMovil = dv.IdReciboMovil AND v.IdTienda = dv.IdTienda
                    JOIN tblArticulosSAP a ON dv.CodigoInterno = a.CodigoInterno
                    WHERE dv.Devolucion = 0 AND v.FechaRecibo >= ? AND v.FechaRecibo <= ? ${storeFilter}
                    GROUP BY a.Familia
                    ORDER BY Total DESC
                    LIMIT 20
                `;
            }
        } else if (metric === 'devoluciones') {
            if (tipo === 'departamento') {
                sql = `
                    SELECT d.IdDepto, d.Depto AS Departamento,
                        SUM(dv.Rec * dv.Costo) as Total,
                        COUNT(*) as Operaciones
                    FROM tblReciboMovil v
                    JOIN tblDetalleReciboMovil dv ON v.IdReciboMovil = dv.IdReciboMovil AND v.IdTienda = dv.IdTienda
                    JOIN tblArticulosSAP a ON dv.CodigoInterno = a.CodigoInterno
                    JOIN tblDeptos d ON a.IdDepto = d.IdDepto
                    WHERE dv.Devolucion = 1 AND v.FechaRecibo >= ? AND v.FechaRecibo <= ? ${storeFilter}
                    GROUP BY d.IdDepto, d.Depto
                    ORDER BY Total DESC
                    LIMIT 20
                `;
            } else if (tipo === 'familia') {
                sql = `
                    SELECT 
                        CASE WHEN a.Familia = '' OR a.Familia IS NULL THEN 'Sin Familia' ELSE a.Familia END AS Familia,
                        SUM(dv.Rec * dv.Costo) as Total,
                        COUNT(*) as Operaciones
                    FROM tblReciboMovil v
                    JOIN tblDetalleReciboMovil dv ON v.IdReciboMovil = dv.IdReciboMovil AND v.IdTienda = dv.IdTienda
                    JOIN tblArticulosSAP a ON dv.CodigoInterno = a.CodigoInterno
                    WHERE dv.Devolucion = 1 AND v.FechaRecibo >= ? AND v.FechaRecibo <= ? ${storeFilter}
                    GROUP BY a.Familia
                    ORDER BY Total DESC
                    LIMIT 20
                `;
            }
        } else if (metric === 'transferenciasSalida') {
            if (tipo === 'departamento') {
                sql = `
                    SELECT d.IdDepto, d.Depto AS Departamento,
                        SUM(dv.Mov * dv.Costo) as Total,
                        COUNT(*) as Operaciones
                    FROM tblTransferenciasSalidas v
                    JOIN tblDetalleTransferenciasSalidas dv ON v.IdTransferenciaSalida = dv.IdTransferenciaSalida AND v.IdTienda = dv.IdTienda
                    JOIN tblArticulosSAP a ON dv.CodigoInterno = a.CodigoInterno
                    JOIN tblDeptos d ON a.IdDepto = d.IdDepto
                    WHERE v.FechaSalida >= ? AND v.FechaSalida <= ? ${storeFilter}
                    GROUP BY d.IdDepto, d.Depto
                    ORDER BY Total DESC
                    LIMIT 20
                `;
            } else if (tipo === 'familia') {
                sql = `
                    SELECT 
                        CASE WHEN a.Familia = '' OR a.Familia IS NULL THEN 'Sin Familia' ELSE a.Familia END AS Familia,
                        SUM(dv.Mov * dv.Costo) as Total,
                        COUNT(*) as Operaciones
                    FROM tblTransferenciasSalidas v
                    JOIN tblDetalleTransferenciasSalidas dv ON v.IdTransferenciaSalida = dv.IdTransferenciaSalida AND v.IdTienda = dv.IdTienda
                    JOIN tblArticulosSAP a ON dv.CodigoInterno = a.CodigoInterno
                    WHERE v.FechaSalida >= ? AND v.FechaSalida <= ? ${storeFilter}
                    GROUP BY a.Familia
                    ORDER BY Total DESC
                    LIMIT 20
                `;
            }
        } else if (metric === 'transferenciasEntrada') {
            // Filter by destination store
            let destStoreFilter = '';
            if (storeId && storeId !== 'undefined' && storeId !== 'null') {
                destStoreFilter = `AND v.IdTiendaDestino = ?`;
            }
            if (tipo === 'departamento') {
                sql = `
                    SELECT d.IdDepto, d.Depto AS Departamento,
                        SUM(dv.Mov * dv.Costo) as Total,
                        COUNT(*) as Operaciones
                    FROM tblTransferenciasSalidas v
                    JOIN tblDetalleTransferenciasSalidas dv ON v.IdTransferenciaSalida = dv.IdTransferenciaSalida AND v.IdTienda = dv.IdTienda
                    JOIN tblArticulosSAP a ON dv.CodigoInterno = a.CodigoInterno
                    JOIN tblDeptos d ON a.IdDepto = d.IdDepto
                    WHERE v.FechaEntrada >= ? AND v.FechaEntrada <= ? ${destStoreFilter}
                    GROUP BY d.IdDepto, d.Depto
                    ORDER BY Total DESC
                    LIMIT 20
                `;
            } else if (tipo === 'familia') {
                sql = `
                    SELECT 
                        CASE WHEN a.Familia = '' OR a.Familia IS NULL THEN 'Sin Familia' ELSE a.Familia END AS Familia,
                        SUM(dv.Mov * dv.Costo) as Total,
                        COUNT(*) as Operaciones
                    FROM tblTransferenciasSalidas v
                    JOIN tblDetalleTransferenciasSalidas dv ON v.IdTransferenciaSalida = dv.IdTransferenciaSalida AND v.IdTienda = dv.IdTienda
                    JOIN tblArticulosSAP a ON dv.CodigoInterno = a.CodigoInterno
                    WHERE v.FechaEntrada >= ? AND v.FechaEntrada <= ? ${destStoreFilter}
                    GROUP BY a.Familia
                    ORDER BY Total DESC
                    LIMIT 20
                `;
            }
        }

        if (!sql) {
            return NextResponse.json({ data: [] });
        }

        const result = await mysqlQuery(sql, params);
        return NextResponse.json({ data: result });

    } catch (error: any) {
        console.error('Error fetching purchases desglose:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
