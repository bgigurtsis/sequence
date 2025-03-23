// utils/fetchWithAuth.ts

/**
 * Wrapper for fetch that handles authentication
 * Redirects to sign-in page if unauthorized
 */
export async function fetchWithAuth(url: string, options: RequestInit = {}) {
    const response = await fetch(url, options);

    if (response.status === 401) {
        // Get current path to redirect back after login
        const currentPath = encodeURIComponent(window.location.pathname + window.location.search);

        // Log the auth error
        console.log(`[Auth] Unauthorized access to ${url}, redirecting to sign-in`);

        // Redirect to sign-in page with return URL
        window.location.href = `/sign-in?returnUrl=${currentPath}`;

        throw new Error("Authentication required - redirecting to login");
    }

    return response;
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

    return await response.json();
}