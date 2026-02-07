"use client"

import React from "react"
import { useRouter } from "next/navigation"
import Image from "next/image"
import { Bell, User, LogOut, Settings, HelpCircle, Database } from "lucide-react"
import { cn } from "@/lib/utils"

export function Header({ isCollapsed = false }: { isCollapsed?: boolean }) {
    const router = useRouter()
    const [userName, setUserName] = React.useState<string>("Cargando...")

    React.useEffect(() => {
        const fetchUser = async () => {
            try {
                const res = await fetch("/api/auth/me")
                const data = await res.json()
                if (data.user && data.user.name) {
                    setUserName(data.user.name)
                } else {
                    setUserName("Invitado")
                }
            } catch (error) {
                console.error("Error fetching user:", error)
                setUserName("Usuario")
            }
        }
        fetchUser()
    }, [])

    const handleLogout = async () => {
        try {
            await fetch("/api/auth/logout", { method: "POST" })
            router.push("/login")
            router.refresh()
        } catch (error) {
            console.error("Logout failed:", error)
            // Fallback redirect
            router.push("/login")
        }
    }

    return (
        <header className={cn(
            "fixed top-0 left-0 right-0 h-16 z-50 px-6 sm:px-8 flex items-center justify-between backdrop-blur-md shadow-md",
            "bg-[#FD9800] border-b border-[#E68A00] text-white"
        )}>
            {/* Left side: Branding & Logo */}
            <div className="flex items-center gap-6">
                <div className={cn(
                    "flex items-center gap-4 pr-6 border-r border-white/20 transition-all duration-300",
                    isCollapsed ? "w-12" : "w-64"
                )}>
                    <div className="w-12 h-12 flex items-center justify-center flex-shrink-0 overflow-hidden">
                        <img
                            src="/logo.svg"
                            alt="Logo"
                            className="w-full h-full object-contain"
                        />
                    </div>
                    {!isCollapsed && (
                        <div className="flex flex-col whitespace-nowrap overflow-hidden">
                            <span className="font-black text-lg leading-none tracking-tight text-white">
                                Kesos iA
                            </span>
                            <span className="text-[9px] font-bold text-white/80 uppercase tracking-widest mt-0.5">
                                Enterprise
                            </span>
                        </div>
                    )}
                </div>


            </div>

            {/* Right side profile & settings */}
            <div className="flex items-center gap-3 sm:gap-6">
                <div className="flex items-center gap-1.5 pr-4 border-r border-white/20">
                    <button className="p-2 rounded-none hover:bg-white/10 text-white/80 hover:text-white transition-all">
                        <HelpCircle className="h-4 w-4" />
                    </button>
                    <button className="p-2 rounded-none hover:bg-white/10 text-white/80 hover:text-white transition-all relative">
                        <Bell className="h-4 w-4" />
                        <span className="absolute top-2.5 right-2.5 w-1.5 h-1.5 bg-white rounded-none ring-2 ring-[#FD9800]" />
                    </button>
                    <button className="p-2 rounded-none hover:bg-white/10 text-white/80 hover:text-white transition-all">
                        <Settings className="h-4 w-4" />
                    </button>
                </div>

                <div className="flex items-center gap-3 pl-2 group">
                    <div className="hidden sm:flex flex-col text-right">
                        <p className="text-[13px] font-bold leading-none text-white">{userName}</p>
                        <p className="text-[10px] text-white/70 mt-1 uppercase tracking-widest font-black">Pro License</p>
                    </div>

                    <div className="relative">
                        <button className="h-10 w-10 bg-white/10 border border-white/20 rounded-none flex items-center justify-center text-white font-bold shadow-sm overflow-hidden hover:scale-105 transition-all">
                            <User size={20} />
                        </button>
                    </div>

                    <button
                        onClick={handleLogout}
                        className="p-2 rounded-none bg-white/10 border border-white/20 text-white/80 hover:text-white hover:bg-rose-500/80 hover:border-rose-500/80 transition-all flex items-center gap-2 group/logout"
                        title="Cerrar Sesión"
                    >
                        <LogOut className="h-4 w-4 transform group-hover/logout:translate-x-0.5 transition-transform" />
                        <span className="hidden xl:block text-[11px] font-bold uppercase tracking-wider">Salir</span>
                    </button>
                </div>
            </div>
        </header>
    )
}
