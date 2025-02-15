import './globals.css';
import { ReactNode } from 'react';
import ClientClerkProviderWrapper from '../components/ClientClerkProviderWrapper';

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <title>Dance Rehearsal App</title>
      </head>
      <body>
        <ClientClerkProviderWrapper>{children}</ClientClerkProviderWrapper>
      </body>
    </html>
  );
}
