import type { ForecastPoint } from './seasonal-moving-average';

export type OverrideMode = 'pct' | 'delta' | 'replace';

export type BucketOverride = {
    mode: OverrideMode;
    value: number;
};

/**
 * Apply day-level absolute overrides to a forecast.
 * The override is the FINAL predicted value for that day (not a delta).
 * The confidence band is scaled proportionally to preserve relative uncertainty.
 */
export function applyOverridesToForecast(
    forecast: ForecastPoint[],
    overrides: Record<string, number>
): ForecastPoint[] {
    if (Object.keys(overrides).length === 0) return forecast;
    return forecast.map(p => {
        if (!(p.fecha in overrides)) return p;
        const newPred = Math.max(0, overrides[p.fecha]);
        const ratio = p.predicted > 0 ? newPred / p.predicted : 1;
        return {
            fecha: p.fecha,
            predicted: Math.round(newPred),
            lower: Math.max(0, Math.round(p.lower * ratio)),
            upper: Math.max(0, Math.round(p.upper * ratio)),
        };
    });
}

/**
 * Convert a bucket-level override (e.g. for a week or month) into per-day
 * absolute overrides, distributing the adjustment proportionally to the
 * original day-level forecast.
 */
export function bucketOverrideToDayOverrides(
    bucketDays: ForecastPoint[],
    override: BucketOverride
): Record<string, number> {
    const out: Record<string, number> = {};
    if (bucketDays.length === 0) return out;

    const sum = bucketDays.reduce((a, b) => a + b.predicted, 0);

    if (override.mode === 'pct') {
        const mult = 1 + override.value / 100;
        for (const d of bucketDays) {
            out[d.fecha] = Math.max(0, d.predicted * mult);
        }
        return out;
    }

    if (override.mode === 'delta') {
        if (sum <= 0) {
            const per = override.value / bucketDays.length;
            for (const d of bucketDays) out[d.fecha] = Math.max(0, per);
            return out;
        }
        for (const d of bucketDays) {
            const share = d.predicted / sum;
            out[d.fecha] = Math.max(0, d.predicted + override.value * share);
        }
        return out;
    }

    // replace
    if (sum <= 0) {
        const per = override.value / bucketDays.length;
        for (const d of bucketDays) out[d.fecha] = Math.max(0, per);
        return out;
    }
    for (const d of bucketDays) {
        const share = d.predicted / sum;
        out[d.fecha] = Math.max(0, override.value * share);
    }
    return out;
}

/**
 * Sum the original (un-overridden) per-store predicted values on a date,
 * restricted to a subset of stores.
 */
export function sumStoreForecastOnDate(
    forecastByStore: Record<number, ForecastPoint[]>,
    storeIds: number[],
    fecha: string
): number {
    let s = 0;
    for (const sid of storeIds) {
        const pt = (forecastByStore[sid] || []).find(p => p.fecha === fecha);
        if (pt) s += pt.predicted;
    }
    return s;
}
