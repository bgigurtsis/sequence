# Project Milestones

## Next Milestone: Simplify Clerk → Google Drive Integration

**Goal**  
Centralize and streamline the Google Drive upload/management logic into a single file or module so it's easier to debug and maintain with AI assistance.

**Key Tasks**  
1. **Refactor Google Drive Logic**  
   - [x] Move scattered functions (folder creation, file uploads, OAuth/token handling) into one cohesive file or module.  
   - [x] Clearly document input parameters, error handling, and any returned data.

2. **Enhance Debug/Logs**  
   - [x] Introduce consistent logging statements for Drive operations (e.g., "folder created," "file uploaded," "refresh token expired," etc.).  
   - [x] Ensure these logs are easy to follow for debugging in both local dev and production.

3. **Validate Clerk Integration**  
   - [x] Confirm that the single-file approach still retrieves/validates refresh tokens from Clerk properly.  
   - [x] Document any steps needed to update environment variables or Clerk's settings.

4. **Cleanup Unused Routes**  
   - [x] Identify and remove any outdated or duplicated Drive endpoints now covered by the unified file.  
   - [x] Update references in the UI or contexts to ensure they call the new integration file directly.

5. **Testing**  
   - [ ] Verify that new user sign-in and existing user sign-in both work without regression.  
   - [ ] Confirm that uploading a new video successfully creates folders and saves files in Drive.  
   - [ ] Validate error states (e.g., missing or revoked token) produce meaningful log output.

**Completion Criteria**  
- [x] All Google Drive logic is consolidated in a single file (or minimal set of files).  
- [ ] No broken references to old code.  
- [x] Clear log messages confirm each step of the upload process.  
- [ ] Full user workflow (sign in, record, upload, verify in Drive) runs successfully without manual fixes.


# API Project Milestones

## Next Milestone: Consolidate API Routes into a Unified Router File

**Goal:**  
Centralize all API logic from separate files under `app/api` into a single catch-all route file. This will simplify debugging, maintenance, and improve AI-assisted code analysis for the Clerk → Google Drive integration.

**Key Tasks:**

1. **Feasibility & Research:**  
   - Investigate Next.js catch-all routes (e.g., `app/api/[...slug]/route.ts`) to capture all API requests.  
   - Evaluate trade-offs between Next.js's file-based routing and a unified router approach.

2. **Design a Unified Router:**  
   - Create a catch-all API route file (e.g., `app/api/[...slug]/route.ts`) to intercept all API calls.
   - Implement an internal dispatcher that inspects the request path (slug) and method to determine which handler function to invoke.
   - Ensure that authentication checks (e.g., Clerk verification) and error handling are uniformly applied.

3. **Extract and Refactor Logic:**  
   - For each current endpoint (e.g., `/auth/disconnect`, `/auth/exchange-code`, `/auth/google-url`, etc.), extract the handler logic into dedicated functions within the unified router file.
   - Preserve logging and debugging messages to facilitate troubleshooting.
   - Remove or archive the now redundant individual API route files.

4. **Testing and Verification:**  
   - Conduct thorough manual and unit testing to confirm that each endpoint behaves as expected.
   - Verify that the unified dispatcher correctly routes requests and that error handling remains effective.

5. **Documentation and Integration:**  
   - Update `Documentation.md` to reflect the new API structure and describe the dispatch mechanism, including its endpoints, expected inputs, and error responses.
   - Update your `.cursorrules` file to reference both the updated `Project_milestones.md` and `Documentation.md`.

**Completion Criteria:**  
- All API endpoints are accessible via the unified router without loss of functionality.
- The dispatcher properly directs requests based on URL path and HTTP method.
- Clear, consistent logs indicate the progress of each operation.
- Documentation and Cursor rules are updated accordingly.