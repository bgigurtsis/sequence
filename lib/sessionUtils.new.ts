/**
 * Session Utilities
 * 
 * Simplified utilities for session-related functionality.
 */

/**
 * Logs a message with a timestamp for debugging purposes
 */
export function logWithTimestamp(type: string, message: string, data?: any) {
  const timestamp = new Date().toISOString();
  const logPrefix = `[${timestamp}][${type}]`;
  
  if (data) {
    console.log(`${logPrefix} ${message}`, data);
  } else {
    console.log(`${logPrefix} ${message}`);
  }
}

/**
 * Check if the current environment is client-side
 */
export function isClientSide(): boolean {
  return typeof window !== 'undefined';
} 