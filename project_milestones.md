Phase 1: Simplify Client-Side Authentication & Session Handling
Goal: Establish a single, reliable source of truth for client-side authentication state, remove global function dependencies, and streamline validation logic.

Tasks:

Implement Central Auth Hook:

Create a new hook, e.g., useAuthStatus.

Leverage Clerk's useAuth() hook (isLoaded, isSignedIn, userId, sessionId).

If still deemed necessary after evaluating Clerk's capabilities: Add logic for periodic background checks using /api/auth/me or /api/auth/refresh-session (simplify the endpoint if possible) but avoid complex timers tied to visibilitychange. Keep it simple (e.g., check every 5-15 minutes).

Consolidate logic from lib/sessionUtils.ts into this hook if relevant.

Remove Redundant Components/Utils:

Delete app/components/SessionRefresh.tsx.

Delete components/AuthCheck.tsx.

Delete components/ValidationRegistration.tsx.

Delete or significantly simplify lib/sessionUtils.ts.

Eliminate Global Dependencies:

Search for all usages of window.validateAllTokensForRecording, window.refreshBeforeCriticalOperation, window.refreshSessionBeforeAction.

Replace these calls with logic using the new useAuthStatus hook or directly using Clerk's useAuth.

Update components like VideoRecorder and contexts/PerformanceContext (or code calling its actions) to use the new hook for pre-action validation.

Standardize 401 Handling:

Review lib/fetchWithAuth.ts. Ensure it consistently handles 401s by redirecting to /sign-in (or displaying a message/modal).

Consider implementing a global fetch interceptor if more complex handling (like automatic token refresh attempts before redirecting) is desired, but prioritize simplicity first.

Simplify syncService Authentication:

Remove the validateAuthForUpload method from services/syncService.ts.

Modify the syncService.sync() method to assume authentication is valid when called or fail gracefully if the underlying API call returns 401. The responsibility of ensuring auth before calling sync() should lie elsewhere (e.g., in the component triggering the sync).

Verification:

Sign-in, sign-out, recording, and upload flows work correctly.

No errors related to missing window functions.

401 errors from API calls consistently lead to sign-in redirection or clear user feedback.

syncService attempts uploads only when the user is likely authenticated.

Removed components/utils are no longer referenced.

Outcome: A drastically simplified, React-idiomatic approach to client-side authentication state and validation, removing brittle global dependencies.

Phase 2: Complete Centralization & Consistency
Goal: Ensure all OAuth logic resides in googleOAuthManager and all Drive API calls go through GoogleDriveService.

Tasks:

Move Remaining OAuth Functions:

Relocate generateAuthUrl and exchangeCodeForTokens methods from lib/GoogleDriveService.ts to lib/googleOAuthManager.ts.

Update any callers (e.g., API routes, GoogleDriveContext) to use the functions from googleOAuthManager.

Refactor Delete Handler:

Modify app/api-handlers/delete.ts to import and use googleDriveService.deleteFile (or equivalent method if naming differs) instead of directly using googleapis and getUserGoogleAuthClient.

Ensure googleDriveService has a robust deleteFile method that handles different resource types (performance, rehearsal, recording) or create specific methods if needed.

Verification:

Google connection flow (initial connect, reconnect) still functions correctly.

Deleting performances, rehearsals, and recordings works correctly via the /api/delete endpoint.

GoogleDriveService no longer contains core OAuth URL generation or code exchange logic.

delete.ts handler no longer directly imports googleapis.

Outcome: Fully centralized OAuth logic and consistent use of the GoogleDriveService abstraction for all Drive operations.

Phase 3: Refactor PerformanceContext
Goal: Reduce the size and complexity of PerformanceContext for better maintainability and potential performance improvements.

Tasks:

Analyze Context Contents: Identify distinct areas of responsibility within PerformanceContext (e.g., core performance/rehearsal/recording data, UI state like modal visibility, editing state, search state).

Choose Refactoring Strategy:

Option A (Multiple Contexts): Create smaller contexts like PerformanceDataContext, UIStateContext, ModalContext, EditStateContext.

Option B (State Library): Introduce a lightweight state management library like Zustand or Jotai and create corresponding stores/atoms.

Implement Chosen Strategy:

Define the new contexts/stores/atoms.

Migrate state variables (useState) and related actions/logic from PerformanceContext to the new structures.

Keep the PerformanceDataProvider potentially thin, mainly for initializing and providing the new contexts/stores.

Update Consumers:

Refactor components currently using usePerformances() (like app/page.tsx, TodaysRecordings, PerformanceSelector, etc.) to consume state and actions from the new, more focused contexts/hooks/stores.

Verification:

All application features related to performances, rehearsals, recordings, modals, and editing still function correctly.

The original PerformanceContext file is significantly smaller or broken into multiple files.

Consuming components import from the new contexts/hooks/stores.

Outcome: More modular and manageable application state, reduced provider complexity, potentially improved performance due to more granular updates.

Phase 4: API and UI Route Cleanup
Goal: Eliminate redundant API endpoints and confusing UI routes related to authentication.

Tasks:

Analyze API Endpoint Usage:

Trace calls to /api/auth/google-token, /api/upload, /api/drive/upload.

Determine if they are still necessary or if their functionality is covered by /api/upload/form and internal token management.

Remove/Merge Redundant APIs:

Delete the route files and corresponding handlers for any confirmed redundant endpoints.

If /api/upload or /api/drive/upload have unique logic needed, merge it into /api/upload/form or its handler.

Remove Placeholder API: Delete app/api/auth/session/route.ts.

Consolidate Sign-in UI:

Delete the entire app/signin/ directory.

Ensure all links, redirects, and Clerk configuration (signInUrl, signUpUrl in components and middleware.ts) point consistently to /sign-in and /sign-up.

Remove Login Redirect:

Delete the app/login/ directory.

If redirection from /login to /sign-in is strictly necessary (e.g., for existing links), configure a permanent redirect in next.config.js.

Cleanup API Handlers: Review app/api-handlers/auth.ts and others – remove any functions that are no longer called by any active API route after the refactoring in previous phases.

Verification:

Application builds and runs without errors related to removed routes.

Sign-in/sign-up flows work correctly using only the /sign-in and /sign-up paths.

File uploads work correctly via the designated endpoint (likely /api/upload/form).

No 404 errors for previously existing but now removed redundant routes.

Outcome: A leaner API surface, a single clear authentication UI flow, and reduced codebase clutter.

Phase 5: Final Testing, Documentation & Polish
Goal: Ensure application stability after all changes and update documentation to reflect the final architecture.

Tasks:

Sign-up, Sign-in (Google and potentially email/password).

Connecting/Disconnecting Google Drive.

Creating/Editing/Deleting Performances & Rehearsals.

Recording/Uploading/Linking videos.

Playing back videos.

Using search/filter features.

Offline recording and subsequent sync.

Session expiration and re-authentication during critical actions (like upload).

Update Documentation:

Revise documentation.md and README.md to accurately describe the simplified client-side auth mechanism, the final context structure, the unified GoogleDriveService, the fully centralized googleOAuthManager, and the cleaned-up API/UI routes.

Code Review & Cleanup: Perform a final pass to catch any remaining inconsistencies, dead code, or areas needing minor improvements (linting, formatting).