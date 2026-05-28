export type HistoryPoint = {
    fecha: string;
    total: number;
};

export type ForecastPoint = {
    fecha: string;
    predicted: number;
    lower: number;
    upper: number;
};

export type BacktestPoint = {
    fecha: string;
    actual: number;
    predicted: number;
    absPctError: number | null;
};

export type ForecastResult = {
    forecast: ForecastPoint[];
    trend: number;
    confidence: number;
    mape: number | null;
    backtest: BacktestPoint[];
};

const DAY_MS = 24 * 60 * 60 * 1000;

function parseDate(s: string): Date {
    return new Date(`${s}T00:00:00`);
}

function toISODate(d: Date): string {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
}

function average(nums: number[]): number {
    if (nums.length === 0) return 0;
    return nums.reduce((a, b) => a + b, 0) / nums.length;
}

function stdDev(nums: number[]): number {
    if (nums.length < 2) return 0;
    const avg = average(nums);
    const variance = nums.reduce((acc, n) => acc + (n - avg) ** 2, 0) / (nums.length - 1);
    return Math.sqrt(variance);
}

export type HolidayBoost = {
    multiplier: number;
    sourceFecha: string;
    holidayName: string;
};

/**
 * Weighted seasonal moving average by day-of-week.
 * Recent weeks weigh more. Adjusted by month-over-month trend.
 * Optional holidayBoosts: map of forecast date -> multiplier to apply for known holidays.
 */
export function forecastSeasonalMA(
    history: HistoryPoint[],
    horizonDays: number,
    holidayBoosts?: Map<string, HolidayBoost>,
): ForecastResult {
    if (history.length === 0) {
        return { forecast: [], trend: 0, confidence: 0, mape: null, backtest: [] };
    }

    const sorted = [...history].sort((a, b) => a.fecha.localeCompare(b.fecha));
    const lastDate = parseDate(sorted[sorted.length - 1].fecha);

    const byDow: Record<number, { value: number; weeksAgo: number }[]> = {};
    for (let i = 0; i < 7; i++) byDow[i] = [];

    for (const point of sorted) {
        const d = parseDate(point.fecha);
        const dow = d.getDay();
        const weeksAgo = Math.floor((lastDate.getTime() - d.getTime()) / (7 * DAY_MS));
        if (weeksAgo <= 8) {
            byDow[dow].push({ value: point.total, weeksAgo });
        }
    }

    const dowAvg: Record<number, number> = {};
    const dowStd: Record<number, number> = {};
    for (let dow = 0; dow < 7; dow++) {
        const samples = byDow[dow];
        if (samples.length === 0) {
            dowAvg[dow] = 0;
            dowStd[dow] = 0;
            continue;
        }
        let weightedSum = 0;
        let weightTotal = 0;
        for (const s of samples) {
            const weight = 1 / (1 + s.weeksAgo);
            weightedSum += s.value * weight;
            weightTotal += weight;
        }
        dowAvg[dow] = weightTotal > 0 ? weightedSum / weightTotal : 0;
        dowStd[dow] = stdDev(samples.map(s => s.value));
    }

    const last30Cutoff = new Date(lastDate.getTime() - 30 * DAY_MS);
    const prev30Cutoff = new Date(lastDate.getTime() - 60 * DAY_MS);
    const last30 = sorted.filter(p => parseDate(p.fecha) > last30Cutoff);
    const prev30 = sorted.filter(p => {
        const d = parseDate(p.fecha);
        return d > prev30Cutoff && d <= last30Cutoff;
    });
    const last30Sum = last30.reduce((a, b) => a + b.total, 0);
    const prev30Sum = prev30.reduce((a, b) => a + b.total, 0);
    const trend = prev30Sum > 0 ? (last30Sum - prev30Sum) / prev30Sum : 0;
    const clampedTrend = Math.max(-0.4, Math.min(0.4, trend));

    const forecast: ForecastPoint[] = [];
    for (let i = 1; i <= horizonDays; i++) {
        const targetDate = new Date(lastDate.getTime() + i * DAY_MS);
        const dow = targetDate.getDay();
        const fecha = toISODate(targetDate);
        const base = dowAvg[dow] * (1 + clampedTrend);
        const sigma = dowStd[dow];

        const boost = holidayBoosts?.get(fecha);
        const multiplier = boost ? boost.multiplier : 1;
        const adjusted = base * multiplier;
        // Widen confidence band on holidays to reflect added uncertainty.
        const adjustedSigma = boost ? sigma * Math.max(1, multiplier) : sigma;

        forecast.push({
            fecha,
            predicted: Math.max(0, Math.round(adjusted)),
            lower: Math.max(0, Math.round(adjusted - adjustedSigma)),
            upper: Math.round(adjusted + adjustedSigma),
        });
    }

    const { mape, points: backtest } = computeBacktest(sorted);
    const avgPred = average(forecast.map(f => f.predicted));
    const avgSigma = average(forecast.map(f => (f.upper - f.lower) / 2));
    const confidence = avgPred > 0 ? Math.max(0, Math.min(1, 1 - avgSigma / avgPred)) : 0;

    return {
        forecast,
        trend: clampedTrend,
        confidence,
        mape,
        backtest,
    };
}

/**
 * Backtest the last 14 days: predict each using only prior data, compare to actual.
 * Returns both per-day points and the aggregate MAPE.
 */
function computeBacktest(sorted: HistoryPoint[]): { mape: number | null; points: BacktestPoint[] } {
    if (sorted.length < 35) return { mape: null, points: [] };
    const backtestDays = 14;
    const points: BacktestPoint[] = [];

    for (let i = sorted.length - backtestDays; i < sorted.length; i++) {
        const actual = sorted[i].total;
        const target = parseDate(sorted[i].fecha);
        const dow = target.getDay();

        const sameDowPrior: { value: number; weeksAgo: number }[] = [];
        for (let j = 0; j < i; j++) {
            const d = parseDate(sorted[j].fecha);
            if (d.getDay() !== dow) continue;
            const weeksAgo = Math.floor((target.getTime() - d.getTime()) / (7 * DAY_MS));
            if (weeksAgo > 0 && weeksAgo <= 8) {
                sameDowPrior.push({ value: sorted[j].total, weeksAgo });
            }
        }
        if (sameDowPrior.length === 0) continue;

        let weightedSum = 0;
        let weightTotal = 0;
        for (const s of sameDowPrior) {
            const weight = 1 / (1 + s.weeksAgo);
            weightedSum += s.value * weight;
            weightTotal += weight;
        }
        const predicted = weightTotal > 0 ? weightedSum / weightTotal : 0;
        const absPctError = actual > 0 ? Math.abs(actual - predicted) / actual : null;
        points.push({
            fecha: sorted[i].fecha,
            actual,
            predicted: Math.round(predicted),
            absPctError,
        });
    }

    const validErrors = points.map(p => p.absPctError).filter((e): e is number => e !== null);
    if (validErrors.length === 0) return { mape: null, points };
    return { mape: average(validErrors), points };
}
