import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { AuthProvider } from '@/contexts/AuthContext';
import { PerformanceProvider } from '@/contexts/PerformanceContext';
import Navigation from '@/components/Navigation';

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
    <AuthProvider>
      <PerformanceProvider>
        <html lang="en">
          <body className={inter.className}>
            <Navigation />
            <main>{children}</main>
          </body>
        </html>
      </PerformanceProvider>
    </AuthProvider>
  );
}
