'use client';
import React from 'react';
import { ClerkProvider } from '@clerk/nextjs';

export default function ClientClerkProviderWrapper({ children }: { children: React.ReactNode }) {
  return <ClerkProvider>{children}</ClerkProvider>;
}
