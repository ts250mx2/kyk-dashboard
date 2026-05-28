export type Holiday = {
    fecha: string;
    name: string;
    impact: 'high' | 'medium' | 'low';
};

function nthWeekday(year: number, month: number, weekday: number, n: number): Date {
    const first = new Date(year, month, 1);
    const offset = (weekday - first.getDay() + 7) % 7;
    return new Date(year, month, 1 + offset + (n - 1) * 7);
}

function lastFridayOfMonth(year: number, month: number): Date {
    const last = new Date(year, month + 1, 0);
    const offset = (last.getDay() - 5 + 7) % 7;
    return new Date(year, month, last.getDate() - offset);
}

function fmt(d: Date): string {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
}

export function mexicanHolidaysForYear(year: number): Holiday[] {
    return [
        { fecha: `${year}-01-01`, name: 'Año Nuevo', impact: 'high' },
        { fecha: fmt(nthWeekday(year, 1, 1, 1)), name: 'Día de la Constitución', impact: 'low' },
        { fecha: fmt(nthWeekday(year, 2, 1, 3)), name: 'Natalicio de Juárez', impact: 'low' },
        { fecha: `${year}-05-01`, name: 'Día del Trabajo', impact: 'medium' },
        { fecha: `${year}-05-10`, name: 'Día de las Madres', impact: 'high' },
        { fecha: `${year}-09-15`, name: 'Grito de Independencia', impact: 'high' },
        { fecha: `${year}-09-16`, name: 'Día de la Independencia', impact: 'high' },
        { fecha: `${year}-11-01`, name: 'Día de Todos los Santos', impact: 'medium' },
        { fecha: `${year}-11-02`, name: 'Día de Muertos', impact: 'high' },
        { fecha: fmt(nthWeekday(year, 10, 1, 3)), name: 'Revolución Mexicana', impact: 'low' },
        { fecha: `${year}-12-12`, name: 'Día de la Virgen', impact: 'medium' },
        { fecha: `${year}-12-24`, name: 'Nochebuena', impact: 'high' },
        { fecha: `${year}-12-25`, name: 'Navidad', impact: 'high' },
        { fecha: `${year}-12-31`, name: 'Fin de Año', impact: 'high' },
        { fecha: fmt(lastFridayOfMonth(year, 10)), name: 'Buen Fin', impact: 'high' },
    ];
}

export function getHolidaysInRange(start: string, end: string): Holiday[] {
    const startDate = new Date(`${start}T00:00:00`);
    const endDate = new Date(`${end}T00:00:00`);
    const years = new Set<number>();
    years.add(startDate.getFullYear());
    years.add(endDate.getFullYear());

    const all = Array.from(years).flatMap(y => mexicanHolidaysForYear(y));
    return all
        .filter(h => h.fecha >= start && h.fecha <= end)
        .sort((a, b) => a.fecha.localeCompare(b.fecha));
}
