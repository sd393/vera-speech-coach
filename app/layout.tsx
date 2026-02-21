import React from "react"
import type { Metadata, Viewport } from 'next'
import { Libre_Caslon_Text } from 'next/font/google'
import { Toaster } from 'sonner'

import { AuthProvider } from '@/contexts/auth-context'
import './globals.css'

const libreCaslon = Libre_Caslon_Text({
  subsets: ['latin'],
  weight: ['400', '700'],
  style: ['normal', 'italic'],
  variable: '--font-display',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'Vera - Rehearse with an AI audience',
  description:
    'Vera simulates your target audience and gives detailed, personalized feedback on your presentations. Think of it as a rehearsal room powered by AI.',
}

export const viewport: Viewport = {
  themeColor: '#191B1A',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" className={libreCaslon.variable}>
      <body className="font-sans antialiased">
        <AuthProvider>{children}</AuthProvider>
        <Toaster theme="dark" />
      </body>
    </html>
  )
}
