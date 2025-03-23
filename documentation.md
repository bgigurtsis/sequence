Architectural Analysis (High-Level)
Authentication and Sessions

Uses Clerk for user management and session handling (including OAuth flows).

Provides endpoints (/api/auth/...) that handle:

Exchanging Google OAuth codes for tokens.

Storing refresh tokens in either Clerk metadata or a local DB.

Checking/disconnecting the Google integration.

Retrieving session/user information.

Google Drive Integration

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

Core Data Entities & Flows

Performances → can have multiple Rehearsals → each Rehearsal can have multiple Recordings.

Endpoints and UI components coordinate the creation, update, and deletion of these items.

Local metadata is stored (e.g., performanceId, rehearsalId, recordingId) to keep track of the Google Drive folder structure and file references.

UI/UX

Built on Next.js with React and Clerk's out-of-the-box components for sign-up/sign-in flows.

Main functionality includes:

Capturing video via the browser (camera input).

Uploading that captured video and optional thumbnail to Google Drive.

Searching/filtering performances, listing recordings, playing them (via a video player).

TailwindCSS is used for styling, though there are also custom utility classes.

File/Folder Structure (Next.js App Router)

/app/ folder for page routes.

/app/api/ for serverless API endpoints (Next.js Route Handlers).

/components/ for UI building blocks (dialog, forms, video recorder, etc.).

/lib/ for shared logic (auth helpers, DB connections, Google API wrappers).

/contexts/ for React context providers (e.g., PerformanceContext, GoogleDriveContext).

Next.js & Clerk Integration

The repository employs both Next.js's App Router and Clerk's server/client hooks to manage protected routes.

Some logic for ensuring the user is authenticated uses <SignedIn> and <SignedOut> from Clerk on the client side, and server-side checks in the API routes.

Overall Purpose & Flow

This codebase is aimed at a PoC where a user:

Logs in (via Google or standard Clerk sign-in).

Creates or selects a Performance → Rehearsal → Recording.

Records a video or uploads one.

Automatically saves the video and its metadata into the user's Google Drive.

On re-login, the user can see their existing data from Google Drive (and local or Clerk metadata).