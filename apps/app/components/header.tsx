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
  ]

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    if (searchQuery.trim()) {
      router.push(`/search?q=${encodeURIComponent(searchQuery.trim())}`)
      setSearchQuery("")
    }
  }

  return (
    <header className="sticky top-0 z-50 w-full border-b border-white/10 bg-background/60 backdrop-blur-xl supports-[backdrop-filter]:bg-background/40">
      <nav className="mx-auto px-4 sm:px-6 lg:px-8 flex h-16 items-center justify-between gap-4 max-w-7xl">
        <div className="flex items-center gap-6 md:gap-10">
          <Link href="/" className="flex items-center space-x-3 group">
            <div className="bg-gradient-to-br from-cyan-400 to-blue-600 p-2 rounded-xl shadow-[0_0_15px_rgba(6,182,212,0.3)] group-hover:shadow-[0_0_25px_rgba(6,182,212,0.5)] transition-all duration-300 transform group-hover:scale-105 group-hover:rotate-3">
              <Brain className="h-5 w-5 text-white" />
            </div>
            <span className="font-semibold text-2xl tracking-tight flex items-center gap-2">
              <span className="bg-clip-text text-transparent bg-gradient-to-r from-foreground to-foreground/80 group-hover:from-cyan-400 group-hover:to-purple-500 transition-all duration-500">
                Entropy
              </span>
              <span
                className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold tracking-widest bg-gradient-to-r from-orange-500 to-red-500 text-white border border-orange-400/30 uppercase shadow-lg animate-pulse"
              >
                BETA VERSION
              </span>
            </span>
          </Link>
          <div className="hidden md:flex gap-6">
            {navigation.map((item) => (
              <Link
                key={item.name}
                href={item.href}
                className={`text-sm font-medium transition-all hover:text-primary hover:drop-shadow-[0_0_8px_rgba(var(--primary),0.5)] ${pathname === item.href ? "text-primary drop-shadow-[0_0_8px_rgba(var(--primary),0.5)]" : "text-muted-foreground"
                  }`}
              >
                {item.name}
              </Link>
            ))}
          </div>
        </div>

        {/* Search Bar */}
        <form onSubmit={handleSearch} className="hidden md:flex flex-1 max-w-sm">
          <div className="relative w-full group">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
            <Input
              type="search"
              placeholder="Search questions, topics..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 pr-4 bg-white dark:bg-secondary/50 border border-slate-200 dark:border-transparent focus:border-cyan-500 focus:bg-white dark:focus:bg-background transition-all duration-300 rounded-full shadow-sm text-slate-900 dark:text-foreground placeholder:text-slate-400 dark:placeholder:text-muted-foreground"
            />
          </div>
        </form>

        <div className="flex items-center gap-3">
          {session ? (
            <>
              <div className="hidden lg:flex items-center gap-4 px-4 py-1.5 bg-secondary/30 rounded-full border border-white/10 shadow-[0_0_15px_rgba(34,211,238,0.1)] hover:shadow-[0_0_20px_rgba(34,211,238,0.2)] transition-all duration-500">
                <div className="flex items-center gap-2 group/coins" title="Entropy Coins">
                  <Coins className="h-4 w-4 text-yellow-500 group-hover/coins:scale-125 transition-transform" />
                  <span className="text-xs font-black tabular-nums">{stats?.user?.credits ?? 0}</span>
                </div>
                <div className="w-px h-3 bg-white/10" />
                <div className="flex flex-col items-center gap-0.5" title={`${stats?.user?.tier ?? "Initiate"} - Level ${stats?.currentLevel ?? 1}`}>
                  <div className="flex items-center gap-1.5">
                    <Trophy className="h-4 w-4 text-cyan-400 animate-pulse" />
                    <span className="text-[10px] font-black uppercase tracking-tighter text-cyan-400">
                      {stats?.user?.tier ?? "Initiate"}
                    </span>
                  </div>
                </div>
                <div className="w-px h-3 bg-white/10" />
                <div className="flex items-center gap-1.5 group/streak" title="Daily Streak">
                  <Flame className={`h-4 w-4 ${stats?.user?.streaks?.currentStreak > 0 ? "text-orange-500 animate-bounce" : "text-muted-foreground"}`} />
                  <span className="text-xs font-black tabular-nums">{stats?.user?.streaks?.currentStreak ?? 0}</span>
                </div>
              </div>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="relative h-8 w-8 rounded-full">
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={session.user?.image || ""} alt={session.user?.name || ""} />
                      <AvatarFallback>{session.user?.name?.[0] || "U"}</AvatarFallback>
                    </Avatar>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-56" align="end" forceMount>
                  <DropdownMenuLabel className="font-normal">
                    <div className="flex flex-col space-y-1">
                      <p className="text-sm font-medium leading-none">{session.user?.name}</p>
                      <p className="text-xs leading-none text-muted-foreground">{session.user?.email}</p>
                    </div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild>
                    <Link href="/profile">
                      <User className="mr-2 h-4 w-4" />
                      <span>Profile</span>
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link href="/profile/settings">
                      <Settings className="mr-2 h-4 w-4" />
                      <span>Settings</span>
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => signOut()}>
                    <LogOut className="mr-2 h-4 w-4" />
                    <span>Log out</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </>
          ) : (
            <Button asChild>
              <Link href="/auth/signin">Sign In</Link>
            </Button>
          )}

          {/* Theme toggle - visible on all sizes */}
          <Button
            variant="ghost"
            size="icon"
            aria-label="Toggle color theme"
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          >
            {mounted && (theme === "dark" ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />)}
          </Button>

          {/* Mobile menu button */}
          <Button
            variant="ghost"
            className="md:hidden"
            size="icon"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          >
            {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </Button>
        </div>
      </nav>

      {mobileMenuOpen && (
        <div className="md:hidden border-t">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 space-y-3">
            {/* Mobile Search */}
            <form onSubmit={handleSearch} className="pb-2">
              <div className="relative w-full">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  type="search"
                  placeholder="Search..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 pr-4"
                />
              </div>
            </form>

            {/* Mobile Navigation Links */}
            {navigation.map((item) => (
              <Link
                key={item.name}
                href={item.href}
                className={`block px-4 py-2 text-sm font-medium rounded-md transition-colors ${pathname === item.href
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted"
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