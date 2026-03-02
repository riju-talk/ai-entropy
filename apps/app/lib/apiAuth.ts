import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import { NextRequest } from "next/server"

export interface AuthUser {
  id: string
  email: string
  name?: string
  uid: string // For backwards compatibility with Firebase-style code
}

/**
 * Get the authenticated user from NextAuth session
 * Works with both API routes and server components
 */
export async function getAuthUser(req?: NextRequest): Promise<AuthUser | null> {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.id) {
      return null
    }

    return {
      id: session.user.id,
      email: session.user.email!,
      name: session.user.name || undefined,
      uid: session.user.id, // Use NextAuth user ID as uid
    }
  } catch (error) {
    console.error("Error getting auth user:", error)
    return null
  }
}

/**
 * Require authentication for API routes
 * Throws an error if user is not authenticated
 */
export async function requireAuth(req: Request): Promise<AuthUser> {
  const user = await getAuthUser()
  
  if (!user) {
    throw new Error("Authentication required")
  }

  return user
}

/**
 * Check if user is authenticated (returns boolean)
 */
export async function isAuthenticated(req?: NextRequest): Promise<boolean> {
  const user = await getAuthUser(req)
  return !!user
}