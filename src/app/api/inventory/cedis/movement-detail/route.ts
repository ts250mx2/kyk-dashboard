import { NextResponse } from 'next/server';
import { mysqlQuery } from '@/lib/mysql';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const CEDIS_ID = 64;

interface DetailItem {
    codigoBarras: string | null;
    descripcion: string;
    cantidad: number;
    piezasPedido: number | null;
    piezasRecibo: number | null;
    costo: number;
    total: number;
}

function mapSalidaRow(r: any): DetailItem {
    return {
        codigoBarras: r.CodigoBarras ? String(r.CodigoBarras).trim() : null,
        descripcion: r.Descripcion || 'S/N',
        cantidad: Number(r.Mov ?? 0),
        piezasPedido: r.PiezasPedido != null ? Number(r.PiezasPedido) : null,
        piezasRecibo: r.PiezasRecibo != null ? Number(r.PiezasRecibo) : null,
        costo: Number(r.Costo ?? 0),
        total: Number(r.Mov ?? 0) * Number(r.Costo ?? 0),
    };
}

async function salidaItems(idSalida: number, idTienda: number): Promise<DetailItem[]> {
    const rows = (await mysqlQuery(
        `SELECT d.Mov, d.Costo, d.PiezasPedido, d.PiezasRecibo, a.CodigoBarras, a.Descripcion
         FROM tblDetalleTransferenciasSalidas d
         LEFT JOIN tblArticulosSAP a ON a.CodigoInterno = d.CodigoInterno
         WHERE d.IdTransferenciaSalida = ? AND d.IdTienda = ?
         ORDER BY a.Descripcion`,
        [idSalida, idTienda]
    )) as any[];
    return (rows ?? []).map(mapSalidaRow);
}

/**
 * GET /api/inventory/cedis/movement-detail?tipo=RECIBO|SALIDA|ENTRADA&id=123
 * Renglones (artículos) de un movimiento del CEDIS.
 */
export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const tipo = (searchParams.get('tipo') ?? '').toUpperCase();
    const id = Number(searchParams.get('id'));
    if (!Number.isFinite(id) || id <= 0 || !['RECIBO', 'SALIDA', 'ENTRADA'].includes(tipo)) {
        return NextResponse.json({ error: 'Parámetros inválidos' }, { status: 400 });
    }

    try {
        let items: DetailItem[] = [];

        if (tipo === 'RECIBO') {
            const rows = (await mysqlQuery(
                `SELECT d.Rec, d.Costo, d.Devolucion, d.PiezasPedido, d.PiezasRecibo, a.CodigoBarras, a.Descripcion
                 FROM tblDetalleReciboMovil d
                 LEFT JOIN tblArticulosSAP a ON a.CodigoInterno = d.CodigoInterno
                 WHERE d.IdReciboMovil = ? AND d.IdTienda = ${CEDIS_ID}
                 ORDER BY a.Descripcion`,
                [id]
            )) as any[];
            items = (rows ?? []).map((r) => ({
                codigoBarras: r.CodigoBarras ? String(r.CodigoBarras).trim() : null,
                descripcion: r.Descripcion || 'S/N',
                cantidad: Number(r.Rec ?? 0),
                piezasPedido: r.PiezasPedido != null ? Number(r.PiezasPedido) : null,
                piezasRecibo: r.PiezasRecibo != null ? Number(r.PiezasRecibo) : null,
                costo: Number(r.Costo ?? 0),
                total: Number(r.Rec ?? 0) * Number(r.Costo ?? 0),
            }));
        } else if (tipo === 'SALIDA') {
            items = await salidaItems(id, CEDIS_ID);
        } else {
            // ENTRADA al CEDIS: los renglones viven en la salida de la tienda origen.
            const link = (await mysqlQuery(
                `SELECT s.IdTransferenciaSalida, s.IdTienda
                 FROM tblTransferenciasSalidas s
                 WHERE s.IdTransferenciaEntrada = ? AND s.IdTiendaDestino = ${CEDIS_ID}
                 LIMIT 1`,
                [id]
            )) as any[];
            const salida = link?.[0];
            if (salida) items = await salidaItems(Number(salida.IdTransferenciaSalida), Number(salida.IdTienda));
        }

        const total = items.reduce((acc, i) => acc + i.total, 0);
        return NextResponse.json({ count: items.length, total, items });
    } catch (error) {
        console.error('Error fetching CEDIS movement detail:', error);
        return NextResponse.json({ error: 'Error al consultar el detalle del movimiento' }, { status: 500 });
    }
}
