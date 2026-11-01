import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { getToken } from "next-auth/jwt"

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Protected routes that require authentication
  // Prefix matches. Profiles at /profile/<id> and question pages at /doubt/<id> are public;
  // only the exact paths below need a session.
  const protectedPrefixes = ['/create-community', '/ai-agent', '/ask', '/study', '/mentorship/register', '/mentorship/requests', '/profile/achievements']
  const protectedExact = ['/profile']

  if (protectedExact.includes(pathname) || protectedPrefixes.some(route => pathname.startsWith(route))) {
    try {
      // Check for NextAuth JWT token with proper secret
      const token = await getToken({ 
        req: request as any,
        secret: process.env.NEXTAUTH_SECRET,
        secureCookie: (process.env.NEXTAUTH_URL || "").startsWith("https://"),
      })
      
      if (!token) {
        // Store the attempted URL to redirect back after login
        const signInUrl = new URL('/auth/signin', request.url)
        signInUrl.searchParams.set('callbackUrl', pathname)
        return NextResponse.redirect(signInUrl)
      }
    } catch (error) {
      console.error('Middleware auth check error:', error)
      // On error, redirect to signin to be safe
      const signInUrl = new URL('/auth/signin', request.url)
      signInUrl.searchParams.set('callbackUrl', pathname)
      return NextResponse.redirect(signInUrl)
    }
  }

  // Add security headers for API routes
  if (pathname.startsWith("/api/")) {
    const response = NextResponse.next()

    // Security headers
    response.headers.set("X-Frame-Options", "DENY")
    response.headers.set("X-Content-Type-Options", "nosniff")
    response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin")

    return response
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
}
