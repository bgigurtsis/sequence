import type { Metadata } from 'next';
import { ClerkProvider } from '@clerk/nextjs';
import { Inter } from 'next/font/google';
import './globals.css';
import { Providers } from './providers';
import { Navigation } from './components/Navigation';

const inter = Inter({ subsets: ['latin'] });

// Move metadata to a separate file since we're using 'use client'
export const metadata: Metadata = {
  title: 'StageVault',
  description: 'Record and manage your dance rehearsals',
};

// Update the RootLayout component to include navigation
export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <ClerkProvider>
          <Providers>
            <Navigation />
            {children}
          </Providers>
        </ClerkProvider>
      </body>
    </html>
  );
}

// Add this to enable client-side rendering of Clerk components
export const dynamic = 'force-dynamic';
