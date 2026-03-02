"use client"

import { AuthModal } from "@/components/auth-modal"
import { useAuthModal } from "@/hooks/use-auth-modal"

export function AuthModalProvider() {
  const { isOpen, close } = useAuthModal()

  return <AuthModal open={isOpen} onOpenChange={close} />
}
