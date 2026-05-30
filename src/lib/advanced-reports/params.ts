/**
 * Sustitución SEGURA de parámetros en el SQL de un reporte.
 *
 * El SQL guardado usa tokens `{{token}}`. Aquí los reemplazamos por fragmentos
 * SQL validados según el tipo del parámetro. El resultado SIEMPRE pasa después
 * por assertReadOnly() en el caller, y los valores se validan/escapan aquí:
 *   - date:      'YYYY-MM-DD' validado (o default / fecha segura)
 *   - number:    número validado
 *   - storeList: lista de enteros (n,n,n); vacío → todas las sucursales (subquery)
 *   - text:      '%texto%' con comillas escapadas; vacío → '%' (todo)
 */

import type { ReportParam } from './types';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function todayISO(): string {
    return new Date().toISOString().slice(0, 10);
}

function escapeLiteral(s: string): string {
    return s.replace(/'/g, "''");
}

function fragmentFor(p: ReportParam, rawValue: string | undefined): string {
    const raw = (rawValue ?? p.defaultValue ?? '').toString().trim();
    switch (p.kind) {
        case 'date': {
            if (DATE_RE.test(raw)) return `'${raw}'`;
            const def = (p.defaultValue || '').toString().trim();
            if (DATE_RE.test(def)) return `'${def}'`;
            return `'${todayISO()}'`;
        }
        case 'number': {
            const n = Number(raw);
            return Number.isFinite(n) ? String(n) : '0';
        }
        case 'storeList': {
            const ids = raw
                .split(',')
                .map((s) => Number(s.trim()))
                .filter((n) => Number.isFinite(n) && n > 0);
            return ids.length > 0
                ? `(${ids.join(',')})`
                : `(SELECT IdTienda FROM tblTiendas WHERE Status = 0)`;
        }
        case 'text': {
            const t = escapeLiteral(raw);
            return t ? `'%${t}%'` : `'%'`;
        }
        default:
            return `''`;
    }
}

/** Reemplaza todos los `{{token}}` del SQL por fragmentos seguros. */
export function substituteParams(
    sql: string,
    params: ReportParam[] | undefined,
    values: Record<string, string> = {}
): string {
    if (!params || params.length === 0) return sql;
    let out = sql;
    for (const p of params) {
        if (!p || !p.token) continue;
        const frag = fragmentFor(p, values[p.token]);
        out = out.split(`{{${p.token}}}`).join(frag);
    }
    return out;
}
