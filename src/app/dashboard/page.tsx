"use client";

import { useState, useEffect } from 'react';
import {
    TrendingUp,
    ShoppingCart,
    Ticket,
    Calendar,
    AlertCircle,
    Wallet,
    Store,
    ArrowUpRight,
    ArrowDownRight,
    Search,
    X,
    Maximize2,
    Minimize2,
    FileText,
    User,
    CreditCard,
    ChevronUp,
    ChevronDown,
    Package,
    FileSpreadsheet,
    FileDown,
    RotateCcw
} from 'lucide-react';
import * as XLSX from 'xlsx';
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    Cell,
    PieChart,
    Pie,
    Legend
} from 'recharts';
import { cn } from '@/lib/utils';

export default function DashboardPage() {
    const [fechaInicio, setFechaInicio] = useState(new Date().toISOString().split('T')[0]);
    const [fechaFin, setFechaFin] = useState(new Date().toISOString().split('T')[0]);
    const [loading, setLoading] = useState(true);
    const [data, setData] = useState<any>(null);
    const [selectedMetric, setSelectedMetric] = useState<'ventas' | 'aperturas' | 'cancelaciones' | 'retiros' | 'devoluciones'>('ventas');
    const [chartType, setChartType] = useState<'bar' | 'pie'>('bar');
    const [subMetric, setSubMetric] = useState<string>('Total');

    // Modal state
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isMaximized, setIsMaximized] = useState(false);
    const [selectedStoreData, setSelectedStoreData] = useState<any>(null);
    const [ticketDetails, setTicketDetails] = useState<any[]>([]);
    const [loadingDetails, setLoadingDetails] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [sortConfig, setSortConfig] = useState<{ key: string, direction: 'asc' | 'desc' } | null>({ key: 'Fecha Venta', direction: 'desc' });

    // Secondary Modal (Ticket Items)
    const [isItemsModalOpen, setIsItemsModalOpen] = useState(false);
    const [selectedTicket, setSelectedTicket] = useState<any>(null);
    const [ticketItems, setTicketItems] = useState<any[]>([]);
    const [loadingItems, setLoadingItems] = useState(false);

    // Opening Modal
    const [isOpeningModalOpen, setIsOpeningModalOpen] = useState(false);
    const [openingDetails, setOpeningDetails] = useState<any[]>([]);
    const [loadingOpenings, setLoadingOpenings] = useState(false);
    const [openingSortConfig, setOpeningSortConfig] = useState<{ key: string, direction: 'asc' | 'desc' } | null>({ key: 'Fecha Apertura', direction: 'desc' });

    // Cancellation Modal
    const [isCancellationModalOpen, setIsCancellationModalOpen] = useState(false);
    const [cancellationDetails, setCancellationDetails] = useState<any[]>([]);
    const [loadingCancellations, setLoadingCancellations] = useState(false);
    const [cancellationSortConfig, setCancellationSortConfig] = useState<{ key: string, direction: 'asc' | 'desc' } | null>({ key: 'FechaCancelacion', direction: 'desc' });

    // Withdrawal Modal
    const [isWithdrawalModalOpen, setIsWithdrawalModalOpen] = useState(false);
    const [withdrawalDetails, setWithdrawalDetails] = useState<any[]>([]);
    const [loadingWithdrawals, setLoadingWithdrawals] = useState(false);
    const [withdrawalSortConfig, setWithdrawalSortConfig] = useState<{ key: string, direction: 'asc' | 'desc' } | null>({ key: 'Fecha Retiro', direction: 'desc' });

    // Return Modal
    const [isReturnModalOpen, setIsReturnModalOpen] = useState(false);
    const [returnDetails, setReturnDetails] = useState<any[]>([]);
    const [loadingReturns, setLoadingReturns] = useState(false);
    const [returnSortConfig, setReturnSortConfig] = useState<{ key: string, direction: 'asc' | 'desc' } | null>({ key: 'Fecha', direction: 'desc' });

    // Return Items Modal
    const [isReturnItemsModalOpen, setIsReturnItemsModalOpen] = useState(false);
    const [selectedReturn, setSelectedReturn] = useState<any>(null);
    const [returnItems, setReturnItems] = useState<any[]>([]);
    const [loadingReturnItems, setLoadingReturnItems] = useState(false);
    const [returnItemsSortConfig, setReturnItemsSortConfig] = useState<{ key: string, direction: 'asc' | 'desc' } | null>(null);

    const fetchData = async () => {
        setLoading(true);
        try {
            const res = await fetch(`/api/dashboard/stats?fechaInicio=${fechaInicio}&fechaFin=${fechaFin}`);
            const json = await res.json();
            setData(json);
        } catch (error) {
            console.error('Error fetching dashboard data:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        const handleDateChange = (event: any) => {
            const { startDate, endDate } = event.detail;
            if (startDate && endDate) {
                setFechaInicio(startDate);
                setFechaFin(endDate);
            }
        };

        window.addEventListener('dashboard-date-change', handleDateChange);
        return () => window.removeEventListener('dashboard-date-change', handleDateChange);
    }, []);

    useEffect(() => {
        fetchData();
    }, [fechaInicio, fechaFin]);

    useEffect(() => {
        // Reset submetric when changing main metric
        if (selectedMetric === 'ventas') setSubMetric('Total');
        else if (selectedMetric === 'cancelaciones') setSubMetric('Total');
        else setSubMetric('Total');
    }, [selectedMetric]);

    const handleStoreClick = async (store: any) => {
        if (selectedMetric !== 'ventas' && selectedMetric !== 'aperturas' && selectedMetric !== 'cancelaciones' && selectedMetric !== 'retiros' && selectedMetric !== 'devoluciones') return;

        setSelectedStoreData(store);
        setSearchTerm('');

        if (selectedMetric === 'ventas') {
            setIsModalOpen(true);
            setLoadingDetails(true);
            try {
                const res = await fetch(`/api/dashboard/sales-details?fechaInicio=${fechaInicio}&fechaFin=${fechaFin}&idTienda=${store.IdTienda}`);
                const json = await res.json();
                setTicketDetails(json);
            } catch (error) {
                console.error('Error fetching ticket details:', error);
            } finally {
                setLoadingDetails(false);
            }
        } else if (selectedMetric === 'aperturas') {
            setIsOpeningModalOpen(true);
            setLoadingOpenings(true);
            try {
                const res = await fetch(`/api/dashboard/opening-details?fechaInicio=${fechaInicio}&fechaFin=${fechaFin}&idTienda=${store.IdTienda}`);
                const json = await res.json();
                setOpeningDetails(json);
            } catch (error) {
                console.error('Error fetching opening details:', error);
            } finally {
                setLoadingOpenings(false);
            }
        } else if (selectedMetric === 'cancelaciones') {
            setIsCancellationModalOpen(true);
            setLoadingCancellations(true);
            try {
                const res = await fetch(`/api/dashboard/cancellation-details?fechaInicio=${fechaInicio}&fechaFin=${fechaFin}&idTienda=${store.IdTienda}`);
                const json = await res.json();
                setCancellationDetails(json);
            } catch (error) {
                console.error('Error fetching cancellation details:', error);
            } finally {
                setLoadingCancellations(false);
            }
        } else if (selectedMetric === 'retiros') {
            setIsWithdrawalModalOpen(true);
            setLoadingWithdrawals(true);
            try {
                const res = await fetch(`/api/dashboard/withdrawal-details?fechaInicio=${fechaInicio}&fechaFin=${fechaFin}&idTienda=${store.IdTienda}`);
                const json = await res.json();
                setWithdrawalDetails(json);
            } catch (error) {
                console.error('Error fetching withdrawal details:', error);
            } finally {
                setLoadingWithdrawals(false);
            }
        } else if (selectedMetric === 'devoluciones') {
            setIsReturnModalOpen(true);
            setLoadingReturns(true);
            try {
                const res = await fetch(`/api/dashboard/returns-details?fechaInicio=${fechaInicio}&fechaFin=${fechaFin}&idTienda=${store.IdTienda}`);
                const json = await res.json();
                setReturnDetails(json);
            } catch (error) {
                console.error('Error fetching return details:', error);
            } finally {
                setLoadingReturns(false);
            }
        }
    };

    const handleReturnRowClick = async (item: any) => {
        setSelectedReturn(item);
        setIsReturnItemsModalOpen(true);
        setLoadingReturnItems(true);
        try {
            const res = await fetch(`/api/dashboard/return-items?idTienda=${selectedStoreData.IdTienda}&idDevolucionVenta=${item['Folio Devolucion']}`);
            const json = await res.json();
            setReturnItems(json);
        } catch (error) {
            console.error('Error fetching return items:', error);
        } finally {
            setLoadingReturnItems(false);
        }
    };

    const filteredTickets = ticketDetails.filter(t =>
        t.FolioVenta.toLowerCase().includes(searchTerm.toLowerCase()) ||
        t.Cajero.toLowerCase().includes(searchTerm.toLowerCase()) ||
        t.Z.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const sortedTickets = [...filteredTickets].sort((a, b) => {
        if (!sortConfig) return 0;
        const { key, direction } = sortConfig;

        let aValue = a[key];
        let bValue = b[key];

        if (aValue < bValue) return direction === 'asc' ? -1 : 1;
        if (aValue > bValue) return direction === 'asc' ? 1 : -1;
        return 0;
    });

    const handleSort = (key: string) => {
        let direction: 'asc' | 'desc' = 'asc';
        if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
            direction = 'desc';
        }
        setSortConfig({ key, direction });
    };

    const handleOpeningSort = (key: string) => {
        let direction: 'asc' | 'desc' = 'asc';
        if (openingSortConfig && openingSortConfig.key === key && openingSortConfig.direction === 'asc') {
            direction = 'desc';
        }
        setOpeningSortConfig({ key, direction });
    };

    const filteredOpenings = openingDetails.filter(o =>
        o.Cajero.toLowerCase().includes(searchTerm.toLowerCase()) ||
        o.Z.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const sortedOpenings = [...filteredOpenings].sort((a, b) => {
        if (!openingSortConfig) return 0;
        const { key, direction } = openingSortConfig;

        let aValue = a[key];
        let bValue = b[key];

        if (aValue < bValue) return direction === 'asc' ? -1 : 1;
        if (aValue > bValue) return direction === 'asc' ? 1 : -1;
        return 0;
    });

    const handleCancellationSort = (key: string) => {
        let direction: 'asc' | 'desc' = 'asc';
        if (cancellationSortConfig && cancellationSortConfig.key === key && cancellationSortConfig.direction === 'asc') {
            direction = 'desc';
        }
        setCancellationSortConfig({ key, direction });
    };

    const filteredCancellations = cancellationDetails.filter(c =>
        c['Folio Cancelacion'].toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.Cajero.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.Supervisor.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.Descripcion.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.Z.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const sortedCancellations = [...filteredCancellations].sort((a, b) => {
        if (!cancellationSortConfig) return 0;
        const { key, direction } = cancellationSortConfig;

        let aValue = a[key];
        let bValue = b[key];

        if (aValue < bValue) return direction === 'asc' ? -1 : 1;
        if (aValue > bValue) return direction === 'asc' ? 1 : -1;
        return 0;
    });

    const handleWithdrawalSort = (key: string) => {
        let direction: 'asc' | 'desc' = 'asc';
        if (withdrawalSortConfig && withdrawalSortConfig.key === key && withdrawalSortConfig.direction === 'asc') {
            direction = 'desc';
        }
        setWithdrawalSortConfig({ key, direction });
    };

    const filteredWithdrawals = withdrawalDetails.filter(w =>
        w['Folio Retiro'].toLowerCase().includes(searchTerm.toLowerCase()) ||
        w.Cajero.toLowerCase().includes(searchTerm.toLowerCase()) ||
        w.Supervisor.toLowerCase().includes(searchTerm.toLowerCase()) ||
        w.Concepto.toLowerCase().includes(searchTerm.toLowerCase()) ||
        w.Z.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const sortedWithdrawals = [...filteredWithdrawals].sort((a, b) => {
        if (!withdrawalSortConfig) return 0;
        const { key, direction } = withdrawalSortConfig;

        let aValue = a[key];
        let bValue = b[key];

        if (aValue < bValue) return direction === 'asc' ? -1 : 1;
        if (aValue > bValue) return direction === 'asc' ? 1 : -1;
        return 0;
    });

    const handleReturnSort = (key: string) => {
        let direction: 'asc' | 'desc' = 'asc';
        if (returnSortConfig && returnSortConfig.key === key && returnSortConfig.direction === 'asc') {
            direction = 'desc';
        }
        setReturnSortConfig({ key, direction });
    };

    const handleReturnItemsSort = (key: string) => {
        let direction: 'asc' | 'desc' = 'asc';
        if (returnItemsSortConfig && returnItemsSortConfig.key === key && returnItemsSortConfig.direction === 'asc') {
            direction = 'desc';
        }
        setReturnItemsSortConfig({ key, direction });
    };

    const filteredReturns = returnDetails.filter(r =>
        r['Folio Devolucion']?.toString().toLowerCase().includes(searchTerm.toLowerCase()) ||
        r.Cliente?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        r.Concepto?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        r.Empleado?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        r.Supervisor?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        r.Clave?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const sortedReturns = [...filteredReturns].sort((a, b) => {
        if (!returnSortConfig) return 0;
        const { key, direction } = returnSortConfig;

        let aValue = a[key];
        let bValue = b[key];

        if (aValue < bValue) return direction === 'asc' ? -1 : 1;
        if (aValue > bValue) return direction === 'asc' ? 1 : -1;
        return 0;
    });

    const sortedReturnItems = [...returnItems].sort((a, b) => {
        if (!returnItemsSortConfig) return 0;
        const { key, direction } = returnItemsSortConfig;

        let aValue = a[key];
        let bValue = b[key];

        if (aValue < bValue) return direction === 'asc' ? -1 : 1;
        if (aValue > bValue) return direction === 'asc' ? 1 : -1;
        return 0;
    });

    const handleTicketClick = async (ticket: any) => {
        setSelectedTicket(ticket);
        setIsItemsModalOpen(true);
        setLoadingItems(true);
        try {
            const res = await fetch(`/api/dashboard/ticket-items?idTienda=${ticket.IdTienda}&idCaja=${ticket.Caja}&idVenta=${ticket.IdVenta}`);
            const json = await res.json();
            setTicketItems(json);
        } catch (error) {
            console.error('Error fetching ticket items:', error);
        } finally {
            setLoadingItems(false);
        }
    };

    const handleOpeningClick = async (opening: any) => {
        setIsOpeningModalOpen(false); // Close openings modal
        setIsModalOpen(true);       // Open tickets modal
        setLoadingDetails(true);
        setSearchTerm('');
        try {
            const res = await fetch(`/api/dashboard/sales-details?idTienda=${opening.IdTienda}&idApertura=${opening.IdApertura}`);
            const json = await res.json();
            setTicketDetails(json);
        } catch (error) {
            console.error('Error fetching tickets for opening:', error);
        } finally {
            setLoadingDetails(false);
        }
    };

    const exportTicketsToExcel = () => {
        if (sortedTickets.length === 0) return;

        const excelData = sortedTickets.map(t => ({
            'Folio': t.FolioVenta,
            'Z': t.Z,
            'Caja': t.Caja,
            'Fecha': new Date(t['Fecha Venta']).toLocaleString('es-MX'),
            'Artículos': t.Articulos,
            'Cajero': t.Cajero,
            'Tipo Pago': t.Pago,
            'Total': t.Total
        }));

        const worksheet = XLSX.utils.json_to_sheet(excelData);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, 'Tickets');

        // Set column widths
        const wscols = [
            { wch: 20 }, // Folio
            { wch: 10 }, // Z
            { wch: 8 },  // Caja
            { wch: 20 }, // Fecha
            { wch: 10 }, // Arts
            { wch: 20 }, // Cajero
            { wch: 15 }, // Pago
            { wch: 12 }, // Total
        ];
        worksheet['!cols'] = wscols;

        XLSX.writeFile(workbook, `Tickets_${selectedStoreData?.Tienda}_${new Date().toISOString().split('T')[0]}.xlsx`);
    };

    const exportOpeningsToExcel = () => {
        if (sortedOpenings.length === 0) return;

        const excelData = sortedOpenings.map(o => ({
            'Z': o.Z,
            'Caja': o.Caja,
            'Fecha Apertura': new Date(o['Fecha Apertura']).toLocaleString('es-MX'),
            'Cajero': o.Cajero,
            'Tickets': o.Tickets,
            'Total Venta': o['Total Venta'],
            'Fecha Cierre': o.FechaCierre ? new Date(o.FechaCierre).toLocaleString('es-MX') : 'Abierta'
        }));

        const worksheet = XLSX.utils.json_to_sheet(excelData);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, 'Aperturas');

        const wscols = [
            { wch: 15 }, // Z
            { wch: 8 },  // Caja
            { wch: 20 }, // Fecha Apertura
            { wch: 20 }, // Cajero
            { wch: 10 }, // Tickets
            { wch: 15 }, // Total Venta
            { wch: 20 }, // Fecha Cierre
        ];
        worksheet['!cols'] = wscols;

        XLSX.writeFile(workbook, `Aperturas_${selectedStoreData?.Tienda}_${new Date().toISOString().split('T')[0]}.xlsx`);
    };

    const exportCancellationsToExcel = () => {
        if (sortedCancellations.length === 0) return;

        const excelData = sortedCancellations.map(c => ({
            'Z': c.Z,
            'Folio Cancelación': c['Folio Cancelacion'],
            'Fecha': new Date(c.FechaCancelacion).toLocaleString('es-MX'),
            'Cantidad': c.Cantidad,
            'Código': c['Codigo Barras'],
            'Descripción': c.Descripcion,
            'P. Venta': c['Precio Venta'],
            'Total': c.Total,
            'Cajero': c.Cajero,
            'Supervisor': c.Supervisor
        }));

        const worksheet = XLSX.utils.json_to_sheet(excelData);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, 'Cancelaciones');

        const wscols = [
            { wch: 15 }, // Z
            { wch: 20 }, // Folio
            { wch: 20 }, // Fecha
            { wch: 10 }, // Cantidad
            { wch: 15 }, // Código
            { wch: 30 }, // Descripción
            { wch: 12 }, // P. Venta
            { wch: 12 }, // Total
            { wch: 20 }, // Cajero
            { wch: 20 }, // Supervisor
        ];
        worksheet['!cols'] = wscols;

        XLSX.writeFile(workbook, `Cancelaciones_${selectedStoreData?.Tienda}_${new Date().toISOString().split('T')[0]}.xlsx`);
    };

    const exportWithdrawalsToExcel = () => {
        if (sortedWithdrawals.length === 0) return;

        const excelData = sortedWithdrawals.map(w => ({
            'Z': w.Z,
            'Folio Retiro': w['Folio Retiro'],
            'Fecha': new Date(w['Fecha Retiro']).toLocaleString('es-MX'),
            'Concepto': w.Concepto,
            'Tarjeta': w.Tarjeta,
            'Efectivo': w.Efectivo,
            'Devoluciones': w.Devoluciones,
            'Dolares': w.Dolares,
            'Cheques': w.Cheques,
            'Transferencia': w.Transferencia,
            'Debito': w.Debito,
            'Vales': w.Vales,
            'Cajero': w.Cajero,
            'Supervisor': w.Supervisor
        }));

        const worksheet = XLSX.utils.json_to_sheet(excelData);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, 'Retiros');

        const wscols = [
            { wch: 15 }, // Z
            { wch: 20 }, // Folio
            { wch: 20 }, // Fecha
            { wch: 25 }, // Concepto
            { wch: 12 }, // Tarjeta
            { wch: 12 }, // Efectivo
            { wch: 12 }, // Devoluciones
            { wch: 12 }, // Dolares
            { wch: 12 }, // Cheques
            { wch: 15 }, // Transferencia
            { wch: 12 }, // Debito
            { wch: 12 }, // Vales
            { wch: 20 }, // Cajero
            { wch: 20 }, // Supervisor
        ];
        worksheet['!cols'] = wscols;

        XLSX.writeFile(workbook, `Retiros_${selectedStoreData?.Tienda}_${new Date().toISOString().split('T')[0]}.xlsx`);
    };

    const exportReturnsToExcel = () => {
        if (sortedReturns.length === 0) return;

        const excelData = sortedReturns.map(r => ({
            'Folio': r['Folio Devolucion'],
            'Fecha': new Date(r['Fecha Devolucion']).toLocaleString('es-MX'),
            'Clave': r.Clave,
            'Valor': r.Valor,
            'Cliente': r.Cliente,
            'Concepto': r.Concepto,
            'Teléfono': r.Telefono,
            'Empleado': r.Empleado,
            'Supervisor': r.Supervisor
        }));

        const worksheet = XLSX.utils.json_to_sheet(excelData);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, 'Devoluciones');

        const wscols = [
            { wch: 15 }, // Folio
            { wch: 20 }, // Fecha
            { wch: 10 }, // Clave
            { wch: 12 }, // Valor
            { wch: 25 }, // Cliente
            { wch: 25 }, // Concepto
            { wch: 15 }, // Teléfono
            { wch: 20 }, // Empleado
            { wch: 20 }, // Supervisor
        ];
        worksheet['!cols'] = wscols;

        XLSX.writeFile(workbook, `Devoluciones_${selectedStoreData?.Tienda}_${new Date().toISOString().split('T')[0]}.xlsx`);
    };

    const handleExportPDF = () => {
        window.print();
    };

    const formatValue = (val: number) => {
        if (selectedMetric === 'aperturas') return val.toString();
        return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(val);
    };

    const formatCurrency = (val: number) => {
        return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(val);
    };

    const RenderSortIcon = (columnKey: string) => {
        if (sortConfig?.key !== columnKey) return <div className="w-4" />;
        return sortConfig.direction === 'asc' ? <ChevronUp size={14} className="ml-1 text-[#4050B4]" /> : <ChevronDown size={14} className="ml-1 text-[#4050B4]" />;
    };

    const RenderOpeningSortIcon = (columnKey: string) => {
        if (openingSortConfig?.key !== columnKey) return <div className="w-4" />;
        return openingSortConfig.direction === 'asc' ? <ChevronUp size={14} className="ml-1 text-[#4050B4]" /> : <ChevronDown size={14} className="ml-1 text-[#4050B4]" />;
    };

    const RenderCancellationSortIcon = (columnKey: string) => {
        if (cancellationSortConfig?.key !== columnKey) return <div className="w-4" />;
        return cancellationSortConfig.direction === 'asc' ? <ChevronUp size={14} className="ml-1 text-[#4050B4]" /> : <ChevronDown size={14} className="ml-1 text-[#4050B4]" />;
    };

    const RenderWithdrawalSortIcon = (columnKey: string) => {
        if (withdrawalSortConfig?.key !== columnKey) return <div className="w-4" />;
        return withdrawalSortConfig.direction === 'asc' ? <ChevronUp size={14} className="ml-1 text-[#4050B4]" /> : <ChevronDown size={14} className="ml-1 text-[#4050B4]" />;
    };

    const RenderReturnSortIcon = (columnKey: string) => {
        if (returnSortConfig?.key !== columnKey) return <div className="w-4" />;
        return returnSortConfig.direction === 'asc' ? <ChevronUp size={14} className="ml-1 text-[#4050B4]" /> : <ChevronDown size={14} className="ml-1 text-[#4050B4]" />;
    };

    const RenderReturnItemsSortIcon = (columnKey: string) => {
        if (returnItemsSortConfig?.key !== columnKey) return <div className="w-4" />;
        return returnItemsSortConfig.direction === 'asc' ? <ChevronUp size={14} className="ml-1 text-indigo-600" /> : <ChevronDown size={14} className="ml-1 text-indigo-600" />;
    };

    const metrics = data?.metrics || {
        ventas: { TotalVentas: 0, Operaciones: 0, TicketPromedio: 0 },
        aperturas: 0,
        cancelaciones: { MontoCancelaciones: 0, CantidadCancelaciones: 0, PromedioCancelacion: 0 },
        retiros: 0,
        devoluciones: { MontoDevoluciones: 0, CantidadDevoluciones: 0 }
    };

    const chartData = data?.data?.[selectedMetric] || [];

    const getMetricConfig = () => {
        switch (selectedMetric) {
            case 'ventas': return { title: 'Ventas por Sucursal', sub: 'Distribución del ingreso por tienda', color: '#4050B4' };
            case 'aperturas': return { title: 'Aperturas por Sucursal', sub: 'Cantidad de aperturas por tienda', color: '#f59e0b' };
            case 'cancelaciones': return { title: 'Cancelaciones por Sucursal', sub: 'Monto de cancelaciones por tienda', color: '#e11d48' };
            case 'retiros': return { title: 'Retiros por Sucursal', sub: 'Monto de retiros por tienda', color: '#10b981' };
            case 'devoluciones': return { title: 'Devoluciones por Sucursal', sub: 'Monto de devoluciones por tienda', color: '#6366F1' };
        }
    };

    const config = getMetricConfig();

    // Custom color mapping for specific branches (UPPERCASE for robust matching)
    const STORE_COLOR_MAP: Record<string, string> = {
        'BODEGA 238': '#35e844',
        'ARAMBERRI 210': '#eb0258',
        'LINCOLN': '#fcc442',
        'LEONES': '#4ecdc4',
        'ZUAZUA': '#de6262',
        'VALLE SOLEADO': '#ff0f35',
        'RUPERTO MTZ QCF': '#029913',
        'SANTA CATARINA QCF': '#fea189',
        'SOLIDARIDAD': '#566965',
        'MERKADON': '#fcea42',
        'MERKDON': '#fcea42',
    };

    // Varied and professional color palette fallback
    const STORE_COLORS = [
        '#2563EB', '#3B82F6', '#DC2626', '#EF4444', '#0D9488', '#14B8A6', '#D97706', '#F59E0B',
        '#16A34A', '#22C55E', '#064E3B', '#DCFCE7', '#7C3AED', '#8B5CF6', '#713F12', '#92400E',
        '#EAB308', '#CA8A04', '#0F172A', '#334155', '#EA580C', '#F97316'
    ];

    // Get a consistent color for a store name
    const getStoreColor = (name: string) => {
        if (!name) return STORE_COLORS[0];

        const cleanName = name.trim().toUpperCase();
        // Check if there's a specific custom color for this branch
        if (STORE_COLOR_MAP[cleanName]) {
            return STORE_COLOR_MAP[cleanName];
        }

        // fallback to hash-based selection from the professional palette
        let hash = 0;
        for (let i = 0; i < name.length; i++) {
            hash = name.charCodeAt(i) + ((hash << 5) - hash);
        }
        const index = Math.abs(hash) % STORE_COLORS.length;
        return STORE_COLORS[index];
    };

    return (
        <div className="space-y-4 animate-in fade-in duration-500">
            {/* Print-only Header */}
            <div className="hidden print:flex items-center justify-between border-b-2 border-slate-900 pb-4 mb-6">
                <div className="flex items-center gap-4">
                    <img src="/kesito.svg" alt="KYK Logo" className="w-16 h-16" />
                    <div>
                        <h1 className="text-3xl font-black text-slate-900 tracking-tighter uppercase">KYK DASHBOARD</h1>
                        <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">Reporte de Ventas y Métricas</p>
                    </div>
                </div>
                <div className="text-right">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Fecha de Emisión</p>
                    <p className="text-sm font-bold text-slate-800">{new Date().toLocaleDateString('es-MX', { day: '2-digit', month: 'long', year: 'numeric' })}</p>
                </div>
            </div>

            {/* Header with Filters */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white py-2 px-4 rounded-none shadow-sm border border-slate-100">
                <div>
                    <h1 className="text-xl font-black text-slate-800 tracking-tight uppercase flex items-center gap-2">
                        <span>📈</span>
                        DASHBOARD DE VENTAS
                    </h1>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                    <button
                        onClick={handleExportPDF}
                        className="flex items-center gap-2 px-3 py-2 bg-[#4050B4] text-white hover:bg-[#344196] transition-all text-sm font-bold uppercase tracking-widest rounded-none shadow-sm print:hidden group"
                    >
                        <FileDown size={18} className="group-hover:scale-110 transition-transform" />
                        <span>Exportar PDF</span>
                    </button>

                    <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-none px-3 py-1.5 focus-within:ring-2 focus-within:ring-[#4050B4]/20 transition-all">
                        <Calendar size={16} className="text-[#4050B4]" />
                        <div className="flex flex-col">
                            <span className="text-[10px] font-bold text-slate-400 uppercase leading-none mb-1">Inicio</span>
                            <input
                                type="date"
                                value={fechaInicio}
                                onChange={(e) => setFechaInicio(e.target.value)}
                                className="bg-transparent text-sm font-bold text-slate-700 outline-none p-0 border-none h-auto leading-none"
                            />
                        </div>
                    </div>

                    <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-none px-3 py-1.5 focus-within:ring-2 focus-within:ring-[#4050B4]/20 transition-all">
                        <Calendar size={16} className="text-[#4050B4]" />
                        <div className="flex flex-col">
                            <span className="text-[10px] font-bold text-slate-400 uppercase leading-none mb-1">Fin</span>
                            <input
                                type="date"
                                value={fechaFin}
                                onChange={(e) => setFechaFin(e.target.value)}
                                className="bg-transparent text-sm font-bold text-slate-700 outline-none p-0 border-none h-auto leading-none"
                            />
                        </div>
                    </div>

                    <button
                        onClick={fetchData}
                        className="p-2.5 bg-slate-50 border border-slate-200 text-[#4050B4] hover:bg-slate-100 transition-colors rounded-none shadow-sm print:hidden group"
                        title="Actualizar Datos"
                    >
                        <RotateCcw size={18} className={cn("group-hover:rotate-180 transition-transform duration-500", loading && "animate-spin")} />
                    </button>
                </div>
            </div>

            {/* Metrics Cards Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
                {/* Ventas Card */}
                <button
                    onClick={() => setSelectedMetric('ventas')}
                    className={cn(
                        "bg-white p-4 rounded-none border shadow-sm hover:shadow-md transition-all relative overflow-hidden group text-left print-visible",
                        selectedMetric === 'ventas' ? "border-[#4050B4] ring-2 ring-[#4050B4]/10" : "border-slate-100"
                    )}
                >
                    <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity">
                        <TrendingUp size={80} className="text-[#4050B4]" />
                    </div>
                    <div className="flex flex-col h-full justify-between">
                        <div>
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 block">Ventas</span>
                            <h2 className="text-2xl font-black text-slate-900 mb-2">{formatCurrency(metrics.ventas.TotalVentas)}</h2>
                        </div>
                        <div className="flex flex-col gap-2 border-t border-slate-50 pt-4 mt-2">
                            <div className="flex justify-between items-center text-xs font-bold">
                                <span className="text-slate-500">Operaciones</span>
                                <span className="text-[#4050B4] px-2 py-0.5 bg-[#4050B4]/5 rounded-none">{metrics.ventas.Operaciones}</span>
                            </div>
                            <div className="flex justify-between items-center text-xs font-bold">
                                <span className="text-slate-500">Ticket Promedio</span>
                                <span className="text-emerald-600">{formatCurrency(metrics.ventas.TicketPromedio)}</span>
                            </div>
                        </div>
                    </div>
                </button>

                {/* Aperturas Card */}
                <button
                    onClick={() => setSelectedMetric('aperturas')}
                    className={cn(
                        "bg-white p-4 rounded-none border shadow-sm hover:shadow-md transition-all relative overflow-hidden group text-left print-visible",
                        selectedMetric === 'aperturas' ? "border-amber-500 ring-2 ring-amber-500/10" : "border-slate-100"
                    )}
                >
                    <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity">
                        <Store size={80} className="text-amber-500" />
                    </div>
                    <div className="flex flex-col h-full justify-between">
                        <div>
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 block">Aperturas</span>
                            <h2 className="text-2xl font-black text-slate-900 mb-2">{metrics.aperturas}</h2>
                        </div>
                        <div className="flex items-center gap-1.5 text-xs font-bold text-slate-500 bg-slate-50 p-2 rounded-none mt-4">
                            <ArrowUpRight size={14} className="text-amber-500" />
                            <span>Registros activos en periodo</span>
                        </div>
                    </div>
                </button>

                {/* Cancelaciones Card */}
                <button
                    onClick={() => setSelectedMetric('cancelaciones')}
                    className={cn(
                        "bg-white p-4 rounded-none border shadow-sm hover:shadow-md transition-all relative overflow-hidden group text-left print-visible",
                        selectedMetric === 'cancelaciones' ? "border-rose-500 ring-2 ring-rose-500/10" : "border-slate-100"
                    )}
                >
                    <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity">
                        <AlertCircle size={80} className="text-rose-500" />
                    </div>
                    <div className="flex flex-col h-full justify-between">
                        <div>
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 block">Cancelaciones</span>
                            <h2 className="text-2xl font-black text-rose-600 mb-2">{formatCurrency(metrics.cancelaciones.MontoCancelaciones)}</h2>
                        </div>
                        <div className="flex flex-col gap-2 border-t border-slate-50 pt-4 mt-2">
                            <div className="flex justify-between items-center text-xs font-bold">
                                <span className="text-slate-500">Cantidad</span>
                                <span className="text-rose-600 px-2 py-0.5 bg-rose-50 rounded-none">{metrics.cancelaciones.CantidadCancelaciones}</span>
                            </div>
                            <div className="flex justify-between items-center text-xs font-bold">
                                <span className="text-slate-500">Promedio</span>
                                <span className="text-amber-600">{formatCurrency(metrics.cancelaciones.PromedioCancelacion)}</span>
                            </div>
                        </div>
                    </div>
                </button>

                {/* Retiros Card */}
                <button
                    onClick={() => setSelectedMetric('retiros')}
                    className={cn(
                        "bg-white p-4 rounded-none border shadow-sm hover:shadow-md transition-all relative overflow-hidden group text-left print-visible",
                        selectedMetric === 'retiros' ? "border-emerald-500 ring-2 ring-emerald-500/10" : "border-slate-100"
                    )}
                >
                    <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity">
                        <Wallet size={80} className="text-emerald-500" />
                    </div>
                    <div className="flex flex-col h-full justify-between">
                        <div>
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 block">Retiros</span>
                            <h2 className="text-2xl font-black text-emerald-600 mb-2">{formatCurrency(metrics.retiros)}</h2>
                        </div>
                        <div className="flex items-center gap-1.5 text-xs font-bold text-slate-500 bg-slate-50 p-2 rounded-none mt-4">
                            <ArrowDownRight size={14} className="text-emerald-500" />
                            <span>Total de egresos de caja</span>
                        </div>
                    </div>
                </button>

                {/* Devoluciones Card */}
                <button
                    onClick={() => setSelectedMetric('devoluciones')}
                    className={cn(
                        "bg-white p-4 rounded-none border shadow-sm hover:shadow-md transition-all relative overflow-hidden group text-left print-visible",
                        selectedMetric === 'devoluciones' ? "border-indigo-500 ring-2 ring-indigo-500/10" : "border-slate-100"
                    )}
                >
                    <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity">
                        <RotateCcw size={80} className="text-indigo-500" />
                    </div>
                    <div className="flex flex-col h-full justify-between">
                        <div>
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 block">Devoluciones</span>
                            <h2 className="text-2xl font-black text-indigo-600 mb-2">{formatCurrency(metrics.devoluciones.MontoDevoluciones)}</h2>
                        </div>
                        <div className="flex flex-col gap-2 border-t border-slate-50 pt-4 mt-2">
                            <div className="flex justify-between items-center text-xs font-bold">
                                <span className="text-slate-500">Cantidad</span>
                                <span className="text-indigo-600 px-2 py-0.5 bg-indigo-50 rounded-none">{metrics.devoluciones.CantidadDevoluciones}</span>
                            </div>
                            <div className="flex justify-between items-center text-xs font-bold">
                                <span className="text-slate-500">Estado</span>
                                <span className="text-emerald-600">Completas</span>
                            </div>
                        </div>
                    </div>
                </button>
            </div>

            {/* Bottom Section: Chart + Details */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                {/* Chart Card */}
                <div className="lg:col-span-2 bg-white p-5 rounded-none border border-slate-100 shadow-sm relative">
                    <div className="flex items-center justify-between mb-4">
                        <div>
                            <h3 className="text-lg font-black text-slate-800 uppercase tracking-tight">{config.title}</h3>
                            <p className="text-[13px] text-slate-500 font-medium">{config.sub}</p>
                        </div>
                        <div className="flex items-center gap-4">
                            {/* Sub-metric Selector */}
                            {(selectedMetric === 'ventas' || selectedMetric === 'cancelaciones' || selectedMetric === 'devoluciones') && (
                                <div className="flex items-center bg-slate-100 p-1 rounded-none">
                                    {selectedMetric === 'ventas' ? (
                                        <>
                                            <button
                                                onClick={() => setSubMetric('Total')}
                                                className={cn(
                                                    "px-3 py-1 text-[10px] font-black uppercase tracking-widest transition-all",
                                                    subMetric === 'Total' ? "bg-white text-slate-900 shadow-sm" : "text-slate-400 hover:text-slate-600"
                                                )}
                                            >
                                                Ventas
                                            </button>
                                            <button
                                                onClick={() => setSubMetric('Operaciones')}
                                                className={cn(
                                                    "px-3 py-1 text-[10px] font-black uppercase tracking-widest transition-all",
                                                    subMetric === 'Operaciones' ? "bg-white text-slate-900 shadow-sm" : "text-slate-400 hover:text-slate-600"
                                                )}
                                            >
                                                Ops
                                            </button>
                                            <button
                                                onClick={() => setSubMetric('TicketPromedio')}
                                                className={cn(
                                                    "px-3 py-1 text-[10px] font-black uppercase tracking-widest transition-all",
                                                    subMetric === 'TicketPromedio' ? "bg-white text-slate-900 shadow-sm" : "text-slate-400 hover:text-slate-600"
                                                )}
                                            >
                                                Avg
                                            </button>
                                        </>
                                    ) : (
                                        <>
                                            <button
                                                onClick={() => setSubMetric('Total')}
                                                className={cn(
                                                    "px-3 py-1 text-[10px] font-black uppercase tracking-widest transition-all",
                                                    subMetric === 'Total' ? "bg-white text-slate-900 shadow-sm" : "text-slate-400 hover:text-slate-600"
                                                )}
                                            >
                                                Monto
                                            </button>
                                            <button
                                                onClick={() => setSubMetric('Cantidad')}
                                                className={cn(
                                                    "px-3 py-1 text-[10px] font-black uppercase tracking-widest transition-all",
                                                    subMetric === 'Cantidad' ? "bg-white text-slate-900 shadow-sm" : "text-slate-400 hover:text-slate-600"
                                                )}
                                            >
                                                Cant
                                            </button>
                                            {selectedMetric === 'cancelaciones' && (
                                                <button
                                                    onClick={() => setSubMetric('Promedio')}
                                                    className={cn(
                                                        "px-3 py-1 text-[10px] font-black uppercase tracking-widest transition-all",
                                                        subMetric === 'Promedio' ? "bg-white text-slate-900 shadow-sm" : "text-slate-400 hover:text-slate-600"
                                                    )}
                                                >
                                                    Avg
                                                </button>
                                            )}
                                        </>
                                    )}
                                </div>
                            )}

                            <div className="flex items-center bg-slate-100 p-1 rounded-none">
                                <button
                                    onClick={() => setChartType('bar')}
                                    className={cn(
                                        "px-3 py-1 text-[10px] font-black uppercase tracking-widest transition-all",
                                        chartType === 'bar' ? "bg-white text-slate-900 shadow-sm" : "text-slate-400 hover:text-slate-600"
                                    )}
                                >
                                    Barras
                                </button>
                                <button
                                    onClick={() => setChartType('pie')}
                                    className={cn(
                                        "px-3 py-1 text-[10px] font-black uppercase tracking-widest transition-all",
                                        chartType === 'pie' ? "bg-white text-slate-900 shadow-sm" : "text-slate-400 hover:text-slate-600"
                                    )}
                                >
                                    Pastel
                                </button>
                            </div>
                            <div className="p-2 bg-slate-100 rounded-none">
                                {selectedMetric === 'ventas' && <ShoppingCart size={20} className="text-slate-400" />}
                                {selectedMetric === 'aperturas' && <Store size={20} className="text-slate-400" />}
                                {selectedMetric === 'cancelaciones' && <AlertCircle size={20} className="text-slate-400" />}
                                {selectedMetric === 'retiros' && <Wallet size={20} className="text-slate-400" />}
                            </div>
                        </div>
                    </div>

                    <div className="h-[400px] w-full">
                        {loading ? (
                            <div className="h-full flex items-center justify-center">
                                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#4050B4]"></div>
                            </div>
                        ) : (
                            <ResponsiveContainer width="100%" height="100%">
                                {chartType === 'bar' ? (
                                    <BarChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 60 }}>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                                        <XAxis
                                            dataKey="Tienda"
                                            axisLine={false}
                                            tickLine={false}
                                            tick={{ fill: '#94A3B8', fontSize: 10, fontWeight: 700 }}
                                            interval={0}
                                            angle={-45}
                                            textAnchor="end"
                                            height={80}
                                        />
                                        <YAxis
                                            axisLine={false}
                                            tickLine={false}
                                            tick={{ fill: '#94A3B8', fontSize: 11, fontWeight: 700 }}
                                            tickFormatter={(val) => {
                                                if (selectedMetric === 'aperturas') return val.toString();
                                                if (subMetric === 'Operaciones' || subMetric === 'Cantidad') return val.toString();
                                                return `$${val >= 1000 ? (val / 1000).toFixed(1) + 'k' : val}`;
                                            }}
                                        />
                                        <Tooltip
                                            cursor={{ fill: 'transparent' }}
                                            content={({ active, payload }) => {
                                                if (active && payload && payload.length) {
                                                    const value = payload[0].value as number;
                                                    const formatted = (subMetric === 'Operaciones' || subMetric === 'Cantidad' || selectedMetric === 'aperturas')
                                                        ? value.toString()
                                                        : formatCurrency(value);
                                                    return (
                                                        <div className="bg-slate-900 text-white p-3 rounded-none shadow-2xl border border-white/10">
                                                            <p className="text-[10px] font-bold text-white/50 uppercase mb-1">{payload[0].payload.Tienda}</p>
                                                            <p className="text-sm font-black">{formatted}</p>
                                                        </div>
                                                    );
                                                }
                                                return null;
                                            }}
                                        />
                                        <Bar dataKey={subMetric} radius={[0, 0, 0, 0]} barSize={40}>
                                            {chartData.map((entry: any, index: number) => (
                                                <Cell key={`cell-${index}`} fill={getStoreColor(entry.Tienda)} fillOpacity={0.9} />
                                            ))}
                                        </Bar>
                                    </BarChart>
                                ) : (
                                    <PieChart>
                                        <Pie
                                            data={chartData}
                                            cx="50%"
                                            cy="50%"
                                            innerRadius={0}
                                            outerRadius={140}
                                            paddingAngle={2}
                                            dataKey={subMetric}
                                            nameKey="Tienda"
                                            stroke="none"
                                        >
                                            {chartData.map((entry: any, index: number) => (
                                                <Cell key={`cell-${index}`} fill={getStoreColor(entry.Tienda)} />
                                            ))}
                                        </Pie>
                                        <Tooltip
                                            content={({ active, payload }) => {
                                                if (active && payload && payload.length) {
                                                    const value = payload[0].value as number;
                                                    const formatted = (subMetric === 'Operaciones' || subMetric === 'Cantidad' || selectedMetric === 'aperturas')
                                                        ? value.toString()
                                                        : formatCurrency(value);
                                                    return (
                                                        <div className="bg-slate-900 text-white p-3 rounded-none shadow-2xl border border-white/10">
                                                            <p className="text-[10px] font-bold text-white/50 uppercase mb-1">{payload[0].name}</p>
                                                            <p className="text-sm font-black">{formatted}</p>
                                                        </div>
                                                    );
                                                }
                                                return null;
                                            }}
                                        />
                                        <Legend verticalAlign="bottom" height={36} />
                                    </PieChart>
                                )}
                            </ResponsiveContainer>
                        )}
                    </div>
                </div>

                {/* Details Card */}
                <div className="bg-white p-5 rounded-none border border-slate-100 shadow-sm flex flex-col h-full">
                    <div className="mb-4">
                        <h3 className="text-lg font-black text-slate-800 uppercase tracking-tight">
                            Detalle {selectedMetric === 'ventas' ? 'Ventas' :
                                selectedMetric === 'aperturas' ? 'Aperturas' :
                                    selectedMetric === 'cancelaciones' ? 'Cancelaciones' :
                                        selectedMetric === 'devoluciones' ? 'Devoluciones' : 'Retiros'}
                        </h3>
                        <p className="text-[13px] text-slate-500 font-medium">Desglose de rendimiento</p>
                    </div>

                    <div className="flex-1 space-y-3 overflow-y-auto pr-2 no-scrollbar">
                        {loading ? (
                            Array(5).fill(0).map((_, i) => (
                                <div key={i} className="h-16 bg-slate-50 rounded-none animate-pulse" />
                            ))
                        ) : (
                            chartData.map((item: any, index: number) => {
                                const storeColor = getStoreColor(item.Tienda);
                                return (
                                    <div
                                        key={item.Tienda}
                                        onClick={() => handleStoreClick(item)}
                                        className={cn(
                                            "flex flex-col p-3 bg-slate-50 rounded-none border border-slate-100 group transition-all outline-none",
                                            (selectedMetric === 'ventas' || selectedMetric === 'aperturas') ? "cursor-pointer hover:bg-white hover:border-[#4050B4] hover:shadow-lg hover:shadow-[#4050B4]/10" : "hover:bg-white hover:border-slate-200 hover:shadow-lg hover:shadow-slate-200/20"
                                        )}
                                    >
                                        <div className="flex items-center justify-between mb-2">
                                            <div className="flex items-center gap-2">
                                                <div
                                                    className="w-8 h-8 rounded-none flex items-center justify-center border shadow-sm font-black text-[10px]"
                                                    style={{ backgroundColor: `${storeColor}10`, borderColor: `${storeColor}20`, color: storeColor }}
                                                >
                                                    {item.Tienda.substring(0, 2).toUpperCase()}
                                                </div>
                                                <div className="flex flex-col">
                                                    <span className="text-[12px] font-black text-slate-700 leading-none">{item.Tienda}</span>
                                                    <span className="text-[9px] font-bold text-slate-400 uppercase">Sucursal</span>
                                                </div>
                                            </div>
                                            {(selectedMetric !== 'ventas' && selectedMetric !== 'cancelaciones') && (
                                                <div className="text-right">
                                                    <div className="text-sm font-black text-slate-900">
                                                        {selectedMetric === 'aperturas' ? item.Total : formatCurrency(item.Total)}
                                                    </div>
                                                </div>
                                            )}
                                        </div>

                                        {(selectedMetric === 'ventas' || selectedMetric === 'cancelaciones' || selectedMetric === 'devoluciones') && (
                                            <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-200/50">
                                                <div className="flex flex-col">
                                                    <span className="text-[8px] font-black text-slate-400 uppercase leading-none mb-1">
                                                        {selectedMetric === 'ventas' ? 'Ventas' : selectedMetric === 'cancelaciones' ? 'Cancelaciones' : 'Devoluciones'}
                                                    </span>
                                                    <span className="text-[11px] font-black text-slate-900">
                                                        {formatCurrency(item.Total)}
                                                    </span>
                                                </div>
                                                <div className="flex flex-col border-x border-slate-200/50 px-2">
                                                    <span className="text-[8px] font-black text-slate-400 uppercase leading-none mb-1">
                                                        {selectedMetric === 'ventas' ? 'Ops' : 'Cant'}
                                                    </span>
                                                    <span className="text-[11px] font-black text-slate-600">
                                                        {selectedMetric === 'ventas' ? item.Operaciones : item.Cantidad}
                                                    </span>
                                                </div>
                                                <div className="flex flex-col text-right">
                                                    <span className="text-[8px] font-black text-slate-400 uppercase leading-none mb-1">Promedio</span>
                                                    <span className="text-[11px] font-black text-emerald-600">
                                                        {formatCurrency(selectedMetric === 'ventas' ? item.TicketPromedio : item.Promedio)}
                                                    </span>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                );
                            })
                        )}
                    </div>
                </div>
            </div>

            {/* Sales Drill-down Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className={cn(
                        "bg-white shadow-2xl overflow-hidden flex flex-col transition-all duration-300 border border-slate-200",
                        isMaximized ? "fixed inset-0 m-0" : "w-full max-w-6xl max-h-[90vh]"
                    )}>
                        {/* Modal Header */}
                        <div className="flex items-center justify-between bg-white border-b border-slate-100 p-4">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-slate-50 rounded-none border border-slate-100">
                                    <ShoppingCart size={18} className="text-[#4050B4]" />
                                </div>
                                <div>
                                    <h3 className="font-black text-sm uppercase tracking-widest leading-none mb-1 text-slate-800">Detalle de Tickets</h3>
                                    <p className="text-[10px] font-bold text-slate-400 uppercase">{selectedStoreData?.Tienda} • {fechaInicio} a {fechaFin}</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                <div className="relative mr-4 hidden md:block">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                                    <input
                                        type="text"
                                        placeholder="BUSCAR FOLIO, CAJERO..."
                                        className="bg-slate-50 border border-slate-200 rounded-none pl-9 pr-4 py-1.5 text-[10px] font-bold uppercase tracking-widest focus:ring-2 focus:ring-[#4050B4]/20 outline-none text-slate-700 w-64"
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                    />
                                </div>
                                <button
                                    onClick={exportTicketsToExcel}
                                    disabled={sortedTickets.length === 0}
                                    className="flex items-center gap-2 px-3 py-1.5 bg-[#4050B4]/10 text-[#4050B4] hover:bg-[#4050B4] hover:text-white transition-all text-[10px] font-black uppercase tracking-widest border border-[#4050B4]/20 disabled:opacity-50 disabled:cursor-not-allowed mr-2"
                                >
                                    <FileSpreadsheet size={14} />
                                    <span>Exportar Excel</span>
                                </button>
                                <button
                                    onClick={() => setIsMaximized(!isMaximized)}
                                    className="p-2 hover:bg-slate-50 text-slate-500 transition-colors"
                                    title={isMaximized ? "Restaurar" : "Maximizar"}
                                >
                                    {isMaximized ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
                                </button>
                                <button
                                    onClick={() => { setIsModalOpen(false); setIsMaximized(false); setSearchTerm(''); }}
                                    className="p-2 hover:bg-rose-50 text-rose-500 transition-colors"
                                >
                                    <X size={20} />
                                </button>
                            </div>
                        </div>

                        {/* Search Bar for Mobile */}
                        <div className="p-3 bg-slate-50 border-b border-slate-200 md:hidden">
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                                <input
                                    type="text"
                                    placeholder="BUSCAR TICKET..."
                                    className="w-full bg-white border border-slate-200 rounded-none pl-9 pr-4 py-2 text-[10px] font-bold uppercase tracking-widest focus:ring-2 focus:ring-[#4050B4]/20 outline-none"
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                />
                            </div>
                        </div>

                        {/* Modal Content */}
                        <div className="flex-1 overflow-auto bg-white p-0 relative">
                            {loadingDetails ? (
                                <div className="absolute inset-0 flex items-center justify-center">
                                    <div className="flex flex-col items-center gap-4">
                                        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[#4050B4]"></div>
                                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Cargando tickets...</p>
                                    </div>
                                </div>
                            ) : (
                                <div className="min-w-full inline-block align-middle">
                                    <table className="min-w-full border-collapse">
                                        <thead className="sticky top-0 z-10">
                                            <tr className="bg-slate-50 border-b border-slate-200">
                                                <th onClick={() => handleSort('FolioVenta')} className="px-4 py-3 text-left text-[10px] font-black text-slate-500 uppercase tracking-wider cursor-pointer hover:bg-slate-100 transition-colors">
                                                    <div className="flex items-center">Folio {RenderSortIcon('FolioVenta')}</div>
                                                </th>
                                                <th onClick={() => handleSort('Z')} className="px-4 py-3 text-center text-[10px] font-black text-slate-500 uppercase tracking-wider cursor-pointer hover:bg-slate-100 transition-colors">
                                                    <div className="flex items-center justify-center">Z {RenderSortIcon('Z')}</div>
                                                </th>
                                                <th onClick={() => handleSort('Caja')} className="px-4 py-3 text-center text-[10px] font-black text-slate-500 uppercase tracking-wider cursor-pointer hover:bg-slate-100 transition-colors">
                                                    <div className="flex items-center justify-center">Caja {RenderSortIcon('Caja')}</div>
                                                </th>
                                                <th onClick={() => handleSort('Fecha Venta')} className="px-4 py-3 text-left text-[10px] font-black text-slate-500 uppercase tracking-wider cursor-pointer hover:bg-slate-100 transition-colors">
                                                    <div className="flex items-center">Fecha {RenderSortIcon('Fecha Venta')}</div>
                                                </th>
                                                <th onClick={() => handleSort('Articulos')} className="px-4 py-3 text-center text-[10px] font-black text-slate-500 uppercase tracking-wider cursor-pointer hover:bg-slate-100 transition-colors">
                                                    <div className="flex items-center justify-center">Arts {RenderSortIcon('Articulos')}</div>
                                                </th>
                                                <th onClick={() => handleSort('Cajero')} className="px-4 py-3 text-left text-[10px] font-black text-slate-500 uppercase tracking-wider cursor-pointer hover:bg-slate-100 transition-colors">
                                                    <div className="flex items-center">Cajero {RenderSortIcon('Cajero')}</div>
                                                </th>
                                                <th onClick={() => handleSort('Pago')} className="px-4 py-3 text-right text-[10px] font-black text-slate-500 uppercase tracking-wider cursor-pointer hover:bg-slate-100 transition-colors">
                                                    <div className="flex items-center justify-end">Pago {RenderSortIcon('Pago')}</div>
                                                </th>
                                                <th onClick={() => handleSort('Total')} className="px-4 py-3 text-right text-[10px] font-black text-slate-500 uppercase tracking-wider cursor-pointer hover:bg-slate-100 transition-colors">
                                                    <div className="flex items-center justify-end">Total {RenderSortIcon('Total')}</div>
                                                </th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100">
                                            {sortedTickets.length > 0 ? (
                                                sortedTickets.map((ticket) => (
                                                    <tr
                                                        key={ticket.FolioVenta}
                                                        onClick={() => handleTicketClick(ticket)}
                                                        className="hover:bg-indigo-50/50 transition-colors cursor-pointer group/row"
                                                    >
                                                        <td className="px-4 py-3 whitespace-nowrap">
                                                            <div className="flex items-center gap-2">
                                                                <FileText size={14} className="text-slate-400 group-hover/row:text-[#4050B4] transition-colors" />
                                                                <span className="text-[11px] font-black text-slate-900">{ticket.FolioVenta}</span>
                                                            </div>
                                                        </td>
                                                        <td className="px-4 py-3 whitespace-nowrap text-center text-[11px] font-bold text-slate-600">{ticket.Z}</td>
                                                        <td className="px-4 py-3 whitespace-nowrap text-center">
                                                            <span className="bg-slate-100 text-slate-600 px-2 py-0.5 text-[10px] font-black">{ticket.Caja}</span>
                                                        </td>
                                                        <td className="px-4 py-3 whitespace-nowrap">
                                                            <div className="flex flex-col">
                                                                <span className="text-[11px] font-bold text-slate-700">{new Date(ticket['Fecha Venta']).toLocaleDateString('es-MX')}</span>
                                                                <span className="text-[9px] font-medium text-slate-400">{new Date(ticket['Fecha Venta']).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}</span>
                                                            </div>
                                                        </td>
                                                        <td className="px-4 py-3 whitespace-nowrap text-center text-[11px] font-black text-slate-900">{ticket.Articulos}</td>
                                                        <td className="px-4 py-3 whitespace-nowrap">
                                                            <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-600">
                                                                <User size={12} className="text-slate-400" />
                                                                {ticket.Cajero}
                                                            </div>
                                                        </td>
                                                        <td className="px-4 py-3 whitespace-nowrap text-right text-[11px] font-bold text-slate-600 italic">{ticket.Pago}</td>
                                                        <td className="px-4 py-3 whitespace-nowrap text-right">
                                                            <span className="text-[12px] font-black text-[#4050B4]">{formatCurrency(ticket.Total)}</span>
                                                        </td>
                                                    </tr>
                                                ))
                                            ) : (
                                                <tr>
                                                    <td colSpan={8} className="px-4 py-12 text-center">
                                                        <div className="flex flex-col items-center gap-3">
                                                            <div className="p-4 bg-slate-50 rounded-none">
                                                                <Search size={32} className="text-slate-200" />
                                                            </div>
                                                            <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest">No se encontraron tickets</p>
                                                        </div>
                                                    </td>
                                                </tr>
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>

                        {/* Modal Footer */}
                        <div className="bg-slate-50 p-4 border-t border-slate-200 flex items-center justify-between">
                            <div className="flex items-center gap-6">
                                <div className="flex flex-col">
                                    <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Total Tickets</span>
                                    <span className="text-sm font-black text-slate-900">{filteredTickets.length}</span>
                                </div>
                                <div className="flex flex-col border-l border-slate-200 pl-6">
                                    <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Sumatoria Ventas</span>
                                    <span className="text-sm font-black text-[#4050B4]">{formatCurrency(filteredTickets.reduce((acc, t) => acc + t.Total, 0))}</span>
                                </div>
                            </div>
                            <button
                                onClick={() => { setIsModalOpen(false); setIsMaximized(false); setSearchTerm(''); }}
                                className="px-6 py-2 bg-slate-900 text-white font-black text-[10px] uppercase tracking-widest hover:bg-slate-800 transition-colors shadow-lg shadow-slate-900/20"
                            >
                                CERRAR
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Ticket Items Breakdown Modal (Secondary level) */}
            {isItemsModalOpen && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-[2px] animate-in fade-in zoom-in duration-200">
                    <div className="bg-white shadow-3xl w-full max-w-4xl max-h-[85vh] flex flex-col border border-slate-200">
                        {/* Modal Header */}
                        <div className="flex items-center justify-between bg-slate-50 border-b border-slate-200 p-4">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-white rounded-none border border-slate-200 shadow-sm">
                                    <Package size={18} className="text-[#4050B4]" />
                                </div>
                                <div>
                                    <h3 className="font-black text-xs uppercase tracking-widest leading-none mb-1 text-slate-800">Partidas del Ticket</h3>
                                    <p className="text-[10px] font-bold text-slate-400 uppercase">FOLIO: {selectedTicket?.FolioVenta} • {selectedTicket?.Cajero}</p>
                                </div>
                            </div>
                            <button
                                onClick={() => setIsItemsModalOpen(false)}
                                className="p-2 hover:bg-slate-200 rounded-none transition-colors text-slate-400"
                            >
                                <X size={20} />
                            </button>
                        </div>

                        {/* Modal Content */}
                        <div className="flex-1 overflow-auto bg-white relative">
                            {loadingItems ? (
                                <div className="absolute inset-0 flex items-center justify-center py-20">
                                    <div className="flex flex-col items-center gap-4">
                                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#4050B4]"></div>
                                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Obteniendo partidas...</p>
                                    </div>
                                </div>
                            ) : (
                                <table className="min-w-full border-collapse">
                                    <thead className="sticky top-0 z-10">
                                        <tr className="bg-white border-b border-slate-200">
                                            <th className="px-6 py-3 text-center text-[9px] font-black text-slate-400 uppercase tracking-wider">Cant</th>
                                            <th className="px-6 py-3 text-left text-[9px] font-black text-slate-400 uppercase tracking-wider">Código</th>
                                            <th className="px-6 py-3 text-left text-[9px] font-black text-slate-400 uppercase tracking-wider">Descripción</th>
                                            <th className="px-6 py-3 text-right text-[9px] font-black text-slate-400 uppercase tracking-wider">P. Normal</th>
                                            <th className="px-6 py-3 text-right text-[9px] font-black text-slate-400 uppercase tracking-wider">P. Venta</th>
                                            <th className="px-6 py-3 text-right text-[9px] font-black text-slate-400 uppercase tracking-wider">Importe</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {ticketItems.map((item, idx) => (
                                            <tr key={idx} className="hover:bg-slate-50 transition-colors">
                                                <td className="px-6 py-3 whitespace-nowrap text-center text-[11px] font-black text-slate-900 italic">{item.Cantidad}</td>
                                                <td className="px-6 py-3 whitespace-nowrap text-[11px] font-bold text-slate-500">{item['Codigo Barras']}</td>
                                                <td className="px-6 py-3 text-[11px] font-black text-slate-700">{item.Descripcion}</td>
                                                <td className="px-6 py-3 whitespace-nowrap text-right text-[11px] font-medium text-slate-400 line-through decoration-rose-300">
                                                    {formatCurrency(item['Precio Normal'])}
                                                </td>
                                                <td className="px-6 py-3 whitespace-nowrap text-right text-[11px] font-black text-slate-600">
                                                    {formatCurrency(item['Precio Venta'])}
                                                </td>
                                                <td className="px-6 py-3 whitespace-nowrap text-right">
                                                    <span className="text-[12px] font-black text-[#4050B4] bg-[#4050B4]/5 px-2 py-1">
                                                        {formatCurrency(item.Total)}
                                                    </span>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            )}
                        </div>

                        {/* Footer Summary */}
                        <div className="bg-slate-50 p-4 border-t border-slate-200 flex items-center justify-between">
                            <div className="flex items-center gap-8">
                                <div className="flex flex-col">
                                    <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Unidades</span>
                                    <span className="text-sm font-black text-slate-900">{ticketItems.reduce((acc, i) => acc + i.Cantidad, 0)}</span>
                                </div>
                                <div className="flex flex-col border-l border-slate-200 pl-6">
                                    <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Monto Total</span>
                                    <span className="text-sm font-black text-[#4050B4]">
                                        {formatCurrency(ticketItems.reduce((acc, i) => acc + i.Total, 0))}
                                    </span>
                                </div>
                            </div>
                            <button
                                onClick={() => setIsItemsModalOpen(false)}
                                className="px-6 py-2 bg-slate-900 text-white font-black text-[10px] uppercase tracking-widest hover:bg-slate-800 transition-colors shadow-lg shadow-slate-900/20"
                            >
                                VOLVER A TICKETS
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Openings Drill-down Modal */}
            {isOpeningModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className={cn(
                        "bg-white shadow-2xl overflow-hidden flex flex-col transition-all duration-300 border border-slate-200",
                        isMaximized ? "fixed inset-0 m-0" : "w-full max-w-6xl max-h-[90vh]"
                    )}>
                        {/* Modal Header */}
                        <div className="flex items-center justify-between bg-white border-b border-slate-100 p-4">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-slate-50 rounded-none border border-slate-100">
                                    <Calendar size={18} className="text-[#4050B4]" />
                                </div>
                                <div>
                                    <h3 className="font-black text-sm uppercase tracking-widest leading-none mb-1 text-slate-800">Detalle de Aperturas</h3>
                                    <p className="text-[10px] font-bold text-slate-400 uppercase">{selectedStoreData?.Tienda} • {fechaInicio} a {fechaFin}</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                <div className="relative mr-4 hidden md:block">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                                    <input
                                        type="text"
                                        placeholder="BUSCAR Z, CAJERO..."
                                        className="bg-slate-50 border border-slate-200 rounded-none pl-9 pr-4 py-1.5 text-[10px] font-bold uppercase tracking-widest focus:ring-2 focus:ring-[#4050B4]/20 outline-none text-slate-700 w-64"
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                    />
                                </div>
                                <button
                                    onClick={exportOpeningsToExcel}
                                    disabled={sortedOpenings.length === 0}
                                    className="flex items-center gap-2 px-3 py-1.5 bg-[#4050B4]/10 text-[#4050B4] hover:bg-[#4050B4] hover:text-white transition-all text-[10px] font-black uppercase tracking-widest border border-[#4050B4]/20 disabled:opacity-50 disabled:cursor-not-allowed mr-2"
                                >
                                    <FileSpreadsheet size={14} />
                                    <span>Exportar Excel</span>
                                </button>
                                <button
                                    onClick={() => setIsMaximized(!isMaximized)}
                                    className="p-2 hover:bg-slate-50 text-slate-500 transition-colors"
                                    title={isMaximized ? "Restaurar" : "Maximizar"}
                                >
                                    {isMaximized ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
                                </button>
                                <button
                                    onClick={() => { setIsOpeningModalOpen(false); setIsMaximized(false); setSearchTerm(''); }}
                                    className="p-2 hover:bg-rose-50 text-rose-500 transition-colors"
                                >
                                    <X size={20} />
                                </button>
                            </div>
                        </div>

                        {/* Modal Content */}
                        <div className="flex-1 overflow-auto bg-white p-0 relative">
                            {loadingOpenings ? (
                                <div className="absolute inset-0 flex items-center justify-center">
                                    <div className="flex flex-col items-center gap-4">
                                        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[#4050B4]"></div>
                                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Cargando aperturas...</p>
                                    </div>
                                </div>
                            ) : (
                                <div className="min-w-full inline-block align-middle">
                                    <table className="min-w-full border-collapse">
                                        <thead className="sticky top-0 z-10">
                                            <tr className="bg-slate-50 border-b border-slate-200">
                                                <th onClick={() => handleOpeningSort('Z')} className="px-4 py-3 text-center text-[10px] font-black text-slate-500 uppercase tracking-wider cursor-pointer hover:bg-slate-100 transition-colors">
                                                    <div className="flex items-center justify-center">Z {RenderOpeningSortIcon('Z')}</div>
                                                </th>
                                                <th onClick={() => handleOpeningSort('Caja')} className="px-4 py-3 text-center text-[10px] font-black text-slate-500 uppercase tracking-wider cursor-pointer hover:bg-slate-100 transition-colors">
                                                    <div className="flex items-center justify-center">Caja {RenderOpeningSortIcon('Caja')}</div>
                                                </th>
                                                <th onClick={() => handleOpeningSort('Fecha Apertura')} className="px-4 py-3 text-left text-[10px] font-black text-slate-500 uppercase tracking-wider cursor-pointer hover:bg-slate-100 transition-colors">
                                                    <div className="flex items-center">Apertura {RenderOpeningSortIcon('Fecha Apertura')}</div>
                                                </th>
                                                <th onClick={() => handleOpeningSort('Cajero')} className="px-4 py-3 text-left text-[10px] font-black text-slate-500 uppercase tracking-wider cursor-pointer hover:bg-slate-100 transition-colors">
                                                    <div className="flex items-center">Cajero {RenderOpeningSortIcon('Cajero')}</div>
                                                </th>
                                                <th onClick={() => handleOpeningSort('Tickets')} className="px-4 py-3 text-center text-[10px] font-black text-slate-500 uppercase tracking-wider cursor-pointer hover:bg-slate-100 transition-colors">
                                                    <div className="flex items-center justify-center">Tickets {RenderOpeningSortIcon('Tickets')}</div>
                                                </th>
                                                <th onClick={() => handleOpeningSort('Total Venta')} className="px-4 py-3 text-right text-[10px] font-black text-slate-500 uppercase tracking-wider cursor-pointer hover:bg-slate-100 transition-colors">
                                                    <div className="flex items-center justify-end">Venta {RenderOpeningSortIcon('Total Venta')}</div>
                                                </th>
                                                <th onClick={() => handleOpeningSort('FechaCierre')} className="px-4 py-3 text-left text-[10px] font-black text-slate-500 uppercase tracking-wider cursor-pointer hover:bg-slate-100 transition-colors">
                                                    <div className="flex items-center">Cierre {RenderOpeningSortIcon('FechaCierre')}</div>
                                                </th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100">
                                            {sortedOpenings.length > 0 ? (
                                                sortedOpenings.map((opening, idx) => (
                                                    <tr
                                                        key={idx}
                                                        onClick={() => handleOpeningClick(opening)}
                                                        className="hover:bg-indigo-50/50 transition-colors group/row cursor-pointer"
                                                    >
                                                        <td className="px-4 py-3 whitespace-nowrap text-center text-[11px] font-black text-slate-900">{opening.Z}</td>
                                                        <td className="px-4 py-3 whitespace-nowrap text-center">
                                                            <span className="bg-slate-100 text-slate-600 px-2 py-0.5 text-[10px] font-black">{opening.Caja}</span>
                                                        </td>
                                                        <td className="px-4 py-3 whitespace-nowrap">
                                                            <div className="flex flex-col">
                                                                <span className="text-[11px] font-bold text-slate-700">{new Date(opening['Fecha Apertura']).toLocaleDateString('es-MX')}</span>
                                                                <span className="text-[9px] font-medium text-slate-400">{new Date(opening['Fecha Apertura']).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}</span>
                                                            </div>
                                                        </td>
                                                        <td className="px-4 py-3 whitespace-nowrap">
                                                            <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-600">
                                                                <User size={12} className="text-slate-400" />
                                                                {opening.Cajero}
                                                            </div>
                                                        </td>
                                                        <td className="px-4 py-3 whitespace-nowrap text-center text-[11px] font-black text-slate-900">{opening.Tickets}</td>
                                                        <td className="px-4 py-3 whitespace-nowrap text-right">
                                                            <span className="text-[12px] font-black text-[#4050B4]">{formatCurrency(opening['Total Venta'])}</span>
                                                        </td>
                                                        <td className="px-4 py-3 whitespace-nowrap">
                                                            {opening.FechaCierre ? (
                                                                <div className="flex flex-col opacity-60">
                                                                    <span className="text-[10px] font-bold text-slate-500">{new Date(opening.FechaCierre).toLocaleDateString('es-MX')}</span>
                                                                    <span className="text-[9px] font-medium text-slate-400">{new Date(opening.FechaCierre).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}</span>
                                                                </div>
                                                            ) : (
                                                                <span className="inline-flex items-center px-2 py-0.5 rounded-none text-[8px] font-black bg-emerald-100 text-emerald-700 uppercase tracking-widest animate-pulse">En Línea</span>
                                                            )}
                                                        </td>
                                                    </tr>
                                                ))
                                            ) : (
                                                <tr>
                                                    <td colSpan={7} className="px-4 py-12 text-center">
                                                        <div className="flex flex-col items-center gap-3">
                                                            <div className="p-4 bg-slate-50 rounded-none">
                                                                <Search size={32} className="text-slate-200" />
                                                            </div>
                                                            <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest">No se encontraron aperturas</p>
                                                        </div>
                                                    </td>
                                                </tr>
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>

                        {/* Modal Footer */}
                        <div className="bg-slate-50 p-4 border-t border-slate-200 flex items-center justify-between">
                            <div className="flex items-center gap-6">
                                <div className="flex flex-col">
                                    <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Total Z</span>
                                    <span className="text-sm font-black text-slate-900">{filteredOpenings.length}</span>
                                </div>
                                <div className="flex flex-col border-l border-slate-200 pl-6">
                                    <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Venta Acumulada</span>
                                    <span className="text-sm font-black text-[#4050B4]">{formatCurrency(filteredOpenings.reduce((acc, o) => acc + o['Total Venta'], 0))}</span>
                                </div>
                            </div>
                            <button
                                onClick={() => { setIsOpeningModalOpen(false); setIsMaximized(false); setSearchTerm(''); }}
                                className="px-6 py-2 bg-slate-900 text-white font-black text-[10px] uppercase tracking-widest hover:bg-slate-800 transition-colors shadow-lg shadow-slate-900/20"
                            >
                                CERRAR
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Cancellation Drill-down Modal */}
            {isCancellationModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className={cn(
                        "bg-white shadow-2xl overflow-hidden flex flex-col transition-all duration-300 border border-slate-200",
                        isMaximized ? "fixed inset-0 m-0" : "w-full max-w-6xl max-h-[90vh]"
                    )}>
                        {/* Modal Header */}
                        <div className="flex items-center justify-between bg-white border-b border-slate-100 p-4">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-slate-50 rounded-none border border-slate-100">
                                    <AlertCircle size={18} className="text-rose-500" />
                                </div>
                                <div>
                                    <h3 className="font-black text-sm uppercase tracking-widest leading-none mb-1 text-slate-800">Detalle de Cancelaciones</h3>
                                    <p className="text-[10px] font-bold text-slate-400 uppercase">{selectedStoreData?.Tienda} • {fechaInicio} a {fechaFin}</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                <div className="relative mr-4 hidden md:block">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                                    <input
                                        type="text"
                                        placeholder="BUSCAR FOLIO, ARTICULO, SUPERVISOR..."
                                        className="bg-slate-50 border border-slate-200 rounded-none pl-9 pr-4 py-1.5 text-[10px] font-bold uppercase tracking-widest focus:ring-2 focus:ring-[#4050B4]/20 outline-none text-slate-700 w-64"
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                    />
                                </div>
                                <button
                                    onClick={exportCancellationsToExcel}
                                    disabled={sortedCancellations.length === 0}
                                    className="flex items-center gap-2 px-3 py-1.5 bg-rose-50 text-rose-600 hover:bg-rose-600 hover:text-white transition-all text-[10px] font-black uppercase tracking-widest border border-rose-100 disabled:opacity-50 disabled:cursor-not-allowed mr-2"
                                >
                                    <FileSpreadsheet size={14} />
                                    <span>Exportar Excel</span>
                                </button>
                                <button
                                    onClick={() => setIsMaximized(!isMaximized)}
                                    className="p-2 hover:bg-slate-50 text-slate-500 transition-colors"
                                    title={isMaximized ? "Restaurar" : "Maximizar"}
                                >
                                    {isMaximized ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
                                </button>
                                <button
                                    onClick={() => { setIsCancellationModalOpen(false); setIsMaximized(false); setSearchTerm(''); }}
                                    className="p-2 hover:bg-rose-50 text-rose-500 transition-colors"
                                >
                                    <X size={20} />
                                </button>
                            </div>
                        </div>

                        {/* Modal Content */}
                        <div className="flex-1 overflow-auto bg-white p-0 relative">
                            {loadingCancellations ? (
                                <div className="absolute inset-0 flex items-center justify-center">
                                    <div className="flex flex-col items-center gap-4">
                                        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-rose-500"></div>
                                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Consultando cancelaciones...</p>
                                    </div>
                                </div>
                            ) : (
                                <div className="min-w-full inline-block align-middle">
                                    <table className="min-w-full border-collapse">
                                        <thead className="sticky top-0 z-10">
                                            <tr className="bg-slate-50 border-b border-slate-200">
                                                <th onClick={() => handleCancellationSort('Z')} className="px-4 py-3 text-center text-[10px] font-black text-slate-500 uppercase tracking-wider cursor-pointer hover:bg-slate-100 transition-colors">
                                                    <div className="flex items-center justify-center">Z {RenderCancellationSortIcon('Z')}</div>
                                                </th>
                                                <th onClick={() => handleCancellationSort('Folio Cancelacion')} className="px-4 py-3 text-left text-[10px] font-black text-slate-500 uppercase tracking-wider cursor-pointer hover:bg-slate-100 transition-colors">
                                                    <div className="flex items-center">Folio {RenderCancellationSortIcon('Folio Cancelacion')}</div>
                                                </th>
                                                <th onClick={() => handleCancellationSort('FechaCancelacion')} className="px-4 py-3 text-left text-[10px] font-black text-slate-500 uppercase tracking-wider cursor-pointer hover:bg-slate-100 transition-colors">
                                                    <div className="flex items-center">Fecha {RenderCancellationSortIcon('FechaCancelacion')}</div>
                                                </th>
                                                <th onClick={() => handleCancellationSort('Cantidad')} className="px-4 py-3 text-center text-[10px] font-black text-slate-500 uppercase tracking-wider cursor-pointer hover:bg-slate-100 transition-colors">
                                                    <div className="flex items-center justify-center">Cant {RenderCancellationSortIcon('Cantidad')}</div>
                                                </th>
                                                <th onClick={() => handleCancellationSort('Descripcion')} className="px-4 py-3 text-left text-[10px] font-black text-slate-500 uppercase tracking-wider cursor-pointer hover:bg-slate-100 transition-colors">
                                                    <div className="flex items-center">Descripción {RenderCancellationSortIcon('Descripcion')}</div>
                                                </th>
                                                <th onClick={() => handleCancellationSort('Total')} className="px-4 py-3 text-right text-[10px] font-black text-slate-500 uppercase tracking-wider cursor-pointer hover:bg-slate-100 transition-colors">
                                                    <div className="flex items-center justify-end">Importe {RenderCancellationSortIcon('Total')}</div>
                                                </th>
                                                <th onClick={() => handleCancellationSort('Cajero')} className="px-4 py-3 text-left text-[10px] font-black text-slate-500 uppercase tracking-wider cursor-pointer hover:bg-slate-100 transition-colors">
                                                    <div className="flex items-center">Cajero {RenderCancellationSortIcon('Cajero')}</div>
                                                </th>
                                                <th onClick={() => handleCancellationSort('Supervisor')} className="px-4 py-3 text-left text-[10px] font-black text-slate-500 uppercase tracking-wider cursor-pointer hover:bg-slate-100 transition-colors">
                                                    <div className="flex items-center">Supervisor {RenderCancellationSortIcon('Supervisor')}</div>
                                                </th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100">
                                            {sortedCancellations.length > 0 ? (
                                                sortedCancellations.map((item, idx) => (
                                                    <tr key={idx} className="hover:bg-rose-50/30 transition-colors group/row">
                                                        <td className="px-4 py-3 whitespace-nowrap text-center text-[11px] font-black text-slate-900">{item.Z}</td>
                                                        <td className="px-4 py-3 whitespace-nowrap text-[11px] font-bold text-rose-600">{item['Folio Cancelacion']}</td>
                                                        <td className="px-4 py-3 whitespace-nowrap">
                                                            <div className="flex flex-col">
                                                                <span className="text-[11px] font-bold text-slate-700">{new Date(item.FechaCancelacion).toLocaleDateString('es-MX')}</span>
                                                                <span className="text-[9px] font-medium text-slate-400">{new Date(item.FechaCancelacion).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}</span>
                                                            </div>
                                                        </td>
                                                        <td className="px-4 py-3 whitespace-nowrap text-center text-[11px] font-black text-slate-900">{item.Cantidad}</td>
                                                        <td className="px-4 py-3">
                                                            <div className="flex flex-col">
                                                                <span className="text-[11px] font-black text-slate-800 leading-tight">{item.Descripcion}</span>
                                                                <span className="text-[9px] font-bold text-slate-400 uppercase">{item['Codigo Barras']}</span>
                                                            </div>
                                                        </td>
                                                        <td className="px-4 py-3 whitespace-nowrap text-right">
                                                            <div className="flex flex-col">
                                                                <span className="text-[12px] font-black text-slate-900">{formatCurrency(item.Total)}</span>
                                                                <span className="text-[9px] font-medium text-slate-400">@{formatCurrency(item['Precio Venta'])}</span>
                                                            </div>
                                                        </td>
                                                        <td className="px-4 py-3 whitespace-nowrap">
                                                            <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-600">
                                                                <User size={12} className="text-slate-400" />
                                                                {item.Cajero}
                                                            </div>
                                                        </td>
                                                        <td className="px-4 py-3 whitespace-nowrap">
                                                            <div className="flex items-center gap-1.5 text-[11px] font-black text-rose-700">
                                                                <AlertCircle size={12} className="text-rose-300" />
                                                                {item.Supervisor}
                                                            </div>
                                                        </td>
                                                    </tr>
                                                ))
                                            ) : (
                                                <tr>
                                                    <td colSpan={8} className="px-4 py-12 text-center">
                                                        <div className="flex flex-col items-center gap-3">
                                                            <div className="p-4 bg-slate-50 rounded-none">
                                                                <Search size={32} className="text-slate-200" />
                                                            </div>
                                                            <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest">No se encontraron cancelaciones</p>
                                                        </div>
                                                    </td>
                                                </tr>
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>

                        {/* Modal Footer */}
                        <div className="bg-slate-50 p-4 border-t border-slate-200 flex items-center justify-between">
                            <div className="flex items-center gap-6">
                                <div className="flex flex-col">
                                    <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Total Registros</span>
                                    <span className="text-sm font-black text-slate-900">{filteredCancellations.length}</span>
                                </div>
                                <div className="flex flex-col border-l border-slate-200 pl-6">
                                    <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Monto Cancelado</span>
                                    <span className="text-sm font-black text-rose-600">{formatCurrency(filteredCancellations.reduce((acc, c) => acc + c.Total, 0))}</span>
                                </div>
                            </div>
                            <button
                                onClick={() => { setIsCancellationModalOpen(false); setIsMaximized(false); setSearchTerm(''); }}
                                className="px-6 py-2 bg-slate-900 text-white font-black text-[10px] uppercase tracking-widest hover:bg-slate-800 transition-colors shadow-lg shadow-slate-900/20"
                            >
                                CERRAR
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Withdrawal Drill-down Modal */}
            {isWithdrawalModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className={cn(
                        "bg-white shadow-2xl overflow-hidden flex flex-col transition-all duration-300 border border-slate-200",
                        isMaximized ? "fixed inset-0 m-0" : "w-full max-w-[95vw] lg:max-w-7xl max-h-[90vh]"
                    )}>
                        {/* Modal Header */}
                        <div className="flex items-center justify-between bg-white border-b border-slate-100 p-4">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-slate-50 rounded-none border border-slate-100">
                                    <Wallet size={18} className="text-amber-500" />
                                </div>
                                <div>
                                    <h3 className="font-black text-sm uppercase tracking-widest leading-none mb-1 text-slate-800">Detalle de Retiros</h3>
                                    <p className="text-[10px] font-bold text-slate-400 uppercase">{selectedStoreData?.Tienda} • {fechaInicio} a {fechaFin}</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                <div className="relative mr-4 hidden md:block">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                                    <input
                                        type="text"
                                        placeholder="BUSCAR FOLIO, CONCEPTO, SUPERVISOR..."
                                        className="bg-slate-50 border border-slate-200 rounded-none pl-9 pr-4 py-1.5 text-[10px] font-bold uppercase tracking-widest focus:ring-2 focus:ring-[#4050B4]/20 outline-none text-slate-700 w-64"
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                    />
                                </div>
                                <button
                                    onClick={exportWithdrawalsToExcel}
                                    disabled={sortedWithdrawals.length === 0}
                                    className="flex items-center gap-2 px-3 py-1.5 bg-amber-50 text-amber-600 hover:bg-amber-600 hover:text-white transition-all text-[10px] font-black uppercase tracking-widest border border-amber-100 disabled:opacity-50 disabled:cursor-not-allowed mr-2"
                                >
                                    <FileSpreadsheet size={14} />
                                    <span>Exportar Excel</span>
                                </button>
                                <button
                                    onClick={() => setIsMaximized(!isMaximized)}
                                    className="p-2 hover:bg-slate-50 text-slate-500 transition-colors"
                                    title={isMaximized ? "Restaurar" : "Maximizar"}
                                >
                                    {isMaximized ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
                                </button>
                                <button
                                    onClick={() => { setIsWithdrawalModalOpen(false); setIsMaximized(false); setSearchTerm(''); }}
                                    className="p-2 hover:bg-rose-50 text-rose-500 transition-colors"
                                >
                                    <X size={20} />
                                </button>
                            </div>
                        </div>

                        {/* Modal Content */}
                        <div className="flex-1 overflow-auto bg-white p-0 relative">
                            {loadingWithdrawals ? (
                                <div className="absolute inset-0 flex items-center justify-center">
                                    <div className="flex flex-col items-center gap-4">
                                        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-amber-500"></div>
                                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Consultando retiros...</p>
                                    </div>
                                </div>
                            ) : (
                                <div className="min-w-full inline-block align-middle">
                                    <table className="min-w-full border-collapse text-[11px]">
                                        <thead className="sticky top-0 z-10">
                                            <tr className="bg-slate-50 border-b border-slate-200">
                                                <th onClick={() => handleWithdrawalSort('Z')} className="px-3 py-3 text-center font-black text-slate-500 uppercase tracking-wider cursor-pointer hover:bg-slate-100 transition-colors">
                                                    <div className="flex items-center justify-center">Z {RenderWithdrawalSortIcon('Z')}</div>
                                                </th>
                                                <th onClick={() => handleWithdrawalSort('Folio Retiro')} className="px-3 py-3 text-left font-black text-slate-500 uppercase tracking-wider cursor-pointer hover:bg-slate-100 transition-colors">
                                                    <div className="flex items-center">Folio {RenderWithdrawalSortIcon('Folio Retiro')}</div>
                                                </th>
                                                <th onClick={() => handleWithdrawalSort('Fecha Retiro')} className="px-3 py-3 text-left font-black text-slate-500 uppercase tracking-wider cursor-pointer hover:bg-slate-100 transition-colors">
                                                    <div className="flex items-center">Fecha {RenderWithdrawalSortIcon('Fecha Retiro')}</div>
                                                </th>
                                                <th onClick={() => handleWithdrawalSort('Concepto')} className="px-3 py-3 text-left font-black text-slate-500 uppercase tracking-wider cursor-pointer hover:bg-slate-100 transition-colors">
                                                    <div className="flex items-center">Concepto {RenderWithdrawalSortIcon('Concepto')}</div>
                                                </th>
                                                <th onClick={() => handleWithdrawalSort('Efectivo')} className="px-3 py-3 text-right font-black text-slate-500 uppercase tracking-wider cursor-pointer hover:bg-slate-100 transition-colors">
                                                    <div className="flex items-center justify-end">Efectivo {RenderWithdrawalSortIcon('Efectivo')}</div>
                                                </th>
                                                <th onClick={() => handleWithdrawalSort('Tarjeta')} className="px-3 py-3 text-right font-black text-slate-500 uppercase tracking-wider cursor-pointer hover:bg-slate-100 transition-colors">
                                                    <div className="flex items-center justify-end">Tarjeta {RenderWithdrawalSortIcon('Tarjeta')}</div>
                                                </th>
                                                <th onClick={() => handleWithdrawalSort('Debito')} className="px-3 py-3 text-right font-black text-slate-500 uppercase tracking-wider cursor-pointer hover:bg-slate-100 transition-colors">
                                                    <div className="flex items-center justify-end">Débito {RenderWithdrawalSortIcon('Debito')}</div>
                                                </th>
                                                <th onClick={() => handleWithdrawalSort('Transferencia')} className="px-3 py-3 text-right font-black text-slate-500 uppercase tracking-wider cursor-pointer hover:bg-slate-100 transition-colors">
                                                    <div className="flex items-center justify-end">Transf. {RenderWithdrawalSortIcon('Transferencia')}</div>
                                                </th>
                                                <th onClick={() => handleWithdrawalSort('Vales')} className="px-3 py-3 text-right font-black text-slate-500 uppercase tracking-wider cursor-pointer hover:bg-slate-100 transition-colors">
                                                    <div className="flex items-center justify-end">Vales {RenderWithdrawalSortIcon('Vales')}</div>
                                                </th>
                                                <th onClick={() => handleWithdrawalSort('Cajero')} className="px-3 py-3 text-left font-black text-slate-500 uppercase tracking-wider cursor-pointer hover:bg-slate-100 transition-colors">
                                                    <div className="flex items-center">Cajero {RenderWithdrawalSortIcon('Cajero')}</div>
                                                </th>
                                                <th onClick={() => handleWithdrawalSort('Supervisor')} className="px-3 py-3 text-left font-black text-slate-500 uppercase tracking-wider cursor-pointer hover:bg-slate-100 transition-colors">
                                                    <div className="flex items-center">Supervisor {RenderWithdrawalSortIcon('Supervisor')}</div>
                                                </th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100">
                                            {sortedWithdrawals.length > 0 ? (
                                                sortedWithdrawals.map((item, idx) => {
                                                    const totalRetiro = item.Efectivo + item.Tarjeta + item.Debito + item.Transferencia + item.Vales + item.Dolares + item.Cheques - item.Devoluciones;
                                                    return (
                                                        <tr key={idx} className="hover:bg-amber-50/30 transition-colors group/row">
                                                            <td className="px-3 py-3 whitespace-nowrap text-center font-black text-slate-900">{item.Z}</td>
                                                            <td className="px-3 py-3 whitespace-nowrap font-bold text-amber-600">{item['Folio Retiro']}</td>
                                                            <td className="px-3 py-3 whitespace-nowrap">
                                                                <div className="flex flex-col">
                                                                    <span className="font-bold text-slate-700">{new Date(item['Fecha Retiro']).toLocaleDateString('es-MX')}</span>
                                                                    <span className="text-[9px] font-medium text-slate-400">{new Date(item['Fecha Retiro']).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}</span>
                                                                </div>
                                                            </td>
                                                            <td className="px-3 py-3">
                                                                <span className="font-bold text-slate-600 block max-w-[150px] truncate" title={item.Concepto}>{item.Concepto}</span>
                                                            </td>
                                                            <td className="px-3 py-3 whitespace-nowrap text-right font-bold text-slate-700">{formatCurrency(item.Efectivo)}</td>
                                                            <td className="px-3 py-3 whitespace-nowrap text-right font-bold text-slate-700">{formatCurrency(item.Tarjeta)}</td>
                                                            <td className="px-3 py-3 whitespace-nowrap text-right font-bold text-slate-700">{formatCurrency(item.Debito)}</td>
                                                            <td className="px-3 py-3 whitespace-nowrap text-right font-bold text-slate-700">{formatCurrency(item.Transferencia)}</td>
                                                            <td className="px-3 py-3 whitespace-nowrap text-right font-bold text-slate-700">{formatCurrency(item.Vales)}</td>
                                                            <td className="px-3 py-3 whitespace-nowrap">
                                                                <div className="flex items-center gap-1.5 font-bold text-slate-600">
                                                                    <User size={12} className="text-slate-400" />
                                                                    {item.Cajero}
                                                                </div>
                                                            </td>
                                                            <td className="px-3 py-3 whitespace-nowrap">
                                                                <div className="flex items-center gap-1.5 font-black text-amber-700">
                                                                    <AlertCircle size={12} className="text-amber-300" />
                                                                    {item.Supervisor}
                                                                </div>
                                                            </td>
                                                        </tr>
                                                    );
                                                })
                                            ) : (
                                                <tr>
                                                    <td colSpan={11} className="px-4 py-12 text-center">
                                                        <div className="flex flex-col items-center gap-3">
                                                            <div className="p-4 bg-slate-50 rounded-none">
                                                                <Search size={32} className="text-slate-200" />
                                                            </div>
                                                            <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest">No se encontraron retiros</p>
                                                        </div>
                                                    </td>
                                                </tr>
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>

                        {/* Modal Footer */}
                        <div className="bg-slate-50 p-4 border-t border-slate-200 flex items-center justify-between">
                            <div className="flex items-center gap-6">
                                <div className="flex flex-col">
                                    <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Total Retiros</span>
                                    <span className="text-sm font-black text-slate-900">{filteredWithdrawals.length}</span>
                                </div>
                                <div className="flex flex-col border-l border-slate-200 pl-6 text-right">
                                    <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Gran Total Retirado</span>
                                    <span className="text-sm font-black text-amber-600">
                                        {formatCurrency(filteredWithdrawals.reduce((acc, w) => {
                                            return acc + w.Efectivo + w.Tarjeta + w.Debito + w.Transferencia + w.Vales + w.Dolares + w.Cheques - w.Devoluciones;
                                        }, 0))}
                                    </span>
                                </div>
                            </div>
                            <button
                                onClick={() => { setIsWithdrawalModalOpen(false); setIsMaximized(false); setSearchTerm(''); }}
                                className="px-6 py-2 bg-slate-900 text-white font-black text-[10px] uppercase tracking-widest hover:bg-slate-800 transition-colors shadow-lg shadow-slate-900/20"
                            >
                                CERRAR
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Devoluciones Drill-down Modal */}
            {isReturnModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className={cn(
                        "bg-white shadow-2xl overflow-hidden flex flex-col transition-all duration-300 border border-slate-200",
                        isMaximized ? "fixed inset-0 m-0" : "w-full max-w-6xl max-h-[90vh]"
                    )}>
                        {/* Modal Header */}
                        <div className="flex items-center justify-between bg-white border-b border-slate-100 p-4">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-slate-50 rounded-none border border-slate-100">
                                    <RotateCcw size={18} className="text-indigo-600" />
                                </div>
                                <div>
                                    <h3 className="font-black text-sm uppercase tracking-widest leading-none mb-1 text-slate-800">Detalle de Devoluciones</h3>
                                    <p className="text-[10px] font-bold text-slate-400 uppercase">{selectedStoreData?.Tienda} • {fechaInicio} a {fechaFin}</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                <div className="relative mr-4 hidden md:block">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                                    <input
                                        type="text"
                                        placeholder="BUSCAR FOLIO, CLIENTE, SUPERVISOR..."
                                        className="bg-slate-50 border border-slate-200 rounded-none pl-9 pr-4 py-1.5 text-[10px] font-bold uppercase tracking-widest focus:ring-2 focus:ring-indigo-500/20 outline-none text-slate-700 w-64"
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                    />
                                </div>
                                <button
                                    onClick={exportReturnsToExcel}
                                    disabled={sortedReturns.length === 0}
                                    className="flex items-center gap-2 px-3 py-1.5 bg-indigo-50 text-indigo-600 hover:bg-indigo-600 hover:text-white transition-all text-[10px] font-black uppercase tracking-widest border border-indigo-100 disabled:opacity-50 disabled:cursor-not-allowed mr-2"
                                >
                                    <FileSpreadsheet size={14} />
                                    <span>Exportar Excel</span>
                                </button>
                                <button
                                    onClick={() => setIsMaximized(!isMaximized)}
                                    className="p-2 hover:bg-slate-50 text-slate-500 transition-colors"
                                    title={isMaximized ? "Restaurar" : "Maximizar"}
                                >
                                    {isMaximized ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
                                </button>
                                <button
                                    onClick={() => { setIsReturnModalOpen(false); setIsMaximized(false); setSearchTerm(''); }}
                                    className="p-2 hover:bg-rose-50 text-rose-500 transition-colors"
                                >
                                    <X size={20} />
                                </button>
                            </div>
                        </div>

                        {/* Search Bar for Mobile */}
                        <div className="p-3 bg-slate-50 border-b border-slate-200 md:hidden">
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                                <input
                                    type="text"
                                    placeholder="BUSCAR DEVOLUCIÓN..."
                                    className="w-full bg-white border border-slate-200 rounded-none pl-9 pr-4 py-2 text-[10px] font-bold uppercase tracking-widest focus:ring-2 focus:ring-indigo-500/20 outline-none"
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                />
                            </div>
                        </div>

                        {/* Modal Content */}
                        <div className="flex-1 overflow-auto bg-white p-0 relative">
                            {loadingReturns ? (
                                <div className="absolute inset-0 flex items-center justify-center">
                                    <div className="flex flex-col items-center gap-4">
                                        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600"></div>
                                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Consultando devoluciones...</p>
                                    </div>
                                </div>
                            ) : (
                                <div className="min-w-full inline-block align-middle">
                                    <table className="min-w-full border-collapse">
                                        <thead className="sticky top-0 z-10">
                                            <tr className="bg-slate-50 border-b border-slate-200">
                                                {['Folio', 'Fecha', 'Clave', 'Valor', 'Cliente', 'Concepto', 'Teléfono', 'Empleado', 'Supervisor'].map((header) => (
                                                    <th
                                                        key={header}
                                                        onClick={() => handleReturnSort(header === 'Folio' ? 'Folio Devolucion' : header === 'Fecha' ? 'Fecha Devolucion' : header === 'Teléfono' ? 'Telefono' : header)}
                                                        className="px-4 py-3 text-center text-[10px] font-black text-slate-500 uppercase tracking-widest cursor-pointer hover:bg-slate-100 transition-colors"
                                                    >
                                                        <div className="flex items-center justify-center gap-1">
                                                            {header}
                                                            {RenderReturnSortIcon(header === 'Folio' ? 'Folio Devolucion' : header === 'Fecha' ? 'Fecha Devolucion' : header === 'Teléfono' ? 'Telefono' : header)}
                                                        </div>
                                                    </th>
                                                ))}
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100">
                                            {sortedReturns.length > 0 ? (
                                                sortedReturns.map((item, idx) => (
                                                    <tr
                                                        key={idx}
                                                        onClick={() => handleReturnRowClick(item)}
                                                        className="hover:bg-indigo-50/30 transition-colors group/row text-center cursor-pointer"
                                                    >
                                                        <td className="px-4 py-3 whitespace-nowrap font-bold text-indigo-600">{item['Folio Devolucion']}</td>
                                                        <td className="px-4 py-3 whitespace-nowrap">
                                                            <div className="flex flex-col items-center">
                                                                <span className="text-[11px] font-bold text-slate-700">{new Date(item['Fecha Devolucion']).toLocaleDateString('es-MX')}</span>
                                                                <span className="text-[9px] font-medium text-slate-400">{new Date(item['Fecha Devolucion']).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}</span>
                                                            </div>
                                                        </td>
                                                        <td className="px-4 py-3 whitespace-nowrap text-[11px] font-bold text-slate-600">{item.Clave}</td>
                                                        <td className="px-4 py-3 whitespace-nowrap">
                                                            <span className="text-[12px] font-black text-indigo-600">{formatCurrency(item.Valor)}</span>
                                                        </td>
                                                        <td className="px-4 py-3">
                                                            <span className="text-[11px] font-bold text-slate-600 block max-w-[120px] truncate mx-auto" title={item.Cliente}>{item.Cliente}</span>
                                                        </td>
                                                        <td className="px-4 py-3">
                                                            <span className="text-[11px] font-bold text-slate-500 block max-w-[120px] truncate mx-auto" title={item.Concepto}>{item.Concepto}</span>
                                                        </td>
                                                        <td className="px-4 py-3 whitespace-nowrap text-[11px] font-medium text-slate-600">{item.Telefono}</td>
                                                        <td className="px-4 py-3 whitespace-nowrap">
                                                            <div className="flex items-center justify-center gap-1.5 text-[11px] font-bold text-slate-600">
                                                                <User size={12} className="text-slate-400" />
                                                                {item.Empleado}
                                                            </div>
                                                        </td>
                                                        <td className="px-4 py-3 whitespace-nowrap">
                                                            <div className="flex items-center justify-center gap-1.5 text-[11px] font-black text-indigo-700 uppercase italic">
                                                                {item.Supervisor}
                                                            </div>
                                                        </td>
                                                    </tr>
                                                ))
                                            ) : (
                                                <tr>
                                                    <td colSpan={9} className="px-4 py-12 text-center">
                                                        <div className="flex flex-col items-center gap-3">
                                                            <div className="p-4 bg-slate-50 rounded-none">
                                                                <Search size={32} className="text-slate-200" />
                                                            </div>
                                                            <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest">No se encontraron devoluciones</p>
                                                        </div>
                                                    </td>
                                                </tr>
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>

                        {/* Modal Footer */}
                        <div className="bg-slate-50 p-4 border-t border-slate-200 flex items-center justify-between">
                            <div className="flex items-center gap-6">
                                <div className="flex flex-col">
                                    <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Total Devoluciones</span>
                                    <span className="text-sm font-black text-slate-900">{filteredReturns.length}</span>
                                </div>
                                <div className="flex flex-col border-l border-slate-200 pl-6 text-right">
                                    <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Monto Total Devoluciones</span>
                                    <span className="text-sm font-black text-indigo-600">
                                        {formatCurrency(filteredReturns.reduce((acc, r) => acc + r.Valor, 0))}
                                    </span>
                                </div>
                            </div>
                            <button
                                onClick={() => { setIsReturnModalOpen(false); setIsMaximized(false); setSearchTerm(''); }}
                                className="px-6 py-2 bg-slate-900 text-white font-black text-[10px] uppercase tracking-widest hover:bg-slate-800 transition-colors shadow-lg shadow-slate-900/20"
                            >
                                CERRAR
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Return Items Breakdown Modal */}
            {isReturnItemsModalOpen && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-white shadow-2xl overflow-hidden flex flex-col w-full max-w-5xl max-h-[85vh] border border-slate-200">
                        {/* Modal Header */}
                        <div className="flex items-center justify-between bg-white border-b border-slate-100 p-4">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-indigo-50 rounded-none border border-indigo-100">
                                    <Package size={18} className="text-indigo-600" />
                                </div>
                                <div>
                                    <h3 className="font-black text-xs uppercase tracking-widest leading-none mb-1 text-slate-800">Partidas de Devolución</h3>
                                    <p className="text-[10px] font-bold text-slate-400 uppercase">Folio: {selectedReturn?.['Folio Devolucion']} • Cliente: {selectedReturn?.Cliente}</p>
                                </div>
                            </div>
                            <button
                                onClick={() => setIsReturnItemsModalOpen(false)}
                                className="p-2 hover:bg-rose-50 text-rose-500 transition-colors"
                            >
                                <X size={20} />
                            </button>
                        </div>

                        {/* Modal Content */}
                        <div className="flex-1 overflow-auto p-0 relative">
                            {loadingReturnItems ? (
                                <div className="absolute inset-0 flex items-center justify-center">
                                    <div className="flex flex-col items-center gap-4">
                                        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600"></div>
                                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Consultando partidas...</p>
                                    </div>
                                </div>
                            ) : (
                                <div className="min-w-full inline-block align-middle">
                                    <table className="min-w-full border-collapse">
                                        <thead className="sticky top-0 z-10">
                                            <tr className="bg-slate-50 border-b border-slate-200">
                                                <th onClick={() => handleReturnItemsSort('FolioVenta')} className="px-4 py-3 text-left text-[10px] font-black text-slate-500 uppercase tracking-wider cursor-pointer hover:bg-slate-100 transition-colors">
                                                    <div className="flex items-center">Folio Venta {RenderReturnItemsSortIcon('FolioVenta')}</div>
                                                </th>
                                                <th onClick={() => handleReturnItemsSort('Fecha Venta')} className="px-4 py-3 text-left text-[10px] font-black text-slate-500 uppercase tracking-wider cursor-pointer hover:bg-slate-100 transition-colors">
                                                    <div className="flex items-center">Fecha Venta {RenderReturnItemsSortIcon('Fecha Venta')}</div>
                                                </th>
                                                <th onClick={() => handleReturnItemsSort('Codigo Barras')} className="px-4 py-3 text-left text-[10px] font-black text-slate-500 uppercase tracking-wider cursor-pointer hover:bg-slate-100 transition-colors">
                                                    <div className="flex items-center">Código {RenderReturnItemsSortIcon('Codigo Barras')}</div>
                                                </th>
                                                <th onClick={() => handleReturnItemsSort('Descripcion')} className="px-4 py-3 text-left text-[10px] font-black text-slate-500 uppercase tracking-wider cursor-pointer hover:bg-slate-100 transition-colors">
                                                    <div className="flex items-center">Descripción {RenderReturnItemsSortIcon('Descripcion')}</div>
                                                </th>
                                                <th onClick={() => handleReturnItemsSort('CantidadAnterior')} className="px-4 py-3 text-center text-[10px] font-black text-slate-500 uppercase tracking-wider cursor-pointer hover:bg-slate-100 transition-colors">
                                                    <div className="flex items-center justify-center">Cant. Ant. {RenderReturnItemsSortIcon('CantidadAnterior')}</div>
                                                </th>
                                                <th onClick={() => handleReturnItemsSort('Dev')} className="px-4 py-3 text-center text-[10px] font-black text-slate-500 uppercase tracking-wider cursor-pointer hover:bg-slate-100 transition-colors">
                                                    <div className="flex items-center justify-center">Cant. Dev. {RenderReturnItemsSortIcon('Dev')}</div>
                                                </th>
                                                <th onClick={() => handleReturnItemsSort('PrecioVenta')} className="px-4 py-3 text-right text-[10px] font-black text-slate-500 uppercase tracking-wider cursor-pointer hover:bg-slate-100 transition-colors">
                                                    <div className="flex items-center justify-end">Precio {RenderReturnItemsSortIcon('PrecioVenta')}</div>
                                                </th>
                                                <th onClick={() => handleReturnItemsSort('Total')} className="px-4 py-3 text-right text-[10px] font-black text-slate-500 uppercase tracking-wider cursor-pointer hover:bg-slate-100 transition-colors">
                                                    <div className="flex items-center justify-end">Total {RenderReturnItemsSortIcon('Total')}</div>
                                                </th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100 text-[11px]">
                                            {sortedReturnItems.map((item, idx) => (
                                                <tr key={idx} className={`${item.Dev > 0 ? 'bg-amber-100/60 border-l-4 border-l-amber-500' : ''} hover:bg-slate-50 transition-colors`}>
                                                    <td className="px-4 py-3 whitespace-nowrap font-bold text-slate-700">{item.FolioVenta}</td>
                                                    <td className="px-4 py-3 whitespace-nowrap">
                                                        <div className="flex flex-col">
                                                            <span className="font-bold text-slate-600">{new Date(item['Fecha Venta']).toLocaleDateString('es-MX')}</span>
                                                            <span className="text-[9px] text-slate-400">{new Date(item['Fecha Venta']).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}</span>
                                                        </div>
                                                    </td>
                                                    <td className="px-4 py-3 whitespace-nowrap text-slate-600 font-medium">{item['Codigo Barras']}</td>
                                                    <td className="px-4 py-3 font-bold text-slate-700">{item.Descripcion}</td>
                                                    <td className="px-4 py-3 text-center font-bold text-slate-600">{item.CantidadAnterior}</td>
                                                    <td className="px-4 py-3 text-center font-black text-indigo-600">{item.Dev}</td>
                                                    <td className="px-4 py-3 text-right font-bold text-slate-600">{formatCurrency(item.PrecioVenta)}</td>
                                                    <td className="px-4 py-3 text-right font-black text-indigo-700">{formatCurrency(item.Total)}</td>
                                                </tr>
                                            ))}
                                            {sortedReturnItems.length === 0 && !loadingReturnItems && (
                                                <tr>
                                                    <td colSpan={8} className="px-4 py-12 text-center text-slate-400 font-bold uppercase tracking-widest text-[10px]">No hay partidas para mostrar</td>
                                                </tr>
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>

                        {/* Modal Footer */}
                        <div className="bg-slate-50 p-4 border-t border-slate-200 flex items-center justify-between">
                            <div className="flex items-center gap-6">
                                <div className="flex flex-col">
                                    <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Partidas</span>
                                    <span className="text-sm font-black text-slate-900">{sortedReturnItems.length}</span>
                                </div>
                                <div className="flex flex-col border-l border-slate-200 pl-6 text-right">
                                    <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Total Devolución</span>
                                    <span className="text-sm font-black text-indigo-600">
                                        {formatCurrency(sortedReturnItems.reduce((acc, item) => acc + item.Total, 0))}
                                    </span>
                                </div>
                            </div>
                            <button
                                onClick={() => setIsReturnItemsModalOpen(false)}
                                className="px-6 py-2 bg-slate-900 text-white font-black text-[10px] uppercase tracking-widest hover:bg-slate-800 transition-colors shadow-lg shadow-slate-900/20"
                            >
                                CERRAR
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Print Styles */}
            <style jsx global>{`
                @media print {
                    /* Hide sidebar and other UI elements */
                    nav, 
                    aside, 
                    header,
                    .print\\:hidden,
                    button:not(.print-visible),
                    .fixed.inset-y-0.left-0 {
                        display: none !important;
                    }

                    /* Ensure background colors are printed */
                    * {
                        -webkit-print-color-adjust: exact !important;
                        print-color-adjust: exact !important;
                    }

                    /* Reset body and container for printing */
                    body, html {
                        background: white !important;
                        margin: 0 !important;
                        padding: 0 !important;
                    }

                    main, 
                    .container,
                    .space-y-4 {
                        margin: 0 !important;
                        padding: 5mm !important;
                        width: 100% !important;
                        max-width: none !important;
                    }

                    /* Grid for metrics cards in print */
                    .grid {
                        display: grid !important;
                        grid-template-cols: repeat(5, 1fr) !important;
                        gap: 10px !important;
                    }

                    .print-visible {
                        display: block !important;
                        visibility: visible !important;
                        border: 1px solid #e2e8f0 !important;
                        break-inside: avoid !important;
                    }

                    /* Ensure charts are visible */
                    .recharts-responsive-container {
                        width: 100% !important;
                        height: 400px !important;
                    }
                }
            `}</style>
        </div>
    );
}
