import './globals.css';
import { Inter } from 'next/font/google';
import { AuthProvider } from '@/contexts/AuthContext';
import { PerformanceProvider } from '@/contexts/PerformanceContext';
import Navigation from '@/components/Navigation';
import { FirebaseInitializer } from '@/components/FirebaseInitializer';

const inter = Inter({ subsets: ['latin'] });

export const metadata = {
  title: 'StageVault',
  description: 'Manage your performances and recordings',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <FirebaseInitializer />
        <AuthProvider>
          <PerformanceProvider>
            <Navigation />
            <main className="min-h-screen bg-gray-50">
              {children}
            </main>
          </PerformanceProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
