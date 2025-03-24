# Application Documentation

## Architectural Analysis (High-Level)

### Authentication and Sessions

- Uses Clerk for user management and session handling (including OAuth flows).
- Provides centralized API endpoints through a unified router that handle:
  - Exchanging Google OAuth codes for tokens
  - Storing refresh tokens in Clerk metadata
  - Checking/disconnecting the Google integration
  - Retrieving session/user information
- Current authentication flow experiences 401 errors that are being addressed (see Project Milestones)

### Google Drive Integration

The app obtains a user's Google OAuth refresh token and uses it to store/retrieve recordings on their personal Google Drive.

The Google Drive integration is centralized in a dedicated `GoogleDriveService` module (`/lib/GoogleDriveService.ts`), which handles:

1. **Authentication**: Generating OAuth URLs, exchanging authorization codes for tokens, and retrieving access tokens from refresh tokens.
2. **Folder Management**: Creating, finding, and ensuring folders exist for the root app folder and individual performance folders.
3. **File Operations**: Uploading, listing, and deleting files, including handling file metadata.
4. **Error Handling**: Comprehensive error capture, logging, and recovery mechanisms.
5. **Logging**: Detailed timestamped logging at various stages (start, progress, success, error, info) for debugging and monitoring.

The service retrieves the refresh token from Clerk's user metadata, using it to authenticate with the Google Drive API. All operations are logged with a consistent format that includes timestamps and operation status.

Files are structured in a parent "StageVault Recordings" directory, with nested subfolders for Performances and Rehearsals. Metadata is attached to files using Google Drive's appProperties system.

The UI surfaces "Connected" vs. "Not Connected" states for Drive and allows the user to connect/disconnect.

### API Structure

- All API routes have been consolidated into a unified router file using Next.js catch-all routes
- This centralized approach improves debugging capabilities and maintenance
- API endpoints handle authentication, Google Drive operations, and data management
- Common error handling and authentication verification is applied consistently across endpoints

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
- **/app/api/[...slug]/route.ts**: Unified API router that handles all API requests
- **/components/**: UI building blocks (dialog, forms, video recorder, etc.)
- **/lib/**: Shared logic, including:
  - **GoogleDriveService.ts**: Centralized Google Drive functionality
  - Auth helpers, DB connections, and other utility services
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

## Known Issues

- Authentication flow occasionally fails with 401 errors when uploading recordings
- Fallback to performanceId when user authentication fails creates potential security concerns
- Error handling for authentication failures needs improvement