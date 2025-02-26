import type { Metadata } from 'next';
import { ClerkProvider } from '@clerk/nextjs';
import { Inter } from 'next/font/google';
import './globals.css';
import { GoogleDriveProvider } from '@/contexts/GoogleDriveContext';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'StageVault',
  description: 'Record and manage your dance rehearsals',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <ClerkProvider>
        <GoogleDriveProvider>
          <body className={inter.className}>{children}</body>
        </GoogleDriveProvider>
      </ClerkProvider>
    </html>
  );
}
