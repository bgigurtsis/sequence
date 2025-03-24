'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useUser } from '@clerk/nextjs';

// Add detailed logging helper
function logWithTimestamp(type: string, message: string, data?: any) {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}][AuthCheck][${type}] ${message}`, data ? data : '');
}

export default function AuthCheck() {
    const { isSignedIn, isLoaded } = useUser();
    const router = useRouter();
    const [isChecking, setIsChecking] = useState(false);

    // Periodically check if the auth session is still valid
    useEffect(() => {
        if (!isLoaded) return;

        const checkSession = async () => {
            if (isChecking) return;
            if (!isSignedIn) {
                logWithTimestamp('SESSION', 'User not signed in, redirecting to sign-in page');
                router.push('/sign-in');
                return;
            }

            try {
                setIsChecking(true);
                logWithTimestamp('SESSION', 'Checking session validity');

                // Use the refresh-session endpoint instead of /api/auth/me for more efficient checks
                const response = await fetch('/api/auth/refresh-session', {
                    method: 'GET',
                    credentials: 'include',
                    headers: {
                        'Content-Type': 'application/json',
                        // Add cache control to prevent browsers from caching the response
                        'Cache-Control': 'no-cache, no-store, must-revalidate',
                        'Pragma': 'no-cache',
                        'Expires': '0'
                    }
                });

                if (!response.ok) {
                    if (response.status === 401) {
                        logWithTimestamp('SESSION', 'Session expired, redirecting to sign-in page');
                        // Clear any local auth state
                        sessionStorage.removeItem('lastSessionCheck');
                        sessionStorage.removeItem('userId');
                        localStorage.removeItem('authState');

                        // Show a message and redirect
                        alert('Your session has expired. Please sign in again to continue.');
                        router.push('/sign-in');
                        return;
                    }

                    // For other errors, log but don't redirect
                    logWithTimestamp('SESSION', `Session check failed with status: ${response.status}`);
                } else {
                    const data = await response.json();
                    if (data.success) {
                        logWithTimestamp('SESSION', 'Session is valid');
                        // Store the last successful check time
                        sessionStorage.setItem('lastSessionCheck', new Date().toISOString());
                        // Cache the userId if available
                        if (data.userId) {
                            sessionStorage.setItem('userId', data.userId);
                        }
                    }
                }
            } catch (error) {
                logWithTimestamp('SESSION', 'Error checking session', error);
            } finally {
                setIsChecking(false);
            }
        };

        // Check immediately on component mount
        checkSession();

        // Set up periodic checks
        const intervalId = setInterval(checkSession, 10 * 60 * 1000); // Check every 10 minutes

        return () => {
            clearInterval(intervalId);
        };
    }, [isLoaded, isSignedIn, router]);

    // This component doesn't render anything
    return null;
} 