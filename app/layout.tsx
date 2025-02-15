import { ClerkProvider } from '@clerk/nextjs';
import './globals.css';
import { ReactNode } from 'react';

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <ClerkProvider>
      <html lang="en">
        <head>
          <title>Dance Rehearsal App</title>
        </head>
        <body>{children}</body>
      </html>
    </ClerkProvider>
  );
}
