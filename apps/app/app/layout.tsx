import type React from "react"
import type { Metadata, Viewport } from "next"
import { JetBrains_Mono } from "next/font/google"
import { Inter } from "next/font/google"
import "./globals.css"
import { ThemeProvider } from "@/components/theme-provider"
import { AuthProvider } from "@/components/auth-provider"
import { Toaster } from "@/components/ui/toaster"
import { AuthModalProvider } from "@/components/auth-modal-provider"
import { ClientLayout } from "@/components/client-layout"
import { ErrorBoundary } from "@/components/error-boundary"

const inter = Inter({ subsets: ["latin"], display: "swap", variable: "--font-inter" })
const jetbrains = JetBrains_Mono({ subsets: ["latin"], display: "swap", variable: "--font-jetbrains" })

export const metadata: Metadata = {
  title: {
    default: "Novyra - Academic community platform",
    template: "%s | Novyra",
  },
  description:
    "A comprehensive academic community platform for STEM learning, doubt resolution, and collaborative education. Connect with students, educators, and experts worldwide.",
  keywords: [
    "academic",
    "education",
    "STEM",
    "learning",
    "community",
    "doubts",
    "questions",
    "answers",
    "collaboration",
  ],
  authors: [{ name: "Novyra Team" }],
  creator: "Novyra",
  publisher: "Novyra",
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_APP_URL || "https://novyra-community-forum.vercel.app"
  ),
  alternates: {
    canonical: "/",
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "/",
    title: "Novyra - Academic community platform",
    description:
      "A comprehensive academic community platform for STEM learning, doubt resolution, and collaborative education.",
    siteName: "Novyra",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "Novyra - Academic community platform",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Novyra - Academic community platform",
    description:
      "A comprehensive academic community platform for STEM learning, doubt resolution, and collaborative education.",
    images: ["/og-image.png"],
    creator: "@novyra",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
  themeColor: [{ color: "black" }],
}

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className={`${inter.variable} ${jetbrains.variable}`} suppressHydrationWarning>
      <head>
        <link rel="manifest" href="/manifest.json" />
        <link rel="apple-touch-icon" href="/icon-192x192.png" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="Novyra" />
        <meta name="msapplication-TileColor" content="#000000" />
        <meta name="msapplication-tap-highlight" content="no" />
        <meta name="theme-color" content="#000000" />
        <meta name="color-scheme" content="dark" />
        <link rel="icon" href="/favicon.ico" />
      </head>
      <body className={`${inter.variable} antialiased bg-background dark`}>
        <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false} disableTransitionOnChange>
          <AuthProvider>
            <ErrorBoundary>
              <ClientLayout>{children}</ClientLayout>
              <Toaster />
              <AuthModalProvider />
            </ErrorBoundary>
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
