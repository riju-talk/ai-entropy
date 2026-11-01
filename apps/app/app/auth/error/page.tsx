import Link from "next/link"

import { Button } from "@/components/ui/button"
import { authErrorMessage } from "@/lib/auth-errors"

export const metadata = { title: "Sign-in problem" }

export default function AuthErrorPage({ searchParams }: { searchParams: { error?: string } }) {
  return (
    <div className="mx-auto max-w-lg py-16">
      <p className="eyebrow mb-3">Sign-in problem</p>
      <h1 className="font-display text-4xl">We could not sign you in</h1>
      <p className="mt-4 text-muted-foreground">{authErrorMessage(searchParams.error)}</p>
      <div className="mt-8 flex gap-3">
        <Button asChild>
          <Link href="/auth/signin">Try again</Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="/">Back home</Link>
        </Button>
      </div>
    </div>
  )
}
