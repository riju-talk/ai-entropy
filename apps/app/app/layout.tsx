import type React from "react"
import type { Metadata, Viewport } from "next"
import { Fraunces, Instrument_Sans, JetBrains_Mono } from "next/font/google"
import "./globals.css"
import { ThemeProvider } from "@/components/theme-provider"
import { AuthProvider } from "@/components/auth-provider"
import { Toaster } from "@/components/ui/toaster"
import { AuthModalProvider } from "@/components/auth-modal-provider"
import { ClientLayout } from "@/components/client-layout"
import { ErrorBoundary } from "@/components/error-boundary"

const sans = Instrument_Sans({ subsets: ["latin"], display: "swap", variable: "--font-sans" })
const serif = Fraunces({ subsets: ["latin"], display: "swap", variable: "--font-serif", axes: ["opsz"] })
const mono = JetBrains_Mono({ subsets: ["latin"], display: "swap", variable: "--font-mono" })

export const metadata: Metadata = {
  title: {
    default: "Entropy - Academic community platform",
    template: "%s | Entropy",
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
  authors: [{ name: "Entropy Team" }],
  creator: "Entropy",
  publisher: "Entropy",
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_APP_URL || "https://entropy-community.vercel.app"
  ),
  alternates: {
    canonical: "/",
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "/",
    title: "Entropy - Academic community platform",
    description:
      "A comprehensive academic community platform for STEM learning, doubt resolution, and collaborative education.",
    siteName: "Entropy",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "Entropy - Academic community platform",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Entropy - Academic community platform",
    description:
      "A comprehensive academic community platform for STEM learning, doubt resolution, and collaborative education.",
    images: ["/og-image.png"],
    creator: "@entropy_app",
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
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f7f4ee" },
    { media: "(prefers-color-scheme: dark)", color: "#151311" },
  ],
}

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className={`${sans.variable} ${serif.variable} ${mono.variable}`} suppressHydrationWarning>
      <head>
        <link rel="manifest" href="/manifest.json" />
        <link rel="apple-touch-icon" href="/icon-192x192.png" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="Entropy" />
        <meta name="msapplication-tap-highlight" content="no" />
        <link rel="icon" href="/favicon.ico" />
      </head>
      <body className="min-h-screen bg-background text-foreground antialiased">
        <a href="#main" className="skip-link">Skip to content</a>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
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
