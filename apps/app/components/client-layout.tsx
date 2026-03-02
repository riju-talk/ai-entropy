"use client"

import { SessionProvider } from "next-auth/react"
import { Header } from "@/components/header"
import { Sidebar } from "@/components/sidebar"

export function ClientLayout({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <div className="flex flex-col h-screen bg-background relative selection:bg-cyan-500 selection:text-white font-sans overflow-hidden">
        {/* 'Campify' Global Background - Dark Mode Only */}
        <div className="fixed inset-0 z-0 pointer-events-none bg-background hidden dark:block">
          <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-purple-600/10 rounded-full blur-[120px] animate-pulse"></div>
          <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-cyan-600/10 rounded-full blur-[120px] animate-pulse delay-700"></div>
          <div className="absolute top-[20%] right-[20%] w-[30%] h-[30%] bg-blue-600/5 rounded-full blur-[100px]"></div>
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