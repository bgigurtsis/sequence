/**
 * Shared logging utility for API routes
 */

/**
 * Log a message with timestamp, module, and level
 * @param module The module name (e.g., 'api', 'auth', 'upload')
 * @param level The log level (e.g., 'info', 'error', 'warning')
 * @param message The message to log
 * @param data Optional data to include in the log
 */
export function log(module: string, level: string, message: string, data?: any): void {
    // Only log errors and warnings in production, all logs in development
    const isProd = process.env.NODE_ENV === 'production';
    const logLevel = level.toLowerCase();
    
    // Skip verbose logs in production
    if (isProd && logLevel === 'info' && !message.includes('error') && !message.includes('fail')) {
        return;
    }
    
    const timestamp = new Date().toISOString();
    
    // Simplify data logging in production
    let logData = data;
    if (isProd && data) {
        // For requests, don't log full headers and bodies
        if (message.includes('Request') && typeof data === 'object') {
            logData = { url: data.url };
        } else if (typeof data === 'object' && data !== null) {
            // For other data, only include essential properties
            const essentialKeys = ['userId', 'sessionId', 'error', 'status', 'success', 'requestId'];
            const simplifiedData: Record<string, any> = {};
            
            for (const key of essentialKeys) {
                if (key in data) {
                    simplifiedData[key] = data[key];
                }
            }
            
            logData = Object.keys(simplifiedData).length > 0 ? simplifiedData : null;
        }
    }
    
    // Use appropriate console method based on log level
    const prefix = `[${timestamp}][${module}][${level.toUpperCase()}]`;
    
    if (logLevel === 'error') {
        console.error(`${prefix} ${message}`, logData ? (typeof logData === 'string' ? logData : JSON.stringify(logData, null, 2)) : '');
    } else if (logLevel === 'warning' || logLevel === 'warn') {
        console.warn(`${prefix} ${message}`, logData ? (typeof logData === 'string' ? logData : JSON.stringify(logData, null, 2)) : '');
    } else {
        console.log(`${prefix} ${message}`, logData ? (typeof logData === 'string' ? logData : JSON.stringify(logData, null, 2)) : '');
    }
}

/**
 * Generate a unique request ID for tracking
 * @param method The HTTP method
 * @param path The request path
 * @returns A unique request ID
 */
export function generateRequestId(method: string, path: string): string {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 8);
    return `${method}-${path}-${timestamp}-${random}`;
}

/**
 * Request tracking cache to prevent duplicate processing
 */
export const requestCache = {
    processedRequests: new Map<string, number>(),
    
    /**
     * Check if a request has been processed before
     * @param requestId The request ID
     * @returns true if the request is a duplicate, false otherwise
     */
    checkDuplicate(requestId: string): boolean {
        if (this.processedRequests.has(requestId)) {
            const count = this.processedRequests.get(requestId) || 0;
            this.processedRequests.set(requestId, count + 1);
            
            // If we've seen it before, it's a duplicate
            return count > 0;
        }
        
        // First time seeing this request
        this.processedRequests.set(requestId, 1);
        
        // Clean up old requests if cache is getting too large
        if (this.processedRequests.size > 100) {
            const keysToDelete = Array.from(this.processedRequests.keys()).slice(0, 50);
            keysToDelete.forEach(key => this.processedRequests.delete(key));
        }
        
        return false;
    }
}; 