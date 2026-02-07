"use client";
import { useState, useEffect } from 'react';
import { ResultsDisplay } from '@/components/results-display';
import { ThemeToggle } from '@/components/theme-toggle';
import { BrainCircuit, Home, LogOut } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

export default function SalesPage() {
    const router = useRouter();
    const [sucursales, setSucursales] = useState<{ IdTienda: number, Tienda: string }[]>([]);
    const [sucursal, setSucursal] = useState('all');
    const [groupBy, setGroupBy] = useState('detalle');
    const [fechaInicio, setFechaInicio] = useState('');
    const [fechaFin, setFechaFin] = useState('');
    const [results, setResults] = useState<any[]>([]); // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const [loading, setLoading] = useState(false);
    const [user, setUser] = useState<{ name: string } | null>(null);

    // Initial load: User and Branches
    useEffect(() => {
        // Set default dates to today
        const today = new Date().toISOString().split('T')[0];
        setFechaInicio(today);
        setFechaFin(today);

        // Fetch User
        fetch('/api/auth/me')
            .then(res => res.json())
            .then(data => {
                if (data.user) setUser(data.user);
            })
            .catch(err => console.error(err));

        // Fetch Sucursales
        fetch('/api/sucursales')
            .then(res => res.json())
            .then(data => {
                if (Array.isArray(data)) {
                    setSucursales(data);
                }
            })
            .catch(err => console.error(err));
    }, []);

    const handleSearch = async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/ventas', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    sucursalId: sucursal === 'all' ? null : sucursal,
                    fechaInicio,
                    fechaFin,
                    groupBy
                })
            });
            const data = await res.json();
            if (data.data) {
                setResults(data.data);
            }
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    const handleLogout = async () => {
        try {
            await fetch('/api/auth/logout', { method: 'POST' });
            window.location.href = '/login';
        } catch (error) {
            console.error('Error logging out:', error);
        }
    };

    return (
        <main className="flex flex-col items-center min-h-screen bg-background pt-24">
            <header className="fixed top-0 left-0 w-full flex justify-between items-center p-4 bg-background z-50 border-b shadow-sm">
                <div className="flex flex-col items-start px-4">
                    <h1 className="text-3xl font-bold flex items-center gap-2">
                        <BrainCircuit className="w-8 h-8 text-primary" />
                        Kesos iA - Ventas
                    </h1>
                    {user && (
                        <div className="flex items-center gap-2 mt-1 text-sm text-muted-foreground">
                            <span>Hola, {user.name}</span>
                            <button
                                onClick={handleLogout}
                                className="text-red-500 hover:text-red-700 hover:underline"
                            >
                                <LogOut className="w-4 h-4 inline mr-1" />
                                (Salir)
                            </button>
                        </div>
                    )}
                </div>
                <div className="px-4 flex items-center gap-4">
                    <Link href="/" className="flex items-center gap-2 text-primary hover:underline font-medium">
                        <Home className="w-5 h-5" />
                        Ir al Chat
                    </Link>
                    <ThemeToggle />
                </div>
            </header>

            <div className="w-full max-w-6xl flex flex-col flex-grow px-4 pb-8">
                {/* Filters */}
                <div className="flex flex-wrap items-end gap-4 bg-muted/30 p-4 rounded-lg border border-border mb-6">
                    <div className="flex flex-col space-y-1.5">
                        <label htmlFor="sucursal" className="text-sm font-medium">Sucursal</label>
                        <select
                            id="sucursal"
                            value={sucursal}
                            onChange={(e) => setSucursal(e.target.value)}
                            className="flex h-10 w-[200px] items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                            <option value="all">Todas las sucursales</option>
                            {sucursales.map(s => (
                                <option key={s.IdTienda} value={s.IdTienda}>{s.Tienda}</option>
                            ))}
                        </select>
                    </div>

                    <div className="flex flex-col space-y-1.5">
                        <label htmlFor="groupBy" className="text-sm font-medium">Agrupar por</label>
                        <select
                            id="groupBy"
                            value={groupBy}
                            onChange={(e) => setGroupBy(e.target.value)}
                            className="flex h-10 w-[180px] items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                            <option value="detalle">Detalle</option>
                            <option value="sucursal">Sucursal</option>
                            <option value="producto">Producto</option>
                            <option value="departamento">Departamento</option>
                            <option value="proveedor">Proveedor</option>
                            <option value="mes">Mes</option>
                            <option value="anio">Año</option>
                            <option value="dia_semana">Día Semana</option>
                            <option value="hora">Hora</option>
                        </select>
                    </div>

                    <div className="flex flex-col space-y-1.5">
                        <label htmlFor="fechaInicio" className="text-sm font-medium">Fecha Inicio</label>
                        <input
                            type="date"
                            id="fechaInicio"
                            value={fechaInicio}
                            onChange={(e) => setFechaInicio(e.target.value)}
                            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                        />
                    </div>

                    <div className="flex flex-col space-y-1.5">
                        <label htmlFor="fechaFin" className="text-sm font-medium">Fecha Fin</label>
                        <input
                            type="date"
                            id="fechaFin"
                            value={fechaFin}
                            onChange={(e) => setFechaFin(e.target.value)}
                            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                        />
                    </div>

                    <button
                        onClick={handleSearch}
                        disabled={loading}
                        className="h-10 px-4 py-2 bg-primary text-primary-foreground hover:bg-primary/90 inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50"
                    >
                        {loading ? 'Buscando...' : 'Buscar Ventas'}
                    </button>
                </div>

                {/* Results */}
                {results.length > 0 ? (
                    <div className="animate-in fade-in zoom-in duration-300">
                        <ResultsDisplay
                            data={results}
                            sql="Reporte de Ventas por Filtros"
                            visualization="table"
                        />
                    </div>
                ) : (
                    <div className="flex flex-col items-center justify-center min-h-[300px] text-muted-foreground border-2 border-dashed border-muted rounded-lg p-8 text-center">
                        <p className="text-lg font-medium">Sin resultados</p>
                        <p className="text-sm">Selecciona los filtros y haz clic en "Buscar Ventas" para ver los datos.</p>
                    </div>
                )}
            </div>
        </main>
    );
}
