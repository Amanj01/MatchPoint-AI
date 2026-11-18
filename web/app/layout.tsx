import type { Metadata } from 'next';
import { Nav } from '@/components/Nav';
import { Providers } from '@/components/Providers';
import './globals.css';

// Font: Apple system font (SF Pro) via the -apple-system stack in globals.css; no web fonts to download.

export const metadata: Metadata = {
  title: 'MatchPoint: CVs and job matching',
  description: 'Build your CV with an AI agent, get matched to jobs, and help employers find the right people.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Providers>
          <Nav />
          {children}
          <footer className="footer">
            <div>
              <strong>MatchPoint</strong> · University project
            </div>
            <div className="muted">All companies and people in this demo are fictional.</div>
          </footer>
        </Providers>
      </body>
    </html>
  );
}
