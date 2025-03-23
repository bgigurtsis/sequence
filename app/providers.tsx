'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { GoogleDriveProvider } from '@/contexts/GoogleDriveContext';
import { ReactNode, useState } from 'react';

export function Providers({ children }: { children: ReactNode }) {
    const [queryClient] = useState(
        () =>
            new QueryClient({
                defaultOptions: {
                    queries: {
                        staleTime: 5 * 60 * 1000, // 5 minutes
                        refetchOnWindowFocus: false,
                    },
                },
            })
    );

    return (
        <QueryClientProvider client={queryClient}>
            <GoogleDriveProvider>
                {children}
            </GoogleDriveProvider>
        </QueryClientProvider>
    );
} 