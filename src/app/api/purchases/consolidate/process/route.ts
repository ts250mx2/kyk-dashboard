import { NextResponse } from 'next/server';
import { mysqlQuery } from '@/lib/mysql';
import { anthropic } from '@/lib/anthropic';

export async function POST(request: Request) {
    try {
        const formData = await request.formData();
        const file = formData.get('file') as File;

        if (!file) {
            return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
        }

        const buffer = Buffer.from(await file.arrayBuffer());
        const fileName = file.name;
        const fileType = file.type;
        let uuid: string | null = null;
        let facturaItems: any[] = [];
        let facturaNumero: string | null = null;
        let facturaProveedor: string | null = null;
        let facturaTotalFromOCR: number | null = null;

        console.log(`[Consolidate API] Processing file: ${fileName}, Type: ${fileType} (Using Claude)`);

        // --- Step 1: Extract UUID and factura info ---
        if (fileType.includes('xml')) {
            const xmlContent = buffer.toString('utf-8');
            // Standard SAT UUID attribute: UUID="[UUID]"
            const satMatch = xmlContent.match(/UUID\s*=\s*["']([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})["']/i);
            uuid = satMatch ? satMatch[1] : null;

            if (!uuid) {
                // Fallback to general UUID regex
                const uuidMatch = xmlContent.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i);
                uuid = uuidMatch ? uuidMatch[0] : null;
            }

            // Extract invoice number (Folio) from XML
            const folioMatch = xmlContent.match(/Folio\s*=\s*["']([^"']+)["']/i);
            facturaNumero = folioMatch ? folioMatch[1] : null;

            // Extract provider name (Emisor Nombre)
            const emisorMatch = xmlContent.match(/<[^:]*:?Emisor[^>]*Nombre\s*=\s*["']([^"']+)["']/i);
            facturaProveedor = emisorMatch ? emisorMatch[1] : null;

            // Extract invoice items (Conceptos) for comparison
            const conceptoRegex = /<[^:]*:?Concepto[^>]*>/gi;
            let conceptoMatch;
            while ((conceptoMatch = conceptoRegex.exec(xmlContent)) !== null) {
                const tag = conceptoMatch[0];
                const cantidadMatch = tag.match(/Cantidad\s*=\s*["']([^"']+)["']/i);
                const descripcionMatch = tag.match(/Descripcion\s*=\s*["']([^"']+)["']/i);
                const valorUnitMatch = tag.match(/ValorUnitario\s*=\s*["']([^"']+)["']/i);
                const importeMatch = tag.match(/Importe\s*=\s*["']([^"']+)["']/i);
                const unidadMatch = tag.match(/Unidad\s*=\s*["']([^"']+)["']/i);
                const claveUnidadMatch = tag.match(/ClaveUnidad\s*=\s*["']([^"']+)["']/i);

                if (descripcionMatch) {
                    facturaItems.push({
                        Cantidad: cantidadMatch ? parseFloat(cantidadMatch[1]) : 0,
                        Descripcion: descripcionMatch[1],
                        PrecioUnitario: valorUnitMatch ? parseFloat(valorUnitMatch[1]) : 0,
                        Importe: importeMatch ? parseFloat(importeMatch[1]) : 0,
                        Unidad: unidadMatch ? unidadMatch[1] : (claveUnidadMatch ? claveUnidadMatch[1] : ''),
                    });
                }
            }

            // Extract Total from Comprobante
            const totalMatch = xmlContent.match(/<[^:]*:?Comprobante[^>]*Total\s*=\s*["']([^"']+)["']/i);
            if (totalMatch) {
                facturaTotalFromOCR = parseFloat(totalMatch[1]);
            }

            // Extract Descuento per Concepto if present
            const descuentoRegex = /<[^:]*:?Concepto[^>]*Descuento\s*=\s*["']([^"']+)["']/gi;
            let descIdx = 0;
            let descMatch;
            while ((descMatch = descuentoRegex.exec(xmlContent)) !== null) {
                if (facturaItems[descIdx]) {
                    facturaItems[descIdx].Descuento = parseFloat(descMatch[1]);
                }
                descIdx++;
            }

            console.log(`[Consolidate API] XML UUID: ${uuid}, Folio: ${facturaNumero}, Emisor: ${facturaProveedor}, Total: ${facturaTotalFromOCR}, Items: ${facturaItems.length}`);
        } else if (fileType.includes('image')) {
            const base64Image = buffer.toString('base64');
            // Claude requires specific image types
            const mediaType = fileType.includes('png') ? 'image/png' :
                fileType.includes('webp') ? 'image/webp' :
                    fileType.includes('gif') ? 'image/gif' : 'image/jpeg';

            const response = await anthropic.messages.create({
                model: "claude-opus-4-6",
                max_tokens: 4096,
                messages: [
                    {
                        role: "user",
                        content: [
                            {
                                type: "image",
                                source: {
                                    type: "base64",
                                    media_type: mediaType as any,
                                    data: base64Image,
                                },
                            },
                            {
                                type: "text",
                                text: `Eres un experto en documentos fiscales mexicanos (CFDI). Analiza esta imagen de factura y extrae TODA la información en formato JSON.

INSTRUCCIONES IMPORTANTES PARA EL UUID:
1. PRIMERO intenta localizar y decodificar el código QR de la factura. La URL del SAT contiene el UUID como parámetro "id".
2. Si el QR NO es legible, busca el campo de texto etiquetado como "Folio Fiscal" o "UUID" en el cuerpo del documento. Es un código alfanumérico de 36 caracteres con formato XXXXXXXX-XXXX-XXXX-XXXX-XXXXXXXXXXXX.
3. El UUID es OBLIGATORIO. Búscalo en cualquier parte del documento hasta encontrarlo.

INSTRUCCIONES PARA PRODUCTOS:
4. Extrae ABSOLUTAMENTE TODOS los productos/conceptos de la factura, sin omitir ninguno.
5. Para cada producto, extrae la cantidad exacta, la descripción completa, el precio unitario y el importe.
6. Si hay descuentos por línea, inclúyelos.
7. El "folio" es el número de factura (campo Folio o Serie+Folio).

Formato de respuesta JSON:
{
  "uuid": "UUID de 36 caracteres o null",
  "folio": "número de folio/factura",
  "serie": "serie de la factura si existe",
  "emisor": "nombre o razón social del emisor/proveedor",
  "rfcEmisor": "RFC del emisor",
  "subtotal": 0.00,
  "iva": 0.00,
  "total": 0.00,
  "conceptos": [
    {"Cantidad": 1, "Descripcion": "nombre exacto del producto", "PrecioUnitario": 100.00, "Importe": 100.00, "Unidad": "PZA", "Descuento": 0.00}
  ]
}

Responde SOLO con el JSON válido, sin texto adicional, sin markdown, sin backticks.`
                            }
                        ],
                    },
                ],
            });

            let content = (response.content[0] as any).text?.trim();
            // Strip markdown code fences if Claude wraps the JSON
            if (content?.startsWith('```')) {
                content = content.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim();
            }
            try {
                const parsed = JSON.parse(content);
                uuid = parsed.uuid || null;
                facturaNumero = parsed.folio || null;
                facturaProveedor = parsed.emisor || null;
                if (Array.isArray(parsed.conceptos)) {
                    facturaItems = parsed.conceptos;
                }
                // Use parsed totals for the factura total if available
                if (parsed.total && typeof parsed.total === 'number') {
                    facturaTotalFromOCR = parsed.total;
                }
            } catch {
                // Fallback: just try to extract UUID
                const uuidMatch = content?.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i);
                uuid = uuidMatch ? uuidMatch[0] : null;
            }
            console.log(`[Consolidate API] Claude OCR UUID: ${uuid}, Folio: ${facturaNumero}, Emisor: ${facturaProveedor}, Items: ${facturaItems.length}`);
        } else if (fileType.includes('pdf')) {
            // Basic PDF text extraction as a fallback if digital
            const textContent = buffer.toString('utf-8');
            const uuidMatch = textContent.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i);
            uuid = uuidMatch ? uuidMatch[0] : null;

            if (!uuid) {
                console.log(`[Consolidate API] PDF UUID not found in raw text.`);
            }
        }

        if (!uuid) {
            return NextResponse.json({ error: 'No se pudo extraer UUID del documento. Asegúrate de que es una factura válida.' }, { status: 422 });
        }

        // --- Step 2: Database Lookup by UUID ---
        let receipt = null;
        let order = null;
        let lookupMethod = 'none';

        const receiptResult: any = await mysqlQuery(`
            SELECT 
                A.IdReciboMovil, A.IdTienda, A.FolioReciboMovil, A.FechaRecibo, 
                B.IdProveedor, B.Proveedor, B.RFC AS RFCProveedor, C.Tienda, A.Total, A.UUID, A.Numero
            FROM tblReciboMovil A
            INNER JOIN tblProveedores B ON A.IdProveedor = B.IdProveedor
            INNER JOIN tblTiendas C ON A.IdTienda = C.IdTienda
            WHERE A.UUID LIKE ?
        `, [`%${uuid}%`]);

        if (receiptResult.length > 0) {
            receipt = receiptResult[0];
            lookupMethod = 'uuid';
            console.log(`[Consolidate API] Found receipt by UUID: ${receipt.FolioReciboMovil}`);
        }

        // 3. Find Order using IdReciboMovil and IdTienda
        if (receipt) {
            const orderResult: any = await mysqlQuery(`
                SELECT 
                    A.*, B.Proveedor, B.RFC AS RFCProveedor, C.Tienda, E.StatusOrdenCompra as Status,
                    F.Usuario as UsuarioOrden
                FROM tblOrdenesCompra A
                INNER JOIN tblProveedores B ON A.IdProveedor = B.IdProveedor
                INNER JOIN tblTiendas C ON A.IdTienda = C.IdTienda
                INNER JOIN tblStatusOrdenesCompra E ON A.IdStatusOrdenCompra = E.IdStatusOrdenCompra
                INNER JOIN tblUsuarios F ON A.IdUsuarioOrdenCompra = F.IdUsuario
                WHERE A.IdReciboMovil = ? AND A.IdTienda = ?
            `, [receipt.IdReciboMovil, receipt.IdTienda]);

            order = orderResult.length > 0 ? orderResult[0] : null;
        }

        return NextResponse.json({
            success: true,
            uuid,
            facturaNumero,
            facturaProveedor,
            facturaTotalFromOCR,
            lookupMethod,
            document: {
                name: fileName,
                type: fileType,
                preview: fileType.includes('image') ? `data:${fileType};base64,${buffer.toString('base64')}` : null
            },
            facturaItems,
            receipt,
            order
        });

    } catch (error: any) {
        console.error('[Consolidate API] Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
