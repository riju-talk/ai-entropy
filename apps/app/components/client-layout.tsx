"use client"

import { usePathname } from "next/navigation"
import { SessionProvider } from "next-auth/react"

import { CommandPalette } from "@/components/command-palette"
import { Footer } from "@/components/footer"
import { Header } from "@/components/header"
import { Sidebar } from "@/components/sidebar"

export function ClientLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const hideFooter = pathname?.startsWith("/ai-agent")
  return (
    <SessionProvider>
      <div className="flex min-h-screen flex-col bg-background">
        <Header />
        <CommandPalette />
        <div className="mx-auto flex w-full max-w-[1800px] flex-1">
          <div className="sticky top-14 hidden h-[calc(100vh-3.5rem)] overflow-y-auto lg:block">
            <Sidebar />
          </div>
          <div className="flex min-w-0 flex-1 flex-col">
            <main id="main" className="flex-1 px-4 py-8 sm:px-6 lg:px-10">
              {children}
            </main>
            {!hideFooter && <Footer />}
          </div>
        </div>
      </div>
    </SessionProvider>
  )
}
