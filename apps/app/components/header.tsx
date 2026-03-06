"use client"

import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Input } from "@/components/ui/input"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Brain, Menu, X, User, LogOut, Settings, Search, Sun, Moon, Flame, Trophy, Coins } from "lucide-react"
import { useTheme } from "next-themes"
import { useEffect, useState } from "react"
import { signOut, useSession } from "next-auth/react"

export function Header() {
  const pathname = usePathname()
  const router = useRouter()
  const { data: session } = useSession()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  const [stats, setStats] = useState<any>(null)

  useEffect(() => {
    setMounted(true)
    if (session) {
      fetch("/api/users/me/stats")
        .then((res) => res.json())
        .then((data) => setStats(data))
        .catch(console.error)
    }
  }, [session])

  const navigation = [
    { name: "Community", href: "/communities" },
    { name: "Ask", href: "/ask" },
    { name: "AI Agent", href: "/ai-agent" },
    { name: "Leaderboard", href: "/leaderboard" },
    { name: "About", href: "/about" },
  ]

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    if (searchQuery.trim()) {
      router.push(`/search?q=${encodeURIComponent(searchQuery.trim())}`)
      setSearchQuery("")
    }
  }

  return (
    <header className="sticky top-0 z-50 w-full border-b border-cyan-500/10 bg-[#0a0a0f]/80 backdrop-blur-xl font-mono">
      {/* scan-line accent */}
      <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-cyan-500/40 to-transparent" />
      <nav className="mx-auto px-4 sm:px-6 lg:px-8 flex h-14 items-center justify-between gap-4 max-w-screen-2xl">
        <div className="flex items-center gap-6 md:gap-8">
          <Link href="/" className="flex items-center gap-3 group">
            <div className="relative">
              <div className="bg-cyan-500/10 border border-cyan-500/30 p-2 rounded-lg group-hover:border-cyan-400/60 group-hover:bg-cyan-500/20 group-hover:shadow-[0_0_20px_rgba(6,182,212,0.3)] transition-all duration-300">
                <Brain className="h-5 w-5 text-cyan-400" />
              </div>
              <div className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.8)] animate-pulse" />
            </div>
            <div className="flex flex-col">
              <span className="text-[15px] font-bold tracking-[0.1em] uppercase text-white group-hover:text-cyan-300 transition-colors">
                Entropy
              </span>
              <span className="text-[8px] text-white/30 tracking-[0.25em] uppercase">Cognitive OS · v2.0</span>
            </div>
            <span className="hidden sm:inline-flex items-center px-2 py-0.5 rounded text-[9px] font-bold tracking-widest bg-amber-500/10 text-amber-400 border border-amber-500/20 uppercase">
              BETA
            </span>
          </Link>
          <div className="hidden md:flex gap-1">
            {navigation.map((item) => (
              <Link
                key={item.name}
                href={item.href}
                className={`px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.15em] rounded transition-all ${
                  pathname === item.href
                    ? "text-cyan-400 bg-cyan-500/10 border border-cyan-500/20"
                    : "text-white/40 hover:text-white/70 hover:bg-white/[0.04]"
                }`}
              >
                {item.name}
              </Link>
            ))}
          </div>
        </div>

        {/* Search Bar */}
        <form onSubmit={handleSearch} className="hidden md:flex flex-1 max-w-xs">
          <div className="relative w-full group">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-3.5 w-3.5 text-white/20 group-focus-within:text-cyan-400 transition-colors" />
            <Input
              type="search"
              placeholder="Search questions, topics..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 pr-4 h-8 text-[11px] bg-white/[0.04] border border-white/[0.08] focus:border-cyan-500/40 focus:bg-white/[0.06] rounded-lg placeholder:text-white/20 text-white/70 font-mono transition-all"
            />
          </div>
        </form>

        <div className="flex items-center gap-2">
          {session ? (
            <>
              <div className="hidden lg:flex items-center gap-3 px-3 py-1.5 bg-white/[0.03] rounded-lg border border-white/[0.06] hover:border-cyan-500/20 transition-all">
                <div className="flex items-center gap-1.5" title="Entropy Coins">
                  <Coins className="h-3.5 w-3.5 text-amber-400" />
                  <span className="text-[11px] font-bold tabular-nums text-white/70">{stats?.user?.credits ?? 0}</span>
                </div>
                <div className="w-px h-3 bg-white/10" />
                <div className="flex items-center gap-1.5" title={`${stats?.user?.tier ?? "Initiate"} · Level ${stats?.currentLevel ?? 1}`}>
                  <Trophy className="h-3.5 w-3.5 text-cyan-400" />
                  <span className="text-[10px] font-bold uppercase tracking-widest text-cyan-400">
                    {stats?.user?.tier ?? "Init"}
                  </span>
                </div>
                <div className="w-px h-3 bg-white/10" />
                <div className="flex items-center gap-1.5" title="Daily Streak">
                  <Flame className={`h-3.5 w-3.5 ${(stats?.user?.streaks?.currentStreak ?? 0) > 0 ? "text-orange-400" : "text-white/20"}`} />
                  <span className="text-[11px] font-bold tabular-nums text-white/70">{stats?.user?.streaks?.currentStreak ?? 0}</span>
                </div>
              </div>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="relative h-8 w-8 rounded-lg border border-white/[0.08] bg-white/[0.04] hover:bg-white/[0.08] hover:border-cyan-500/30 p-0 transition-all">
                    <Avatar className="h-6 w-6">
                      <AvatarImage src={session.user?.image || ""} alt={session.user?.name || ""} />
                      <AvatarFallback className="text-[10px] font-bold bg-cyan-500/20 text-cyan-400">{session.user?.name?.[0] || "U"}</AvatarFallback>
                    </Avatar>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-56 bg-[#0f0f1a] border border-white/[0.08] font-mono" align="end" forceMount>
                  <DropdownMenuLabel className="font-normal">
                    <div className="flex flex-col space-y-0.5">
                      <p className="text-sm font-bold text-white">{session.user?.name}</p>
                      <p className="text-[10px] text-white/30">{session.user?.email}</p>
                    </div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator className="bg-white/[0.06]" />
                  <DropdownMenuItem asChild className="text-white/60 hover:text-white focus:text-white">
                    <Link href="/profile">
                      <User className="mr-2 h-3.5 w-3.5" />
                      <span className="text-[11px] uppercase tracking-widest">Profile</span>
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild className="text-white/60 hover:text-white focus:text-white">
                    <Link href="/profile/settings">
                      <Settings className="mr-2 h-3.5 w-3.5" />
                      <span className="text-[11px] uppercase tracking-widest">Settings</span>
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator className="bg-white/[0.06]" />
                  <DropdownMenuItem onClick={() => signOut()} className="text-red-400/70 hover:text-red-400 focus:text-red-400">
                    <LogOut className="mr-2 h-3.5 w-3.5" />
                    <span className="text-[11px] uppercase tracking-widest">Log out</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </>
          ) : (
            <Button asChild size="sm" className="h-8 text-[10px] font-bold uppercase tracking-widest rounded-lg bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 hover:bg-cyan-500/20 hover:border-cyan-400/50 hover:shadow-[0_0_15px_rgba(6,182,212,0.2)] transition-all">
              <Link href="/auth/signin">Sign In</Link>
            </Button>
          )}

          {/* Mobile menu button */}
          <Button
            variant="ghost"
            className="md:hidden h-8 w-8 p-0 border border-white/[0.08] bg-white/[0.04] rounded-lg"
            size="icon"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          >
            {mobileMenuOpen ? <X className="h-4 w-4 text-white/60" /> : <Menu className="h-4 w-4 text-white/60" />}
          </Button>
        </div>
      </nav>

      {mobileMenuOpen && (
        <div className="md:hidden border-t border-white/[0.06] bg-[#0a0a0f]/95">
          <div className="max-w-7xl mx-auto px-4 py-3 space-y-2">
            {/* Mobile Search */}
            <form onSubmit={handleSearch} className="pb-2">
              <div className="relative w-full">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-3.5 w-3.5 text-white/30" />
                <Input
                  type="search"
                  placeholder="Search..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 h-8 text-[11px] bg-white/[0.04] border border-white/[0.08] text-white/70 font-mono"
                />
              </div>
            </form>

            {/* Mobile Navigation Links */}
            {navigation.map((item) => (
              <Link
                key={item.name}
                href={item.href}
                className={`block px-3 py-2 text-[11px] font-bold uppercase tracking-widest rounded-lg transition-all ${
                  pathname === item.href
                    ? "bg-cyan-500/10 text-cyan-400 border border-cyan-500/20"
                    : "text-white/40 hover:text-white/70 hover:bg-white/[0.04]"
                }`}
                onClick={() => setMobileMenuOpen(false)}
              >
                {item.name}
              </Link>
            ))}
          </div>
        </div>
      )}
    </header>
  )
}