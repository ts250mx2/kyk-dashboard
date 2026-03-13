import { NextResponse } from 'next/server';
import { mysqlQuery } from '@/lib/mysql';

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const folioRecibo = searchParams.get('folioRecibo');

    if (!folioRecibo) {
        return NextResponse.json({ error: 'FolioRecibo is required' }, { status: 400 });
    }

    try {
        // 1. Get Receipt Header Info
        const headerInfo: any = await mysqlQuery(`
            SELECT A.IdReciboMovil, A.IdTienda, A.UUID, A.FechaRecibo, B.Usuario 
            FROM tblReciboMovil A
            LEFT JOIN tblUsuarios B ON A.IdUsuarioRecibo = B.IdUsuario
            WHERE A.FolioReciboMovil = ?
        `, [folioRecibo]);

        if (headerInfo.length === 0) {
            return NextResponse.json({ error: 'Receipt not found' }, { status: 404 });
        }

        const { IdReciboMovil, IdTienda, UUID, FechaRecibo, Usuario } = headerInfo[0];

        // 2. Get Receipt Items (Devolucion = 0)
        const receiptItems = await mysqlQuery(`
            SELECT 
                A.*, 
                (
                    A.Rec * A.Costo * 
                    (1 - A.Desc0/100) * (1 - A.Desc1/100) * (1 - A.Desc2/100) * (1 - A.Desc3/100) * (1 - A.Desc4/100) * 
                    (CASE WHEN A.Factor = 0 THEN 1 ELSE A.Factor END) * 
                    (1 + A.IEPS/100) * (1 + A.Iva/100)
                ) AS Total,
                B.CodigoBarras, 
                B.Descripcion, 
                B.MedidaCompra, 
                B.MedidaVenta, 
                CASE WHEN B.CantidadGranel > 0 THEN 'Kg' ELSE '' END AS MedidaGranel 
            FROM tblDetalleReciboMovil A 
            INNER JOIN tblArticulosSAP B ON A.CodigoInterno = B.CodigoInterno 
            WHERE A.IdReciboMovil = ? AND A.IdTienda = ? AND A.Devolucion = 0 
            ORDER BY B.Descripcion
        `, [IdReciboMovil, IdTienda]);

        // 3. Get Return Items (Devolucion = 1)
        const returnItems = await mysqlQuery(`
            SELECT 
                A.*, 
                (
                    A.Rec * A.Costo * 
                    (1 - A.Desc0/100) * (1 - A.Desc1/100) * (1 - A.Desc2/100) * (1 - A.Desc3/100) * (1 - A.Desc4/100) * 
                    (CASE WHEN A.Factor = 0 THEN 1 ELSE A.Factor END) * 
                    (1 + A.IEPS/100) * (1 + A.Iva/100)
                ) AS Total,
                B.CodigoBarras, 
                B.Descripcion, 
                B.MedidaVenta 
            FROM tblDetalleReciboMovil A 
            INNER JOIN tblArticulosSAP B ON A.CodigoInterno = B.CodigoInterno 
            WHERE A.IdReciboMovil = ? AND A.IdTienda = ? AND A.Devolucion = 1 
            ORDER BY B.Descripcion
        `, [IdReciboMovil, IdTienda]);

        return NextResponse.json({
            header: {
                folioRecibo,
                IdReciboMovil,
                IdTienda,
                UUID,
                FechaRecibo,
                Usuario
            },
            receiptItems,
            returnItems
        });
    } catch (error: any) {
        console.error('[Receipt Details API] Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
