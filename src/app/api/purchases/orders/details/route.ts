import { NextResponse } from 'next/server';
import { mysqlQuery } from '@/lib/mysql';

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const idComputadora = searchParams.get('idComputadora');
    const idOrdenCompra = searchParams.get('idOrdenCompra');

    if (!idComputadora) {
        return NextResponse.json({ error: 'IdComputadora is required' }, { status: 400 });
    }

    try {
        // 1. DELETE previous buffer data for this session
        await mysqlQuery('DELETE FROM tblBufferOrdenesCompra WHERE IdComputadora = ?', [idComputadora]);

        // 2. INSERT into buffer for the specific order
        if (idOrdenCompra) {
            const insertSql = `
                INSERT INTO tblBufferOrdenesCompra (
                    IdComputadora, IdOrdenCompra, CodigoInterno, CodigoBarras, 
                    DescripcionCompra, MedidaCompra, Costo, Desc0, Desc1, Desc2, Desc3, Desc4, 
                    FactorVolumen, Iva, CostoReal, Pedido, PiezasPedido, PedidoTransito, 
                    Rec, IdTipo, CantidadCompra, ReciboKilos, IEPS, EsCatalogo, CantidadGranel
                )
                SELECT 
                    ?, A.IdOrdenCompra, A.CodigoInterno, B.CodigoBarras, 
                    B.DescripcionCompra, B.MedidaCompra, A.Costo, A.Desc0, A.Desc1, A.Desc2, A.Desc3, A.Desc4, 
                    A.FactorVolumen, B.Iva, B.UltimoCosto, A.Cantidad, A.PiezasPedido, A.PedidoTransito, 
                    A.Rec, B.IdTipo, B.CantidadCompra, B.ReciboKilos, B.IEPS, 1, 
                    CASE WHEN B.CantidadGranel = 0 AND B.IdTipo = 2 AND B.Contenido > 0 THEN B.Contenido ELSE B.CantidadGranel END
                FROM tblDetalleOrdenesCompra A
                INNER JOIN tblArticulosSAP B ON A.CodigoInterno = B.CodigoInterno
                WHERE A.IdOrdenCompra = ?
            `;
            await mysqlQuery(insertSql, [idComputadora, idOrdenCompra]);
        }

        // 3. SELECT data with calculated Total and Obs (joining back to original details)
        const selectSql = `
            SELECT 
                B.PiezasPedido,
                B.Pedido,
                B.PedidoTransito,
                D.Obs AS SinCargo,
                B.MedidaCompra AS Medida,
                B.CodigoBarras,
                B.DescripcionCompra AS Descripcion,
                B.Costo,
                B.Iva AS IVA100,
                B.IEPS AS IEPS100,
                B.Desc0 AS D1,
                B.Desc1 AS D2,
                B.Desc2 AS D3,
                B.Desc3 AS D4,
                B.Desc4 AS D5,
                (
                    B.Pedido * B.Costo * 
                    (1 - B.Desc0/100) * (1 - B.Desc1/100) * (1 - B.Desc2/100) * (1 - B.Desc3/100) * (1 - B.Desc4/100) * 
                    (CASE WHEN B.FactorVolumen = 0 THEN 1 ELSE B.FactorVolumen END) * 
                    (1 + B.IEPS/100) * (1 + B.Iva/100)
                ) AS Total,
                U.Usuario AS UsuarioOrden,
                O.FechaOrdenCompra
            FROM tblBufferOrdenesCompra B
            LEFT JOIN tblDetalleOrdenesCompra D ON B.IdOrdenCompra = D.IdOrdenCompra AND B.CodigoInterno = D.CodigoInterno
            LEFT JOIN tblOrdenesCompra O ON B.IdOrdenCompra = O.IdOrdenCompra
            LEFT JOIN tblUsuarios U ON O.IdUsuarioOrdenCompra = U.IdUsuario
            WHERE B.IdComputadora = ?
        `;
        const results = await mysqlQuery(selectSql, [idComputadora]);
        return NextResponse.json(results);
    } catch (error: any) {
        console.error('[Order Details API] Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
