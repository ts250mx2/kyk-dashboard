"use client"

import React, { useState, useMemo } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import {
    ChevronLeft,
    ChevronRight,
    Search,
    Menu,
    X,
    ChevronDown,
    Database as DatabaseIcon
} from "lucide-react"
import { cn } from "@/lib/utils"

type MenuItem = {
    name: string;
    emoji: string;
    href: string;
};

type MenuSection = {
    title: string;
    emoji: string;
    items: MenuItem[];
};

const menuSections: MenuSection[] = [
    {
        title: "Dashboard",
        emoji: "📊",
        items: [
            { name: "Dashboard de Ventas", emoji: "📈", href: "/dashboard" },
            { name: "Chat con IA", emoji: "🤖", href: "/dashboard/chat" },
        ]
    },
    {
        title: "Inventario",
        emoji: "📦",
        items: [
            { name: "Inventarios Tienda", emoji: "🏬", href: "/dashboard/inventory/store" },
            { name: "Auditoria por Proveedor", emoji: "🚚", href: "/dashboard/inventory/provider" },
            { name: "Auditoria por zona", emoji: "📍", href: "/dashboard/inventory/zone" },
        ]
    },
    {
        title: "Compras",
        emoji: "🛒",
        items: [
            { name: "Ordenes de Compra", emoji: "📝", href: "/dashboard/purchases/orders" },
            { name: "Precios", emoji: "🏷️", href: "/dashboard/purchases/prices" },
            { name: "Reportes de Compras", emoji: "📈", href: "/dashboard/purchases/reports" },
        ]
    },
    {
        title: "Ventas",
        emoji: "💰",
        items: [
            { name: "Facturas", emoji: "🧾", href: "/dashboard/sales/invoices" },
            { name: "Cortes de Caja", emoji: "💸", href: "/dashboard/sales/cash-closure" },
            { name: "Reportes de Ventas", emoji: "📊", href: "/dashboard/sales/reports" },
        ]
    },
    {
        title: "Sistema",
        emoji: "⚙️",
        items: [
            { name: "Configuración", emoji: "🛠️", href: "/dashboard/settings" },
            { name: "Aprendizaje IA", emoji: "🧠", href: "/dashboard/system/ai-learning" },
            { name: "Historial de preguntas", emoji: "📜", href: "/dashboard/system/question-history" },
        ]
    }
];

export function Sidebar({
    isCollapsed,
    onToggle
}: {
    isCollapsed: boolean;
    onToggle: () => void;
}) {
    const [isMobileOpen, setIsMobileOpen] = useState(false)
    const [searchTerm, setSearchTerm] = useState("")
    const [openSections, setOpenSections] = useState<Record<string, boolean>>({})

    const pathname = usePathname()

    const toggleSection = (title: string) => {
        setOpenSections(prev => ({
            ...prev,
            [title]: !prev[title]
        }))
    }

    const filteredSections = useMemo(() => {
        return menuSections.map(section => ({
            ...section,
            items: section.items.filter(item =>
                item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                section.title.toLowerCase().includes(searchTerm.toLowerCase())
            )
        })).filter(section => section.items.length > 0)
    }, [searchTerm])

    return (
        <>
            {/* Mobile Nav Button trigger would typically be in the Header now */}
            <button
                onClick={() => setIsMobileOpen(!isMobileOpen)}
                className="lg:hidden fixed top-3 left-4 z-[60] p-2 bg-[#4050B4] text-white rounded-none shadow-lg"
            >
                {isMobileOpen ? <X size={20} /> : <Menu size={20} />}
            </button>

            {isMobileOpen && (
                <div
                    className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 lg:hidden"
                    onClick={() => setIsMobileOpen(false)}
                />
            )}

            {/* Sidebar Container */}
            <aside className={cn(
                "fixed left-0 top-16 h-[calc(100vh-4rem)] transition-all duration-300 z-40 flex flex-col shadow-2xl overflow-hidden",
                "bg-[#4050B4] text-white",
                isCollapsed ? "w-[80px]" : "w-72",
                isMobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
            )}>

                {/* Search Bar */}
                {!isCollapsed && (
                    <div className="px-4 mt-6 mb-2">
                        <div className="relative group">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/40 group-focus-within:text-white transition-colors" />
                            <input
                                type="text"
                                placeholder="Buscar menú..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full bg-white/5 border border-white/10 rounded-none py-2.5 pl-10 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-white/20 focus:bg-white/10 transition-all placeholder:text-white/30"
                            />
                        </div>
                    </div>
                )}

                {/* Navigation Menu */}
                <nav className="flex-1 px-3 py-4 space-y-2 overflow-y-auto no-scrollbar">
                    {filteredSections.map((section) => {
                        const isOpen = openSections[section.title]
                        const hasActiveChild = section.items.some(item => pathname === item.href)

                        return (
                            <div key={section.title} className="space-y-1">
                                <button
                                    onClick={() => !isCollapsed && toggleSection(section.title)}
                                    className={cn(
                                        "w-full flex items-center gap-3 py-2 transition-all rounded-none",
                                        isCollapsed ? "justify-center" : "px-3 justify-between",
                                        !isCollapsed && "hover:bg-white/5",
                                        hasActiveChild && !isOpen && "bg-white/10 border border-white/10"
                                    )}
                                    title={isCollapsed ? section.title : ""}
                                >
                                    <div className="flex items-center gap-3">
                                        <span className="text-xl drop-shadow-md">{section.emoji}</span>
                                        {!isCollapsed && (
                                            <span className="text-[13px] font-bold uppercase tracking-widest text-white/50">
                                                {section.title}
                                            </span>
                                        )}
                                    </div>
                                    {!isCollapsed && (
                                        <ChevronDown className={cn(
                                            "h-3.5 w-3.5 text-white/40 transition-transform duration-300",
                                            isOpen ? "rotate-180" : ""
                                        )} />
                                    )}
                                </button>

                                <div className={cn(
                                    "space-y-1 overflow-hidden transition-all duration-300",
                                    (isOpen && !isCollapsed) ? "max-h-96 opacity-100 mt-1" : "max-h-0 opacity-0"
                                )}>
                                    {section.items.map((item) => {
                                        const isActive = pathname === item.href
                                        return (
                                            <Link
                                                key={item.name}
                                                href={item.href}
                                                onClick={() => setIsMobileOpen(false)}
                                                className={cn(
                                                    "flex items-center gap-3 py-2.5 rounded-none transition-all border-l-2 ml-3",
                                                    isCollapsed ? "justify-center ml-0" : "pl-6 pr-4",
                                                    isActive
                                                        ? "bg-white text-[#4050B4] font-bold border-white shadow-lg shadow-black/20"
                                                        : "text-white/70 hover:bg-white/10 hover:text-white border-transparent"
                                                )}
                                            >
                                                <span className="text-lg">{item.emoji}</span>
                                                {!isCollapsed && (
                                                    <span className="text-sm tracking-tight">{item.name}</span>
                                                )}
                                            </Link>
                                        )
                                    })}
                                </div>
                            </div>
                        )
                    })}
                </nav>

                {/* Footer Toggle */}
                <div className="p-4 border-t border-white/10">
                    <button
                        onClick={onToggle}
                        className="w-full flex items-center gap-3 p-3 rounded-none hover:bg-white/10 transition-all text-white/50 hover:text-white group"
                    >
                        <div className="flex-shrink-0 w-6 h-6 flex items-center justify-center">
                            {isCollapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
                        </div>
                        {!isCollapsed && <span className="text-sm font-bold tracking-tight">Contraer Panel</span>}
                    </button>

                </div>
            </aside>
        </>
    )
}
