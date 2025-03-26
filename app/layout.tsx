import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import ClientProviders from './ClientProviders';
import MainNavbar from '../components/MainNavbar';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'StageVault',
  description: 'Record and manage your dance rehearsals',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <ClientProviders>
          <MainNavbar />
          <main>
            {children}
          </main>
        </ClientProviders>
      </body>
    </html>
  );
}
