"use client"

import { SessionProvider } from "next-auth/react"
import { Header } from "@/components/header"
import { Sidebar } from "@/components/sidebar"

export function ClientLayout({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <div className="flex flex-col h-screen bg-background relative selection:bg-cyan-500 selection:text-white font-sans overflow-hidden">
        {/* Global Background */}
        <div className="fixed inset-0 z-0 pointer-events-none bg-[#06060a]">
          {/* Dot grid */}
          <div className="absolute inset-0 bg-dot-grid opacity-100" />

          {/* Bubble 1 — orange */}
          <div className="bubble-a absolute top-[10%] left-[15%] w-[420px] h-[420px] rounded-full bg-orange-500/14 blur-[100px]" />
          {/* Bubble 2 — blue */}
          <div className="bubble-b absolute top-[55%] left-[60%] w-[480px] h-[480px] rounded-full bg-blue-500/12 blur-[110px]" />
          {/* Bubble 3 — yellow */}
          <div className="bubble-c absolute top-[30%] right-[10%] w-[340px] h-[340px] rounded-full bg-yellow-400/10 blur-[90px]" />
          {/* Bubble 4 — purple */}
          <div className="bubble-d absolute bottom-[5%] left-[5%] w-[400px] h-[400px] rounded-full bg-purple-600/13 blur-[105px]" />
          {/* Bubble 5 — orange+yellow mix */}
          <div className="bubble-e absolute top-[70%] left-[40%] w-[300px] h-[300px] rounded-full bg-amber-500/10 blur-[80px]" />
          {/* Bubble 6 — deep blue accent */}
          <div className="bubble-a absolute top-[5%] right-[25%] w-[260px] h-[260px] rounded-full bg-indigo-500/10 blur-[85px]" style={{animationDelay: '-9s', animationDuration: '21s'}} />
        </div>

        <div className="relative z-10 flex flex-col h-screen">
          <Header />
          <div className="flex flex-1 overflow-hidden">
            {/* Fixed Sidebar - Desktop only */}
            <div className="hidden md:flex md:flex-shrink-0">
              <div className="w-64 h-full overflow-y-auto scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
                <Sidebar />
              </div>
            </div>
            {/* Scrollable Main Content */}
            <main className="flex-1 overflow-y-auto overflow-x-hidden scrollbar-thin scrollbar-thumb-cyan-500/20 scrollbar-track-transparent hover:scrollbar-thumb-cyan-500/40 transition-colors">
              <div className="px-4 sm:px-6 lg:px-12 py-6 sm:py-8">
                {children}
              </div>
            </main>
          </div>
        </div>
      </div>
    </SessionProvider>
  )
}