import { NextResponse } from 'next/server';
import { mysqlQuery } from '@/lib/mysql';

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const idReciboMovil = searchParams.get('idReciboMovil');
    const idTienda = searchParams.get('idTienda');
    const idOrdenCompra = searchParams.get('idOrdenCompra');
    const idProveedor = searchParams.get('idProveedor');

    try {
        // 1. Determine the most reliable IdProveedor (with fallbacks)
        let resolvedIdProveedor: any = idProveedor;
        
        // Handle "undefined" or "null" strings coming from frontend state
        if (!resolvedIdProveedor || resolvedIdProveedor === 'undefined' || resolvedIdProveedor === 'null') {
            resolvedIdProveedor = null;
            
            // Fallback 1: Try to get it from the Purchase Order
            if (idOrdenCompra && idOrdenCompra !== 'undefined' && idOrdenCompra !== 'null') {
                const ocData: any = await mysqlQuery(`SELECT IdProveedor FROM tblOrdenesCompra WHERE IdOrdenCompra = ?`, [idOrdenCompra]);
                if (ocData.length > 0) resolvedIdProveedor = ocData[0].IdProveedor;
            }
            
            // Fallback 2: Try to get it from the Receipt Header
            if (!resolvedIdProveedor && idReciboMovil && idReciboMovil !== 'undefined' && idReciboMovil !== 'null' && idTienda) {
                const recData: any = await mysqlQuery(`SELECT IdProveedor FROM tblReciboMovil WHERE IdReciboMovil = ? AND IdTienda = ?`, [idReciboMovil, idTienda]);
                if (recData.length > 0) resolvedIdProveedor = recData[0].IdProveedor;
            }
        }

        // 2. Get Provider Metadata (RFC and Name) from tblProveedores
        let freshProvider: any = null;
        if (resolvedIdProveedor) {
            const providerData: any = await mysqlQuery(`
                SELECT RFC AS RFCProveedor, Proveedor, IdProveedor
                FROM tblProveedores
                WHERE IdProveedor = ?
            `, [resolvedIdProveedor]);
            if (providerData.length > 0) freshProvider = providerData[0];
        }

        // 3. Get Receipt Header Metadata (Optional, for UUID)
        let freshHeader: any = null;
        if (idReciboMovil && idReciboMovil !== 'undefined' && idReciboMovil !== 'null' && idTienda) {
            const headerData: any = await mysqlQuery(`
                SELECT UUID, IdProveedor
                FROM tblReciboMovil
                WHERE IdReciboMovil = ? AND IdTienda = ?
            `, [idReciboMovil, idTienda]);
            if (headerData.length > 0) freshHeader = headerData[0];
        }

        // 2. Get Receipt Detail Items (tblDetalleReciboMovil)
        const receiptItems: any = await mysqlQuery(`
            SELECT 
                A.CodigoInterno,
                B.CodigoBarras,
                B.Descripcion,
                A.Rec AS Cantidad,
                A.Costo AS PrecioUnitario,
                (
                    A.Rec * A.Costo * 
                    (1 - A.Desc0/100) * (1 - A.Desc1/100) * (1 - A.Desc2/100) * (1 - A.Desc3/100) * (1 - A.Desc4/100) * 
                    (CASE WHEN A.Factor = 0 THEN 1 ELSE A.Factor END) * 
                    (1 + A.IEPS/100) * (1 + A.IVA/100)
                ) AS Total,
                B.MedidaCompra AS Unidad,
                A.Devolucion,
                H.IdProveedor
            FROM tblDetalleReciboMovil A
            INNER JOIN tblArticulosSAP B ON A.CodigoInterno = B.CodigoInterno
            INNER JOIN tblReciboMovil H ON A.IdReciboMovil = H.IdReciboMovil AND A.IdTienda = H.IdTienda
            WHERE A.IdReciboMovil = ? AND A.IdTienda = ? AND A.Devolucion = 0
            ORDER BY B.Descripcion
        `, [idReciboMovil, idTienda]);

        const providerIdFromHeader = receiptItems.length > 0 ? receiptItems[0].IdProveedor : null;

        // 2. Get Order Detail Items (tblDetalleOrdenesCompra)
        let orderItems: any[] = [];
        if (idOrdenCompra) {
            orderItems = await mysqlQuery(`
                SELECT 
                    A.CodigoInterno,
                    B.CodigoBarras,
                    B.Descripcion,
                    A.Cantidad,
                    A.Costo AS PrecioUnitario,
                    (
                        A.Cantidad * A.Costo * 
                        (1 - A.Desc0/100) * (1 - A.Desc1/100) * (1 - A.Desc2/100) * (1 - A.Desc3/100) * (1 - A.Desc4/100) * 
                        (CASE WHEN A.FactorVolumen = 0 THEN 1 ELSE A.FactorVolumen END) * 
                        (1 + B.IEPS/100) * (1 + B.Iva/100)
                    ) AS Total,
                    B.MedidaCompra AS Unidad
                FROM tblDetalleOrdenesCompra A
                INNER JOIN tblArticulosSAP B ON A.CodigoInterno = B.CodigoInterno
                WHERE A.IdOrdenCompra = ?
                ORDER BY B.Descripcion
            `, [idOrdenCompra]) as any[];
        }

        return NextResponse.json({
            receiptItems,
            orderItems,
            metadata: {
                IdProveedor: freshProvider?.IdProveedor || null,
                RFCProveedor: freshProvider?.RFCProveedor || null,
                RFC: freshProvider?.RFCProveedor || null,
                Proveedor: freshProvider?.Proveedor || null,
                UUID: freshHeader?.UUID || null
            }
        });
    } catch (error: any) {
        console.error('[Consolidate Compare API] Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
