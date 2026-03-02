// lib/auth.ts
import { NextAuthOptions } from "next-auth"
import GoogleProvider from "next-auth/providers/google"
import GitHubProvider from "next-auth/providers/github"
import { PrismaAdapter } from "@auth/prisma-adapter"
import { PrismaClient } from "@prisma/client"

// Local Prisma singleton
let __prisma__: PrismaClient | undefined
function getPrisma() {
  if (!__prisma__) {
    __prisma__ = new PrismaClient({ log: ["error", "warn"] })
  }
  return __prisma__
}

const prisma = getPrisma()

// Prefer GITHUB_ID/SECRET but also support *_CLIENT_* fallbacks
const githubId = process.env.GITHUB_ID || process.env.GITHUB_CLIENT_ID
const githubSecret = process.env.GITHUB_SECRET || process.env.GITHUB_CLIENT_SECRET

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma) as any,
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
    ...(githubId && githubSecret
      ? [
          GitHubProvider({
            clientId: githubId,
            clientSecret: githubSecret,
          }),
        ]
      : []),
  ],
  pages: {
    signIn: "/auth/signin",
    error: "/auth/error",
    newUser: "/", // new accounts land on home
  },
  session: {
    strategy: "jwt",
  },
  callbacks: {
    // persist user id/role into the token
    async jwt({ token, user }) {
      if (user) {
        ;(token as any).id = (user as any).id
        ;(token as any).role = (user as any).role ?? "STUDENT"
      }
      return token
    },

    // expose token props on session.user
    async session({ session, token }) {
      if (session.user) {
        ;(session.user as any).id = (token as any).id
        ;(session.user as any).role = (token as any).role ?? "STUDENT"
      }
      return session
    },

    // attempt to link OAuth account to existing user by email when appropriate
    async signIn({ user, account, profile }) {
      try {
        // Only proceed for OAuth providers
        if (!account || account.type !== "oauth") return true

        // If account already exists, allow sign in
        const existingAccount = await prisma.account.findUnique({
          where: {
            provider_providerAccountId: {
              provider: account.provider,
              providerAccountId: String(account.providerAccountId),
            },
          },
        })
        if (existingAccount) return true

        // If user email present, try to find user by email
        const email = (profile as any)?.email || user?.email
        if (!email) return true // no email to match — proceed (NextAuth will create user)

        const existingUser = await prisma.user.findUnique({ where: { email } })
        if (existingUser) {
          // Link the new provider account to the existing user
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
          return true
        }

        // No existing user — let adapter/createUser handle a new user
        return true
      } catch (err) {
        console.error("signIn callback error:", err)
        return false
      }
    },

    // redirect to callbackUrl if specified, otherwise home
    async redirect({ url, baseUrl }) {
      // Allows relative callback URLs
      if (url.startsWith("/")) return `${baseUrl}${url}`
      // Allows callback URLs on the same origin
      else if (new URL(url).origin === baseUrl) return url
      return baseUrl
    },
  },
  debug: process.env.NODE_ENV === "development",
}

// Helpful diagnostics in dev
if (process.env.NODE_ENV === "development") {
  console.log("NextAuth config:", {
    GITHUB_ID: !!githubId,
    GITHUB_SECRET: !!githubSecret,
    GOOGLE_CLIENT_ID: !!process.env.GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET: !!process.env.GOOGLE_CLIENT_SECRET,
    NEXTAUTH_SECRET: !!process.env.NEXTAUTH_SECRET,
  })
}
