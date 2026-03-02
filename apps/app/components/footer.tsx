import Link from "next/link"
import { Badge } from "@/components/ui/badge"

export function Footer() {
  return (
    <footer className="border-t border-white/5 bg-card/60 backdrop-blur-sm">
      <div className="container mx-auto px-4 sm:px-6 py-6 sm:py-8">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 sm:gap-8">
          {/* Brand */}
          <div className="text-center sm:text-left">
            <div className="mb-3 sm:mb-4">
              <div className="flex items-center gap-2 justify-center sm:justify-start">
                <div className="h-5 w-5 sm:h-6 sm:w-6 rounded bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center text-white font-bold text-[10px] sm:text-xs shadow-[0_0_10px_rgba(6,182,212,0.4)]">
                  E
                </div>
                <span className="font-bold text-base sm:text-lg">Novyra</span>
                <Badge variant="secondary" className="text-[10px] sm:text-xs">Alpha</Badge>
              </div>
            </div>
            <p className="text-xs sm:text-sm text-muted-foreground">
              A community-driven platform for students and educators.
            </p>
          </div>

          {/* Product */}
          <div className="text-center sm:text-left">
            <h3 className="font-semibold text-sm mb-2 sm:mb-3">Product</h3>
            <ul className="space-y-1.5 sm:space-y-2 text-xs sm:text-sm text-muted-foreground">
              <li><Link href="/" className="hover:text-cyan-400 transition-colors">Questions</Link></li>
              <li><Link href="/ai-agent" className="hover:text-cyan-400 transition-colors">AI Agent</Link></li>
              <li><Link href="/leaderboard" className="hover:text-cyan-400 transition-colors">Leaderboard</Link></li>
            </ul>
          </div>

          {/* Company */}
          <div className="text-center sm:text-left">
            <h3 className="font-semibold text-sm mb-2 sm:mb-3">Company</h3>
            <ul className="space-y-1.5 sm:space-y-2 text-xs sm:text-sm text-muted-foreground">
              <li><Link href="/about" className="hover:text-cyan-400 transition-colors">About</Link></li>
              <li><Link href="/contact" className="hover:text-cyan-400 transition-colors">Contact</Link></li>
              <li><Link href="/careers" className="hover:text-cyan-400 transition-colors">Careers</Link></li>
            </ul>
          </div>

          {/* Legal */}
          <div className="text-center sm:text-left">
            <h3 className="font-semibold text-sm mb-2 sm:mb-3">Legal</h3>
            <ul className="space-y-1.5 sm:space-y-2 text-xs sm:text-sm text-muted-foreground">
              <li><Link href="/privacy" className="hover:text-cyan-400 transition-colors">Privacy</Link></li>
              <li><Link href="/terms" className="hover:text-cyan-400 transition-colors">Terms</Link></li>
              <li><Link href="/cookies" className="hover:text-cyan-400 transition-colors">Cookies</Link></li>
            </ul>
          </div>
        </div>

        <div className="mt-6 sm:mt-8 pt-4 sm:pt-6 border-t border-white/5 text-center text-xs sm:text-sm text-muted-foreground">
          <p>© {new Date().getFullYear()} Novyra Community Forum. All rights reserved.</p>
        </div>
      </div>
    </footer>
  )
}
