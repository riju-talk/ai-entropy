"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useSession } from "next-auth/react"
import {
  BookOpen,
  CalendarDays,
  GraduationCap,
  HelpCircle,
  Info,
  MessageSquarePlus,
  Timer,
  Trophy,
  Users,
} from "lucide-react"

import { useAuthModal } from "@/hooks/use-auth-modal"
import { cn } from "@/lib/utils"

export const NAV_ITEMS = [
  { href: "/", label: "Questions", icon: HelpCircle },
  { href: "/ask", label: "Ask a question", icon: MessageSquarePlus, protected: true },
  { href: "/communities", label: "Communities", icon: Users },
  { href: "/ai-agent", label: "AI study", icon: BookOpen },
  { href: "/study", label: "Study timer", icon: Timer, protected: true },
  { href: "/mentorship", label: "Mentorship", icon: GraduationCap },
  { href: "/happenings", label: "Happenings", icon: CalendarDays },
  { href: "/leaderboard", label: "Leaderboard", icon: Trophy },
  { href: "/about", label: "About", icon: Info },
] as const

/** `compact` renders an icon-only rail (labels stay available to screen readers and as tooltips). */
export function NavLinks({ onNavigate, compact = false }: { onNavigate?: () => void; compact?: boolean }) {
  const pathname = usePathname()
  const { status } = useSession()
  const { open: openAuthModal } = useAuthModal()

  return (
    <nav aria-label="Main" className="space-y-0.5">
      {NAV_ITEMS.map((item) => {
        const Icon = item.icon
        const active = item.href === "/" ? pathname === "/" : pathname?.startsWith(item.href)
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            title={compact ? item.label : undefined}
            onClick={(e) => {
              if ("protected" in item && item.protected && status !== "authenticated") {
                e.preventDefault()
                openAuthModal()
                return
              }
              onNavigate?.()
            }}
            className={cn(
              "flex items-center gap-3 border-l-2 py-1.5 text-sm transition-colors",
              compact ? "justify-center px-0" : "px-3",
              active
                ? "border-primary font-medium text-foreground"
                : "border-transparent text-muted-foreground hover:border-foreground/30 hover:text-foreground"
            )}
          >
            <Icon className="h-4 w-4 shrink-0" strokeWidth={1.5} />
            <span className={compact ? "sr-only" : "truncate"}>{item.label}</span>
          </Link>
        )
      })}
    </nav>
  )
}
