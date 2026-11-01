"use client"

import { useEffect, useState } from "react"
import { Check, Monitor, Moon, Sun } from "lucide-react"
import { useTheme } from "next-themes"

import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

const OPTIONS = [
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
  { value: "system", label: "System", icon: Monitor },
] as const

/** Light / dark / follow-the-OS switch. Remembers the choice; defaults to the OS setting. */
export function ThemeToggle() {
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Change colour theme" className="h-9 w-9">
          {/* Both icons are in the DOM; CSS shows the right one so there is no flash before hydration */}
          <Sun className="h-[1.1rem] w-[1.1rem] dark:hidden" />
          <Moon className="hidden h-[1.1rem] w-[1.1rem] dark:block" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-40">
        {OPTIONS.map(({ value, label, icon: Icon }) => (
          <DropdownMenuItem key={value} onClick={() => setTheme(value)} className="gap-2">
            <Icon className="h-4 w-4" />
            <span className="flex-1">{label}</span>
            {mounted && theme === value && <Check className="h-4 w-4" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
