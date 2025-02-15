// app/layout.tsx
import './globals.css';
import { ReactNode } from 'react';

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <title>Dance Rehearsal App</title>
      </head>
      <body>
        {children}
      </body>
    </html>
  );
}
