"use client"

import React, { useState } from "react"
import { usePathname } from "next/navigation"
import { Sidebar } from "@/components/dashboard/Sidebar"
import { Header } from "@/components/dashboard/Header"
import { ChatAgent } from "@/components/chat-agent"
import { cn } from "@/lib/utils"

export default function DashboardLayout({
    children,
}: {
    children: React.ReactNode
}) {
    const [isCollapsed, setIsCollapsed] = useState(false)
    const pathname = usePathname()
    // Ocultar el widget flotante y usar layout full-height en páginas dedicadas
    // (chat de Kesito y consola del Agente Avanzado)
    const isChatPage = pathname === '/dashboard/chat' || pathname === '/dashboard/agent-console'

    return (
        <div className="min-h-screen bg-slate-50 flex flex-col">
            {/* Full-width fixed Header */}
            <Header isCollapsed={isCollapsed} />

            <div className="flex flex-1 pt-16">
                {/* Fixed Sidebar starts below Header */}
                <Sidebar
                    isCollapsed={isCollapsed}
                    onToggle={() => setIsCollapsed(!isCollapsed)}
                />

                {/* Main Content Area */}
                <main className={cn(
                    "flex-1 transition-all duration-300 min-w-0",
                    isCollapsed ? "lg:pl-[80px]" : "lg:pl-72"
                )}>
                    <div className={cn(
                        isChatPage
                            ? "h-[calc(100vh-64px)]"
                            : "p-4 sm:p-8 md:p-10 max-w-[1600px] mx-auto"
                    )}>
                        {children}
                    </div>
                </main>
            </div>

            {/* Floating AI Agent (oculto en página dedicada del chat) */}
            {!isChatPage && <ChatAgent />}
        </div>
    )
}
