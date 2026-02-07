"use client"

import React from "react"
import {
    Users,
    Database,
    Zap,
    Clock,
    ArrowUpRight,
    ArrowDownRight,
    Search,
    Filter,
    MoreHorizontal,
    TrendingUp
} from "lucide-react"
import {
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    AreaChart,
    Area
} from "recharts"
import { cn } from "@/lib/utils"

const stats = [
    {
        name: "Total Queries",
        value: "2,543",
        change: "+12.5%",
        trend: "up",
        emoji: "⚡",
        color: "text-blue-600",
        bg: "bg-blue-50 dark:bg-blue-900/10"
    },
    {
        name: "Connected DBs",
        value: "142",
        change: "+3.2%",
        trend: "up",
        emoji: "🗄️",
        color: "text-indigo-600",
        bg: "bg-indigo-50 dark:bg-indigo-900/10"
    },
    {
        name: "Avg Response",
        value: "0.8s",
        change: "-15%",
        trend: "down",
        emoji: "⏱️",
        color: "text-cyan-600",
        bg: "bg-cyan-50 dark:bg-cyan-900/10"
    },
    {
        name: "Active Users",
        value: "89",
        change: "+5.4%",
        trend: "up",
        emoji: "👥",
        color: "text-blue-600",
        bg: "bg-blue-50 dark:bg-blue-900/10"
    },
]

const data = [
    { name: "Mon", queries: 400 },
    { name: "Tue", queries: 300 },
    { name: "Wed", queries: 200 },
    { name: "Thu", queries: 278 },
    { name: "Fri", queries: 189 },
    { name: "Sat", queries: 239 },
    { name: "Sun", queries: 349 },
]

const recentQueries = [
    { id: 1, query: "Show today's total revenue by department", user: "Admin", time: "2m ago", status: "Success" },
    { id: 2, query: "Top 5 best-selling products this month", user: "M. Garcia", time: "15m ago", status: "Success" },
    { id: 3, query: "Revenue comparison Q3 vs Q4 with charts", user: "R. Lopez", time: "1h ago", status: "Refining", statusColor: "text-amber-500" },
    { id: 4, query: "List all clients with overdue invoices", user: "Admin", time: "3h ago", status: "Success" },
]

