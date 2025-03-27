# Application Documentation

## Architectural Analysis (High-Level)

### Authentication and Sessions

- Uses Clerk for user management and session handling (including OAuth flows).
- Provides streamlined API endpoints that handle:
  - Exchanging Google OAuth codes for tokens
  - Storing refresh tokens in Clerk metadata
  - Checking/disconnecting the Google integration
  - Retrieving session/user information
- Authentication follows React best practices with the `useAuthStatus` hook for client-side authentication checks
- Google OAuth logic has been fully centralized in a dedicated `googleOAuthManager.ts` utility
- API endpoints follow conventional Next.js App Router structure with individual route handlers
- Authentication and error handling has been standardized across all routes with shared utilities:
  - `lib/server/auth.ts` provides functions like `requireAuth()`, `tryRefreshSession()`, and `validateUserSession()`
  - `lib/server/apiUtils.ts` provides the `withErrorHandling()` wrapper for consistent error handling
  - `lib/logging.ts` provides standardized logging with environment-aware verbosity control
- Authentication flow has been simplified by removing global function dependencies and redundant components

### Google Drive Integration

The app obtains a user's Google OAuth refresh token and uses it to store/retrieve recordings on their personal Google Drive.

The Google Drive integration is centralized in a dedicated `GoogleDriveService` module (`/lib/GoogleDriveService.ts`), which handles:

1. **Authentication**: Using the centralized `googleOAuthManager` to obtain tokens and create authenticated clients.
2. **Folder Management**: Creating, finding, and ensuring folders exist for the root app folder and individual performance folders.
3. **File Operations**: Uploading, listing, deleting files, including handling file metadata.
4. **Error Handling**: Comprehensive error capture, logging, and recovery mechanisms.
5. **Logging**: Detailed timestamped logging at various stages (start, progress, success, error, info) for debugging and monitoring.

The service provides both client-side and server-side functionality in a unified API:
- `uploadFile` - Client-side focused for Blob uploads with metadata
- `uploadFileWithBuffer` - Server-side focused for Buffer uploads
- `createFolder`, `listFiles`, `getFile`, `deleteFile` - Core operations available to both client and server

All Drive API calls are now consistently routed through the `GoogleDriveService`, ensuring proper error handling and authentication.

### Google OAuth Manager

A fully centralized utility (`/lib/googleOAuthManager.ts`) now handles ALL Google OAuth operations:

1. **Token Management**: Retrieving, refreshing, and validating Google OAuth tokens.
2. **Connection Status**: Checking if a user has connected their Google account.
3. **Auth URL Generation**: Creating URLs for Google OAuth flows (initial connection and reconnection).
4. **Auth Client Creation**: Building authenticated Google API clients for API operations.
5. **OAuth Code Exchange**: Processing authorization codes and exchanging them for tokens.
6. **Error Handling**: Comprehensive error handling with detailed logging.

This utility provides a single source of truth for all Google OAuth operations, eliminating code duplication and ensuring consistent behavior across both client and server components.

### Context Structure

The application state has been refactored into a more modular structure with focused contexts:

1. **PerformanceDataContext**: Manages core data for performances, rehearsals, and recordings.
2. **UIStateContext**: Handles UI-related state like search queries, selected performance, and filtered recordings.
3. **ModalContext**: Controls visibility of various modals (recorder, metadata form, performance form, etc.).
4. **EditStateContext**: Manages state for editing performances, rehearsals, and recordings.

The original `PerformanceContext` has been refactored to be a thin wrapper that combines these specialized contexts, maintaining backward compatibility while improving maintainability and performance through more granular updates.

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
- Routes have been consolidated and cleaned up, removing redundant endpoints
- All authentication UI routes now consistently use `/sign-in` and `/sign-up` paths
- All routes use the shared utilities for authentication, error handling, and logging
- Upload functionality has been consolidated into the `/api/upload/form` endpoint
- The structure improves maintainability and testability vs. the previous catch-all approach

