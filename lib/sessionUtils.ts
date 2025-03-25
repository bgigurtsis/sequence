/**
 * Session Utilities
 * 
 * This file contains utilities for managing user sessions, token validation,
 * and authentication states throughout the application.
 */

/**
 * Logs a message with a timestamp for debugging purposes
 */
export function logWithTimestamp(type: string, message: string, data?: any) {
  const timestamp = new Date().toLocaleTimeString();
  const logPrefix = `[${timestamp}][${type}]`;
  
  if (data) {
    console.log(`${logPrefix} ${message}`, data);
  } else {
    console.log(`${logPrefix} ${message}`);
  }
}

/**
 * Validates all tokens including OAuth tokens
 * Includes retry logic and backup validation mechanisms
 */
export async function validateAllTokensWithRetry(maxRetries = 3): Promise<boolean> {
  let attempts = 0;
  
  while (attempts < maxRetries) {
    try {
      logWithTimestamp('VALIDATION', `Token validation attempt ${attempts + 1}/${maxRetries}`);
      
      // Try global window function first (provided by SessionRefresh component)
      if (typeof window !== 'undefined' && window.validateAllTokensForRecording) {
        const isValid = await window.validateAllTokensForRecording();
        if (isValid) {
          logWithTimestamp('VALIDATION', 'Tokens validated successfully');
          return true;
        }
        
        logWithTimestamp('VALIDATION', `Window function validation failed on attempt ${attempts + 1}`);
      } else {
        // Fallback to direct API call if window function isn't available
        try {
          logWithTimestamp('VALIDATION', 'Using direct API call for validation');
          const response = await fetch('/api/auth/refresh-session?checkGoogle=true', {
            method: 'GET',
            credentials: 'include',
            headers: {
              'Content-Type': 'application/json',
              'Cache-Control': 'no-cache, no-store, must-revalidate',
              'Pragma': 'no-cache'
            }
          });
          
          if (!response.ok) {
            logWithTimestamp('VALIDATION', `API validation failed with status ${response.status}`);
            
            // Special handling for auth failure
            if (response.status === 401) {
              logWithTimestamp('VALIDATION', 'Authentication required');
              return false;
            }
          }
          
          const data = await response.json();
          if (data.authenticated && (!data.googleStatus || data.googleStatus.connected)) {
            logWithTimestamp('VALIDATION', 'API validation successful');
            return true;
          }
          
          logWithTimestamp('VALIDATION', 'API validation failed', data);
        } catch (apiError) {
          logWithTimestamp('ERROR', 'Error during API validation', apiError);
        }
      }
      
      // If we reached here, validation failed for this attempt
      
      // Back-off delay between attempts
      const delay = 500 * Math.pow(1.5, attempts);
      logWithTimestamp('VALIDATION', `Retrying in ${delay}ms`);
      await new Promise(resolve => setTimeout(resolve, delay));
      
      attempts++;
    } catch (error) {
      logWithTimestamp('ERROR', `Error during token validation attempt ${attempts + 1}`, error);
      
      // Back-off delay between attempts after error
      const delay = 800 * Math.pow(1.5, attempts);
      logWithTimestamp('VALIDATION', `Retrying after error in ${delay}ms`);
      await new Promise(resolve => setTimeout(resolve, delay));
      
      attempts++;
    }
  }
  
  // All validation attempts failed
  logWithTimestamp('VALIDATION', 'All validation attempts failed');
  return false;
}

/**
 * Checks if the current user session is valid
 * This is a lightweight check that doesn't validate OAuth tokens
 */
export async function isSessionValid(): Promise<boolean> {
  try {
    const response = await fetch('/api/auth/me', {
      method: 'GET',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache, no-store'
      }
    });
    
    if (!response.ok) {
      return false;
    }
    
    const data = await response.json();
    return !!data.userId;
  } catch (error) {
    logWithTimestamp('ERROR', 'Error checking session validity', error);
    return false;
  }
}

/**
 * Adds global validation functions to window object
 * To be used during application initialization
 */
export function registerGlobalValidationFunctions(): void {
  if (typeof window !== 'undefined') {
    // Only register if they don't already exist
    if (!window.validateAllTokensForRecording) {
      // @ts-ignore - Adding to window
      window.validateAllTokensForRecording = () => validateAllTokensWithRetry(3);
    }
  }
}

// Add type definition for global functions
declare global {
  interface Window {
    refreshBeforeCriticalOperation?: (enforceGoogleCheck?: boolean) => Promise<boolean>;
    validateAllTokensForRecording?: () => Promise<boolean>;
  }
} 