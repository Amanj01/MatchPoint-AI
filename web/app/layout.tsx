import type { Metadata } from 'next';
import { Bricolage_Grotesque, DM_Sans } from 'next/font/google';
import { Nav } from '@/components/Nav';
import { Providers } from '@/components/Providers';
import './globals.css';

const display = Bricolage_Grotesque({ subsets: ['latin'], variable: '--font-display', weight: ['500', '700', '800'] });
const body = DM_Sans({ subsets: ['latin'], variable: '--font-body' });

export const metadata: Metadata = {
  title: 'MatchPoint AI: AI-written CVs and smart job matching',
  description: 'Build your CV with an AI agent, get matched to jobs, and help employers find the right people.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${display.variable} ${body.variable}`}>
      <body>
        <Providers>
          <Nav />
          {children}
          <footer className="footer">
            <div>
              <strong>MatchPoint AI</strong> · University project · CVs by AI, matches by explainable scoring
            </div>
            <div className="muted">All companies and people in this demo are fictional.</div>
          </footer>
        </Providers>
      </body>
    </html>
  );
}