### Core Data Entities & Flows

- **Performances** → can have multiple **Rehearsals** → each Rehearsal can have multiple **Recordings**
- Endpoints and UI components coordinate the creation, update, and deletion of these items
- Local metadata is stored (e.g., performanceId, rehearsalId, recordingId) to keep track of the Google Drive folder structure and file references
- SyncService handles the synchronization of recordings to Google Drive with improved authentication handling

### UI/UX

- Built on Next.js with React and Clerk's out-of-the-box components for sign-up/sign-in flows
- Authentication UI has been streamlined with consistent paths and improved error handling
- Main functionality includes:
  - Capturing video via the browser (camera input)
  - Uploading that captured video and optional thumbnail to Google Drive
  - Searching/filtering performances, listing recordings, playing them (via a video player)
- TailwindCSS is used for styling, with consistent implementation of utility classes

## File/Folder Structure (Next.js App Router)

- **/app/**: Page routes using Next.js App Router
- **/app/api/**: API routes organized by feature area
  - **/app/api/auth/**: Authentication-related endpoints (simplified)
  - **/app/api/upload/**: Consolidated file upload endpoint
  - **/app/api/delete/**: File deletion endpoint (now using GoogleDriveService)
- **/components/**: UI building blocks (dialog, forms, video recorder, etc.)
- **/lib/**: Shared logic, including:
  - **GoogleDriveService.ts**: Unified Google Drive functionality without OAuth methods
  - **googleOAuthManager.ts**: Fully centralized Google OAuth utilities
  - **logging.ts**: Shared logging utilities
  - **server/auth.ts**: Authentication helpers for server components
  - **server/apiUtils.ts**: API route utilities including error handling
- **/contexts/**: React context providers, now refactored into:
  - **PerformanceDataContext.tsx**: Core data management
  - **UIStateContext.tsx**: UI state management
  - **ModalContext.tsx**: Modal visibility control
  - **EditStateContext.tsx**: Editing state management
  - **PerformanceContext.tsx**: Thin wrapper combining the above contexts

## Current Development Focus

The application has addressed authentication flow issues by:

1. Simplifying client-side authentication with React hooks and patterns
2. Centralizing OAuth logic in a dedicated manager
3. Ensuring consistent auth header handling
4. Implementing proper error recovery mechanisms
5. Improving user feedback when authentication issues occur

The redesigned architecture provides better maintainability, clearer separation of concerns, and a more robust user experience.

## Overall Application Flow

1. User logs in (via Google or standard Clerk sign-in) through the unified `/sign-in` path
2. User creates or selects a Performance → Rehearsal → Recording
3. User records a video or uploads one
4. Video and metadata are automatically saved to the user's Google Drive via the unified GoogleDriveService
5. On re-login, user can see existing data from Google Drive (and metadata stored in Clerk)

## API Endpoints

### Auth Endpoints
- `GET /api/auth/me` - Get current user and Google connection status
- `GET /api/auth/google-status` - Check Google connection status
- `GET /api/auth/google-auth-url` - Generate Google auth URL
- `POST /api/auth/google-disconnect` - Disconnect Google account
- `GET /api/auth/refresh-session` - Refresh the session

### Upload Endpoint
- `POST /api/upload/form` - Upload a file with form data (consolidated endpoint)

### Delete Endpoint
- `DELETE /api/delete` - Delete a file or item (now using GoogleDriveService)

## Known Issues

The previous authentication flow issues have been addressed through the implementation of the project phases:
- Authentication with proper React hooks instead of global functions
- Centralized OAuth management in googleOAuthManager
- Consistent error handling for authentication failures
- Improved user feedback for connection issues

Some areas for potential future improvement:
- Additional unit and integration testing for the new context structure
- Performance optimization for large collections of recordings
- Enhanced offline capabilities with more sophisticated sync conflict resolution