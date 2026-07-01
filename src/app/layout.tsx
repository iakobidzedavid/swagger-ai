import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Swagger AI — Self-serve branded storefronts',
  description: 'Swag in minutes, not months. Built for People Ops teams.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <header className="site-header">
          <div className="site-header-inner">
            <a href="/" className="site-logo">
              Swagger AI
              <span className="logo-badge">Early access</span>
            </a>
            <nav className="site-nav">
              <a href="/admin/channels">Acquisition channels</a>
              <a href="/onboard">Get Started</a>
            </nav>
          </div>
        </header>

        <main>{children}</main>

        <footer className="site-footer">
          <p>© 2026 Swagger AI · Built for People Ops teams · <a href="/onboard">Get started free</a></p>
        </footer>
      </body>
    </html>
  )
}
