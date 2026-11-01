import Link from "next/link"

export function Footer() {
  return (
    <footer className="border-t px-4 py-6 text-sm text-muted-foreground sm:px-6 lg:px-10">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="font-mono text-xs">&copy; {new Date().getFullYear()} entropy. learn together.</p>
        <nav aria-label="Footer" className="flex flex-wrap gap-x-5 gap-y-1">
          <Link href="/about" className="hover:text-foreground">
            About
          </Link>
          <Link href="/leaderboard" className="hover:text-foreground">
            Leaderboard
          </Link>
          <Link href="/mentorship" className="hover:text-foreground">
            Mentorship
          </Link>
          <Link href="/happenings" className="hover:text-foreground">
            Happenings
          </Link>
        </nav>
      </div>
    </footer>
  )
}
