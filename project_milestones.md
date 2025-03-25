Project Milestone: Auth Refactor

Stage 1: Remove Manual Google Token Handling (Backend)

Goal: Eradicate all code related to manually storing, retrieving, or exchanging Google refresh tokens.

Delete File:

Action: Delete the file lib/clerkAuth.ts.

Remove Imports and Usages:

File: app/api-handlers/auth.ts

Action: Remove the import import { getGoogleRefreshToken, saveGoogleToken } from '@/lib/clerkAuth';.

Action: Remove the exchangeCode function entirely.

Action: In getMe, remove any code referencing getGoogleRefreshToken.

Action: Remove the migrateTokens function entirely (migration is no longer handled this way).

File: app/api-handlers/upload.ts

Action: Remove the import import { getGoogleRefreshToken, uploadToGoogleDrive } from '@/lib/clerkAuth';.

Action: In upload function, remove the call to getGoogleRefreshToken. Replace the call to googleDriveService.uploadFile to use userId instead of refreshToken.

Action: In uploadForm function, remove any remaining direct calls to getGoogleRefreshToken. Ensure it uses userId when calling googleDriveService.uploadFile.

File: lib/GoogleDriveService.ts

Action: Remove the import import { getGoogleRefreshToken } from './clerkAuth';.

Action: Remove the exchangeCodeForTokens method.

Action: Remove the getAccessToken method.

Action: Remove the findRootFolder method (and any usages) if it relied on a refresh token directly.

Action: Remove the deleteFile method parameter refreshToken and update its implementation to use userId to get the client.

Action: Remove the listFiles method parameter refreshToken and update its implementation to use userId to get the client.

File: lib/googleAuth.ts

Action: Remove the import import { getGoogleRefreshToken } from './clerkAuth';.

Action: In getUserGoogleAuthClient, remove any code paths that attempt to use getGoogleRefreshToken.

Action: Search the entire project for getGoogleRefreshToken, saveGoogleToken, checkGoogleRefreshToken, removeGoogleRefreshToken, exchangeCode (related to auth), migrateTokens, and remove all relevant code and imports.

Action: Search for localStorage.setItem('google_token_') and localStorage.getItem('google_token_') and remove those lines.

Remove API Route Definitions:

File: app/api/[...slug]/route.ts

Action: Remove the route entries for 'auth/exchange-code' and 'auth/migrate-tokens' from the routes object.

Stage 2: Update Backend Services for Clerk Wallet

Goal: Ensure all backend Google API interactions use tokens obtained via Clerk's OAuth Token Wallet.

Refactor lib/googleAuth.ts:

Function: getUserGoogleAuthClient

Action: Ensure the function only contains logic that calls getGoogleOAuthToken(userId) from lib/clerkTokenManager.ts.

Action: Add robust error handling: If getGoogleOAuthToken returns { token: null, ... }, throw a specific error like throw new Error('Google token unavailable via Clerk. User may need to connect/reconnect.');. Also handle potential errors from the getGoogleOAuthToken call itself.

Action: Remove the getGoogleAuthClient (deprecated) function completely.

Action: Ensure OAuth2Client is created using google.auth.OAuth2 and credentials are set using oauth2Client.setCredentials({ access_token: accessToken }); where accessToken comes from getGoogleOAuthToken.

Refactor lib/GoogleDriveService.ts:

Method: getUserAuthClient (private helper)

Action: Ensure this method correctly calls the refactored getUserGoogleAuthClient(userId) from lib/googleAuth.ts. Propagate errors clearly.

Method: uploadFile

Action: Change the first parameter from refreshToken: string to userId: string.

Action: Replace token/client setup logic with const oauth2Client = await this.getUserAuthClient(userId);. Handle potential null/error return from getUserAuthClient.

Method: listFiles (if kept)

Action: Change the first parameter from refreshToken: string to userId: string.

Action: Replace token/client setup logic with const oauth2Client = await this.getUserAuthClient(userId);.

Method: deleteFile (if kept)

Action: Change the first parameter from refreshToken: string to userId: string.

Action: Replace token/client setup logic with const oauth2Client = await this.getUserAuthClient(userId);.

Method: checkConnection

Action: Change parameter to userId: string.

Action: Replace token/client setup logic with const oauth2Client = await this.getUserAuthClient(userId);. Add checks for oauth2Client being null or throwing.

Method: generateAuthUrl

Action: Strongly consider removing this method. If kept for some reason, ensure it doesn't conflict with Clerk's flow. It should not be used for the primary connection process.

Refactor lib/clerkTokenManager.ts:

Function: getGoogleOAuthToken

Action: Review and enhance error logging. Ensure it correctly handles various response formats from clerkClient.users.getUserOauthAccessToken as identified in the analysis (direct array, stringified array, object with data property). Log clearly which format was detected or if the format was unrecognized.

Function: isGoogleConnected

Action: Simplify this. It should primarily rely on whether getGoogleOAuthToken(userId) returns a non-null token. The check for oauth_google verification strategy might still be useful for diagnosing why a token isn't present (i.e., user connected but token expired vs. user never connected).

Function: getOAuthConnectionStatus

