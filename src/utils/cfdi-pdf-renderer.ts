import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export function generateInvoicePDF(xmlString: string) {
    try {
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(xmlString, "text/xml");

        // Check for parsing errors
        const parseError = xmlDoc.getElementsByTagName("parsererror")[0];
        if (parseError) {
            console.error("XML Parse Error:", parseError.textContent);
            throw new Error("El XML de la factura tiene un formato inválido.");
        }

        // Helper to find nodes by local name (ignoring namespaces like cfdi:, ns2:, etc.)
        const findNode = (name: string) => {
            const nodes = xmlDoc.getElementsByTagName("*");
            for (let i = 0; i < nodes.length; i++) {
                if (nodes[i].localName === name) return nodes[i];
            }
            return null;
        };

        const findNodes = (name: string) => {
            const results: Element[] = [];
            const nodes = xmlDoc.getElementsByTagName("*");
            for (let i = 0; i < nodes.length; i++) {
                if (nodes[i].localName === name) results.push(nodes[i]);
            }
            return results;
        };

        const getAttr = (el: Element | null, attr: string) => el?.getAttribute(attr) || '';

        // Get Main Nodes
        const comprobante = findNode("Comprobante");
        const emisor = findNode("Emisor");
        const receptor = findNode("Receptor");
        const timbre = findNode("TimbreFiscalDigital");
        
        if (!comprobante) {
            throw new Error("No se encontró el nodo Comprobante en el XML.");
        }

        // Extract Metadata
        const serie = getAttr(comprobante, 'Serie');
        const folio = getAttr(comprobante, 'Folio');
        const fecha = getAttr(comprobante, 'Fecha');
        const uuid = getAttr(timbre, 'UUID');
        const moneda = getAttr(comprobante, 'Moneda') || 'MXN';
        const subtotal = parseFloat(getAttr(comprobante, 'SubTotal') || '0');
        const descuento = parseFloat(getAttr(comprobante, 'Descuento') || '0');
        const total = parseFloat(getAttr(comprobante, 'Total') || '0');

        const doc = new jsPDF();
        const pageWidth = doc.internal.pageSize.getWidth();

        // 1. Header (Standard Header)
        doc.setFillColor(64, 80, 180); // #4050B4
        doc.rect(0, 0, pageWidth, 40, 'F');
        
        doc.setTextColor(255, 255, 255);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(22);
        doc.text("COMPROBANTE FISCAL DIGITAL", 15, 20);
        doc.setFontSize(10);
        doc.setFont("helvetica", "normal");
        doc.text("REPRESENTACIÓN IMPRESA DE CFDI " + (getAttr(comprobante, 'Version') || ''), 15, 28);

        // Invoice Info Box
        doc.setFillColor(255, 255, 255);
        doc.roundedRect(pageWidth - 85, 10, 75, 25, 2, 2, 'F');
        doc.setTextColor(64, 80, 180);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(14);
        doc.text(`FOLIO: ${serie}${folio}`, pageWidth - 80, 20);
        doc.setFontSize(7);
        doc.setTextColor(100, 100, 100);
        doc.text(`FECHA: ${fecha}`, pageWidth - 80, 26);
        const uuidText = uuid || '---';
        doc.text(`UUID: ${uuidText}`, pageWidth - 80, 31, { maxWidth: 70 });

        let currentY = 50;

        // 2. Emisor & Receptor
        doc.setTextColor(0, 0, 0);
        doc.setFontSize(10);
        doc.setFont("helvetica", "bold");
        doc.text("EMISOR", 15, currentY);
        doc.text("RECEPTOR", pageWidth / 2 + 5, currentY);
        
        currentY += 5;
        doc.setFont("helvetica", "normal");
        doc.setFontSize(9);
        
        // Emisor Details
        const emisorNombre = getAttr(emisor, 'Nombre');
        const emisorRFC = getAttr(emisor, 'Rfc') || getAttr(emisor, 'RFC');
        doc.text(emisorNombre || '---', 15, currentY, { maxWidth: 80 });
        doc.text(`RFC: ${emisorRFC}`, 15, currentY + (emisorNombre && emisorNombre.length > 40 ? 10 : 5));
        
        // Receptor Details
        const receptorNombre = getAttr(receptor, 'Nombre');
        const receptorRFC = getAttr(receptor, 'Rfc') || getAttr(receptor, 'RFC');
        const usoCfdi = getAttr(receptor, 'UsoCFDI');
        doc.text(receptorNombre || '---', pageWidth / 2 + 5, currentY, { maxWidth: 80 });
        doc.text(`RFC: ${receptorRFC}`, pageWidth / 2 + 5, currentY + (receptorNombre && receptorNombre.length > 40 ? 10 : 5));
        doc.text(`USO CFDI: ${usoCfdi}`, pageWidth / 2 + 5, currentY + (receptorNombre && receptorNombre.length > 40 ? 15 : 10));

        currentY += 25;

        // 3. Concepts Table
        const conceptosNodes = findNodes("Concepto");
        const tableData = conceptosNodes.map((node: any) => [
            getAttr(node, 'Cantidad'),
            getAttr(node, 'ClaveUnidad') || getAttr(node, 'Unidad'),
            getAttr(node, 'ClaveProdServ'),
            getAttr(node, 'Descripcion'),
            new Intl.NumberFormat('es-MX', { style: 'currency', currency: moneda }).format(parseFloat(getAttr(node, 'ValorUnitario') || '0')),
            new Intl.NumberFormat('es-MX', { style: 'currency', currency: moneda }).format(parseFloat(getAttr(node, 'Importe') || '0'))
        ]);

        autoTable(doc, {
            startY: currentY,
            head: [['Cant', 'Unidad', 'Clave', 'Descripción', 'P. Unitario', 'Importe']],
            body: tableData,
            theme: 'striped',
            headStyles: { fillColor: [64, 80, 180], fontSize: 8 },
            styles: { fontSize: 7, cellPadding: 2 },
            columnStyles: {
                0: { halign: 'right', cellWidth: 15 },
                1: { cellWidth: 15 },
                2: { cellWidth: 20 },
                4: { halign: 'right', cellWidth: 25 },
                5: { halign: 'right', cellWidth: 25 },
            }
        });

        currentY = (doc as any).lastAutoTable.finalY + 10;

        // 4. Totals
        const summaryX = pageWidth - 80;
        doc.setFontSize(9);
        doc.setFont("helvetica", "normal");
        
        const format = (val: number) => new Intl.NumberFormat('es-MX', { style: 'currency', currency: moneda }).format(val);

        doc.text("SUBTOTAL:", summaryX, currentY);
        doc.text(format(subtotal), pageWidth - 15, currentY, { align: 'right' });
        
        if (descuento > 0) {
            currentY += 5;
            doc.text("DESCUENTO:", summaryX, currentY);
            doc.text(format(descuento), pageWidth - 15, currentY, { align: 'right' });
        }

        // Taxes - Improved search for Traslados
        const trasladosNodes = findNodes("Traslado");
        let totalTraslados = 0;
        trasladosNodes.forEach((t: any) => {
            // Only count traslados that represent actual amounts (some are just definitions)
            const imp = parseFloat(getAttr(t, 'Importe') || '0');
            const parent = t.parentElement;
            // Usually we want traslados that are children of Impuestos (at the end of Comprobante)
            if (imp > 0 && parent && parent.localName === 'Traslados' && parent.parentElement && parent.parentElement.localName === 'Impuestos' && parent.parentElement.parentElement === comprobante) {
                totalTraslados += imp;
            } else if (imp > 0 && parent && parent.localName === 'Impuestos' && parent.parentElement === comprobante) {
                // CFDI 3.3 style or similar
                totalTraslados += imp;
            }
        });

        // Fallback: If total Traslados is 0 but there is a TotalImpuestosTrasladados attribute
        const impuestosGlobal = findNode("Impuestos");
        if (totalTraslados === 0 && impuestosGlobal && impuestosGlobal.parentElement === comprobante) {
            totalTraslados = parseFloat(getAttr(impuestosGlobal, 'TotalImpuestosTrasladados') || '0');
        }

        if (totalTraslados > 0) {
            currentY += 5;
            doc.text("IVA TRASLADADO:", summaryX, currentY);
            doc.text(format(totalTraslados), pageWidth - 15, currentY, { align: 'right' });
        }

        currentY += 7;
        doc.setFont("helvetica", "bold");
        doc.setFontSize(11);
        doc.text("TOTAL:", summaryX, currentY);
        doc.text(format(total), pageWidth - 15, currentY, { align: 'right' });

        // 5. Footer (Fiscal Metadata)
        currentY = Math.max(currentY + 20, doc.internal.pageSize.getHeight() - 40);
        if (currentY + 40 > doc.internal.pageSize.getHeight()) {
            doc.addPage();
            currentY = 20;
        }

        doc.setDrawColor(200, 200, 200);
        doc.line(15, currentY, pageWidth - 15, currentY);
        
        currentY += 5;
        doc.setFontSize(7);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(150, 150, 150);
        doc.text("Este documento es una representación impresa de un CFDI.", 15, currentY);
        doc.text(`Versión CFDI: ${getAttr(comprobante, 'Version')}`, 15, currentY + 4);
        
        const selloCFD = getAttr(timbre, 'SelloCFD');
        if (selloCFD) {
            doc.text(`Sello Digital Emisor: ${selloCFD.substring(0, 100)}...`, 15, currentY + 8, { maxWidth: pageWidth - 30 });
        }
        const selloSAT = getAttr(timbre, 'SelloSAT');
        if (selloSAT) {
            doc.text(`Sello SAT: ${selloSAT.substring(0, 100)}...`, 15, currentY + 14, { maxWidth: pageWidth - 30 });
        }

        return doc;
    } catch (error: any) {
        console.error("Renderer Error:", error);
        throw error; // Re-throw to be caught by the UI
    }
}
