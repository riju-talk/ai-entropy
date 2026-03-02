"use client"
import React from "react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { useToast } from "@/hooks/use-toast"
import { AiOutlineLoading3Quarters } from "react-icons/ai"
import { FcGoogle } from "react-icons/fc"
import { FaGithub } from "react-icons/fa"
import { signIn } from "next-auth/react"
import { Chrome, Github } from "lucide-react"

interface AuthModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function AuthModal({ open, onOpenChange }: AuthModalProps) {
  const [isLoading, setIsLoading] = React.useState<string | null>(null)
  const { toast } = useToast()

  const handleSignIn = async (provider: "google" | "github") => {
    setIsLoading(provider)
    try {
      // Debug logs to help trace where auth requests are coming from in the browser.
      try {
        // eslint-disable-next-line no-console
        console.log("auth-modal: starting sign-in", {
          provider,
          href: typeof window !== "undefined" ? window.location.href : null,
          NEXT_PUBLIC_ENABLE_FIREBASE: process.env.NEXT_PUBLIC_ENABLE_FIREBASE,
          NEXT_PUBLIC_FIREBASE_API_KEY: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
        })
      } catch (e) {
        /* ignore */
      }
      // Use next-auth OAuth providers directly. This will redirect the user
      // to the provider's consent screen. After successful auth next-auth
      // will redirect back to the app. We pass a callbackUrl to send users
      // to the subscription page on success.
      await signIn(provider, { callbackUrl: "/subscription" })
    } catch (error) {
      console.error(`${provider} sign-in failed:`, error)
      toast({
        title: `${provider.charAt(0).toUpperCase() + provider.slice(1)} Sign-in Failed`,
        description: `There was an issue signing in with ${provider.charAt(0).toUpperCase() + provider.slice(1)}. Please try again later.`,
        variant: "destructive",
      })
    } finally {
      setIsLoading(null)
    }
  }

  const handleGoogleSignIn = () => {
    // Force landing on home after login
    signIn("google", { callbackUrl: "/" })
  }

  const handleGitHubSignIn = () => {
    // Force landing on home after login
    signIn("github", { callbackUrl: "/" })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="text-2xl">Sign in required</DialogTitle>
          <DialogDescription className="text-base">
            You need to be signed in to perform this action.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <Button
            disabled={!!isLoading}
            onClick={handleGoogleSignIn}
            className="w-full h-12 text-base"
            size="lg"
          >
            {isLoading === "google" ? (
              <>
                <AiOutlineLoading3Quarters className="mr-2 h-4 w-4 animate-spin" />
                Signing In...
              </>
            ) : (
              <>
                <FcGoogle className="mr-2 h-4 w-4" />
                Continue with Google
              </>
            )}
          </Button>
          <Button
            disabled={!!isLoading}
            onClick={handleGitHubSignIn}
            className="w-full h-12 text-base"
            size="lg"
            variant="outline"
          >
            {isLoading === "github" ? (
              <>
                <AiOutlineLoading3Quarters className="mr-2 h-4 w-4 animate-spin" />
                Signing In...
              </>
            ) : (
              <>
                <FaGithub className="mr-2 h-4 w-4" />
                Continue with GitHub
              </>
            )}
          </Button>
          <p className="text-xs text-center text-muted-foreground">
            By continuing, you agree to our Terms of Service and Privacy Policy
          </p>
        </div>
      </DialogContent>
    </Dialog>
  )
}
