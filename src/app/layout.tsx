import type { Metadata } from 'next'
import './globals.css'
import Sidebar from '@/components/layout/Sidebar'

export const metadata: Metadata = {
  title: 'RescueNet AI — Disaster Response Coordinator',
  description: 'AI-powered disaster response coordination platform built for Google Cloud hackathon',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="flex min-h-screen bg-gray-950">
        <Sidebar />
        <main className="flex-1 ml-[260px] min-h-screen overflow-auto">
          {children}
        </main>
      </body>
    </html>
  )
}