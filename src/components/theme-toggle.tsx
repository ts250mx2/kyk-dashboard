"use client"

import * as React from "react"
import { Moon, Sun, Laptop, Palette } from "lucide-react"
import { useTheme } from "next-themes"

import { cn } from "@/lib/utils"

export function ThemeToggle() {
    const { setTheme, theme } = useTheme()
    const [isOpen, setIsOpen] = React.useState(false)
    const dropdownRef = React.useRef<HTMLDivElement>(null)

    React.useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false)
            }
        }

        document.addEventListener("mousedown", handleClickOutside)
        return () => {
            document.removeEventListener("mousedown", handleClickOutside)
        }
    }, [])

    const themes = [
        { name: 'light', label: 'Light', icon: Sun, color: 'bg-white' },
        { name: 'dark', label: 'Dark', icon: Moon, color: 'bg-slate-950' },
        { name: 'system', label: 'System', icon: Laptop, color: 'bg-gray-200' },
        { name: 'midnight', label: 'Midnight', icon: Moon, color: 'bg-[#0b1120]' },
        { name: 'forest', label: 'Forest', icon: Moon, color: 'bg-[#052e16]' },
        { name: 'latte', label: 'Latte', icon: Sun, color: 'bg-[#fdf6e3]' },
        { name: 'kesos-y-kosas', label: 'Kesos y Kosas', icon: Sun, color: 'bg-[#fff601]' },
    ]

    return (
        <div className="relative" ref={dropdownRef}>
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="flex items-center gap-2 px-3 py-2 rounded-md border border-border hover:bg-accent hover:text-accent-foreground transition-colors"
            >
                <Palette className="h-4 w-4" />
                <span className="text-sm font-medium hidden sm:inline-block">Theme</span>
            </button>

            {isOpen && (
                <div className="absolute right-0 mt-2 w-48 rounded-md shadow-lg bg-popover border border-border ring-1 ring-black ring-opacity-5 z-50">
                    <div className="py-1" role="menu" aria-orientation="vertical">
                        {themes.map((t) => (
                            <button
                                key={t.name}
                                onClick={() => {
                                    setTheme(t.name)
                                    setIsOpen(false)
                                }}
                                className={cn(
                                    "flex items-center w-full px-4 py-2 text-sm text-left hover:bg-accent hover:text-accent-foreground transition-colors",
                                    theme === t.name && "bg-accent text-accent-foreground font-medium"
                                )}
                                role="menuitem"
                            >
                                <t.icon className="mr-3 h-4 w-4" />
                                {t.label}
                                <span className={cn("ml-auto w-3 h-3 rounded-full border border-gray-300", t.color)} />
                            </button>
                        ))}
                    </div>
                </div>
            )}
        </div>
    )
}
