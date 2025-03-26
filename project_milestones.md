OAUTH REWORK

Overview
This plan addresses the OAuth and Clerk authentication issues by unifying all token handling under Clerk's management, removing legacy code paths, standardizing error handling, and implementing a thorough testing strategy before rollout.
Milestone A: Remove Legacy Token Storage
A.1: Audit and Convert Token Handling

Delete lib/clerkAuth.ts file entirely
Update app/api-handlers/auth.ts:

Remove import import { getGoogleRefreshToken, saveGoogleToken } from '@/lib/clerkAuth';
Remove the exchangeCode function entirely
In getMe, remove any code referencing getGoogleRefreshToken
Remove the migrateTokens function


Update app/api-handlers/upload.ts:

Remove import import { getGoogleRefreshToken, uploadToGoogleDrive } from '@/lib/clerkAuth';
In the upload function, replace getGoogleRefreshToken(userId) with using userId directly
Update googleDriveService.uploadFile calls to use userId instead of refreshToken


Update lib/googleAuth.ts:

Remove import import { getGoogleRefreshToken } from './clerkAuth';
In getUserGoogleAuthClient, remove any paths that use getGoogleRefreshToken
Add robust error handling for token retrieval failures
Remove the deprecated getGoogleAuthClient function completely


Clean up other token storage uses:

Remove any localStorage.setItem('google_token_${userId}') calls
Remove any localStorage.getItem('google_token_${userId}') calls



A.2: Update API Route Definitions

Update app/api/[...slug]/route.ts:

Remove route entries for 'auth/exchange-code' and 'auth/migrate-tokens'
Remove the route definition for 'auth/google-auth-url' (will be handled by Clerk)



Milestone B: Lock Down the OAuth Flow
B.1: Centralize Google Auth Flow

Update GoogleDriveContext.tsx:

Replace custom popup window OAuth flow with Clerk's built-in approach:
typescriptCopy// Replace this:
const response = await fetch('/api/auth/google-auth-url');
const data = await response.json();
const popup = window.open(data.url, 'googleAuth', 'width=600,height=700');
// ...message handler, etc.

// With this:
import { useUser } from '@clerk/nextjs';
// ...
const { user } = useUser();
await user?.createExternalAccount({
  strategy: 'oauth_google',
  redirect_url: window.location.href,
});



Update lib/GoogleDriveService.ts:

Modify getUserAuthClient private method to exclusively use the Clerk token approach
For all service methods (uploadFile, listFiles, deleteFile, checkConnection):

Change parameter from refreshToken: string to userId: string
Replace token/client setup with const oauth2Client = await this.getUserAuthClient(userId);





B.2: Handle Return from Google

Update app/api/auth/google-reconnect/route.ts:

Delete this file if Clerk is handling reconnection
If it must be kept, simplify it to use Clerk's user management for token retrieval


Update lib/clerkTokenManager.ts:

Enhance getGoogleOAuthToken to handle different response formats robustly
Simplify isGoogleConnected to primarily rely on token availability
Ensure getOAuthConnectionStatus correctly reflects token state



B.3: Properly Handle State Parameter

If using Clerk's OAuth flow, let Clerk handle state parameter validation
If keeping custom flow, ensure state contains userId and validate it strictly
Remove any state validation that might conflict with Clerk's handling

Milestone C: Clean Up Error Handling & Response Codes
C.1: Standardize API Error Responses

Update auth-related API handlers:

Return 401 for authentication failures (not signed in)
Return 403 for authorization failures (signed in but insufficient permissions)
Return 409 for cases where reconnection is needed (token expired/invalid)
Return 500 for internal server errors
Example pattern for getGoogleStatus and similar endpoints:
typescriptCopyif (!userId) {
  return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
}

if (!connectionStatus.hasToken && connectionStatus.hasOAuthAccount) {
  return NextResponse.json({
    connected: false,
    needsReconnect: true,
    message: 'Google connection needs to be refreshed'
  }, { status: 409 }); // Conflict - requires user action
}




C.2: Evaluate and Improve Request Handling

Review app/api/[...slug]/route.ts:

Evaluate if the "duplicate request skipping" logic is causing issues:
typescriptCopy// Review this logic
if (processedRequests.has(requestId)) {
  const count = processedRequests.get(requestId) || 0;
  processedRequests.set(requestId, count + 1);
  
  if (count > 0) {
    // Is this skipping legitimate retries?
    return NextResponse.json({ error: 'Duplicate request', status: 'skipped' }, { status: 200 });
  }
}

Consider removing it or adding a mechanism to distinguish intentional retries



C.3: Simplify Session Management

Simplify components/SessionRefresh.tsx:

Remove the setInterval logic for periodic checks
Remove the handleVisibilityChange listener and related functions
Remove global function assignments (window.refresh..., window.validate...)
Rely on Clerk's session management instead


Simplify components/AuthCheck.tsx:

Remove custom checkAllTokens and refreshAllTokens functions
Remove complex validation logic
Rely on Clerk's useUser().isSignedIn for authentication state


Update components/PreRecordingValidation.tsx:

Replace complex validation with a simple check to /api/auth/google-status
Use clear success/failure states based on API response


Update contexts/PerformanceContext.tsx:

Remove checkAuthentication and other manual auth verification
Rely on API endpoints to return proper status codes
Handle 401/403/409 responses with appropriate UI feedback


Update components using global validation functions:

In components/VideoRecorder.tsx, remove calls to window.validateAllTokensForRecording
In general, replace global window functions with direct API calls