export default function OverviewPage() {
    return (
        <div className="space-y-10 max-w-7xl mx-auto py-4">
            {/* Page Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight text-foreground">Workspace Overview</h1>
                    <p className="text-[13px] text-muted-foreground mt-1">Real-time insights and monitoring for your connected databases.</p>
                </div>
                <div className="flex items-center gap-2">
                    <button className="flex items-center gap-2 px-3 py-1.5 border border-border/80 rounded-lg text-xs font-semibold hover:bg-muted transition-all">
                        <Filter size={14} />
                        Filter View
                    </button>
                    <button className="bg-primary text-primary-foreground px-4 py-1.5 rounded-lg text-xs font-bold hover:opacity-90 transition-all shadow-sm shadow-primary/20">
                        Export Report
                    </button>
                </div>
            </div>

            {/* Metrics Dashboard */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                {stats.map((stat) => (
                    <div key={stat.name} className="bg-background border border-border/50 rounded-2xl p-6 hover:border-primary/30 transition-all hover:bg-muted/5 group">
                        <div className="flex items-center justify-between mb-4">
                            <div className={cn("w-12 h-12 rounded-2xl flex items-center justify-center text-2xl shadow-sm transition-all group-hover:scale-110 group-hover:rotate-6", stat.bg)}>
                                {stat.emoji}
                            </div>
                            <div className={cn(
                                "flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full",
                                stat.trend === "up" ? "bg-emerald-500/10 text-emerald-600" : "bg-rose-500/10 text-rose-600"
                            )}>
                                {stat.trend === "up" ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
                                {stat.change}
                            </div>
                        </div>
                        <p className="text-[12px] font-semibold text-muted-foreground uppercase tracking-wider">{stat.name}</p>
                        <h3 className="text-2xl font-extrabold mt-1 tracking-tight">{stat.value}</h3>
                    </div>
                ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Analytics Snapshot */}
                <div className="lg:col-span-2 bg-background border border-border/50 rounded-3xl p-8 flex flex-col">
                    <div className="flex items-center justify-between mb-10">
                        <div>
                            <h3 className="text-lg font-bold tracking-tight">System Frequency</h3>
                            <p className="text-[12px] text-muted-foreground">Requests processed in the last 7 days.</p>
                        </div>
                        <div className="flex items-center gap-3">
                            <div className="flex items-center gap-1.5 text-xs text-muted-foreground mr-2 font-medium">
                                <span className="w-2 h-2 rounded-full bg-primary" />
                                Database Hits
                            </div>
                            <div className="h-8 w-[1px] bg-border mr-1" />
                            <select className="bg-muted/50 border-none rounded-lg px-3 py-1.5 text-[11px] font-bold outline-none ring-0">
                                <option>Weekly View</option>
                                <option>Monthly View</option>
                            </select>
                        </div>
                    </div>
                    <div className="h-[320px] w-full mt-auto">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={data}>
                                <defs>
                                    <linearGradient id="colorInd" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.08} />
                                        <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" opacity={0.4} />
                                <XAxis
                                    dataKey="name"
                                    axisLine={false}
                                    tickLine={false}
                                    tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11, fontWeight: 500 }}
                                    dy={10}
                                />
                                <YAxis
                                    hide
                                />
                                <Tooltip
                                    isAnimationActive={false}
                                    contentStyle={{
                                        backgroundColor: 'hsl(var(--background))',
                                        borderColor: 'hsl(var(--border))',
                                        borderRadius: '12px',
                                        boxShadow: '0 10px 30px -10px rgba(0, 0, 0, 0.1)',
                                        fontSize: '12px',
                                        fontWeight: '600',
                                        border: '1px solid hsl(var(--border))'
                                    }}
                                />
                                <Area
                                    type="monotone"
                                    dataKey="queries"
                                    stroke="hsl(var(--primary))"
                                    strokeWidth={3}
                                    fillOpacity={1}
                                    fill="url(#colorInd)"
                                />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Efficiency Index */}
                <div className="bg-background border border-border/50 rounded-3xl p-8 flex flex-col justify-between">
                    <div>
                        <div className="flex items-center gap-2 mb-2">
                            <TrendingUp size={16} className="text-primary" />
                            <h3 className="text-lg font-bold tracking-tight">Optimization</h3>
                        </div>
                        <p className="text-[12px] text-muted-foreground leading-relaxed">System performance is exceeding current benchmarks by 12%.</p>
                    </div>

                    <div className="space-y-8 my-8">
                        <div className="space-y-3">
                            <div className="flex justify-between text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                                <span>Index Health</span>
                                <span className="text-foreground">94%</span>
                            </div>
                            <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
                                <div className="h-full w-[94%] bg-primary rounded-full" />
                            </div>
                        </div>

                        <div className="space-y-3">
                            <div className="flex justify-between text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                                <span>Cache Performance</span>
                                <span className="text-foreground">82%</span>
                            </div>
                            <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
                                <div className="h-full w-[82%] bg-indigo-500 rounded-full" />
                            </div>
                        </div>

                        <div className="space-y-3">
                            <div className="flex justify-between text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                                <span>Compute Load</span>
                                <span className="text-foreground">42%</span>
                            </div>
                            <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
                                <div className="h-full w-[42%] bg-emerald-500 rounded-full" />
                            </div>
                        </div>
                    </div>

                    <div className="p-4 bg-muted/30 rounded-2xl border border-border/40">
                        <h4 className="text-[11px] font-bold uppercase text-primary tracking-widest mb-1">Infrastructure Tip</h4>
                        <p className="text-[11px] text-muted-foreground font-medium leading-relaxed italic">"Enabling vertical scaling for the main cluster could reduce latency by an estimated 14ms."</p>
                    </div>
                </div>
            </div>

            {/* Audit Log / Table */}
            <div className="bg-background border border-border/50 rounded-3xl overflow-hidden shadow-sm">
                <div className="px-8 py-6 border-b border-border/40 flex items-center justify-between bg-muted/5">
                    <h3 className="text-md font-bold tracking-tight">Operations Log</h3>
                    <div className="flex items-center gap-4">
                        <div className="relative hidden sm:block">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                            <input
                                type="text"
                                placeholder="Filter log..."
                                className="bg-background border border-border/50 rounded-lg py-1.5 pl-9 pr-3 text-[11px] font-medium outline-none focus:border-primary/50 transition-all w-48"
                            />
                        </div>
                        <button className="h-8 w-8 flex items-center justify-center hover:bg-muted rounded-lg transition-all border border-border/40">
                            <MoreHorizontal size={14} className="text-muted-foreground" />
                        </button>
                    </div>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead>
                            <tr className="border-b border-border/30 bg-muted/10">
                                <th className="px-8 py-4 text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Target Activity</th>
                                <th className="px-8 py-4 text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Identity</th>
                                <th className="px-8 py-4 text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Timestamp</th>
                                <th className="px-8 py-4 text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Result</th>
                                <th className="px-8 py-4 text-[11px] font-bold uppercase tracking-widest text-muted-foreground"></th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border/20">
                            {recentQueries.map((item) => (
                                <tr key={item.id} className="hover:bg-muted/10 transition-colors group">
                                    <td className="px-8 py-5">
                                        <p className="text-[13px] font-semibold text-foreground line-clamp-1">{item.query}</p>
                                    </td>
                                    <td className="px-8 py-5">
                                        <div className="flex items-center gap-2.5">
                                            <div className="w-7 h-7 rounded-full bg-muted border border-border/50 flex items-center justify-center text-[10px] font-extrabold text-muted-foreground">
                                                {item.user.charAt(0)}
                                            </div>
                                            <span className="text-[13px] font-medium">{item.user}</span>
                                        </div>
                                    </td>
                                    <td className="px-8 py-5 text-[12px] text-muted-foreground font-medium">
                                        {item.time}
                                    </td>
                                    <td className="px-8 py-5">
                                        <div className={cn(
                                            "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider",
                                            item.status === "Success" ? "bg-emerald-500/10 text-emerald-600" : "bg-muted text-muted-foreground",
                                            item.statusColor
                                        )}>
                                            <div className={cn("w-1.5 h-1.5 rounded-full", item.status === "Success" ? "bg-emerald-500" : "bg-muted-foreground")} />
                                            {item.status}
                                        </div>
                                    </td>
                                    <td className="px-8 py-5 text-right">
                                        <button className="text-muted-foreground hover:text-foreground opacity-0 group-hover:opacity-100 transition-all font-bold text-xs">
                                            Details
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                <div className="px-8 py-4 border-t border-border/20 bg-muted/5 flex items-center justify-between">
                    <p className="text-[11px] text-muted-foreground font-medium">Showing top 4 recent operations</p>
                    <button className="text-[11px] font-bold text-primary hover:underline underline-offset-4 tracking-tight">View Full Audit Log</button>
                </div>
            </div>
        </div>
    )
}
