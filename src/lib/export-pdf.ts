/**
 * Generador de PDF para exportar respuestas del agente.
 *
 * Estructura:
 *  - Header con título, fecha, modelo usado
 *  - Pregunta del usuario
 *  - Análisis principal (con markdown inline a texto plano)
 *  - Hallazgos clave (si hay)
 *  - Recomendaciones (si hay)
 *  - Tabla de datos (si hay, con autoTable)
 *  - Footer con SQL ejecutado (collapsible) + branding
 *
 * Usa jsPDF + jspdf-autotable (ya instalados).
 */

import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export interface PdfExportOptions {
    question: string;
    analysis: string;
    keyInsights?: string[];
    recommendations?: string[];
    data?: Record<string, any>[];
    sql?: string;
    aiModel?: string;
    suggestedReports?: Array<{ report_name: string; reason: string }>;
}

const COLOR_PRIMARY: [number, number, number] = [79, 70, 229]; // indigo-600
const COLOR_DARK: [number, number, number] = [30, 41, 59];     // slate-800
const COLOR_MUTED: [number, number, number] = [100, 116, 139]; // slate-500
const COLOR_LIGHT: [number, number, number] = [241, 245, 249]; // slate-100

/** Convierte **negritas markdown** y *itálicas* a texto plano. */
function stripMarkdown(text: string): string {
    return text
        .replace(/\*\*(.+?)\*\*/g, '$1')
        .replace(/\*(.+?)\*/g, '$1')
        .replace(/`(.+?)`/g, '$1');
}

/** Sanitiza string para meterla en el PDF (sin acentos rotos por encoding) */
function safe(text: string): string {
    return String(text || '').replace(/\r\n/g, '\n');
}

/** Formato de currency / número para celdas */
function formatCell(key: string, value: any): string {
    if (value === null || value === undefined) return '—';
    if (typeof value === 'number') {
        const isCurrency = /total|costo|monto|venta|precio|promedio|descuento|importe/i.test(key)
            && !/cantidad|unidades|tickets|id|folio|caja|anio|año|mes|dia/i.test(key);
        if (isCurrency) {
            return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(value);
        }
        return new Intl.NumberFormat('es-MX', { maximumFractionDigits: 2 }).format(value);
    }
    return String(value);
}

