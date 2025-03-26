# Application Documentation

## Architectural Analysis (High-Level)

### Authentication and Sessions

- Uses Clerk for user management and session handling (including OAuth flows).
- Provides API endpoints that handle:
  - Exchanging Google OAuth codes for tokens
  - Storing refresh tokens in Clerk metadata
  - Checking/disconnecting the Google integration
  - Retrieving session/user information
- Google OAuth logic has been centralized in a dedicated `googleOAuthManager.ts` utility
- API endpoints follow conventional Next.js App Router structure with individual route handlers
- Authentication and error handling has been standardized across all routes with shared utilities:
  - `lib/server/auth.ts` provides functions like `requireAuth()`, `tryRefreshSession()`, and `validateUserSession()`
  - `lib/server/apiUtils.ts` provides the `withErrorHandling()` wrapper for consistent error handling
  - `lib/logging.ts` provides standardized logging with environment-aware verbosity control
- Current authentication flow experiences 401 errors that are being addressed (see Project Milestones)

### Google Drive Integration

The app obtains a user's Google OAuth refresh token and uses it to store/retrieve recordings on their personal Google Drive.

The Google Drive integration is centralized in a dedicated `GoogleDriveService` module (`/lib/GoogleDriveService.ts`), which handles:

1. **Authentication**: Using the centralized `googleOAuthManager` to obtain tokens and create authenticated clients.
2. **Folder Management**: Creating, finding, and ensuring folders exist for the root app folder and individual performance folders.
3. **File Operations**: Uploading, listing, and deleting files, including handling file metadata.
4. **Error Handling**: Comprehensive error capture, logging, and recovery mechanisms.
5. **Logging**: Detailed timestamped logging at various stages (start, progress, success, error, info) for debugging and monitoring.

The service provides both client-side and server-side functionality in a unified API:
- `uploadFile` - Client-side focused for Blob uploads with metadata
- `uploadFileWithBuffer` - Server-side focused for Buffer uploads
- `createFolder`, `listFiles`, `getFile`, `deleteFile` - Core operations available to both client and server

The service retrieves OAuth tokens through the `googleOAuthManager`, which interfaces with Clerk's OAuth token wallet. All operations are logged with a consistent format that includes timestamps and operation status.

Files are structured in a parent "StageVault Recordings" directory, with nested subfolders for Performances and Rehearsals. Metadata is attached to files using Google Drive's appProperties system.

The UI surfaces "Connected" vs. "Not Connected" states for Drive and allows the user to connect/disconnect.

### Google OAuth Manager

A centralized utility (`/lib/googleOAuthManager.ts`) handles all Google OAuth operations:

1. **Token Management**: Retrieving, refreshing, and validating Google OAuth tokens.
2. **Connection Status**: Checking if a user has connected their Google account.
3. **Auth URL Generation**: Creating URLs for Google OAuth flows (initial connection and reconnection).
4. **Auth Client Creation**: Building authenticated Google API clients for API operations.
5. **Error Handling**: Comprehensive error handling with detailed logging.

This utility provides a single source of truth for all Google OAuth operations, eliminating code duplication and ensuring consistent behavior.

### Shared Server Utilities

Common functionality has been consolidated into shared utilities:

#### Authentication (`lib/server/auth.ts`)

- `getCachedAuth()`: Retrieves authentication information with caching to prevent redundant calls
- `requireAuth()`: Returns userId if authenticated or responds with a 401 error
- `tryRefreshSession()`: Attempts to refresh the session token for operations requiring fresh authentication
- `validateUserSession()`: Provides detailed session validation with configurable behavior

#### Error Handling (`lib/server/apiUtils.ts`)

- `withErrorHandling()`: A wrapper for route handlers that provides consistent error handling and response formatting
- `extractPathParams()`: Helper to extract path parameters from dynamic routes

#### Logging (`lib/logging.ts`)

- `log()`: A centralized logging function with environment-aware filtering and formatting
- `generateRequestId()`: Creates unique request IDs for tracking requests through logs
- `requestCache`: Helps prevent duplicate processing of the same request

These utilities ensure consistent handling of common patterns throughout the application and reduce code duplication.

### API Structure

- API routes follow the standard Next.js 13 App Router structure with dedicated files for each endpoint
- Routes are organized by feature area (auth, upload, delete, etc.)
- All routes use the shared utilities for authentication, error handling, and logging
- The structure improves maintainability and testability vs. the previous catch-all approach

### Core Data Entities & Flows

- **Performances** → can have multiple **Rehearsals** → each Rehearsal can have multiple **Recordings**
- Endpoints and UI components coordinate the creation, update, and deletion of these items
- Local metadata is stored (e.g., performanceId, rehearsalId, recordingId) to keep track of the Google Drive folder structure and file references
- SyncService handles the synchronization of recordings to Google Drive

### UI/UX

- Built on Next.js with React and Clerk's out-of-the-box components for sign-up/sign-in flows
- Main functionality includes:
  - Capturing video via the browser (camera input)
  - Uploading that captured video and optional thumbnail to Google Drive
  - Searching/filtering performances, listing recordings, playing them (via a video player)
- TailwindCSS is used for styling, with consistent implementation of utility classes

## File/Folder Structure (Next.js App Router)

- **/app/**: Page routes using Next.js App Router
- **/app/api/**: API routes organized by feature area
  - **/app/api/auth/**: Authentication-related endpoints
  - **/app/api/upload/**: File upload endpoints
  - **/app/api/delete/**: File deletion endpoints
  - **/app/api/drive/**: Google Drive-specific endpoints
- **/components/**: UI building blocks (dialog, forms, video recorder, etc.)
- **/lib/**: Shared logic, including:
  - **GoogleDriveService.ts**: Centralized Google Drive functionality for both client and server
  - **googleOAuthManager.ts**: Centralized Google OAuth utilities
  - **logging.ts**: Shared logging utilities
  - **server/auth.ts**: Authentication helpers for server components
  - **server/apiUtils.ts**: API route utilities including error handling
- **/contexts/**: React context providers (e.g., PerformanceContext, GoogleDriveContext)

## Current Development Focus

The application is currently addressing authentication flow issues that cause 401 Unauthorized errors during the recording upload process. This involves:

1. Fixing how Clerk authentication tokens are passed to API routes
2. Ensuring consistent auth header handling
3. Implementing proper error recovery mechanisms
4. Improving user feedback when authentication issues occur

See the project milestones document for detailed information about the current fix implementation plan.

## Overall Application Flow

1. User logs in (via Google or standard Clerk sign-in)
2. User creates or selects a Performance → Rehearsal → Recording
3. User records a video or uploads one
4. Video and metadata are automatically saved to the user's Google Drive
5. On re-login, user can see existing data from Google Drive (and metadata stored in Clerk)

## API Endpoints

### Auth Endpoints
- `GET /api/auth/me` - Get current user and Google connection status
- `GET /api/auth/google-status` - Check Google connection status
- `GET /api/auth/google-auth-url` - Generate Google auth URL
- `POST /api/auth/google-disconnect` - Disconnect Google account
- `POST /api/auth/session` - Create a new session
- `GET /api/auth/refresh-session` - Refresh the session

### Upload Endpoints
- `POST /api/upload` - Upload a file
- `POST /api/upload/form` - Upload a file with form data

### Delete Endpoint
- `DELETE /api/delete` - Delete a file or item

### Google Drive Endpoints
- `POST /api/drive/upload` - Upload a file directly to Google Drive

## Known Issues

- Authentication flow occasionally fails with 401 errors when uploading recordings
- Fallback to performanceId when user authentication fails creates potential security concerns
- Error handling for authentication failures needs improvement