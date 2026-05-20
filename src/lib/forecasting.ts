/**
 * Forecasting de series temporales — regresión lineal + estacionalidad semanal.
 *
 * Pensado para ventas, tickets y métricas operativas con estacionalidad de
 * 7 días (los sábados son más altos, los lunes más bajos, etc.).
 *
 * Algoritmo:
 *   1. Calcula tendencia con regresión lineal sobre el índice de día (0..N-1).
 *   2. Calcula los residuos vs la tendencia.
 *   3. Promedia los residuos por día de la semana → factor estacional.
 *   4. Proyecta: tendencia(t) + factor_estacional(día_semana(t)).
 *   5. Intervalo de confianza: ±1.96 * std(residuos) para ~95%.
 *
 * NO usa LLM. Es determinístico, rápido, y suficiente para horizontes
 * cortos (7-30 días) sobre datos retail estables. Para horizontes largos
 * o cambios estructurales (apertura nueva sucursal, promoción) el modelo
 * subestima — por eso devolvemos también un confidence score.
 */

export interface SeriesPoint {
    date: string; // YYYY-MM-DD
    value: number;
}

export interface ForecastPoint {
    date: string;
    pointEstimate: number;
    lowerBound: number;
    upperBound: number;
}

export interface ForecastResult {
    forecast: ForecastPoint[];
    /** "high" | "medium" | "low" basado en R² + número de puntos históricos */
    confidence: 'high' | 'medium' | 'low';
    /** R² de la regresión: 0=mal ajuste, 1=perfecto */
    r2: number;
    /** Texto narrativo listo para inyectar en respuesta */
    summary: string;
}

function addDays(date: string, days: number): string {
    const d = new Date(date);
    d.setDate(d.getDate() + days);
    return d.toISOString().slice(0, 10);
}

function dayOfWeek(date: string): number {
    return new Date(date).getDay(); // 0=domingo, 6=sábado
}

/**
 * Detecta si una pregunta del usuario tiene intención de pronóstico.
 * Heurística por keywords — barato y suficiente.
 */
export function detectForecastIntent(prompt: string): { wants: boolean; daysAhead: number } {
    const lower = prompt.toLowerCase();
    const forecastMarkers = [
        'predicción', 'prediccion', 'predice',
        'pronóstico', 'pronostico', 'pronostica', 'pronosticar',
        'proyección', 'proyeccion', 'proyecta',
        'próxima semana', 'proxima semana',
        'próximo mes', 'proximo mes',
        'vamos a vender', 'vamos a tener',
        'cuánto venderemos', 'cuanto venderemos',
        'forecast', 'estimación', 'estimacion'
    ];
    const wants = forecastMarkers.some(m => lower.includes(m));
    if (!wants) return { wants: false, daysAhead: 0 };

    let daysAhead = 7;
    if (lower.includes('mes') || lower.includes('30 días') || lower.includes('30 dias')) daysAhead = 30;
    else if (lower.includes('15 días') || lower.includes('15 dias') || lower.includes('quincena')) daysAhead = 15;
    else if (lower.includes('semana')) daysAhead = 7;
    else if (lower.includes('mañana') || lower.includes('manana')) daysAhead = 1;

    return { wants, daysAhead };
}

/**
 * Convierte filas SQL a serie temporal {date, value}.
 * Detecta automáticamente la columna fecha (primera Date/string de fecha)
 * y la métrica (primera numérica de mayor magnitud).
 */
export function rowsToSeries(rows: any[]): SeriesPoint[] {
    if (!rows || rows.length === 0) return [];
    const sample = rows[0];
    const cols = Object.keys(sample);

    const dateCol = cols.find(c => {
        const v = sample[c];
        if (v instanceof Date) return true;
        if (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}/.test(v)) return true;
        return false;
    });
    if (!dateCol) return [];

    const numericCols = cols.filter(c => c !== dateCol && typeof sample[c] === 'number');
    if (numericCols.length === 0) return [];

    // Métrica = numérica con mayor magnitud absoluta promedio
    const metricCol = numericCols.reduce((best, c) => {
        const avgC = rows.reduce((s, r) => s + Math.abs(Number(r[c]) || 0), 0) / rows.length;
        const avgBest = rows.reduce((s, r) => s + Math.abs(Number(r[best]) || 0), 0) / rows.length;
        return avgC > avgBest ? c : best;
    }, numericCols[0]);

    return rows.map(r => {
        const v = r[dateCol];
        const date = v instanceof Date ? v.toISOString().slice(0, 10) : String(v).slice(0, 10);
        return { date, value: Number(r[metricCol]) || 0 };
    }).filter(p => p.date && !isNaN(p.value)).sort((a, b) => a.date.localeCompare(b.date));
}

