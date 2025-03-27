// utils/fetchWithAuth.ts

/**
 * Wrapper for fetch that handles authentication
 * Redirects to sign-in page if unauthorized
 */
export async function fetchWithAuth(url: string, options: RequestInit = {}) {
    try {
        const response = await fetch(url, options);

        if (response.status === 401) {
            // Get current path to redirect back after login
            const currentPath = encodeURIComponent(window.location.pathname + window.location.search);
            
            // Log the auth error with timestamp
            const timestamp = new Date().toISOString();
            console.error(`[${timestamp}][Auth] Unauthorized access to ${url}, redirecting to sign-in`);

            // Redirect to sign-in page with return URL
            window.location.href = `/sign-in?returnUrl=${currentPath}`;

            throw new Error("Authentication required - redirecting to sign-in");
        }

        return response;
    } catch (error) {
        // If it's our auth error, just re-throw it
        if (error instanceof Error && error.message.includes('Authentication required')) {
            throw error;
        }
        
        // Log network or other errors
        const timestamp = new Date().toISOString();
        console.error(`[${timestamp}][FetchError] Error fetching ${url}:`, error);
        
        // Re-throw for caller to handle
        throw error;
    }
}

/**
 * JSON fetch with authentication handling
 */
export async function fetchJsonWithAuth<T>(url: string, options: RequestInit = {}): Promise<T> {
    const response = await fetchWithAuth(url, {
        ...options,
        headers: {
            ...options.headers,
            'Content-Type': 'application/json',
            'Accept': 'application/json'
        }
    });

    try {
        return await response.json();
    } catch (error) {
        const timestamp = new Date().toISOString();
        console.error(`[${timestamp}][JSONError] Failed to parse JSON from ${url}:`, error);
        throw new Error(`Failed to parse JSON response from ${url}`);
    }
}