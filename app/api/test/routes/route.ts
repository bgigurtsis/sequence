import { NextRequest, NextResponse } from 'next/server';
import { log, generateRequestId } from '@/lib/logging';

/**
 * GET /api/test/routes - Test API routes
 * 
 * This is a helper endpoint that returns a list of all available API routes
 * to make it easier to test the API during development.
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
    const requestId = generateRequestId('GET', 'test/routes');
    log('test', 'info', 'GET /api/test/routes called', { requestId, url: request.url });
    
    // Define all API routes for documentation and testing purposes
    const routes = [
        // Authentication routes
        { method: 'GET', path: '/api/auth/google-status', description: 'Check Google OAuth connection status' },
        { method: 'GET', path: '/api/auth/google-auth-url', description: 'Get a Google OAuth URL for authentication' },
        { method: 'GET', path: '/api/auth/refresh-session', description: 'Refresh the current session' },
        { method: 'GET', path: '/api/auth/google-reconnect', description: 'Get a URL to reconnect Google OAuth' },
        
        // Upload routes
        { method: 'POST', path: '/api/upload/form', description: 'Upload a file to Google Drive with form data' },
        
        // Other routes
        { method: 'GET', path: '/api/test/routes', description: 'Get a list of all API routes (this endpoint)' },
    ];
    
    // Build HTML for a prettier response in browser
    const html = `
    <!DOCTYPE html>
    <html>
    <head>
        <title>API Routes Test</title>
        <style>
            body { font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 1200px; margin: 0 auto; padding: 20px; }
            h1 { color: #333; }
            h2 { color: #555; margin-top: 30px; }
            table { border-collapse: collapse; width: 100%; }
            th, td { text-align: left; padding: 12px; }
            th { background-color: #f2f2f2; }
            tr:nth-child(even) { background-color: #f8f8f8; }
            .method { font-weight: bold; }
            .get { color: #00aa00; }
            .post { color: #0000aa; }
            .delete { color: #aa0000; }
            .path { font-family: monospace; }
        </style>
    </head>
    <body>
        <h1>API Routes Test</h1>
        <p>The following API routes are available for testing:</p>
        
        ${routes.map((endpoint, index) => `
            <h2>Route ${index + 1}</h2>
            <table>
                <tr>
                    <th>Method</th>
                    <th>Path</th>
                    <th>Description</th>
                </tr>
                <tr>
                    <td class="method ${endpoint.method.toLowerCase()}">${endpoint.method}</td>
                    <td class="path">${endpoint.path}</td>
                    <td>${endpoint.description}</td>
                </tr>
            </table>
        `).join('')}
    </body>
    </html>
    `;
    
    // Return HTML for browser viewing or JSON based on Accept header
    const acceptHeader = request.headers.get('accept');
    if (acceptHeader?.includes('text/html')) {
        return new NextResponse(html, {
            headers: { 'Content-Type': 'text/html' }
        });
    }
    
    return NextResponse.json({ routes });
}

export const dynamic = 'force-dynamic'; 