Action: Ensure this function accurately reflects the state based solely on Clerk's user data (externalAccounts, emailAddresses verification) and the result of getGoogleOAuthToken. The needsReconnect flag should be true if hasOAuthAccount is true but hasToken is false.

Stage 3: Implement Clerk-Managed Google Connection (Client-Side)

Goal: Replace custom OAuth popups/listeners with Clerk's built-in methods for connecting external accounts.

Update GoogleDriveContext.tsx:

Function: connectGoogleDrive

Action: Remove the fetch to /api/auth/google-auth-url.

Action: Remove the window.open call and the window.message listener logic.

Action: Import useUser from @clerk/nextjs.

Action: Get the user object from useUser().

Action: Implement the connection using await user?.createExternalAccount({ strategy: 'oauth_google', redirect_url: window.location.href }); (or a more specific callback URL). Handle potential errors if user is null or the method fails.

Function: reconnectGoogleDrive

Action: Remove the fetch to /api/auth/google-reconnect.

Action: Implement reconnection similarly to connectGoogleDrive, potentially using the same user?.createExternalAccount method. Clerk should handle the linking/refresh automatically when the user re-authenticates with Google via this flow.

Function: refreshStatus

Action: Ensure this function correctly fetches /api/auth/google-status and updates isConnected, needsReconnect, and hasOAuthAccount based on the API response (which now relies on clerkTokenManager).

Remove Obsolete API Handlers/Routes:

File: app/api-handlers/auth.ts

Action: Remove the getGoogleAuthUrl function.

File: app/api/[...slug]/route.ts

Action: Remove the route definition for 'auth/google-auth-url'.

File: app/api/auth/google-reconnect/route.ts

Action: Delete this entire route file.

File: app/api/[...slug]/route.ts

Action: Remove any potential route definition pointing to the deleted reconnect route.

Stage 4: Simplify Session Validation & API Logic

Goal: Remove complex client-side session timers and redundant API checks, relying more on Clerk's middleware and hooks.

Simplify SessionRefresh.tsx:

Action: Remove the setInterval logic for periodic checks.

Action: Remove the handleVisibilityChange listener and its logic.

Action: Remove the refreshSession function and related state (sessionStatus, consecutiveFailures, lastRefreshAttempt).

Action: Remove the global function assignments (window.refresh..., window.validate...). Consider if this component is needed at all. If kept, it might only perform an initial check or subscribe to Clerk's session state changes if available via ClerkJS.

Simplify AuthCheck.tsx:

Action: Remove the checkAllTokens and refreshAllTokens functions.

Action: Remove the useEffect hook performing periodic checks or complex validation.

Action: Remove the global function assignments.

Action: Simplify the component to primarily rely on useUser().isSignedIn and maybe call useGoogleDrive().refreshStatus() once on load if needed. Its main purpose might become just triggering an initial status check.

Update Components Calling Global Functions:

File: components/VideoRecorder.tsx

Action: Remove imports and calls to window.validateAllTokensForRecording or validateSession.

Action: Before calling startRecording or potentially onRecordingComplete, consider fetching /api/auth/google-status to ensure Google is still connected, showing an error if not. Alternatively, trust that the upload process itself will fail gracefully if auth is lost.

File: contexts/PerformanceContext.tsx

Action: In addRecording, deleteRecording, etc., remove any calls to checkAuthentication or global validation functions. Rely on the API endpoints being protected by clerkMiddleware. If an API call fails with 401, handle it gracefully (e.g., using fetchWithAuth which should redirect).

Update PreRecordingValidation.tsx:

Action: Remove usage of validateAllTokensWithRetry or global functions.

Action: Implement the core logic: Fetch /api/auth/google-status. If response.ok and data.connected === true, call onValidationComplete(true). Otherwise, call onValidationComplete(false) and display an error message prompting connection/reconnection.

Clean API Router (app/api/[...slug]/route.ts)

Action: In the handleRequest function (or wherever the main logic resides): Remove the explicit getToken() call that was added for uploads. Rely on Clerk's session handling.

Action: Evaluate if the auth() call inside handleRequest is truly necessary if clerkMiddleware is already configured to protect the routes. If the middleware correctly passes auth info or protects the route, this check might be redundant. Remove cautiously, test thoroughly.

Action: Remove the getCachedAuth helper and use auth() directly if deemed safe and efficient enough (Clerk's helper might have internal caching).

Standardize API Error Responses:

File: app/api-handlers/auth.ts (and others as needed)

Action: Modify getGoogleStatus (and any other relevant handlers) to return standard HTTP errors. Example:

if (!userId) {
  return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
}
// ... later
if (!connectionStatus.hasToken) {
   // Maybe still 200 if you want UI to handle 'needsReconnect' state,
   // OR return 409 Conflict if it's considered an error state.
   // Be consistent! Let's try 409 for needing reconnect.
  return NextResponse.json({
    connected: false,
    needsReconnect: true,
    //...
  }, { status: 409 }); // 409 Conflict might signify "state conflict"
}
// On internal server error:
// return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
Use code with caution.
TypeScript
File: lib/fetchWithAuth.ts

Action: Ensure this helper correctly handles 401 (redirect) and potentially other error codes (like 409, 500) by throwing appropriate errors or returning structured error responses for the UI to handle.