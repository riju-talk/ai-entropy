"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { signOut, useSession } from "next-auth/react"
import { Coins, Flame, LogOut, Menu, Search, User } from "lucide-react"

import { NavLinks } from "@/components/nav-links"
import { ThemeToggle } from "@/components/theme-toggle"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet"

interface Stats {
  user?: { credits?: number; streaks?: { currentStreak?: number } }
}

export function Wordmark({ className = "" }: { className?: string }) {
  return (
    <span className={`font-display text-2xl leading-none ${className}`}>
      entropy<span className="text-primary">.</span>
    </span>
  )
}

export function Header() {
  const router = useRouter()
  const { data: session } = useSession()
  const [query, setQuery] = useState("")
  const [stats, setStats] = useState<Stats | null>(null)
  const [menuOpen, setMenuOpen] = useState(false)

  useEffect(() => {
    if (!session?.user) {
      setStats(null)
      return
    }
    fetch("/api/users/me/stats")
      .then((res) => (res.ok ? res.json() : null))
      .then(setStats)
      .catch(() => setStats(null))
  }, [session?.user])

  const submitSearch = (e: React.FormEvent) => {
    e.preventDefault()
    const q = query.trim()
    if (q) {
      router.push(`/search?q=${encodeURIComponent(q)}`)
      setQuery("")
    }
  }

  const userId = (session?.user as { id?: string } | undefined)?.id
  const streak = stats?.user?.streaks?.currentStreak ?? 0

  return (
    <header className="sticky top-0 z-50 h-14 w-full border-b border-foreground/80 bg-background">
      <div className="mx-auto flex h-full max-w-[1800px] items-center gap-3 px-4 sm:px-6">
        <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" className="lg:hidden" aria-label="Open menu">
              <Menu className="h-5 w-5" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-72">
            <SheetHeader className="mb-4 text-left">
              <SheetTitle>
                <Wordmark />
              </SheetTitle>
            </SheetHeader>
            <NavLinks onNavigate={() => setMenuOpen(false)} />
          </SheetContent>
        </Sheet>

        <Link href="/" className="mr-2 shrink-0" aria-label="Entropy home">
          <Wordmark />
        </Link>

        <form onSubmit={submitSearch} className="hidden max-w-md flex-1 sm:block" role="search">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search questions and topics"
              aria-label="Search"
              className="h-9 border-0 border-b bg-transparent pl-9 focus-visible:ring-0 focus-visible:ring-offset-0 rounded-none"
            />
          </div>
        </form>

        <div className="ml-auto flex items-center gap-1.5">
          {session?.user && (
            <div className="mr-2 hidden items-center gap-4 font-mono text-xs text-muted-foreground md:flex">
              <span className="flex items-center gap-1" title="Credits">
                <Coins className="h-4 w-4" />
                <span className="tabular-nums text-foreground">{stats?.user?.credits ?? 0}</span>
              </span>
              <span className="flex items-center gap-1" title="Day streak">
                <Flame className={`h-4 w-4 ${streak > 0 ? "text-warning" : ""}`} />
                <span className="tabular-nums text-foreground">{streak}</span>
              </span>
            </div>
          )}

          <ThemeToggle />

          {session?.user ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="rounded-full" aria-label="Account menu">
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={session.user.image || ""} alt="" />
                    <AvatarFallback className="text-xs">{session.user.name?.[0]?.toUpperCase() || "U"}</AvatarFallback>
                  </Avatar>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel className="font-normal">
                  <p className="truncate text-sm font-medium">{session.user.name}</p>
                  <p className="truncate text-xs text-muted-foreground">{session.user.email}</p>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link href={userId ? `/profile/${userId}` : "/profile"}>
                    <User className="mr-2 h-4 w-4" /> Your profile
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href="/mentorship/requests">Mentorship requests</Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => signOut({ callbackUrl: "/" })}>
                  <LogOut className="mr-2 h-4 w-4" /> Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <Button asChild size="sm">
              <Link href="/auth/signin">Sign in</Link>
            </Button>
          )}
        </div>
      </div>
    </header>
  )
}
