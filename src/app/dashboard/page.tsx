"use client";

import { useState, useEffect, useRef, useCallback } from 'react';
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
    RotateCcw,
    LayoutGrid,
    Rows,
    Columns,
    Percent
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { LoadingScreen } from '@/components/ui/loading-screen';
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
import { TrendsTicker } from '@/components/trends-ticker';
import { TrendsDiscovery } from '@/components/trends-discovery';
import { CancellationDetailModal } from '@/components/cancellation-detail-modal';
import { DeptoDetailModal } from '@/components/depto-detail-modal';
import { ParetoAnalysisModal } from '@/components/pareto-analysis-modal';

export default function DashboardPage() {
    const getMonterreyDate = () => {
        return new Intl.DateTimeFormat('en-CA', {
            timeZone: 'America/Monterrey',
            year: 'numeric',
            month: '2-digit',
            day: '2-digit'
        }).format(new Date());
    };

    const [fechaInicio, setFechaInicio] = useState(getMonterreyDate());
    const [fechaFin, setFechaFin] = useState(getMonterreyDate());
    const [loading, setLoading] = useState(true);
    const [data, setData] = useState<any>(null);
    const [selectedMetric, setSelectedMetric] = useState<'ventas' | 'aperturas' | 'cancelaciones' | 'retiros' | 'devoluciones'>('ventas');
    const [chartType, setChartType] = useState<'bar' | 'pie'>('bar');
    const [subMetric, setSubMetric] = useState<string>('Total');
    const [selectedVentasTab, setSelectedVentasTab] = useState<'sucursal' | 'departamento' | 'familia'>('sucursal');
    const [selectedStoreId, setSelectedStoreId] = useState<string | null>(null);
    const [selectedStoreName, setSelectedStoreName] = useState<string | null>(null);

    // On-demand chart data for Deptos / Familias
    const [ventasDepto, setVentasDepto] = useState<any[]>([]);
    const [ventasFamilia, setVentasFamilia] = useState<any[]>([]);
    const [loadingDesglose, setLoadingDesglose] = useState(false);

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

    // Withdrawal Modal
    const [isWithdrawalModalOpen, setIsWithdrawalModalOpen] = useState(false);
    const [withdrawalDetails, setWithdrawalDetails] = useState<any[]>([]);
    const [loadingWithdrawals, setLoadingWithdrawals] = useState(false);
    const [withdrawalSortConfig, setWithdrawalSortConfig] = useState<{ key: string, direction: 'asc' | 'desc' } | null>({ key: 'Fecha Retiro', direction: 'desc' });

    // Return Modal
    const [isReturnModalOpen, setIsReturnModalOpen] = useState(false);

    // Depto Detail Modal
    const [isDeptoModalOpen, setIsDeptoModalOpen] = useState(false);
    const [selectedDeptoId, setSelectedDeptoId] = useState<number | undefined>();
    const [selectedDeptoName, setSelectedDeptoName] = useState<string | undefined>();
    const [selectedFamilia, setSelectedFamilia] = useState<string | undefined>();
    const [isParetoModalOpen, setIsParetoModalOpen] = useState(false);

    // Lock body scroll when any modal is open to prevent background flash/repaint on scroll
    const anyModalOpen = isModalOpen || isItemsModalOpen || isOpeningModalOpen || isCancellationModalOpen ||
        isWithdrawalModalOpen || isReturnModalOpen || isDeptoModalOpen || isParetoModalOpen;

    useEffect(() => {
        if (anyModalOpen) {
            const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
            document.body.style.overflow = 'hidden';
            document.body.style.paddingRight = `${scrollbarWidth}px`;
        } else {
            document.body.style.overflow = '';
            document.body.style.paddingRight = '';
        }
        return () => {
            document.body.style.overflow = '';
            document.body.style.paddingRight = '';
        };
    }, [anyModalOpen]);


    // Position Persistence states for all detail modals
    const [salesModalPosition, setSalesModalPosition] = useState({ x: 0, y: 0 });
    const [openingModalPosition, setOpeningModalPosition] = useState({ x: 0, y: 0 });
    const [withdrawalModalPosition, setWithdrawalModalPosition] = useState({ x: 0, y: 0 });
    const [returnModalPosition, setReturnModalPosition] = useState({ x: 0, y: 0 });
    const [itemsModalPosition, setItemsModalPosition] = useState({ x: 0, y: 0 });

    const [isSalesModalDragging, setIsSalesModalDragging] = useState(false);
    const [isOpeningModalDragging, setIsOpeningModalDragging] = useState(false);
    const [isWithdrawalModalDragging, setIsWithdrawalModalDragging] = useState(false);
    const [isReturnModalDragging, setIsReturnModalDragging] = useState(false);
    const [isItemsModalDragging, setIsItemsModalDragging] = useState(false);

    const [isSalesPositionLoaded, setIsSalesPositionLoaded] = useState(false);
    const [isOpeningPositionLoaded, setIsOpeningPositionLoaded] = useState(false);
    const [isWithdrawalPositionLoaded, setIsWithdrawalPositionLoaded] = useState(false);
    const [isReturnPositionLoaded, setIsReturnPositionLoaded] = useState(false);
    const [isItemsPositionLoaded, setIsItemsPositionLoaded] = useState(false);

    const salesModalDragRef = useRef<{ startX: number; startY: number; initialX: number; initialY: number } | null>(null);
    const openingModalDragRef = useRef<{ startX: number; startY: number; initialX: number; initialY: number } | null>(null);
    const withdrawalModalDragRef = useRef<{ startX: number; startY: number; initialX: number; initialY: number } | null>(null);
    const returnModalDragRef = useRef<{ startX: number; startY: number; initialX: number; initialY: number } | null>(null);
    const itemsModalDragRef = useRef<{ startX: number; startY: number; initialX: number; initialY: number } | null>(null);

    // UI State for Minimize/Maximize and Positioning
    const [isChartMinimized, setIsChartMinimized] = useState(() => {
        if (typeof window === 'undefined') return false;
        return localStorage.getItem('kyk_dashboard_chart_minimized') === 'true';
    });
    const [isDetailsMinimized, setIsDetailsMinimized] = useState(() => {
        if (typeof window === 'undefined') return false;
        return localStorage.getItem('kyk_dashboard_details_minimized') === 'true';
    });
    const [layoutPosition, setLayoutPosition] = useState<'top' | 'bottom' | 'left' | 'right'>(() => {
        if (typeof window === 'undefined') return 'bottom';
        return (localStorage.getItem('kyk_dashboard_layout_position') as any) || 'bottom';
    });
    const [isLayoutLoaded, setIsLayoutLoaded] = useState(true);
    const [isDashboardMaximized, setIsDashboardMaximized] = useState(false);

    // Load saved modal positions (not safe for lazy init due to SSR)
    useEffect(() => {
        const loadPosition = (key: string, setPos: Function, setLoaded: Function) => {
            const saved = localStorage.getItem(key);
            if (saved) {
                try { setPos(JSON.parse(saved)); } catch (e) { console.error(`Error loading ${key}`, e); }
            }
            setLoaded(true);
        };
        loadPosition('kyk_sales_modal_position', setSalesModalPosition, setIsSalesPositionLoaded);
        loadPosition('kyk_opening_modal_position', setOpeningModalPosition, setIsOpeningPositionLoaded);
        loadPosition('kyk_withdrawal_modal_position', setWithdrawalModalPosition, setIsWithdrawalPositionLoaded);
        loadPosition('kyk_return_modal_position', setReturnModalPosition, setIsReturnPositionLoaded);
        loadPosition('kyk_items_modal_position', setItemsModalPosition, setIsItemsPositionLoaded);
    }, []);

    // Save positions
    useEffect(() => { if (isSalesPositionLoaded) localStorage.setItem('kyk_sales_modal_position', JSON.stringify(salesModalPosition)); }, [salesModalPosition, isSalesPositionLoaded]);
    useEffect(() => { if (isOpeningPositionLoaded) localStorage.setItem('kyk_opening_modal_position', JSON.stringify(openingModalPosition)); }, [openingModalPosition, isOpeningPositionLoaded]);
    useEffect(() => { if (isWithdrawalPositionLoaded) localStorage.setItem('kyk_withdrawal_modal_position', JSON.stringify(withdrawalModalPosition)); }, [withdrawalModalPosition, isWithdrawalPositionLoaded]);

    const handleCloseCancellation = useCallback(() => {
        setIsCancellationModalOpen(false);
    }, []);

    const handleCloseDepto = useCallback(() => {
        setIsDeptoModalOpen(false);
        setSelectedDeptoId(undefined);
        setSelectedDeptoName(undefined);
        setSelectedFamilia(undefined);
    }, []);
    useEffect(() => { if (isReturnPositionLoaded) localStorage.setItem('kyk_return_modal_position', JSON.stringify(returnModalPosition)); }, [returnModalPosition, isReturnPositionLoaded]);
    useEffect(() => { if (isItemsPositionLoaded) localStorage.setItem('kyk_items_modal_position', JSON.stringify(itemsModalPosition)); }, [itemsModalPosition, isItemsPositionLoaded]);

    // Save layout settings
    useEffect(() => { if (isLayoutLoaded) localStorage.setItem('kyk_dashboard_layout_position', layoutPosition); }, [layoutPosition, isLayoutLoaded]);
    useEffect(() => { if (isLayoutLoaded) localStorage.setItem('kyk_dashboard_chart_minimized', String(isChartMinimized)); }, [isChartMinimized, isLayoutLoaded]);
    useEffect(() => { if (isLayoutLoaded) localStorage.setItem('kyk_dashboard_details_minimized', String(isDetailsMinimized)); }, [isDetailsMinimized, isLayoutLoaded]);

    const handleModalDrag = (e: React.MouseEvent, pos: { x: number, y: number }, setPos: Function, dragRef: any, setDragging: Function) => {
        if (isMaximized) return;
        if ((e.target as HTMLElement).closest('button') || (e.target as HTMLElement).closest('input')) return;

        setDragging(true);
        dragRef.current = {
            startX: e.clientX,
            startY: e.clientY,
            initialX: pos.x,
            initialY: pos.y
        };

        const onMouseMove = (moveEvent: MouseEvent) => {
            if (!dragRef.current) return;
            const deltaX = moveEvent.clientX - dragRef.current.startX;
            const deltaY = moveEvent.clientY - dragRef.current.startY;

            // Use requestAnimationFrame for smoother updates and less reactor stress
            requestAnimationFrame(() => {
                setPos({
                    x: dragRef.current!.initialX + deltaX,
                    y: dragRef.current!.initialY + deltaY
                });
            });
        };

        const onMouseUp = () => {
            setDragging(false);
            dragRef.current = null;
            document.removeEventListener('mousemove', onMouseMove);
            document.removeEventListener('mouseup', onMouseUp);
        };

        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);
    };
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
            let url = `/api/dashboard/stats?fechaInicio=${fechaInicio}&fechaFin=${fechaFin}`;
            if (selectedStoreId) {
                url += `&storeId=${selectedStoreId}`;
            }
            const res = await fetch(url);
            const json = await res.json();
            setData(json);
            // Reset on-demand charts so they reload with the new date range
            setVentasDepto([]);
            setVentasFamilia([]);
            // If we were on a desglose tab, refresh immediately
            if (selectedVentasTab === 'departamento') fetchVentasDesglose('departamento');
            else if (selectedVentasTab === 'familia') fetchVentasDesglose('familia');
        } catch (error) {
            console.error('Error fetching dashboard data:', error);
        } finally {
            setLoading(false);
        }
    };

    // Fetch desglose data on-demand when user switches to Deptos or Familias tab
    const fetchVentasDesglose = async (tipo: 'departamento' | 'familia') => {
        setLoadingDesglose(true);
        try {
            let url = `/api/dashboard/ventas-desglose?fechaInicio=${fechaInicio}&fechaFin=${fechaFin}&tipo=${tipo}`;
            if (selectedStoreId) url += `&storeId=${selectedStoreId}`;
            const res = await fetch(url);
            const json = await res.json();
            if (tipo === 'departamento') setVentasDepto(json.data || []);
            else setVentasFamilia(json.data || []);
        } catch (err) {
            console.error('Error fetching ventas desglose:', err);
        } finally {
            setLoadingDesglose(false);
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
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && isDashboardMaximized) {
                setIsDashboardMaximized(false);
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isDashboardMaximized]);

    useEffect(() => {
        fetchData();
    }, [fechaInicio, fechaFin, selectedStoreId]);

    useEffect(() => {
        // Reset submetric when changing main metric
        if (selectedMetric === 'ventas') setSubMetric('Total');
        else if (selectedMetric === 'cancelaciones') setSubMetric('Total');
        else setSubMetric('Total');
    }, [selectedMetric]);

    const handleStoreClick = useCallback(async (store: any) => {
        if (selectedMetric !== 'ventas' && selectedMetric !== 'aperturas' && selectedMetric !== 'cancelaciones' && selectedMetric !== 'retiros' && selectedMetric !== 'devoluciones') return;

        setSelectedStoreData(store);
        setSearchTerm('');

        if (selectedMetric === 'ventas') {
            setLoadingDetails(true);
            setIsModalOpen(true);
            try {
                let url = `/api/dashboard/sales-details?fechaInicio=${fechaInicio}&fechaFin=${fechaFin}`;
                if (store.IdTienda) url += `&idTienda=${store.IdTienda}`;
                const res = await fetch(url);
                const json = await res.json();
                setTicketDetails(json);
            } catch (error) {
                console.error('Error fetching ticket details:', error);
            } finally {
                setLoadingDetails(false);
            }
        } else if (selectedMetric === 'aperturas') {
            setLoadingOpenings(true);
            setIsOpeningModalOpen(true);
            try {
                let url = `/api/dashboard/opening-details?fechaInicio=${fechaInicio}&fechaFin=${fechaFin}`;
                if (store.IdTienda) url += `&idTienda=${store.IdTienda}`;
                const res = await fetch(url);
                const json = await res.json();
                setOpeningDetails(json);
            } catch (error) {
                console.error('Error fetching opening details:', error);
            } finally {
                setLoadingOpenings(false);
            }
        } else if (selectedMetric === 'cancelaciones') {
            setIsCancellationModalOpen(true);
        } else if (selectedMetric === 'retiros') {
            setLoadingWithdrawals(true);
            setIsWithdrawalModalOpen(true);
            try {
                let url = `/api/dashboard/withdrawal-details?fechaInicio=${fechaInicio}&fechaFin=${fechaFin}`;
                if (store.IdTienda) url += `&idTienda=${store.IdTienda}`;
                const res = await fetch(url);
                const json = await res.json();
                setWithdrawalDetails(json);
            } catch (error) {
                console.error('Error fetching withdrawal details:', error);
            } finally {
                setLoadingWithdrawals(false);
            }
        } else if (selectedMetric === 'devoluciones') {
            setLoadingReturns(true);
            setIsReturnModalOpen(true);
            try {
                let url = `/api/dashboard/returns-details?fechaInicio=${fechaInicio}&fechaFin=${fechaFin}`;
                if (store.IdTienda) url += `&idTienda=${store.IdTienda}`;
                const res = await fetch(url);
                const json = await res.json();
                setReturnDetails(json);
            } catch (error) {
                console.error('Error fetching return details:', error);
            } finally {
                setLoadingReturns(false);
            }
        }
    }, [selectedMetric, fechaInicio, fechaFin]);

    const handleReturnRowClick = async (item: any) => {
        setSelectedReturn(item);
        setLoadingReturnItems(true);
        setIsReturnItemsModalOpen(true);
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
        o.Z.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (o.Tienda && o.Tienda.toLowerCase().includes(searchTerm.toLowerCase()))
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
        w.Z.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (w.Tienda && w.Tienda.toLowerCase().includes(searchTerm.toLowerCase()))
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
        r.Clave?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        r.Tienda?.toLowerCase().includes(searchTerm.toLowerCase())
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
        setLoadingItems(true);
        setIsItemsModalOpen(true);
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
        setLoadingDetails(true);
        setIsModalOpen(true);       // Open tickets modal
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
            ...(!selectedStoreId ? { 'Tienda': o.Tienda } : {}),
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
            ...(!selectedStoreId ? [{ wch: 20 }] : []), // Tienda
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

    const exportWithdrawalsToExcel = () => {
        if (sortedWithdrawals.length === 0) return;

        const excelData = sortedWithdrawals.map(w => ({
            ...(!selectedStoreId ? { 'Tienda': w.Tienda } : {}),
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
            ...(!selectedStoreId ? [{ wch: 20 }] : []), // Tienda
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
            ...(!selectedStoreId ? { 'Tienda': r.Tienda } : {}),
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
            ...(!selectedStoreId ? [{ wch: 20 }] : []), // Tienda
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

    const handleChartBarClick = (data: any) => {
        // Block detail if too many operations (would be too slow to load)
        const ops = data?.Operaciones ?? data?.Cantidad ?? data?.Total ?? 0;
        if (selectedMetric === 'ventas' && ops > 2000) return;
        if (selectedMetric !== 'ventas' && (data?.Cantidad ?? 0) > 2000) return;

        if (selectedVentasTab === 'sucursal') {
            handleStoreClick(data);
        } else if (selectedVentasTab === 'departamento') {
            setSelectedDeptoId(data.IdDepto);
            setSelectedDeptoName(data.Departamento);
            setIsDeptoModalOpen(true);
        } else if (selectedVentasTab === 'familia') {
            setSelectedDeptoId(undefined);
            setSelectedDeptoName(undefined);
            setSelectedFamilia(data.Familia);
            setIsDeptoModalOpen(true);
        } else {
            handleStoreClick(data);
        }
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
        retiros: { MontoRetiros: 0, CantidadRetiros: 0, PromedioRetiro: 0 },
        devoluciones: { MontoDevoluciones: 0, CantidadDevoluciones: 0 }
    };

    const chartData = selectedMetric === 'ventas'
        ? (selectedVentasTab === 'departamento' ? ventasDepto : (selectedVentasTab === 'familia' ? ventasFamilia : data?.data?.ventas)) || []
        : data?.data?.[selectedMetric] || [];

    const listData = data?.data?.[selectedMetric] || [];

    const getMetricConfig = () => {
        const storeTitle = selectedStoreName ? ` de ${selectedStoreName}` : (selectedVentasTab === 'sucursal' ? ' por Sucursal' : (selectedVentasTab === 'departamento' ? ' por Departamento' : ' por Familia'));
        const mainTitle = selectedStoreName ? `Ventas${storeTitle}` : (selectedMetric === 'ventas' ? (selectedVentasTab === 'sucursal' ? 'Ventas por Sucursal' : (selectedVentasTab === 'departamento' ? 'Ventas por Departamento' : 'Ventas por Familia')) : '');

        switch (selectedMetric) {
            case 'ventas': return {
                title: mainTitle,
                sub: selectedStoreName ? `Detalle de ${selectedStoreName}` : (selectedVentasTab === 'familia' ? 'Distribución del ingreso por familias de artículos' : 'Distribución del ingreso por tienda'),
                color: '#4050B4'
            };
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
        <div className={cn(
            "space-y-4",
            isDashboardMaximized && "fixed inset-0 z-[100] bg-slate-50 overflow-y-auto p-4 sm:p-8 md:p-10"
        )}>
            {/* Trends Ticker Marquee */}
            <div className="print:hidden">
                <TrendsTicker />
            </div>

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

                    {/* Quick Date Period Buttons */}
                    <div className="flex items-center gap-1 bg-slate-100 border border-slate-200 rounded-none p-0.5 print:hidden">
                        {(() => {
                            const mtyDate = (offset = 0) => {
                                const d = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Monterrey' }));
                                d.setDate(d.getDate() + offset);
                                return d.toLocaleDateString('en-CA');
                            };
                            const mtyMonth = (monthOffset = 0) => {
                                const d = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Monterrey' }));
                                d.setMonth(d.getMonth() + monthOffset);
                                return d;
                            };
                            const today = mtyDate();
                            const periods = [
                                { label: 'Hoy', start: today, end: today },
                                { label: 'Ayer', start: mtyDate(-1), end: mtyDate(-1) },
                                {
                                    label: 'Semana',
                                    start: (() => { const d = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Monterrey' })); d.setDate(d.getDate() - d.getDay()); return d.toLocaleDateString('en-CA'); })(),
                                    end: today
                                },
                                { label: '7 días', start: mtyDate(-6), end: today },
                                {
                                    label: 'Este mes',
                                    start: (() => { const d = mtyMonth(0); d.setDate(1); return d.toLocaleDateString('en-CA'); })(),
                                    end: today
                                },
                                {
                                    label: 'Mes ant.',
                                    start: (() => { const d = mtyMonth(-1); d.setDate(1); return d.toLocaleDateString('en-CA'); })(),
                                    end: (() => { const d = mtyMonth(0); d.setDate(0); return d.toLocaleDateString('en-CA'); })()
                                },
                            ];
                            return periods.map(({ label, start, end }) => {
                                const isActive = fechaInicio === start && fechaFin === end;
                                return (
                                    <button
                                        key={label}
                                        onClick={() => { setFechaInicio(start); setFechaFin(end); }}
                                        className={cn(
                                            'px-2 py-1 text-[9px] font-black uppercase tracking-widest transition-all whitespace-nowrap',
                                            isActive ? 'bg-[#4050B4] text-white shadow-sm' : 'text-slate-500 hover:text-slate-800 hover:bg-white'
                                        )}
                                    >
                                        {label}
                                    </button>
                                );
                            });
                        })()}
                    </div>

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

                    <button
                        onClick={() => setIsDashboardMaximized(!isDashboardMaximized)}
                        className={cn(
                            "p-2.5 border transition-all rounded-none shadow-sm print:hidden group",
                            isDashboardMaximized
                                ? "bg-amber-50 border-amber-200 text-amber-600 hover:bg-amber-100"
                                : "bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100"
                        )}
                        title={isDashboardMaximized ? "Salir de Pantalla Completa" : "Pantalla Completa"}
                    >
                        {isDashboardMaximized ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
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
                            <h2 className="text-2xl font-black text-emerald-600 mb-2">{formatCurrency(metrics.retiros.MontoRetiros)}</h2>
                        </div>
                        <div className="flex flex-col gap-2 border-t border-slate-50 pt-4 mt-2">
                            <div className="flex justify-between items-center text-xs font-bold">
                                <span className="text-slate-500">Operaciones</span>
                                <span className="text-emerald-600 px-2 py-0.5 bg-emerald-50 rounded-none">{metrics.retiros.CantidadRetiros}</span>
                            </div>
                            <div className="flex justify-between items-center text-xs font-bold">
                                <span className="text-slate-500">Retiro Promedio</span>
                                <span className="text-emerald-600">{formatCurrency(metrics.retiros.PromedioRetiro)}</span>
                            </div>
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

            {/* Layout Controls */}
            <div className="flex items-center justify-end gap-2 mb-4 bg-slate-100/50 p-1 self-end">
                <button
                    onClick={() => setLayoutPosition('top')}
                    className={cn(
                        "flex items-center gap-2 px-3 py-1.5 text-[10px] font-black uppercase tracking-widest transition-all",
                        layoutPosition === 'top' ? "bg-white text-slate-900 shadow-sm" : "text-slate-400 hover:text-slate-600"
                    )}
                >
                    <Rows size={14} className="rotate-180" /> Arriba
                </button>
                <button
                    onClick={() => setLayoutPosition('bottom')}
                    className={cn(
                        "flex items-center gap-2 px-3 py-1.5 text-[10px] font-black uppercase tracking-widest transition-all",
                        layoutPosition === 'bottom' ? "bg-white text-slate-900 shadow-sm" : "text-slate-400 hover:text-slate-600"
                    )}
                >
                    <Rows size={14} /> Abajo
                </button>
                <button
                    onClick={() => setLayoutPosition('left')}
                    className={cn(
                        "flex items-center gap-2 px-3 py-1.5 text-[10px] font-black uppercase tracking-widest transition-all",
                        layoutPosition === 'left' ? "bg-white text-slate-900 shadow-sm" : "text-slate-400 hover:text-slate-600"
                    )}
                >
                    <Columns size={14} className="rotate-180" /> Izquierda
                </button>
                <button
                    onClick={() => setLayoutPosition('right')}
                    className={cn(
                        "flex items-center gap-2 px-3 py-1.5 text-[10px] font-black uppercase tracking-widest transition-all",
                        layoutPosition === 'right' ? "bg-white text-slate-900 shadow-sm" : "text-slate-400 hover:text-slate-600"
                    )}
                >
                    <Columns size={14} /> Derecha
                </button>
            </div>

            {/* Bottom Section: Chart + Details */}
            <div className={cn(
                "flex gap-4",
                (layoutPosition === 'left' || layoutPosition === 'right') ? "flex-col lg:grid lg:grid-cols-3" :
                    layoutPosition === 'top' ? "flex-col-reverse" : "flex-col",
                layoutPosition === 'left' && "lg:flex-row-reverse"
            )}>
                {/* Chart Card */}
                <div className={cn(
                    "bg-white p-5 rounded-none border border-slate-100 shadow-sm relative transition-all duration-300",
                    (layoutPosition === 'left' || layoutPosition === 'right') && "lg:col-span-2",
                    layoutPosition === 'left' && "lg:order-2"
                )}>
                    <div className="flex items-center justify-between mb-4">
                        <div>
                            <div className="flex items-center gap-4 mb-1">
                                <h3 className="text-lg font-black text-slate-800 uppercase tracking-tight">{config.title}</h3>
                                {selectedMetric === 'ventas' && (
                                    <div className="flex bg-slate-100 p-0.5 rounded-none border border-slate-200">
                                        <button
                                            onClick={() => {
                                                setSelectedVentasTab('sucursal');
                                                setSelectedStoreId(null);
                                                setSelectedStoreName(null);
                                            }}
                                            className={cn(
                                                "px-2 py-1 text-[9px] font-black uppercase tracking-widest transition-all",
                                                selectedVentasTab === 'sucursal' ? "bg-white text-slate-900 shadow-sm" : "text-slate-400 hover:text-slate-600"
                                            )}
                                        >
                                            Sucursales
                                        </button>
                                        <button
                                            onClick={() => {
                                                setSelectedVentasTab('departamento');
                                                fetchVentasDesglose('departamento');
                                            }}
                                            className={cn(
                                                "px-2 py-1 text-[9px] font-black uppercase tracking-widest transition-all",
                                                selectedVentasTab === 'departamento' ? "bg-white text-slate-900 shadow-sm" : "text-slate-400 hover:text-slate-600"
                                            )}
                                        >
                                            Deptos
                                        </button>
                                        <button
                                            onClick={() => {
                                                setSelectedVentasTab('familia');
                                                fetchVentasDesglose('familia');
                                            }}
                                            className={cn(
                                                "px-2 py-1 text-[9px] font-black uppercase tracking-widest transition-all",
                                                selectedVentasTab === 'familia' ? "bg-white text-slate-900 shadow-sm" : "text-slate-400 hover:text-slate-600"
                                            )}
                                        >
                                            Familias
                                        </button>
                                    </div>
                                )}
                            </div>
                            <p className="text-[13px] text-slate-500 font-medium">{config.sub}</p>
                        </div>
                        <div className="flex items-center gap-4">
                            {/* Sub-metric Selector */}
                            {!isChartMinimized && (selectedMetric === 'ventas' || selectedMetric === 'cancelaciones' || selectedMetric === 'devoluciones' || selectedMetric === 'retiros') && (
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
                                                {selectedMetric === 'retiros' ? 'Ops' : 'Cant'}
                                            </button>
                                            {(selectedMetric === 'cancelaciones' || selectedMetric === 'devoluciones' || selectedMetric === 'retiros') && (
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

                            {!isChartMinimized && (
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
                            )}

                            <button
                                onClick={() => setIsChartMinimized(!isChartMinimized)}
                                className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-500 transition-colors rounded-none"
                            >
                                {isChartMinimized ? <ChevronDown size={20} /> : <ChevronUp size={20} />}
                            </button>
                        </div>
                    </div>

                    {!isChartMinimized && (
                        <div className="h-[400px] w-full animate-in fade-in slide-in-from-top-2 duration-300">
                            {(loading || loadingDesglose) ? (
                                <div className="h-full flex flex-col items-center justify-center gap-2">
                                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#4050B4]"></div>
                                    {loadingDesglose && <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">Cargando desglose...</p>}
                                </div>
                            ) : (
                                <ResponsiveContainer width="100%" height="100%">
                                    {chartType === 'bar' ? (
                                        <BarChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 60 }}>
                                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                                            <XAxis
                                                dataKey={selectedMetric === 'ventas' ? (selectedVentasTab === 'departamento' ? "Departamento" : (selectedVentasTab === 'familia' ? "Familia" : "Tienda")) : "Tienda"}
                                                axisLine={false}
                                                tickLine={false}
                                                interval={0}
                                                height={100}
                                                tick={(props: any) => {
                                                    const { x, y, payload } = props;
                                                    const key = selectedMetric === 'ventas' ? (selectedVentasTab === 'departamento' ? 'Departamento' : (selectedVentasTab === 'familia' ? 'Familia' : 'Tienda')) : 'Tienda';
                                                    const item = chartData.find((d: any) => d[key] === payload.value);
                                                    const total = item ? ((subMetric === 'Operaciones' || subMetric === 'Cantidad' || selectedMetric === 'aperturas')
                                                        ? item[subMetric]
                                                        : formatCurrency(item[subMetric])) : '';
                                                    return (
                                                        <g transform={`translate(${x},${y})`}>
                                                            <text
                                                                x={0}
                                                                y={0}
                                                                dy={10}
                                                                textAnchor="end"
                                                                fill="#94A3B8"
                                                                transform="rotate(-45)"
                                                                style={{ fontSize: '10px', fontWeight: 700 }}
                                                            >
                                                                <tspan x={0} dy="0">{payload.value}</tspan>
                                                                <tspan x={0} dy="12" style={{ fontWeight: 900, fill: '#1e293b' }}>{total}</tspan>
                                                            </text>
                                                        </g>
                                                    );
                                                }}
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
                                                                <p className="text-[10px] font-bold text-white/50 uppercase mb-1">
                                                                    {selectedMetric === 'ventas' ? (selectedVentasTab === 'departamento' ? payload[0].payload.Departamento : (selectedVentasTab === 'familia' ? payload[0].payload.Familia : payload[0].payload.Tienda)) : payload[0].payload.Tienda}
                                                                </p>
                                                                <div className="flex flex-col gap-1">
                                                                    <div className="flex justify-between gap-4 items-baseline">
                                                                        <span className="text-[10px] font-bold text-white/40 uppercase">Total</span>
                                                                        <span className="text-sm font-black text-white">{formatted}</span>
                                                                    </div>
                                                                    {(selectedMetric === 'ventas' || selectedMetric === 'cancelaciones' || selectedMetric === 'devoluciones' || selectedMetric === 'retiros') && (
                                                                        <>
                                                                            <div className="flex justify-between gap-4 items-baseline">
                                                                                <span className="text-[10px] font-bold text-white/40 uppercase">
                                                                                    {selectedMetric === 'ventas' || selectedMetric === 'retiros' ? 'Operaciones' : 'Cantidad'}
                                                                                </span>
                                                                                <span className="text-[11px] font-bold text-white">{selectedMetric === 'ventas' ? payload[0].payload.Operaciones : payload[0].payload.Cantidad}</span>
                                                                            </div>
                                                                            <div className="flex justify-between gap-4 items-baseline">
                                                                                <span className="text-[10px] font-bold text-white/40 uppercase">Promedio</span>
                                                                                <span className="text-[11px] font-bold text-emerald-400">{formatCurrency(selectedMetric === 'ventas' ? payload[0].payload.TicketPromedio : payload[0].payload.Promedio)}</span>
                                                                            </div>
                                                                        </>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        );
                                                    }
                                                    return null;
                                                }}
                                            />
                                            <Bar
                                                dataKey={subMetric}
                                                radius={[0, 0, 0, 0]}
                                                barSize={40}
                                                onClick={(data) => handleChartBarClick(data.payload)}
                                                className="cursor-pointer shadow-lg outline-none"
                                            >
                                                {chartData.map((entry: any, index: number) => (
                                                    <Cell key={`cell-${index}`} fill={getStoreColor(selectedMetric === 'ventas' ? (selectedVentasTab === 'departamento' ? entry.Departamento : (selectedVentasTab === 'familia' ? entry.Familia : entry.Tienda)) : entry.Tienda)} fillOpacity={0.9} />
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
                                                nameKey={selectedMetric === 'ventas' ? (selectedVentasTab === 'departamento' ? "Departamento" : (selectedVentasTab === 'familia' ? "Familia" : "Tienda")) : "Tienda"}
                                                stroke="none"
                                                onClick={(data) => handleChartBarClick(data.payload)}
                                                className="cursor-pointer outline-none"
                                            >
                                                {chartData.map((entry: any, index: number) => (
                                                    <Cell key={`cell-${index}`} fill={getStoreColor(selectedMetric === 'ventas' ? (selectedVentasTab === 'departamento' ? entry.Departamento : (selectedVentasTab === 'familia' ? entry.Familia : entry.Tienda)) : entry.Tienda)} />
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
                                                                <div className="flex flex-col gap-1">
                                                                    <div className="flex justify-between gap-4 items-baseline">
                                                                        <span className="text-[10px] font-bold text-white/40 uppercase">Total</span>
                                                                        <span className="text-sm font-black text-white">{formatted}</span>
                                                                    </div>
                                                                    {(selectedMetric === 'ventas' || selectedMetric === 'cancelaciones' || selectedMetric === 'devoluciones' || selectedMetric === 'retiros') && (
                                                                        <>
                                                                            <div className="flex justify-between gap-4 items-baseline">
                                                                                <span className="text-[10px] font-bold text-white/40 uppercase">
                                                                                    {selectedMetric === 'ventas' || selectedMetric === 'retiros' ? 'Operaciones' : 'Cantidad'}
                                                                                </span>
                                                                                <span className="text-[11px] font-bold text-white">{selectedMetric === 'ventas' ? payload[0].payload.Operaciones : payload[0].payload.Cantidad}</span>
                                                                            </div>
                                                                            <div className="flex justify-between gap-4 items-baseline">
                                                                                <span className="text-[10px] font-bold text-white/40 uppercase">Promedio</span>
                                                                                <span className="text-[11px] font-bold text-emerald-400">{formatCurrency(selectedMetric === 'ventas' ? payload[0].payload.TicketPromedio : payload[0].payload.Promedio)}</span>
                                                                            </div>
                                                                        </>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        );
                                                    }
                                                    return null;
                                                }}
                                            />
                                            <Legend
                                                verticalAlign="bottom"
                                                height={50}
                                                formatter={(value, entry: any) => {
                                                    const item = entry.payload;
                                                    const total = (subMetric === 'Operaciones' || subMetric === 'Cantidad' || selectedMetric === 'aperturas')
                                                        ? item[subMetric]
                                                        : formatCurrency(item[subMetric]);
                                                    return (
                                                        <span className="inline-flex flex-col items-start leading-tight translate-y-2">
                                                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">{value}</span>
                                                            <span className="text-[11px] font-black text-slate-900">{total}</span>
                                                        </span>
                                                    );
                                                }}
                                            />
                                        </PieChart>
                                    )}
                                </ResponsiveContainer>
                            )}
                        </div>
                    )}
                </div>

                {/* Details Card */}
                <div className={cn(
                    "bg-white p-5 rounded-none border border-slate-100 shadow-sm flex flex-col transition-all duration-300",
                    (layoutPosition === 'left' || layoutPosition === 'right') ? "lg:col-span-1 h-[530px]" : "h-full",
                    layoutPosition === 'left' && "lg:order-1"
                )}>
                    <div className="flex items-center justify-between mb-4">
                        <div>
                            <h3 className="text-lg font-black text-slate-800 uppercase tracking-tight">
                                Detalle {selectedMetric === 'ventas' ? 'Ventas' :
                                    selectedMetric === 'aperturas' ? 'Aperturas' :
                                        selectedMetric === 'cancelaciones' ? 'Cancelaciones' :
                                            selectedMetric === 'devoluciones' ? 'Devoluciones' : 'Retiros'}
                            </h3>
                            <p className="text-[13px] text-slate-500 font-medium">Desglose de rendimiento</p>
                        </div>
                        <button
                            onClick={() => setIsDetailsMinimized(!isDetailsMinimized)}
                            className="p-2 bg-slate-50 hover:bg-slate-100 text-slate-500 transition-colors rounded-none border border-slate-100"
                        >
                            {isDetailsMinimized ? <ChevronDown size={20} /> : <ChevronUp size={20} />}
                        </button>
                    </div>

                    {!isDetailsMinimized && (
                        <div className="flex-1 grid grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-4 pb-4 no-scrollbar justify-start animate-in fade-in slide-in-from-top-2 duration-300 overflow-y-auto">
                            {/* Global Summary Card - MOVED TO TOP */}
                            {!loading && chartData.length > 0 && (
                                <div
                                    onClick={() => {
                                        setSelectedStoreId(null);
                                        setSelectedStoreName(null);
                                        if (selectedMetric === 'ventas') {
                                            setSelectedVentasTab('sucursal');
                                        }
                                    }}
                                    className={cn(
                                        "flex flex-col p-3 rounded-none border group transition-all outline-none w-full cursor-pointer shadow-lg",
                                        !selectedStoreId
                                            ? "bg-slate-800 border-indigo-500 ring-1 ring-indigo-500/50"
                                            : "bg-slate-900 border-slate-800 hover:bg-slate-800 hover:shadow-xl hover:shadow-slate-900/20"
                                    )}
                                >
                                    <div className="flex items-center justify-between mb-2">
                                        <div className="flex items-center gap-2">
                                            <div className="w-8 h-8 rounded-none flex items-center justify-center bg-white/10 border border-white/20 font-black text-[10px] text-white">
                                                Σ
                                            </div>
                                            <div className="flex flex-col">
                                                <span className="text-[12px] font-black text-white leading-none">TODAS LAS TIENDAS</span>
                                                <span className="text-[9px] font-bold text-slate-400 uppercase">Resumen Global</span>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            {(selectedMetric === 'aperturas' || selectedMetric === 'retiros') && (
                                                <div className="text-right mr-2">
                                                    <div className="text-sm font-black text-white">
                                                        {selectedMetric === 'aperturas' ? metrics.aperturas : (
                                                            <div className="flex flex-col items-end">
                                                                <span>{formatCurrency(metrics.retiros.MontoRetiros)}</span>
                                                                <span className="text-[9px] font-bold text-slate-400 uppercase leading-none">
                                                                    {metrics.retiros.CantidadRetiros} Ops • {formatCurrency(metrics.retiros.PromedioRetiro)} Prom.
                                                                </span>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            )}
                                            {selectedMetric === 'ventas' && (
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        setIsParetoModalOpen(true);
                                                    }}
                                                    className="group/pbtn text-[10px] font-black uppercase tracking-widest text-white bg-emerald-600 hover:bg-emerald-500 px-3 py-1.5 transition-all rounded-none border-b-2 border-emerald-800 hover:border-emerald-700 shadow-lg shadow-emerald-900/40 active:translate-y-0.5 active:border-b-0 flex items-center gap-1.5"
                                                >
                                                    <Percent size={12} className="group-hover/pbtn:scale-125 transition-transform" />
                                                    80-20
                                                </button>
                                            )}
                                            {selectedMetric && (
                                                metrics.ventas.Operaciones <= 2000 ? (
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            handleStoreClick({ Tienda: 'TODAS LAS TIENDAS' });
                                                        }}
                                                        className="text-[9px] font-black uppercase tracking-tighter text-indigo-400 hover:text-indigo-300 bg-white/10 hover:bg-white/20 px-2 py-1 transition-colors rounded-none border border-white/10"
                                                    >
                                                        Ver Detalle
                                                    </button>
                                                ) : (
                                                    <span className="text-[9px] font-bold text-slate-500 uppercase tracking-tighter" title="Más de 2000 operaciones">
                                                        +2000 ops
                                                    </span>
                                                )
                                            )}
                                        </div>
                                    </div>

                                    {(selectedMetric === 'ventas' || selectedMetric === 'cancelaciones' || selectedMetric === 'devoluciones') && (
                                        <div className="grid grid-cols-3 gap-2 pt-2 border-t border-white/10">
                                            <div className="flex flex-col">
                                                <span className="text-[8px] font-black text-slate-400 uppercase leading-none mb-1">
                                                    {selectedMetric === 'ventas' ? 'Ventas' : selectedMetric === 'cancelaciones' ? 'Cancels' : 'Devols'}
                                                </span>
                                                <span className="text-[11px] font-black text-white">
                                                    {formatCurrency(
                                                        selectedMetric === 'ventas' ? metrics.ventas.TotalVentas :
                                                            selectedMetric === 'cancelaciones' ? metrics.cancelaciones.MontoCancelaciones :
                                                                metrics.devoluciones.MontoDevoluciones
                                                    )}
                                                </span>
                                            </div>
                                            <div className="flex flex-col border-x border-white/10 px-2">
                                                <span className="text-[8px] font-black text-slate-400 uppercase leading-none mb-1">
                                                    {selectedMetric === 'ventas' ? 'Ops' : 'Cant'}
                                                </span>
                                                <span className="text-[11px] font-black text-slate-300">
                                                    {selectedMetric === 'ventas' ? metrics.ventas.Operaciones :
                                                        selectedMetric === 'cancelaciones' ? metrics.cancelaciones.CantidadCancelaciones :
                                                            metrics.devoluciones.CantidadDevoluciones}
                                                </span>
                                            </div>
                                            <div className="flex flex-col text-right">
                                                <span className="text-[8px] font-black text-slate-400 uppercase leading-none mb-1">Promedio</span>
                                                <span className="text-[11px] font-black text-emerald-400">
                                                    {formatCurrency(
                                                        selectedMetric === 'ventas' ? metrics.ventas.TicketPromedio :
                                                            selectedMetric === 'cancelaciones' ? metrics.cancelaciones.PromedioCancelacion :
                                                                (metrics.devoluciones.CantidadDevoluciones > 0 ? metrics.devoluciones.MontoDevoluciones / metrics.devoluciones.CantidadDevoluciones : 0)
                                                    )}
                                                </span>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}

                            {loading ? (
                                Array(5).fill(0).map((_, i) => (
                                    <div key={i} className="h-24 bg-slate-50 rounded-none animate-pulse" />
                                ))
                            ) : (
                                listData.map((item: any, index: number) => {
                                    const name = item.Tienda;
                                    const storeColor = getStoreColor(name);
                                    return (
                                        <div
                                            key={name}
                                            onClick={() => {
                                                if (selectedMetric === 'ventas') {
                                                    setSelectedStoreId(item.IdTienda.toString());
                                                    setSelectedStoreName(item.Tienda);
                                                    if (selectedVentasTab === 'sucursal') {
                                                        setSelectedVentasTab('departamento');
                                                    }
                                                }
                                            }}
                                            className={cn(
                                                "flex flex-col p-3 bg-slate-50 rounded-none border group transition-all outline-none w-full cursor-pointer",
                                                selectedStoreId === item.IdTienda.toString()
                                                    ? "bg-white border-[#4050B4] shadow-lg ring-1 ring-[#4050B4]/20"
                                                    : "border-slate-100 hover:bg-white hover:border-slate-200 hover:shadow-lg hover:shadow-slate-200/20"
                                            )}
                                        >
                                            <div className="flex items-center justify-between mb-2">
                                                <div className="flex items-center gap-2">
                                                    <div
                                                        className="w-8 h-8 rounded-none flex items-center justify-center border shadow-sm font-black text-[10px]"
                                                        style={{ backgroundColor: `${storeColor}10`, borderColor: `${storeColor}20`, color: storeColor }}
                                                    >
                                                        {name.substring(0, 2).toUpperCase()}
                                                    </div>
                                                    <div className="flex flex-col">
                                                        <span className="text-[12px] font-black text-slate-700 leading-none">{name}</span>
                                                        <span className="text-[9px] font-bold text-slate-400 uppercase">Sucursal</span>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    {(selectedMetric !== 'ventas' && selectedMetric !== 'cancelaciones') && (
                                                        <div className="text-right">
                                                            <div className="text-[11px] font-black text-slate-900">
                                                                {selectedMetric === 'aperturas' ? item.Total : formatCurrency(item.Total)}
                                                            </div>
                                                        </div>
                                                    )}
                                                    {selectedMetric && (
                                                        <div className="flex items-center gap-1">
                                                            {selectedMetric === 'ventas' && (
                                                                <button
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        setSelectedStoreId(item.IdTienda.toString());
                                                                        setSelectedStoreName(item.Tienda);
                                                                        setIsParetoModalOpen(true);
                                                                    }}
                                                                    className="group/pbtn text-[9px] font-black uppercase tracking-widest text-emerald-700 bg-emerald-50 hover:bg-emerald-100 px-2 py-1 transition-all rounded-none border border-emerald-200 shadow-sm flex items-center gap-1 active:scale-95"
                                                                >
                                                                    <Percent size={10} className="group-hover/pbtn:scale-110 transition-transform" />
                                                                    80-20
                                                                </button>
                                                            )}
                                                            {(() => {
                                                                const ops = selectedMetric === 'ventas' ? item.Operaciones : item.Cantidad;
                                                                return ops > 2000 ? (
                                                                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter" title="Demasiados registros para mostrar el detalle">
                                                                        +2000 ops
                                                                    </span>
                                                                ) : (
                                                                    <button
                                                                        onClick={(e) => {
                                                                            e.stopPropagation();
                                                                            handleStoreClick(item);
                                                                        }}
                                                                        className="text-[9px] font-black uppercase tracking-tighter text-indigo-600 hover:text-indigo-800 bg-indigo-50 hover:bg-indigo-100 px-2 py-1 transition-colors rounded-none border border-indigo-100/50"
                                                                    >
                                                                        Ver Detalle
                                                                    </button>
                                                                );
                                                            })()}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>

                                            {(selectedMetric === 'ventas' || selectedMetric === 'cancelaciones' || selectedMetric === 'devoluciones' || selectedMetric === 'retiros') && (
                                                <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-200/50">
                                                    <div className="flex flex-col">
                                                        <span className="text-[8px] font-black text-slate-400 uppercase leading-none mb-1">
                                                            {selectedMetric === 'ventas' ? 'Ventas' : selectedMetric === 'cancelaciones' ? 'Cancelaciones' : selectedMetric === 'retiros' ? 'Retiros' : 'Devoluciones'}
                                                        </span>
                                                        <span className="text-[11px] font-black text-slate-900">
                                                            {formatCurrency(item.Total)}
                                                        </span>
                                                    </div>
                                                    <div className="flex flex-col border-x border-slate-200/50 px-2">
                                                        <span className="text-[8px] font-black text-slate-400 uppercase leading-none mb-1">
                                                            {selectedMetric === 'ventas' || selectedMetric === 'retiros' ? 'Ops' : 'Cant'}
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
                    )}
                </div>
            </div>

            {/* Daily Trends Discoveries */}
            <div className="px-4 pb-8">
                <TrendsDiscovery idTienda={selectedStoreData?.IdTienda} />
            </div>

            {/* Sales Drill-down Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
                    <div
                        className={cn(
                            "bg-white shadow-2xl overflow-hidden flex flex-col transition-[width,height,transform] duration-300 border border-slate-200",
                            isMaximized ? "fixed inset-0 m-0" : "w-full max-w-6xl max-h-[90vh]"
                        )}
                        style={!isMaximized ? {
                            transform: `translate(${salesModalPosition.x}px, ${salesModalPosition.y}px)`,
                        } : undefined}
                    >
                        {/* Modal Header */}
                        <div
                            onMouseDown={(e) => handleModalDrag(e, salesModalPosition, setSalesModalPosition, salesModalDragRef, setIsSalesModalDragging)}
                            onDoubleClick={() => setSalesModalPosition({ x: 0, y: 0 })}
                            className={cn(
                                "flex items-center justify-between bg-white border-b border-slate-100 p-4 shrink-0",
                                !isMaximized && "cursor-grab active:cursor-grabbing select-none"
                            )}
                        >
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-slate-50 rounded-none border border-slate-100">
                                    <ShoppingCart size={18} className="text-[#4050B4]" />
                                </div>
                                <div>
                                    <h3 className="font-black text-sm uppercase tracking-widest leading-none mb-1 text-slate-800">Detalle de Tickets</h3>
                                    <p className="text-[10px] font-bold text-slate-400 uppercase">{selectedStoreData ? selectedStoreData.Tienda : 'TODAS LAS TIENDAS'} • {fechaInicio} a {fechaFin}</p>
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
                                <LoadingScreen message="Obteniendo tickets..." />
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
                                            ) : !loadingDetails ? (
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
                                            ) : null}
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
                    <div
                        className="bg-white shadow-3xl w-full max-w-4xl max-h-[85vh] flex flex-col border border-slate-200"
                        style={{
                            transform: `translate(${itemsModalPosition.x}px, ${itemsModalPosition.y}px)`,
                        }}
                    >
                        {/* Modal Header */}
                        <div
                            onMouseDown={(e) => handleModalDrag(e, itemsModalPosition, setItemsModalPosition, itemsModalDragRef, setIsItemsModalDragging)}
                            onDoubleClick={() => setItemsModalPosition({ x: 0, y: 0 })}
                            className="flex items-center justify-between bg-slate-50 border-b border-slate-200 p-4 cursor-grab active:cursor-grabbing select-none"
                        >
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
                                <LoadingScreen message="Cargando partidas del ticket..." />
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
                    <div
                        className={cn(
                            "bg-white shadow-2xl overflow-hidden flex flex-col transition-[width,height,transform] duration-300 border border-slate-200",
                            isMaximized ? "fixed inset-0 m-0" : "w-full max-w-6xl max-h-[90vh]"
                        )}
                        style={!isMaximized ? {
                            transform: `translate(${openingModalPosition.x}px, ${openingModalPosition.y}px)`,
                        } : undefined}
                    >
                        {/* Modal Header */}
                        <div
                            onMouseDown={(e) => handleModalDrag(e, openingModalPosition, setOpeningModalPosition, openingModalDragRef, setIsOpeningModalDragging)}
                            onDoubleClick={() => setOpeningModalPosition({ x: 0, y: 0 })}
                            className={cn(
                                "flex items-center justify-between bg-white border-b border-slate-100 p-4 shrink-0",
                                !isMaximized && "cursor-grab active:cursor-grabbing select-none"
                            )}
                        >
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-slate-50 rounded-none border border-slate-100">
                                    <Calendar size={18} className="text-[#4050B4]" />
                                </div>
                                <div>
                                    <h3 className="font-black text-sm uppercase tracking-widest leading-none mb-1 text-slate-800">Detalle de Aperturas</h3>
                                    <p className="text-[10px] font-bold text-slate-400 uppercase">{selectedStoreData ? selectedStoreData.Tienda : 'TODAS LAS TIENDAS'} • {fechaInicio} a {fechaFin}</p>
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
                                <LoadingScreen message="Obteniendo aperturas..." />
                            ) : (
                                <div className="min-w-full inline-block align-middle">
                                    <table className="min-w-full border-collapse">
                                        <thead className="sticky top-0 z-10">
                                            <tr className="bg-slate-50 border-b border-slate-200">
                                                {!selectedStoreId && (
                                                    <th onClick={() => handleOpeningSort('Tienda')} className="px-4 py-3 text-left text-[10px] font-black text-slate-500 uppercase tracking-wider cursor-pointer hover:bg-slate-100 transition-colors">
                                                        <div className="flex items-center">Tienda {RenderOpeningSortIcon('Tienda')}</div>
                                                    </th>
                                                )}
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
                                                        {!selectedStoreId && (
                                                            <td className="px-4 py-3 whitespace-nowrap text-[10px] font-black text-slate-900 uppercase">
                                                                {opening.Tienda}
                                                            </td>
                                                        )}
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
                                            ) : !loadingOpenings ? (
                                                <tr>
                                                    <td colSpan={!selectedStoreId ? 8 : 7} className="px-4 py-12 text-center">
                                                        <div className="flex flex-col items-center gap-3">
                                                            <div className="p-4 bg-slate-50 rounded-none">
                                                                <Search size={32} className="text-slate-200" />
                                                            </div>
                                                            <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest">No se encontraron aperturas</p>
                                                        </div>
                                                    </td>
                                                </tr>
                                            ) : null}
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
            <CancellationDetailModal
                isOpen={isCancellationModalOpen}
                onClose={handleCloseCancellation}
                idTienda={selectedStoreData?.IdTienda}
                fechaInicio={fechaInicio}
                fechaFin={fechaFin}
                storeName={selectedStoreData?.Tienda}
            />

            {/* Depto Detail Modal */}
            <DeptoDetailModal
                isOpen={isDeptoModalOpen}
                onClose={handleCloseDepto}
                idDepto={selectedDeptoId}
                deptoName={selectedDeptoName}
                familia={selectedFamilia}
                fechaInicio={fechaInicio}
                fechaFin={fechaFin}
                idTienda={selectedStoreId || undefined}
                storeName={selectedStoreName || undefined}
            />

            {/* Global Pareto Analysis Modal */}
            <ParetoAnalysisModal
                isOpen={isParetoModalOpen}
                onClose={() => setIsParetoModalOpen(false)}
                fechaInicio={fechaInicio}
                fechaFin={fechaFin}
                idTienda={selectedStoreId || undefined}
                storeName={selectedStoreName || undefined}
            />


            {/* Withdrawal Drill-down Modal */}
            {isWithdrawalModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
                    <div
                        className={cn(
                            "bg-white shadow-2xl overflow-hidden flex flex-col transition-[width,height,transform] duration-300 border border-slate-200",
                            isMaximized ? "fixed inset-0 m-0" : "w-full max-w-[95vw] lg:max-w-7xl max-h-[90vh]"
                        )}
                        style={!isMaximized ? {
                            transform: `translate(${withdrawalModalPosition.x}px, ${withdrawalModalPosition.y}px)`,
                        } : undefined}
                    >
                        {/* Modal Header */}
                        <div
                            onMouseDown={(e) => handleModalDrag(e, withdrawalModalPosition, setWithdrawalModalPosition, withdrawalModalDragRef, setIsWithdrawalModalDragging)}
                            onDoubleClick={() => setWithdrawalModalPosition({ x: 0, y: 0 })}
                            className={cn(
                                "flex items-center justify-between bg-white border-b border-slate-100 p-4 shrink-0",
                                !isMaximized && "cursor-grab active:cursor-grabbing select-none"
                            )}
                        >
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-slate-50 rounded-none border border-slate-100">
                                    <Wallet size={18} className="text-amber-500" />
                                </div>
                                <div>
                                    <h3 className="font-black text-sm uppercase tracking-widest leading-none mb-1 text-slate-800">Detalle de Retiros</h3>
                                    <p className="text-[10px] font-bold text-slate-400 uppercase">{selectedStoreData ? selectedStoreData.Tienda : 'TODAS LAS TIENDAS'} • {fechaInicio} a {fechaFin}</p>
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
                                <LoadingScreen message="Obteniendo retiros..." />
                            ) : (
                                <div className="min-w-full inline-block align-middle">
                                    <table className="min-w-full border-collapse text-[11px]">
                                        <thead className="sticky top-0 z-10">
                                            <tr className="bg-slate-50 border-b border-slate-200">
                                                {!selectedStoreId && (
                                                    <th onClick={() => handleWithdrawalSort('Tienda')} className="px-3 py-3 text-left font-black text-slate-500 uppercase tracking-wider cursor-pointer hover:bg-slate-100 transition-colors">
                                                        <div className="flex items-center">Tienda {RenderWithdrawalSortIcon('Tienda')}</div>
                                                    </th>
                                                )}
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
                                                            {!selectedStoreId && (
                                                                <td className="px-3 py-3 whitespace-nowrap font-black text-slate-900 uppercase">
                                                                    {item.Tienda}
                                                                </td>
                                                            )}
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
                                            ) : !loadingWithdrawals ? (
                                                <tr>
                                                    <td colSpan={!selectedStoreId ? 12 : 11} className="px-4 py-12 text-center">
                                                        <div className="flex flex-col items-center gap-3">
                                                            <div className="p-4 bg-slate-50 rounded-none">
                                                                <Search size={32} className="text-slate-200" />
                                                            </div>
                                                            <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest">No se encontraron retiros</p>
                                                        </div>
                                                    </td>
                                                </tr>
                                            ) : null}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>

                        {/* Modal Footer */}
                        <div className="bg-slate-50 p-4 border-t border-slate-200 flex items-center justify-between">
                            <div className="flex items-center gap-6">
                                {(() => {
                                    const totalRetirado = filteredWithdrawals.reduce((acc, w) => acc + w.Efectivo + w.Tarjeta + w.Debito + w.Transferencia + w.Vales + w.Dolares + w.Cheques - w.Devoluciones, 0);
                                    const ops = filteredWithdrawals.length;
                                    const promedio = ops > 0 ? totalRetirado / ops : 0;
                                    return (
                                        <>
                                            <div className="flex flex-col">
                                                <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Total Retiros</span>
                                                <span className="text-sm font-black text-slate-900">{ops}</span>
                                            </div>
                                            <div className="flex flex-col border-l border-slate-200 pl-6">
                                                <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Retiro Promedio</span>
                                                <span className="text-sm font-black text-emerald-600">{formatCurrency(promedio)}</span>
                                            </div>
                                            <div className="flex flex-col border-l border-slate-200 pl-6 text-right">
                                                <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Gran Total Retirado</span>
                                                <span className="text-sm font-black text-amber-600">{formatCurrency(totalRetirado)}</span>
                                            </div>
                                        </>
                                    );
                                })()}
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
                    <div
                        className={cn(
                            "bg-white shadow-2xl overflow-hidden flex flex-col transition-[width,height,transform] duration-300 border border-slate-200",
                            isMaximized ? "fixed inset-0 m-0" : "w-full max-w-6xl max-h-[90vh]"
                        )}
                        style={!isMaximized ? {
                            transform: `translate(${returnModalPosition.x}px, ${returnModalPosition.y}px)`,
                        } : undefined}
                    >
                        {/* Modal Header */}
                        <div
                            onMouseDown={(e) => handleModalDrag(e, returnModalPosition, setReturnModalPosition, returnModalDragRef, setIsReturnModalDragging)}
                            onDoubleClick={() => setReturnModalPosition({ x: 0, y: 0 })}
                            className={cn(
                                "flex items-center justify-between bg-white border-b border-slate-100 p-4 shrink-0",
                                !isMaximized && "cursor-grab active:cursor-grabbing select-none"
                            )}
                        >
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-slate-50 rounded-none border border-slate-100">
                                    <RotateCcw size={18} className="text-indigo-600" />
                                </div>
                                <div>
                                    <h3 className="font-black text-sm uppercase tracking-widest leading-none mb-1 text-slate-800">Detalle de Devoluciones</h3>
                                    <p className="text-[10px] font-bold text-slate-400 uppercase">{selectedStoreData ? selectedStoreData.Tienda : 'TODAS LAS TIENDAS'} • {fechaInicio} a {fechaFin}</p>
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
                                <LoadingScreen message="Obteniendo devoluciones..." />
                            ) : (
                                <div className="min-w-full inline-block align-middle">
                                    <table className="min-w-full border-collapse">
                                        <thead className="sticky top-0 z-10">
                                            <tr className="bg-slate-50 border-b border-slate-200">
                                                {!selectedStoreId && (
                                                    <th
                                                        onClick={() => handleReturnSort('Tienda')}
                                                        className="px-4 py-3 text-left text-[10px] font-black text-slate-500 uppercase tracking-widest cursor-pointer hover:bg-slate-100 transition-colors"
                                                    >
                                                        <div className="flex items-center gap-1">
                                                            Tienda
                                                            {RenderReturnSortIcon('Tienda')}
                                                        </div>
                                                    </th>
                                                )}
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
                                                        {!selectedStoreId && (
                                                            <td className="px-4 py-3 whitespace-nowrap text-left font-black text-slate-900 uppercase text-[11px]">
                                                                {item.Tienda}
                                                            </td>
                                                        )}
                                                        <td className="px-4 py-3 whitespace-nowrap font-bold text-indigo-600 text-[11px]">{item['Folio Devolucion']}</td>
                                                        <td className="px-4 py-3 whitespace-nowrap">
                                                            <div className="flex flex-col items-center">
                                                                <span className="text-[11px] font-bold text-slate-700">{new Date(item['Fecha Devolucion']).toLocaleDateString('es-MX')}</span>
                                                                <span className="text-[11px] font-medium text-slate-400">{new Date(item['Fecha Devolucion']).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}</span>
                                                            </div>
                                                        </td>
                                                        <td className="px-4 py-3 whitespace-nowrap text-[11px] font-bold text-slate-600">{item.Clave}</td>
                                                        <td className="px-4 py-3 whitespace-nowrap">
                                                            <span className="text-[11px] font-black text-indigo-600">{formatCurrency(item.Valor)}</span>
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
                                            ) : !loadingReturns ? (
                                                <tr>
                                                    <td colSpan={!selectedStoreId ? 10 : 9} className="px-4 py-12 text-center">
                                                        <div className="flex flex-col items-center gap-3">
                                                            <div className="p-4 bg-slate-50 rounded-none">
                                                                <Search size={32} className="text-slate-200" />
                                                            </div>
                                                            <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest">No se encontraron devoluciones</p>
                                                        </div>
                                                    </td>
                                                </tr>
                                            ) : null}
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
                                <LoadingScreen message="Consultando partidas de devolución..." />
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
