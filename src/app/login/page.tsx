"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Image from "next/image"
import { Lock, ScanBarcode, ArrowRight } from "lucide-react"
import { cn } from "@/lib/utils"

export default function LoginPage() {
    const [codigobarras, setCodigobarras] = useState("")
    const [password, setPassword] = useState("")
    const [error, setError] = useState("")
    const [loading, setLoading] = useState(false)
    const router = useRouter()

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setError("")
        setLoading(true)

        try {
            const res = await fetch("/api/auth/login", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ codigobarras, password }),
            })

            const data = await res.json()

            if (!res.ok) {
                throw new Error(data.error || "Error al iniciar sesión")
            }

            // Redirect to dashboard page
            router.push("/dashboard")
            router.refresh() // Refresh to update middleware/server state
        } catch (err: unknown) {
            if (err instanceof Error) {
                setError(err.message)
            } else {
                setError("An unknown error occurred")
            }
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 px-4">
            <div className="w-full max-w-md">
                {/* Brand Logo Section */}
                <div className="flex flex-col items-center mb-10 text-center">
                    <div className="w-20 h-20 mb-6 flex items-center justify-center transition-transform hover:scale-105 duration-500">
                        <img
                            src="/logo.svg"
                            alt="Kesos iA Logo"
                            className="w-full h-full object-contain"
                        />
                    </div>
                    <h1 className="text-4xl font-black tracking-tighter text-slate-900 uppercase">
                        Kesos <span className="text-[#FD9800]">iA</span>
                    </h1>
                    <p className="mt-2 text-[11px] font-black text-slate-400 uppercase tracking-[0.3em]">
                        Enterprise Resource Intelligence
                    </p>
                </div>

                {/* Login Form Card */}
                <div className="bg-white rounded-[2.5rem] shadow-2xl shadow-blue-900/10 p-10 border border-slate-100">
                    <div className="mb-8">
                        <h2 className="text-2xl font-black text-slate-900 leading-none">Bienvenido</h2>
                        <p className="text-xs font-bold text-slate-400 mt-2 uppercase tracking-widest">Inicia sesión para acceder</p>
                    </div>

                    <form className="space-y-6" onSubmit={handleSubmit}>
                        <div className="space-y-4">
                            <div className="relative group">
                                <ScanBarcode className="absolute top-4 left-4 h-5 w-5 text-slate-400 group-focus-within:text-[#4050B4] transition-colors" />
                                <input
                                    id="codigobarras"
                                    name="codigobarras"
                                    type="text"
                                    required
                                    className="block w-full px-12 py-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#4050B4]/20 focus:border-[#4050B4] focus:bg-white transition-all text-slate-900"
                                    placeholder="CÓDIGO DE BARRAS"
                                    value={codigobarras}
                                    onChange={(e) => setCodigobarras(e.target.value)}
                                />
                            </div>
                            <div className="relative group">
                                <Lock className="absolute top-4 left-4 h-5 w-5 text-slate-400 group-focus-within:text-[#4050B4] transition-colors" />
                                <input
                                    id="password"
                                    name="password"
                                    type="password"
                                    required
                                    className="block w-full px-12 py-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#4050B4]/20 focus:border-[#4050B4] focus:bg-white transition-all text-slate-900"
                                    placeholder="CONTRASEÑA"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                />
                            </div>
                        </div>

                        {error && (
                            <div className="text-rose-500 text-[11px] font-black text-center bg-rose-50 p-3 rounded-xl border border-rose-100 animate-shake uppercase tracking-wider">
                                {error}
                            </div>
                        )}

                        <button
                            type="submit"
                            disabled={loading}
                            className={cn(
                                "group relative w-full flex items-center justify-between py-4 px-8 bg-[#FD9800] hover:bg-[#E68A00] text-black font-black rounded-2xl shadow-xl shadow-orange-500/20 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed overflow-hidden active:scale-95",
                                loading && "opacity-70"
                            )}
                        >
                            <span className="text-[13px] uppercase tracking-[0.2em] relative z-10">
                                {loading ? "Iniciando sesión..." : "Ingresar al Panel"}
                            </span>
                            <ArrowRight className="h-5 w-5 relative z-10 group-hover:translate-x-1 transition-transform" />

                            {/* Animated reflection effect */}
                            <div className="absolute top-0 -left-[100%] w-[50%] h-full bg-white/20 skew-x-[-30deg] group-hover:left-[120%] transition-all duration-700 ease-in-out" />
                        </button>
                    </form>

                    <div className="mt-8 text-center">
                        <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest leading-relaxed">
                            © {new Date().getFullYear()} Kesos iA Core System<br />
                            Todos los derechos reservados.
                        </p>
                    </div>
                </div>

                {/* Decorative Elements */}
                <div className="mt-8 flex justify-center gap-6 opacity-20 filter grayscale hover:grayscale-0 transition-all duration-700 cursor-default">
                    <div className="h-6 w-24 bg-slate-200 rounded-full" />
                    <div className="h-6 w-24 bg-slate-200 rounded-full" />
                    <div className="h-6 w-24 bg-slate-200 rounded-full" />
                </div>
            </div>
        </div>
    )
}
