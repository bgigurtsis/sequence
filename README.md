# Sequence App

A video recording and management application for performances and rehearsals, with Google Drive integration for cloud storage.

## Getting Started

### Installation

1. Clone the repository
2. Install dependencies:

```bash
npm install
```

3. Create a `.env.local` file based on the `.env.example` file

### Google Drive Integration Setup

To enable Google Drive synchronization:

1. Go to the [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Enable the Google Drive API
4. Create OAuth 2.0 Client ID credentials
5. Add the authorized redirect URIs for your application
6. Set the following environment variables in your `.env.local` file:
   - `GOOGLE_CLIENT_ID`
   - `GOOGLE_CLIENT_SECRET`
   - `NEXT_PUBLIC_BASE_URL`

### Development

Run the development server:

```bash
npm run dev
```

### Troubleshooting Google Drive Integration

If you're experiencing issues with Google Drive synchronization:

1. Check if the Google Drive API is enabled in your Google Cloud Console
2. Verify that your OAuth credentials are correct
3. Ensure your redirect URIs are properly configured
4. Look for error messages in the browser console and server logs
5. Use the "Test Connection" button to diagnose OAuth connection issues

### File Structure

- `/app` - Next.js App Router pages and API routes
- `/components` - React components
- `/contexts` - React context providers
- `/lib` - Utility functions and helpers
  - `/lib/googleOAuthManager.ts` - Centralized Google OAuth utilities
  - `/lib/GoogleDriveService.ts` - Unified Google Drive operations for both client and server
- `/services` - Client-side services like sync and storage
- `/types` - TypeScript type definitions

## Architecture

### Key Components

- **Authentication**: Uses Clerk for authentication and session management
  - Shared authentication utilities in `lib/server/auth.ts` provide consistent auth checks and session handling
  - Centralized Google OAuth operations in `lib/googleOAuthManager.ts`

- **API Routes**: Next.js App Router API routes organized by feature area
  - Common error handling with `withErrorHandling()` wrapper from `lib/server/apiUtils.ts`
  - Consistent logging with `log()` function from `lib/logging.ts`
  - Request tracking with unique request IDs

- **Google Drive Integration**: Unified `GoogleDriveService` handles Drive operations
  - File uploads, downloads, and metadata management
  - Folder structure creation and management
  - Error handling with informative messages

- **Recording**: Browser-based video recording with MediaRecorder API
  - Direct uploading to Google Drive
  - Background sync for offline operation

### Shared Utilities

The application uses several shared utilities for common operations:

- **Authentication Utilities** (`lib/server/auth.ts`):
  - `requireAuth()`: Returns userId or responds with 401 error
  - `tryRefreshSession()`: Attempts to refresh the auth token
  - `validateUserSession()`: Comprehensive session validation

- **API Utilities** (`lib/server/apiUtils.ts`):
  - `withErrorHandling()`: Consistent error handling for API routes
  - `extractPathParams()`: Extract parameters from URL paths

- **Logging Utilities** (`lib/logging.ts`):
  - `log()`: Centralized logging with environment-aware filtering
  - `generateRequestId()`: Creates unique request IDs for tracking

### API Routes

The app uses Next.js App Router API routes organized by feature area:

- **Auth API routes**:
  - `/api/auth/me` - Get current user info
  - `/api/auth/google-status` - Check Google OAuth connection status
  - `/api/auth/google-auth-url` - Generate Google Auth URL
  - `/api/auth/google-disconnect` - Disconnect Google account
  - `/api/auth/session` - Create a new session
  - `/api/auth/refresh-session` - Refresh the session
  - `/api/auth/user` - Get user details
  - `/api/auth/logout` - Logout user

- **Upload API routes**:
  - `/api/upload` - Upload a file
  - `/api/upload/form` - Upload a file with form data

- **Delete API route**:
  - `/api/delete` - Delete an item

- **Google Drive API routes**:
  - `/api/drive/upload` - Upload a file directly to Google Drive

For testing and exploration, visit `/api/test/routes` to see a list of all available endpoints.

## Features

- Record videos directly in the browser
- Upload existing video files
- Add external video links
- Organize videos by performances and rehearsals
- Add metadata to recordings
- Synchronize recordings with Google Drive
- Google OAuth integration for secure Drive access
- Offline-first approach - work even without internet
- Background synchronization when online
