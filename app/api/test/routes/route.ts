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
    
    // List of all API routes
    const routes = {
        auth: [
            { method: 'GET', path: '/api/auth/me', description: 'Get current user info' },
            { method: 'GET', path: '/api/auth/google-status', description: 'Check Google connection status' },
            { method: 'GET', path: '/api/auth/google-auth-url', description: 'Generate Google auth URL' },
            { method: 'POST', path: '/api/auth/google-disconnect', description: 'Disconnect Google account' },
            { method: 'POST', path: '/api/auth/session', description: 'Create a new session' },
            { method: 'GET', path: '/api/auth/refresh-session', description: 'Refresh session' },
            { method: 'GET', path: '/api/auth/user', description: 'Get user details' },
            { method: 'POST', path: '/api/auth/logout', description: 'Logout user' }
        ],
        upload: [
            { method: 'POST', path: '/api/upload', description: 'Upload a file' },
            { method: 'POST', path: '/api/upload/form', description: 'Upload a file with form data' },
        ],
        delete: [
            { method: 'DELETE', path: '/api/delete', description: 'Delete an item' }
        ],
        drive: [
            { method: 'POST', path: '/api/drive/upload', description: 'Upload a file to Google Drive' }
        ],
        test: [
            { method: 'GET', path: '/api/test/routes', description: 'List available API routes' }
        ]
    };
    
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
        
        ${Object.entries(routes).map(([category, endpoints]) => `
            <h2>${category.toUpperCase()} Endpoints</h2>
            <table>
                <tr>
                    <th>Method</th>
                    <th>Path</th>
                    <th>Description</th>
                </tr>
                ${endpoints.map(endpoint => `
                    <tr>
                        <td class="method ${endpoint.method.toLowerCase()}">${endpoint.method}</td>
                        <td class="path">${endpoint.path}</td>
                        <td>${endpoint.description}</td>
                    </tr>
                `).join('')}
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