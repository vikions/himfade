import type { Metadata } from 'next';
import { GeistSans } from 'geist/font/sans';
import { GeistMono } from 'geist/font/mono';
import '@solana/wallet-adapter-react-ui/styles.css';
import './globals.css';
import { AppProviders } from './providers';
import { getPublicEnv } from '@/config/env';

export const metadata: Metadata = {
  title: 'Fade Him — Reverse the questionable trade',
  description: 'A Nado-first interface for taking the other side of a curated public position.',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const env = getPublicEnv();
  return (
    <html lang="en" className={`${GeistSans.variable} ${GeistMono.variable}`}>
      <body>
        <AppProviders env={env}>{children}</AppProviders>
      </body>
    </html>
  );
}
