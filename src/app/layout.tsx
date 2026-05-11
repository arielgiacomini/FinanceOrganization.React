import type { Metadata } from 'next'
import './globals.css'
import { Sidebar } from '@/components/layout/Sidebar'

export const metadata: Metadata = {
  title: 'Finance Organization',
  description: 'Controle financeiro pessoal',
  viewport: 'width=device-width, initial-scale=1',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>
        <div className="min-h-screen">
          <Sidebar />
          {/* Desktop: margem esquerda para sidebar fixa */}
          {/* Mobile: padding top para a topbar fixa */}
          <main className="lg:ml-64 pt-14 lg:pt-0 min-h-screen">
            <div className="p-4 md:p-6 lg:p-8 animate-fade-in">
              {children}
            </div>
          </main>
        </div>
      </body>
    </html>
  )
}
