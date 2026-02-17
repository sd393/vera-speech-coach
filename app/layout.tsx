import React from "react"
import type { Metadata, Viewport } from 'next'
import { Libre_Caslon_Text, IBM_Plex_Mono } from 'next/font/google'

import { AuthProvider } from '@/contexts/auth-context'
import './globals.css'

const libreCaslon = Libre_Caslon_Text({
  subsets: ['latin'],
  weight: ['400', '700'],
  style: ['normal', 'italic'],
  variable: '--font-display',
  display: 'swap',
})

const plexMono = IBM_Plex_Mono({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700'],
  variable: '--font-mono',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'Demian - Rehearse with an AI audience',
  description:
    'Demian simulates your target audience and gives detailed, personalized feedback on your presentations. Think of it as a rehearsal room powered by AI.',
}

export const viewport: Viewport = {
  themeColor: '#0891b2',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" className={`${libreCaslon.variable} ${plexMono.variable}`}>
      <body className="font-sans antialiased">
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  )
}