/** Genera proyección para los próximos N días */
export function forecastSeries(series: SeriesPoint[], daysAhead: number): ForecastResult | null {
    if (!series || series.length < 7) {
        return null; // Necesitamos al menos 7 días para estacionalidad semanal
    }

    const n = series.length;
    const indices = series.map((_, i) => i);
    const values = series.map(p => p.value);

    // Regresión lineal: y = m*x + b
    const meanX = indices.reduce((s, x) => s + x, 0) / n;
    const meanY = values.reduce((s, y) => s + y, 0) / n;
    let num = 0;
    let den = 0;
    for (let i = 0; i < n; i++) {
        num += (indices[i] - meanX) * (values[i] - meanY);
        den += (indices[i] - meanX) ** 2;
    }
    const m = den === 0 ? 0 : num / den;
    const b = meanY - m * meanX;
    const trend = (x: number) => m * x + b;

    // R² para confianza
    const ssRes = values.reduce((s, y, i) => s + (y - trend(i)) ** 2, 0);
    const ssTot = values.reduce((s, y) => s + (y - meanY) ** 2, 0);
    const r2 = ssTot === 0 ? 0 : Math.max(0, 1 - ssRes / ssTot);

    // Estacionalidad semanal: promedio de residuos por día de la semana
    const dowResiduals: number[][] = Array.from({ length: 7 }, () => []);
    for (let i = 0; i < n; i++) {
        const residual = values[i] - trend(i);
        dowResiduals[dayOfWeek(series[i].date)].push(residual);
    }
    const dowFactor = dowResiduals.map(arr =>
        arr.length === 0 ? 0 : arr.reduce((s, v) => s + v, 0) / arr.length
    );

    // Std de residuos (con estacionalidad aplicada) para intervalos
    let sumSqRes = 0;
    for (let i = 0; i < n; i++) {
        const predicted = trend(i) + dowFactor[dayOfWeek(series[i].date)];
        sumSqRes += (values[i] - predicted) ** 2;
    }
    const std = Math.sqrt(sumSqRes / n);
    const halfWidth = 1.96 * std;

    // Proyección
    const lastDate = series[series.length - 1].date;
    const forecast: ForecastPoint[] = [];
    for (let i = 1; i <= daysAhead; i++) {
        const futureDate = addDays(lastDate, i);
        const x = n - 1 + i;
        const point = trend(x) + dowFactor[dayOfWeek(futureDate)];
        forecast.push({
            date: futureDate,
            pointEstimate: Math.max(0, Math.round(point)),
            lowerBound: Math.max(0, Math.round(point - halfWidth)),
            upperBound: Math.max(0, Math.round(point + halfWidth))
        });
    }

    // Confianza
    const confidence: ForecastResult['confidence'] =
        r2 >= 0.7 && n >= 21 ? 'high' :
            r2 >= 0.4 && n >= 14 ? 'medium' :
                'low';

    // Resumen narrativo
    const totalForecast = forecast.reduce((s, p) => s + p.pointEstimate, 0);
    const trendDirection = m > 0 ? 'ascendente' : m < 0 ? 'descendente' : 'plana';
    const fmt = (n: number) => new Intl.NumberFormat('es-MX', { maximumFractionDigits: 0 }).format(n);
    const summary = `Proyección a ${daysAhead} días: ~${fmt(totalForecast)} acumulado ` +
        `(rango ${fmt(forecast.reduce((s, p) => s + p.lowerBound, 0))}–${fmt(forecast.reduce((s, p) => s + p.upperBound, 0))}). ` +
        `Tendencia ${trendDirection} con R²=${r2.toFixed(2)}. Confianza: ${confidence}.`;

    return { forecast, confidence, r2, summary };
}

/** Bloque de texto compacto para inyectar en el meta-prompt */
export function formatForecastForPrompt(result: ForecastResult, metricName = 'la métrica'): string {
    const sample = result.forecast.slice(0, 7).map(p =>
        `  ${p.date}: ~${p.pointEstimate.toLocaleString('es-MX')} (rango ${p.lowerBound.toLocaleString('es-MX')}-${p.upperBound.toLocaleString('es-MX')})`
    ).join('\n');
    return `
PROYECCIÓN AUTOMÁTICA (${result.forecast.length} días, confianza ${result.confidence}, R²=${result.r2.toFixed(2)}):
${sample}
${result.forecast.length > 7 ? `  ... y ${result.forecast.length - 7} días más` : ''}

Resumen: ${result.summary}

INSTRUCCIONES: Incorpora esta proyección en tu respuesta de forma natural.
- Si confianza="high": di la proyección con confianza ("esperamos ~$X la próxima semana").
- Si confianza="medium": matiza ("la proyección estima ~$X, pero puede variar").
- Si confianza="low": menciona el rango y advierte ("histórico muy variable, rango amplio $X-$Y").
- SIEMPRE menciona el horizonte (próximos N días).
`;
}