export function generateAnalysisPdf(opts: PdfExportOptions): jsPDF {
    const doc = new jsPDF({ unit: 'pt', format: 'a4' });
    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 48;
    const usableWidth = pageWidth - margin * 2;
    let y = margin;

    // === HEADER ===
    doc.setFillColor(...COLOR_PRIMARY);
    doc.rect(0, 0, pageWidth, 8, 'F');

    y = margin;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(...COLOR_MUTED);
    doc.text('ANÁLISIS DEL AGENTE KESITO', margin, y);

    doc.setFont('helvetica', 'normal');
    const now = new Date().toLocaleString('es-MX', {
        day: '2-digit', month: 'short', year: 'numeric',
        hour: '2-digit', minute: '2-digit'
    });
    doc.text(now, pageWidth - margin, y, { align: 'right' });

    y += 24;

    // === PREGUNTA DEL USUARIO ===
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.setTextColor(...COLOR_DARK);
    const questionLines = doc.splitTextToSize(safe(opts.question), usableWidth);
    doc.text(questionLines, margin, y);
    y += questionLines.length * 20 + 6;

    // Línea separadora
    doc.setDrawColor(...COLOR_LIGHT);
    doc.setLineWidth(1);
    doc.line(margin, y, pageWidth - margin, y);
    y += 20;

    // === ANÁLISIS PRINCIPAL ===
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(11);
    doc.setTextColor(...COLOR_DARK);
    const analysisLines = doc.splitTextToSize(stripMarkdown(safe(opts.analysis)), usableWidth);
    doc.text(analysisLines, margin, y, { lineHeightFactor: 1.5 });
    y += analysisLines.length * 16 + 16;

    // Verificar si necesitamos página nueva
    const checkPageBreak = (neededHeight: number) => {
        const pageHeight = doc.internal.pageSize.getHeight();
        if (y + neededHeight > pageHeight - margin) {
            doc.addPage();
            y = margin;
        }
    };

    // === HALLAZGOS CLAVE ===
    if (opts.keyInsights && opts.keyInsights.length > 0) {
        checkPageBreak(80);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(10);
        doc.setTextColor(...COLOR_PRIMARY);
        doc.text('HALLAZGOS CLAVE', margin, y);
        y += 16;

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(10);
        doc.setTextColor(...COLOR_DARK);

        for (const insight of opts.keyInsights) {
            checkPageBreak(40);
            const lines = doc.splitTextToSize('• ' + stripMarkdown(safe(insight)), usableWidth - 12);
            doc.text(lines, margin + 8, y);
            y += lines.length * 14 + 4;
        }
        y += 8;
    }

    // === RECOMENDACIONES ===
    if (opts.recommendations && opts.recommendations.length > 0) {
        checkPageBreak(80);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(10);
        doc.setTextColor(16, 185, 129); // emerald
        doc.text('RECOMENDACIONES', margin, y);
        y += 16;

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(10);
        doc.setTextColor(...COLOR_DARK);

        opts.recommendations.forEach((rec, i) => {
            checkPageBreak(40);
            const lines = doc.splitTextToSize(`${i + 1}. ${stripMarkdown(safe(rec))}`, usableWidth - 12);
            doc.text(lines, margin + 8, y);
            y += lines.length * 14 + 4;
        });
        y += 8;
    }

    // === TABLA DE DATOS ===
    if (opts.data && opts.data.length > 0) {
        checkPageBreak(120);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(10);
        doc.setTextColor(...COLOR_MUTED);
        doc.text(`DATOS (${opts.data.length} ${opts.data.length === 1 ? 'registro' : 'registros'})`, margin, y);
        y += 14;

        const keys = Object.keys(opts.data[0]);
        const rows = opts.data.slice(0, 100).map(row => keys.map(k => formatCell(k, row[k])));

        autoTable(doc, {
            startY: y,
            head: [keys],
            body: rows,
            theme: 'plain',
            styles: {
                fontSize: 8,
                cellPadding: 6,
                textColor: COLOR_DARK,
                lineColor: COLOR_LIGHT,
                lineWidth: 0.5
            },
            headStyles: {
                fillColor: COLOR_LIGHT,
                textColor: COLOR_MUTED,
                fontStyle: 'bold',
                fontSize: 8,
                cellPadding: 6
            },
            alternateRowStyles: { fillColor: [250, 251, 253] },
            margin: { left: margin, right: margin },
            didDrawPage: () => { /* el AutoTable maneja sus propios saltos */ }
        });

        // @ts-expect-error -- lastAutoTable existe pero no está en el tipo
        y = doc.lastAutoTable.finalY + 16;

        if (opts.data.length > 100) {
            doc.setFont('helvetica', 'italic');
            doc.setFontSize(8);
            doc.setTextColor(...COLOR_MUTED);
            doc.text(`Mostrando primeras 100 filas de ${opts.data.length}. Descarga el Excel para el dataset completo.`, margin, y);
            y += 16;
        }
    }

    // === REPORTES SUGERIDOS ===
    if (opts.suggestedReports && opts.suggestedReports.length > 0) {
        checkPageBreak(60 + opts.suggestedReports.length * 24);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(10);
        doc.setTextColor(...COLOR_MUTED);
        doc.text('REPORTES PARA PROFUNDIZAR', margin, y);
        y += 14;

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9);
        doc.setTextColor(...COLOR_DARK);

        for (const report of opts.suggestedReports) {
            checkPageBreak(28);
            doc.setFont('helvetica', 'bold');
            doc.text('› ' + safe(report.report_name), margin, y);
            y += 12;
            doc.setFont('helvetica', 'normal');
            doc.setTextColor(...COLOR_MUTED);
            const reasonLines = doc.splitTextToSize(safe(report.reason), usableWidth - 16);
            doc.text(reasonLines, margin + 12, y);
            y += reasonLines.length * 11 + 6;
            doc.setTextColor(...COLOR_DARK);
        }
    }

    // === SQL EJECUTADO (al final, como apéndice) ===
    if (opts.sql) {
        checkPageBreak(80);
        y += 8;
        doc.setDrawColor(...COLOR_LIGHT);
        doc.line(margin, y, pageWidth - margin, y);
        y += 14;

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(9);
        doc.setTextColor(...COLOR_MUTED);
        doc.text('CONSULTA EJECUTADA', margin, y);
        y += 12;

        doc.setFont('courier', 'normal');
        doc.setFontSize(7);
        doc.setTextColor(...COLOR_DARK);
        const sqlLines = doc.splitTextToSize(safe(opts.sql), usableWidth);
        doc.text(sqlLines, margin, y);
        y += sqlLines.length * 9 + 8;
    }

    // === FOOTER en cada página ===
    const pageCount = doc.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        const pageHeight = doc.internal.pageSize.getHeight();
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8);
        doc.setTextColor(...COLOR_MUTED);
        doc.text(
            `Generado por Kesito${opts.aiModel ? ` · ${opts.aiModel}` : ''}`,
            margin,
            pageHeight - 24
        );
        doc.text(
            `${i} / ${pageCount}`,
            pageWidth - margin,
            pageHeight - 24,
            { align: 'right' }
        );
    }

    return doc;
}

