'use client';
import { useEffect } from 'react';

function logWithTimestamp(label: string, msg: string, data?: any) {
    const t = new Date().toISOString();
    console.log(`[${t}][SessionRefresh][${label}] ${msg}`, data || '');
}

export default function SessionRefresh() {
    useEffect(() => {
        const refreshSession = async () => {
            try {
                const res = await fetch('/api/auth/refresh-session', {
                    method: 'GET',
                    credentials: 'include',
                    headers: { 'Content-Type': 'application/json' }
                });
                logWithTimestamp('REFRESH', 'Called refresh endpoint', {
                    status: res.status,
                });
            } catch (err) {
                logWithTimestamp('REFRESH', 'Error refreshing session', err);
            }
        };

        // Refresh every 5 minutes
        const interval = setInterval(refreshSession, 5 * 60 * 1000);
        return () => clearInterval(interval);
    }, []);

    return null; // nothing rendered
} 