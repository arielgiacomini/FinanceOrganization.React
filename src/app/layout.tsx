import type { Metadata, Viewport } from 'next'
import './globals.css'
import { LayoutShell } from '@/components/layout/LayoutShell'

export const metadata: Metadata = {
  title: 'Finance Organization',
  description: 'Controle financeiro pessoal',
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>
        <LayoutShell>{children}</LayoutShell>
      </body>
    </html>
  )
}
