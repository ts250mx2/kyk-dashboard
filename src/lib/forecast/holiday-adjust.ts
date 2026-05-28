import { HistoryPoint } from './seasonal-moving-average';
import { Holiday, mexicanHolidaysForYear } from './mx-holidays';

const DAY_MS = 24 * 60 * 60 * 1000;

function parseDate(s: string): Date {
    return new Date(`${s}T00:00:00`);
}

function toISO(d: Date): string {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
}

/**
 * For each forecast-horizon holiday, compute a multiplier:
 *    multiplier = sales_on_same_holiday_last_year / avg_sales_in_normal_window_last_year
 *
 * "normal window" = ±10 days around the last-year holiday, same day-of-week samples.
 * Returns a map keyed by forecast date.
 */
export function computeHolidayBoosts(
    history: HistoryPoint[],
    forecastStart: string,
    forecastEnd: string,
): Map<string, { multiplier: number; sourceFecha: string; holidayName: string }> {
    const boosts = new Map<string, { multiplier: number; sourceFecha: string; holidayName: string }>();
    if (history.length === 0) return boosts;

    const totalsByDate = new Map<string, number>();
    for (const h of history) totalsByDate.set(h.fecha, h.total);

    const fcStart = parseDate(forecastStart);
    const fcEnd = parseDate(forecastEnd);

    const years = new Set<number>([fcStart.getFullYear(), fcEnd.getFullYear()]);
    const forecastHolidays: Holiday[] = Array.from(years)
        .flatMap(y => mexicanHolidaysForYear(y))
        .filter(h => h.fecha >= forecastStart && h.fecha <= forecastEnd && h.impact !== 'low');

    for (const h of forecastHolidays) {
        const target = parseDate(h.fecha);
        const lastYearDate = new Date(target.getTime() - 365 * DAY_MS);
        const lyKey = toISO(lastYearDate);
        const lyValue = totalsByDate.get(lyKey);
        if (lyValue === undefined || lyValue <= 0) continue;

        const dow = lastYearDate.getDay();
        const normalSamples: number[] = [];
        for (let offset = -14; offset <= 14; offset++) {
            if (Math.abs(offset) < 3) continue; // exclude the holiday and the immediate vicinity
            const d = new Date(lastYearDate.getTime() + offset * DAY_MS);
            if (d.getDay() !== dow) continue;
            const v = totalsByDate.get(toISO(d));
            if (v !== undefined && v > 0) normalSamples.push(v);
        }

        if (normalSamples.length < 2) continue;
        const normalAvg = normalSamples.reduce((a, b) => a + b, 0) / normalSamples.length;
        if (normalAvg <= 0) continue;

        const rawMultiplier = lyValue / normalAvg;
        const clamped = Math.max(0.3, Math.min(4, rawMultiplier));

        boosts.set(h.fecha, {
            multiplier: clamped,
            sourceFecha: lyKey,
            holidayName: h.name,
        });
    }

    return boosts;
}
