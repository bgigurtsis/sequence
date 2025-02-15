// app/layout.tsx
import './globals.css';
import { ReactNode } from 'react';
import dynamic from 'next/dynamic';

const ClerkProviderWrapper = dynamic(() => import('../components/ClerkProviderWrapper'), { ssr: false });

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <title>Dance Rehearsal App</title>
      </head>
      <body>
        <ClerkProviderWrapper>{children}</ClerkProviderWrapper>
      </body>
    </html>
  );
}
