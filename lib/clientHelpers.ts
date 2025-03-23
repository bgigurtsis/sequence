// This file is used on the client side only - no server imports here

export async function hasGoogleConnection(): Promise<boolean> {
    try {
        const response = await fetch('/api/auth/google-status', {
            method: 'GET',
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json',
            },
            credentials: 'include', // Include credentials if needed
        });

        // Log the response for debugging
        console.log('Google status response:', {
            status: response.status,
            statusText: response.statusText,
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const contentType = response.headers.get('content-type');
        if (!contentType || !contentType.includes('application/json')) {
            throw new Error(`Expected JSON but got ${contentType}`);
        }

        const text = await response.text(); // Get the raw text first
        console.log('Response text:', text); // Log it for debugging

        try {
            const data = JSON.parse(text);
            return data.connected || false;
        } catch (e) {
            console.error('JSON parse error:', e);
            throw new Error('Invalid JSON response');
        }
    } catch (error) {
        console.error('Error checking Google connection:', error);
        return false;
    }
}

export async function getGoogleTokens() {
    try {
        const response = await fetch('/api/auth/google-tokens', {
            method: 'GET',
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json',
            },
            credentials: 'include',
        });

        if (!response.ok) {
            return null;
        }

        const data = await response.json();
        return data;
    } catch (error) {
        console.error('Error getting Google tokens:', error);
        return null;
    }
} 