export function downloadPdf(opts: PdfExportOptions): void {
    const doc = generateAnalysisPdf(opts);
    const filename = (opts.question || 'analisis')
        .slice(0, 40)
        .replace(/[^\w\s-]/g, '')
        .replace(/\s+/g, '_')
        .toLowerCase() + '.pdf';
    doc.save(filename);
}

/** Convierte el análisis a texto plano para copy-to-clipboard */
export function formatAsText(opts: PdfExportOptions): string {
    const parts: string[] = [];
    parts.push(`PREGUNTA: ${opts.question}`);
    parts.push('');
    parts.push(stripMarkdown(opts.analysis));

    if (opts.keyInsights?.length) {
        parts.push('');
        parts.push('HALLAZGOS CLAVE:');
        opts.keyInsights.forEach(i => parts.push(`  • ${stripMarkdown(i)}`));
    }
    if (opts.recommendations?.length) {
        parts.push('');
        parts.push('RECOMENDACIONES:');
        opts.recommendations.forEach((r, idx) => parts.push(`  ${idx + 1}. ${stripMarkdown(r)}`));
    }

    parts.push('');
    parts.push(`— Generado por Kesito${opts.aiModel ? ` (${opts.aiModel})` : ''}`);
    parts.push(new Date().toLocaleString('es-MX'));

    return parts.join('\n');
}

/** Markdown versión (para pegar en docs o Slack) */
export function formatAsMarkdown(opts: PdfExportOptions): string {
    const parts: string[] = [];
    parts.push(`### ${opts.question}`);
    parts.push('');
    parts.push(opts.analysis);

    if (opts.keyInsights?.length) {
        parts.push('');
        parts.push('**Hallazgos clave:**');
        opts.keyInsights.forEach(i => parts.push(`- ${i}`));
    }
    if (opts.recommendations?.length) {
        parts.push('');
        parts.push('**Recomendaciones:**');
        opts.recommendations.forEach((r, idx) => parts.push(`${idx + 1}. ${r}`));
    }

    parts.push('');
    parts.push(`*Generado por Kesito${opts.aiModel ? ` (${opts.aiModel})` : ''} — ${new Date().toLocaleString('es-MX')}*`);

    return parts.join('\n');
}
