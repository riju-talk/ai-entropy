"use client"

import { useSession, signOut } from "next-auth/react"
import { useAuthModal } from "@/hooks/use-auth-modal"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { useState, useEffect } from "react"
import { Home, HelpCircle, Users, Trophy, Calendar, LogOut, User, Sparkles, Info } from "lucide-react"
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
    {
      href: "/about",
      label: "About",
      icon: Info,
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
    <aside className="hidden lg:flex w-52 xl:w-60 border-r border-white/[0.06] bg-[#08080f]/70 backdrop-blur-xl flex-col min-h-full px-3 xl:px-4 py-6 xl:py-8 relative overflow-y-auto font-mono">
      {/* Main Navigation */}
      <div className="space-y-1">
        <div className="text-[9px] uppercase tracking-[0.25em] text-white/20 px-3 mb-3">// EXPLORE</div>
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
                  "relative flex items-center gap-3 w-full px-3 py-2 rounded-lg transition-all duration-200",
                  isActive
                    ? "text-cyan-400 bg-cyan-500/8"
                    : "text-white/35 hover:text-white/70 hover:bg-white/[0.03]"
                )}
              >
                {isActive && (
                  <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[2px] h-4 rounded-full bg-cyan-400 shadow-[0_0_8px_rgba(6,182,212,0.8)]" />
                )}
                <Icon className={cn("h-[15px] w-[15px] shrink-0", isActive ? "text-cyan-400" : "text-white/30 group-hover:text-white/60")} />
                <span className={cn("text-[11px] tracking-wide truncate", isActive ? "font-bold text-cyan-300" : "font-medium")}>{item.label}</span>
              </div>
            </Link>
          )
        })}
      </div>

      {/* Divider */}
      <div className="my-5 h-px bg-white/[0.05]" />

      {/* Communities Section */}
      <div className="space-y-1 flex-1">
        <div className="text-[9px] uppercase tracking-[0.25em] text-white/20 px-3 mb-3">// COMMUNITIES</div>
        {communities.length > 0 ? (
          communities.slice(0, 5).map((community: any) => (
            <Link key={community.id} href={`/communities/${community.id}`} className="block group">
              <div className="flex items-center gap-2.5 w-full px-3 py-2 rounded-lg text-white/35 hover:text-white/70 hover:bg-white/[0.03] transition-all">
                <div className="w-5 h-5 rounded bg-white/5 border border-white/[0.08] flex items-center justify-center text-[9px] font-bold text-cyan-400/70 group-hover:text-cyan-400 group-hover:border-cyan-500/20 transition-all shrink-0">
                  {community.name?.[0]?.toUpperCase()}
                </div>
                <span className="text-[11px] font-medium truncate group-hover:text-white/70 transition-colors">{community.name}</span>
              </div>
            </Link>
          ))
        ) : (
          <div className="px-3 text-[10px] text-white/15 italic">No communities yet</div>
        )}
      </div>

      {/* User Section */}
      <div className="mt-auto pt-5 border-t border-white/[0.05]">
        {isAuthenticated ? (
          <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3 space-y-3">
            <div className="flex items-center gap-2.5">
              <div className="h-8 w-8 bg-gradient-to-br from-cyan-500 to-blue-600 rounded-lg flex items-center justify-center text-white text-xs font-black shrink-0">
                {userInitial}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[11px] font-bold truncate text-white/80">{displayName}</p>
                <p className="text-[9px] text-white/30 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  Online
                </p>
              </div>
            </div>
            <div className="flex items-center justify-between text-[10px] bg-black/30 rounded-lg px-2.5 py-1.5 border border-white/[0.05]">
              <span className="text-white/30 uppercase tracking-widest text-[9px]">Credits</span>
              <span className="font-mono font-bold text-cyan-400">{credits}</span>
            </div>
            <button
              className="w-full flex items-center justify-center gap-1.5 text-[9px] uppercase tracking-[0.15em] text-white/25 hover:text-red-400 hover:bg-red-500/5 py-1.5 rounded-lg transition-all"
              onClick={handleSignOut}
            >
              <LogOut className="h-3 w-3" />
              Sign out
            </button>
          </div>
        ) : (
          <button
            className="w-full flex items-center justify-center gap-2 h-9 rounded-lg bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 text-[10px] uppercase tracking-[0.15em] font-bold hover:bg-cyan-500/15 hover:border-cyan-400/30 hover:shadow-[0_0_15px_rgba(6,182,212,0.15)] transition-all"
            onClick={openAuthModal}
          >
            <User className="h-3.5 w-3.5" />
            Join Community
          </button>
        )}
      </div>
    </aside>
  )
}