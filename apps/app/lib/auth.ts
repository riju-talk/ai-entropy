import { NextAuthOptions } from "next-auth"
import GoogleProvider from "next-auth/providers/google"
import GitHubProvider from "next-auth/providers/github"
import CredentialsProvider from "next-auth/providers/credentials"
import { PrismaAdapter } from "@auth/prisma-adapter"

import { prisma } from "@/lib/prisma"

const isProd = process.env.NODE_ENV === "production"

// OAuth providers are only registered when their credentials exist. Registering one with
// undefined credentials makes every sign-in attempt fail with an opaque "Configuration" error.
const googleId = process.env.GOOGLE_CLIENT_ID
const googleSecret = process.env.GOOGLE_CLIENT_SECRET
const githubId = process.env.GITHUB_ID || process.env.GITHUB_CLIENT_ID
const githubSecret = process.env.GITHUB_SECRET || process.env.GITHUB_CLIENT_SECRET

// Demo login (no password) for local development and the Docker demo stack. It can never be on for a
// real deployment: outside `next dev` it also requires NEXTAUTH_URL to point at this machine.
export const DEV_LOGIN_DOMAIN = "@local.dev"
function isLocalUrl(url?: string) {
  try {
    const host = new URL(url || "").hostname
    return host === "localhost" || host === "127.0.0.1" || host === "[::1]"
  } catch {
    return false
  }
}
const devLoginEnabled = process.env.ENABLE_DEV_LOGIN === "true" && (!isProd || isLocalUrl(process.env.NEXTAUTH_URL))

// A missing secret makes NextAuth throw on every request in production; in development fall back to a
// fixed value so the app still starts. Never used when NODE_ENV=production.
const secret = process.env.NEXTAUTH_SECRET || (isProd ? undefined : "dev-only-secret-not-for-production")
if (isProd && !process.env.NEXTAUTH_SECRET) console.error("[auth] NEXTAUTH_SECRET is not set; sign-in will not work")

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma) as any,
  secret,
  providers: [
    ...(devLoginEnabled
      ? [
          CredentialsProvider({
            id: "dev-login",
            name: "Demo login",
            credentials: { email: { label: "Email", type: "text" }, name: { label: "Name", type: "text" } },
            async authorize(credentials) {
              const email = String(credentials?.email || "").trim().toLowerCase()
              if (!/^[a-z0-9._-]+@local\.dev$/.test(email)) return null
              const name = String(credentials?.name || "").trim().slice(0, 80) || email.split("@")[0]
              try {
                const user = await prisma.user.upsert({ where: { email }, update: {}, create: { email, name } })
                return { id: user.id, email: user.email, name: user.name, image: user.image, role: user.role } as any
              } catch (err) {
                console.error("[auth] demo login failed:", (err as Error).message)
                throw new Error("DatabaseUnavailable")
              }
            },
          }),
        ]
      : []),
    ...(googleId && googleSecret ? [GoogleProvider({ clientId: googleId, clientSecret: googleSecret })] : []),
    ...(githubId && githubSecret ? [GitHubProvider({ clientId: githubId, clientSecret: githubSecret })] : []),
  ],
  pages: {
    signIn: "/auth/signin",
    error: "/auth/error",
    newUser: "/",
  },
  session: { strategy: "jwt" },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = (user as any).id
        token.role = (user as any).role ?? "STUDENT"
      }
      return token
    },

    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string
        session.user.role = (token.role as string) ?? "STUDENT"
      }
      return session
    },

    // Link a new OAuth provider to an existing user with the same email instead of failing.
    async signIn({ user, account, profile }) {
      if (!account || account.type !== "oauth") return true
      try {
        const existingAccount = await prisma.account.findUnique({
          where: { provider_providerAccountId: { provider: account.provider, providerAccountId: String(account.providerAccountId) } },
        })
        if (existingAccount) return true

        const email = (profile as any)?.email || user?.email
        if (!email) return true
        const existingUser = await prisma.user.findUnique({ where: { email } })
        if (existingUser) {
          await prisma.account.create({
            data: {
              userId: existingUser.id,
              type: account.type,
              provider: account.provider,
              providerAccountId: String(account.providerAccountId),
              refresh_token: account.refresh_token as string | null,
              access_token: account.access_token as string | null,
              expires_at: account.expires_at ? Number(account.expires_at) : null,
              token_type: account.token_type as string | null,
              scope: account.scope as string | null,
              id_token: account.id_token as string | null,
              session_state: null,
            },
          })
        }
        return true
      } catch (err) {
        console.error("[auth] signIn callback failed:", (err as Error).message)
        // Surfaces as ?error=DatabaseUnavailable on /auth/error instead of a generic AccessDenied
        throw new Error("DatabaseUnavailable")
      }
    },

    async redirect({ url, baseUrl }) {
      if (url.startsWith("/")) return `${baseUrl}${url}`
      try {
        if (new URL(url).origin === baseUrl) return url
      } catch {
        /* malformed url: fall through to home */
      }
      return baseUrl
    },
  },
  debug: process.env.NODE_ENV === "development",
}

/** Which sign-in methods this server actually offers (used by diagnostics and the sign-in page). */
export const enabledAuthMethods = {
  google: !!(googleId && googleSecret),
  github: !!(githubId && githubSecret),
  demo: devLoginEnabled,
}
