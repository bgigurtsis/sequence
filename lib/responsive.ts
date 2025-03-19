// Common responsive utility functions

/**
 * Check if the current device is mobile (client-side only)
 */
export function isMobileDevice(): boolean {
    if (typeof window === 'undefined') return false;
    return window.innerWidth < 768;
}

/**
 * Get device orientation (client-side only)
 */
export function getDeviceOrientation(): 'portrait' | 'landscape' {
    if (typeof window === 'undefined') return 'portrait';
    return window.innerWidth > window.innerHeight ? 'landscape' : 'portrait';
}

/**
 * CSS classes for touch-friendly UI elements
 */
export const touchFriendlyClasses = {
    button: "min-h-[44px] min-w-[44px] flex items-center justify-center",
    input: "min-h-[44px] py-2 px-3",
    link: "py-2 px-3 inline-flex items-center",
    listItem: "min-h-[44px] py-2 px-3"
}; 