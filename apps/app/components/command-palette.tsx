"use client"

import { useCallback, useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { useTheme } from "next-themes"
import { Moon, Search } from "lucide-react"

import { NAV_ITEMS } from "@/components/nav-links"
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command"

/** Global Ctrl/Cmd+K palette: keyboard-first navigation for power users. */
export function CommandPalette() {
  const [open, setOpen] = useState(false)
  const router = useRouter()
  const { setTheme, resolvedTheme } = useTheme()

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        setOpen((o) => !o)
      }
    }
    const onOpen = () => setOpen(true)
    document.addEventListener("keydown", onKey)
    window.addEventListener("open-command-palette", onOpen)
    return () => {
      document.removeEventListener("keydown", onKey)
      window.removeEventListener("open-command-palette", onOpen)
    }
  }, [])

  const go = useCallback(
    (href: string) => {
      setOpen(false)
      router.push(href)
    },
    [router],
  )

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput placeholder="Jump to a page or run a command..." />
      <CommandList>
        <CommandEmpty>No results. Try another word.</CommandEmpty>
        <CommandGroup heading="Go to">
          {NAV_ITEMS.map((item) => (
            <CommandItem key={item.href} value={item.label} onSelect={() => go(item.href)}>
              <item.icon className="mr-2 h-4 w-4" strokeWidth={1.5} />
              {item.label}
            </CommandItem>
          ))}
        </CommandGroup>
        <CommandSeparator />
        <CommandGroup heading="Actions">
          <CommandItem value="search questions" onSelect={() => go("/search")}>
            <Search className="mr-2 h-4 w-4" strokeWidth={1.5} /> Search questions
          </CommandItem>
          <CommandItem
            value="toggle theme dark light"
            onSelect={() => {
              setTheme(resolvedTheme === "dark" ? "light" : "dark")
              setOpen(false)
            }}
          >
            <Moon className="mr-2 h-4 w-4" strokeWidth={1.5} /> Toggle dark mode
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  )
}
