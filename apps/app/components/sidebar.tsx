"use client"

import { useSession, signOut } from "next-auth/react"
import { useAuthModal } from "@/hooks/use-auth-modal"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { useState, useEffect } from "react"
import { Home, HelpCircle, Users, Trophy, Calendar, LogOut, Plus, User, Sparkles } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

export function Sidebar() {
  const { data: session, status } = useSession()
  const { open: openAuthModal } = useAuthModal()
  const pathname = usePathname()
  const router = useRouter()

  const isAuthenticated = status === "authenticated"

  const [communities, setCommunities] = useState<any[]>([])
  const [credits, setCredits] = useState<number>(0)

  useEffect(() => {
    const ac = new AbortController()

    fetch("/api/communities", { signal: ac.signal })
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => setCommunities(Array.isArray(data) ? data : []))
      .catch((err: any) => {
        if (err?.name !== "AbortError") console.error(err)
      })

    if (isAuthenticated && session?.user?.email) {
      fetch("/api/users/me/credits", { signal: ac.signal })
        .then((res) => (res.ok ? res.json() : { credits: 0 }))
        .then((d: any) => setCredits(typeof d?.credits === "number" ? d.credits : 0))
        .catch((err: any) => {
          if (err?.name !== "AbortError") console.error(err)
        })
    } else {
      setCredits(0)
    }

    return () => ac.abort()
  }, [isAuthenticated, session?.user?.email])

  const navItems = [
    {
      href: "/",
      label: "Home",
      icon: Home,
    },
    {
      href: "/ask",
      label: "Ask question",
      icon: HelpCircle,
      protected: true,
    },
    {
      href: "/ai-agent",
      label: "Spark AI",
      icon: Sparkles,
    },
    {
      href: "/mentorship",
      label: "Mentorship",
      icon: Users,
    },
    {
      href: "/leaderboard",
      label: "Leaderboard",
      icon: Trophy,
    },
    {
      href: "/happenings",
      label: "Happenings",
      icon: Calendar,
    },
  ]

  const handleProtectedClick = (e: React.MouseEvent, href: string, isProtected?: boolean) => {
    if (isProtected && !isAuthenticated) {
      e.preventDefault()
      openAuthModal()
    }
  }

  const handleSignOut = async () => {
    try {
      await signOut({ redirect: false })
      router.push("/")
    } catch (err) {
      console.error("Sign out error", err)
    }
  }

  const userInitial = session?.user?.name?.charAt(0) ?? session?.user?.email?.charAt(0) ?? ""
  const displayName = session?.user?.name ?? session?.user?.email ?? ""

  return (
    <aside className="hidden lg:flex w-56 xl:w-64 border-r border-white/5 bg-background/60 backdrop-blur-xl flex-col min-h-full px-4 xl:px-6 py-6 xl:py-8 relative overflow-y-auto group/sidebar">
      {/* Sidebar specific glow - Visible only in Dark Mode */}
      <div className="absolute top-0 right-0 w-[50%] h-[50%] bg-primary/5 blur-[80px] pointer-events-none -z-10 hidden dark:block" />

      {/* Main Navigation */}
      <div className="space-y-4 xl:space-y-6">
        <h2 className="text-[10px] font-black text-muted-foreground uppercase tracking-widest pl-3 xl:pl-4">
          Explore
        </h2>
        <div className="space-y-1.5 xl:space-y-2">
          {navItems.map((item) => {
            const Icon = item.icon
            const isActive = item.href === "/" ? pathname === "/" : pathname?.startsWith(item.href)
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={(e) => handleProtectedClick(e, item.href, item.protected)}
                className="block group"
              >
                <div
                  className={cn(
                    "flex items-center gap-2 xl:gap-3 w-full px-3 xl:px-4 py-2.5 xl:py-3 rounded-xl xl:rounded-2xl transition-all duration-300 relative overflow-hidden",
                    isActive
                      ? "bg-gradient-to-r from-cyan-500/10 to-blue-500/10 text-cyan-400 font-bold shadow-[0_0_20px_rgba(6,182,212,0.15)] border border-cyan-500/20"
                      : "text-muted-foreground hover:text-foreground hover:bg-white/5 hover:translate-x-1"
                  )}
                >
                  <Icon className={cn("h-4 w-4 xl:h-5 xl:w-5 transition-transform group-hover:scale-110", isActive && "text-cyan-400")} />
                  <span className="text-xs xl:text-sm tracking-tight truncate">{item.label}</span>
                  {item.comingSoon && (
                    <Badge variant="outline" className="ml-auto text-[8px] xl:text-[9px] bg-purple-500/10 text-purple-400 border-purple-500/20 uppercase tracking-widest shrink-0">
                      Soon
                    </Badge>
                  )}
                </div>
              </Link>
            )
          })}
        </div>
      </div>

      {/* Communities Section */}
      <div className="mt-6 xl:mt-8">
        <h2 className="text-[10px] font-black text-muted-foreground uppercase tracking-widest pl-3 xl:pl-4">
          Communities
        </h2>
        <div className="space-y-1.5 xl:space-y-2 mt-3 xl:mt-4">
          {communities.length > 0 ? (
            communities.slice(0, 5).map((community: any) => (
              <Link
                key={community.id}
                href={`/communities/${community.id}`}
                className="block group"
              >
                <div className="flex items-center gap-2 xl:gap-3 w-full px-3 xl:px-4 py-2 rounded-lg xl:rounded-xl text-muted-foreground hover:text-foreground hover:bg-white/5 transition-all relative">
                  <div className="w-7 h-7 xl:w-8 xl:h-8 rounded-lg bg-white/5 flex items-center justify-center text-[9px] xl:text-[10px] font-bold text-cyan-400 border border-white/5 group-hover:border-cyan-500/30 group-hover:bg-cyan-500/10 transition-all shrink-0">
                    {community.name?.[0]?.toUpperCase()}
                  </div>
                  <span className="text-xs xl:text-sm font-medium truncate group-hover:text-cyan-200 transition-colors">{community.name}</span>
                </div>
              </Link>
            ))
          ) : (
            <div className="px-3 xl:px-4 text-[10px] xl:text-xs text-muted-foreground/50 italic">No communities yet</div>
          )}
        </div>
      </div>

      {/* User Section */}
      <div className="mt-auto pt-4 xl:pt-6">
        {isAuthenticated ? (
          <Card className="bg-gradient-to-br from-background to-white/5 border-white/10 overflow-hidden relative group hover:border-cyan-500/30 transition-all duration-500">
            <CardContent className="p-2.5 xl:p-3 space-y-2.5 xl:space-y-3 relative z-10">
              <div className="flex items-center gap-2 xl:gap-3">
                <div className="h-9 w-9 xl:h-10 xl:w-10 bg-gradient-to-tr from-cyan-500 to-blue-600 rounded-lg xl:rounded-xl flex items-center justify-center text-white text-xs xl:text-sm font-bold shadow-lg shadow-cyan-500/20 shrink-0">
                  {userInitial}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs xl:text-sm font-bold truncate text-foreground">{displayName}</p>
                  <p className="text-[9px] xl:text-[10px] text-muted-foreground font-medium flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 shadow-[0_0_8px_rgba(6,182,212,0.8)] animate-pulse" />
                    Explorer
                  </p>
                </div>
              </div>
              <div className="flex items-center justify-between text-[10px] xl:text-xs bg-black/40 rounded-lg p-1.5 xl:p-2 border border-white/5">
                <span className="text-muted-foreground font-medium">Credits</span>
                <span className="font-mono font-bold text-cyan-400">{credits}</span>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="w-full h-7 xl:h-8 text-[9px] xl:text-[10px] uppercase tracking-wider hover:bg-red-500/10 hover:text-red-400 transition-colors"
                onClick={handleSignOut}
              >
                <LogOut className="h-3 w-3 mr-1.5 xl:mr-2" />
                Sign out
              </Button>
            </CardContent>
          </Card>
        ) : (
          <Button
            variant="default"
            size="sm"
            className="w-full h-10 xl:h-11 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-bold shadow-[0_0_20px_rgba(6,182,212,0.3)] hover:shadow-[0_0_30px_rgba(6,182,212,0.5)] transition-all duration-300 rounded-xl text-xs xl:text-sm"
            onClick={openAuthModal}
          >
            <User className="h-4 w-4 xl:h-5 xl:w-5 mr-1.5 xl:mr-2" />
            Join Community
          </Button>
        )}
      </div>
    </aside>
  )
}