**Revised Project Plan**

**Phase 1: Fix Core Google Drive Upload & Initial Feedback**

*   **Goal:** Ensure reliable online video upload to Google Drive with automatic folder creation and basic user feedback.
*   **Sub-Steps:**
    1.  **1.1 Debug Folder Creation - Logging:**
        *   **Task:** Add detailed logging within `GoogleDriveService`'s folder creation logic to understand the flow and errors.
        *    "Review the `ensureRootFolder` and `ensurePerformanceFolder` methods in `lib/GoogleDriveService.ts`. Add `console.log` statements (using the internal `logOperation` method if available, otherwise standard console.log) before and after each Google Drive API call (`files.list`, `files.create`). Log the parameters being sent (like folder name, parent ID, query) and the full response or error received."
    2.  **1.2 Debug Folder Creation - Analysis & Fix:**
        *   **Task:** Trigger an upload manually, observe the logs from 1.1, identify the exact point of failure (e.g., finding parent folder, creating new folder, permission error), and apply a fix. Verify OAuth scopes (`drive.file`) are set in Clerk/GCP.
        *    "Based on the logs showing [describe the error, e.g., '403 permission error when creating folder'], modify the [specific method, e.g., `ensurePerformanceFolder`] in `GoogleDriveService` to [describe the fix, e.g., 'ensure the correct parent ID is used' or 'handle the specific error type']." (Repeat analysis and fix instructions as needed).
    3.  **1.3 Verify Upload Logic - Logging:**
        *   **Task:** Add logging to trace the file upload data flow.
        *    "Review `uploadFile` in `lib/GoogleDriveService.ts`. Add logs before the multipart upload fetch call, showing the metadata being sent and confirming the file blob size. Log the response status, headers, and body (or error) from the fetch call."
        *    "Review the `POST` handler in `app/api/upload/form/route.ts` (or relevant Server Action). Log the received `FormData` keys/values (excluding file content). Log the parameters passed to `GoogleDriveService.uploadFile` and the result/error received from it."
    4.  **1.4 Verify Upload Logic - Analysis & Fix:**
        *   **Task:** Trigger an upload and analyze logs from 1.3. Ensure the API/Action calls `GoogleDriveService` correctly and handles its response. Debug issues until a file reliably uploads to the correctly created folder structure (from step 1.2).
        *    "Based on the logs showing [describe the error, e.g., 'metadata not being passed correctly'], modify the `POST` handler in `app/api/upload/form/route.ts` to correctly extract and pass [specific metadata field] to `GoogleDriveService.uploadFile`." (Repeat as needed).
    5.  **1.5 Simplify Upload Flow (Disable Sync):**
        *   **Task:** Remove dependencies on the offline sync mechanism for now.
        *    "In the `addRecording` function (likely in `contexts/PerformanceDataContext.tsx` or called by it), comment out or remove any calls related to `syncService.addItemToQueue` or `videoStorage.saveVideo`."
        *    "In the same `addRecording` function, add a direct call to the backend mechanism responsible for the online upload (e.g., `fetch('/api/upload/form', { method: 'POST', body: formData })` or a Server Action call) using the `videoBlob`, `thumbnailBlob`, and `metadata`. Ensure this call happens *after* preparing the data."
        *    "In UI layout files (like `app/layout.tsx` or `components/MainNavbar.tsx`), comment out or remove the rendering of `SyncStatus` and `SyncStatusAdvanced` components."
    6.  **1.6 Backend Error Propagation:**
        *   **Task:** Make `GoogleDriveService` communicate specific errors.
        *    "In `lib/GoogleDriveService.ts`, review methods like `uploadFile`, `ensureRootFolder`, `ensurePerformanceFolder`. Wrap Google Drive API calls (e.g., `drive.files.create`, `fetch` for upload) in try/catch blocks. In the catch block, check for specific Google API error conditions (e.g., `error.code === 403`, `error.errors[0].reason === 'userRateLimitExceeded'`, `error.errors[0].reason === 'storageQuotaExceeded'`). Throw new custom Error instances with specific messages (e.g., `throw new Error('DRIVE_PERMISSION_DENIED: Check app permissions.')`) or return structured error objects (e.g., `return { error: true, code: 'DRIVE_QUOTA_EXCEEDED', message: 'Google Drive quota full.'}`)."
    7.  **1.7 API/Action Error Response:**
        *   **Task:** Make the backend endpoint return structured errors.
        *    "In the `POST` handler in `app/api/upload/form/route.ts` (or Server Action), update the try/catch block around the `GoogleDriveService` call. Catch the custom errors (from step 1.6). Map these errors to specific JSON responses using `NextResponse.json` with appropriate HTTP status codes (e.g., `return NextResponse.json({ code: 'DRIVE_PERMISSION_DENIED', message: 'Permission denied.' }, { status: 403 })`). Ensure a generic 500 response for unhandled errors."
    8.  **1.8 UI Loading State:**
        *   **Task:** Show visual feedback during upload.
        *    "In the component handling the final save/submit after recording (e.g., `MetadataForm` or `app/page.tsx`), add a `useState` hook: `const [isUploading, setIsUploading] = useState(false);`. Set `isUploading(true)` just before initiating the fetch/Server Action call for the upload."
        *    "Add a `finally` block to the fetch/Server Action call promise chain and set `isUploading(false)` inside it."
        *    "Find the main submit button in this component and add the `disabled={isUploading}` attribute. Optionally, change the button text or add a spinner icon when `isUploading` is true."
    9.  **1.9 UI Error Display:**
        *   **Task:** Show errors from the upload process to the user.
        *    "In the same component (from 1.8), add another `useState` hook: `const [uploadError, setUploadError] = useState<string | null>(null);`. In the `catch` block of the fetch/Server Action call, parse the JSON error response from the backend (step 1.7). Set `setUploadError` with a user-friendly message based on the `error.message` or `error.code`."
        *    "Before the form or near the submit button, conditionally render an Alert component (e.g., `<Alert variant='destructive'> {uploadError} </Alert>`) only when `uploadError` is not null. Add a way to clear the error (e.g., set `setUploadError(null)` when the user starts editing the form again)."
        *    "In the main `catch` block of the fetch call, check for network errors (e.g., `error.message === 'Failed to fetch'`) and set a specific `uploadError` like 'Upload failed. Please check your internet connection.'"

*   **Verification:** Online users can successfully upload, folders are auto-created, UI shows loading state during upload, specific Drive/network errors are clearly displayed to the user. `syncService` is inactive.

---

**Phase 2: Database Integration, Metadata Persistence & Feedback**

*   **Goal:** Store application metadata persistently in a database and provide feedback during data operations.
*   **Sub-Steps:**
    1.  **2.1 Setup DB & Prisma:**
        *    "Run `npm install prisma @prisma/client --save-dev`. Run `npx prisma init --datasource-provider postgresql`."
        *    "Update the `DATABASE_URL` in the `.env` file with your Supabase connection string."
    2.  **2.2 Define Schemas:**
        *    "Open `prisma/schema.prisma`. Define models for `User` (fields: `id` String @id @default(cuid()), `clerkId` String @unique, `email` String @unique, `name` String?, `createdAt` DateTime @default(now()), `updatedAt` DateTime @updatedAt, `performances` Performance[], `memberships` Membership[]), `Performance` (fields: `id` String @id @default(cuid()), `title` String, `defaultPerformers` String[], `createdAt`, `updatedAt`, `ownerId` String, `owner` User @relation(fields: [ownerId], references: [id]), `rehearsals` Rehearsal[], `memberships` Membership[]), `Rehearsal` (fields: `id`, `title`, `location` String?, `date` String, `createdAt`, `updatedAt`, `performanceId` String, `performance` Performance @relation(fields: [performanceId], references: [id]), `recordings` Recording[]), and `Recording` (fields: `id`, `title`, `time` String?, `date` String, `driveFileId` String @unique, `thumbnailDriveId` String?, `performers` String[], `tags` String[], `notes` String?, `isExternalLink` Boolean @default(false), `externalUrl` String?, `createdAt`, `updatedAt`, `rehearsalId` String, `rehearsal` Rehearsal @relation(fields: [rehearsalId], references: [id])). Add necessary relations and indices."
    3.  **2.3 Migration:**
        *    "Run `npx prisma migrate dev --name initial-setup` in the terminal."
    4.  **2.4 Backend CRUD (Performances):**
        *    "Create a file `app/actions/performanceActions.ts`. Mark it with `'use server'`. Import Prisma Client. Create exported async functions: `createPerformance(data: { title: string; defaultPerformers: string[] }, ownerId: string)`, `getPerformancesForUser(userId: string)`, `updatePerformance(id: string, data: { title: string; defaultPerformers: string[] })`, `deletePerformance(id: string)`. Implement them using `prisma.performance.create/findMany/update/delete`. Include try/catch blocks, log errors, and return data or throw specific errors."
    5.  **2.5 Backend CRUD (Rehearsals):**
        *    "In a new file `app/actions/rehearsalActions.ts` (or add to `performanceActions`), create functions: `createRehearsal(performanceId: string, data: { title: string; location?: string; date: string })`, `getRehearsals(performanceId: string)`, `updateRehearsal(id: string, data: {...})`, `deleteRehearsal(id: string)`. Use Prisma Client and add error handling."
    6.  **2.6 Backend CRUD (Recordings Metadata):**
        *    "In a new file `app/actions/recordingActions.ts`, create functions: `createRecordingMetadata(rehearsalId: string, data: { title: string; time?: string; date: string; driveFileId: string; performers: string[]; tags: string[]; notes?: string; ... })`, `getRecordingsMetadata(rehearsalId: string)`, `updateRecordingMetadata(id: string, data: {...})`, `deleteRecordingMetadata(id: string)`. Use Prisma Client and add error handling."
    7.  **2.7 Update `addRecording` Flow:**
        *    "Locate the function handling recording completion (likely in `contexts/PerformanceDataContext.tsx`'s `addRecording` or the upload Server Action). After the Google Drive upload successfully returns the `driveFileId` (from Phase 1), call the `createRecordingMetadata` action (from step 2.6), passing the `rehearsalId` and all relevant metadata including the `driveFileId`. Add try/catch around this database call. If it fails, log the error and potentially inform the user that the file uploaded but metadata saving failed."
    8.  **2.8 Refactor Data Loading:**
        *    "In `contexts/PerformanceDataContext.tsx` (or the provider where `performances` state lives), modify the `useEffect` that loads initial data. Remove the `localStorage.getItem` call. Instead, call the `getPerformancesForUser` action (passing the authenticated user ID). Update the `performances` state with the fetched data. Handle loading and error states during this fetch." Fetch related rehearsals/recordings as needed when a performance is selected or expanded.
    9.  **2.9 Remove `localStorage` Persistence:**
        *    "Search for all instances of `localStorage.setItem('performances', ...)` and `localStorage.setItem('collections', ...)` and remove them."
    10. **2.10 UI Loading/Error (Data Fetching):**
        *    "In components that fetch and display lists (e.g., `PerformanceSelector`, `TodaysRecordings`), ensure they use `useState` for `isLoading` and `error`. Set `isLoading` true before fetching, false after. Set `error` if the fetch action/API throws an error."
        *    "Conditionally render loading indicators (spinners, skeletons) when `isLoading` is true. Conditionally render error messages (e.g., using an Alert component) when `error` is not null."

*   **Verification:** App data is sourced from Supabase; Drive File IDs link DB records to Drive files; UI shows loading/errors for DB ops.

---

**Phase 3: Implement Feedback/Comments & Feedback**

*   **Goal:** Allow users to add comments to recordings, with appropriate feedback.
*   **Sub-Steps:**
    1.  **3.1 Comment Schema:**
        *    "Open `prisma/schema.prisma`. Add a `Comment` model: `model Comment { id String @id @default(cuid()) content String @db.Text timestampInVideo Float? createdAt DateTime @default(now()) updatedAt DateTime @updatedAt recordingId String recording Recording @relation(fields: [recordingId], references: [id], onDelete: Cascade) userId String user User @relation(fields: [userId], references: [id]) parentCommentId String? parent Comment? @relation("Replies", fields: [parentCommentId], references: [id], onDelete: Cascade) replies Comment[] @relation("Replies") }`. Run `npx prisma migrate dev --name add-comments`."
    2.  **3.2 Backend: Add Comment Action/API:**
        *    "Create a Server Action `addComment(recordingId: string, data: { content: string; timestampInVideo?: number; parentCommentId?: string }, userId: string)`. Use Prisma Client (`prisma.comment.create`) inside a try/catch. Return the created comment or throw an error."
    3.  **3.3 Backend: Get Comments Action/API:**
        *    "Create a Server Action `getComments(recordingId: string)`. Use Prisma Client (`prisma.comment.findMany`) with `where: { recordingId }`, include related `user` data (`{ select: { id: true, name: true } }`), and sort by `createdAt`. Handle errors."
    4.  **3.4 UI: Display Comments Component:**
        *    "Create a new component `components/CommentsList.tsx`. It should accept `recordingId: string`. Use `useState` for `comments`, `isLoading`, `error`. Use `useEffect` to call the `getComments` action when `recordingId` changes. Render a list of comments, showing `comment.content`, `comment.user.name`, `comment.createdAt`. Add loading/error state display."
    5.  **3.5 UI: Add Comment Form Component:**
        *    "Create `components/AddCommentForm.tsx`. Accept `recordingId` and optional `onCommentAdded` callback. Include a textarea for `content`. Use `useState` for `commentText`, `isSubmitting`, `submitError`. On submit, call `addComment` action. Set loading/error states appropriately. Call `onCommentAdded` on success."
    6.  **3.6 Integrate Components:**
        *    "In the component showing recording details (e.g., `RecordingDetailsModal` or near `VideoPlayer`), add `<CommentsList recordingId={recording.id} />` and `<AddCommentForm recordingId={recording.id} onCommentAdded={refreshComments} />`. Implement the `refreshComments` function to re-trigger the fetch in `CommentsList`."
    7.  **3.7 UI Feedback (Submit):**
        *    "In `AddCommentForm`, disable the textarea and submit button when `isSubmitting` is true. Show a spinner. On success, clear `commentText` and `submitError`. On error, display `submitError` message near the form."
    8.  **3.8 UI Feedback (Fetch):**
        *    "In `CommentsList`, display a skeleton loader or 'Loading comments...' text when `isLoading` is true. If `error` is set, display 'Failed to load comments'."

*   **Verification:** Comments can be added/viewed; UI shows loading/error states for comments.

---

**Phase 4: Implement RBAC, Invitations & Feedback**

*   **Goal:** Introduce role-based access control and user invitations, with clear feedback.
*   **Sub-Steps:**
    1.  **4.1 Schema & Roles:**
        *    "In `prisma/schema.prisma`, add `enum Role { OWNER EDITOR VIEWER }`. Add `model Membership { id String @id @default(cuid()) role Role userId String user User @relation(fields: [userId], references: [id]) performanceId String performance Performance @relation(fields: [performanceId], references: [id]) createdAt DateTime @default(now()) updatedAt DateTime @updatedAt @@unique([userId, performanceId]) }`. Run `npx prisma migrate dev --name add-rbac`."
    2.  **4.2 Permission Check Helper:**
        *    "Create a server-side utility file (e.g., `lib/permissions.ts`). Create an async function `checkPermission(userId: string, performanceId: string, requiredRole: Role): Promise<boolean>`. Use Prisma (`prisma.membership.findUnique`) to check if a membership exists for the user/performance with a role satisfying the `requiredRole` (OWNER > EDITOR > VIEWER). Return true/false."
    3.  **4.3 Secure Data Fetching:**
        *    "Modify the `getPerformancesForUser` action (from 2.4). Use Prisma to find `Membership` records where `userId` matches, then include the related `performance` data (`include: { performance: true }`). Return only the performances the user is a member of."
        *    "Modify `getRehearsals`, `getRecordingsMetadata`, `getComments` actions. Before querying, call `checkPermission(userId, performanceId, 'VIEWER')` (getting `performanceId` from the rehearsal/recording). Throw an error or return empty if permission denied."
    4.  **4.4 Secure Mutations (Create):**
        *    "In `createRehearsal` action, add a call `await checkPermission(userId, performanceId, 'EDITOR')`. If false, throw new Error('PERMISSION_DENIED: Must be editor or owner')."
        *    "In `createRecordingMetadata` action, get `performanceId` from `rehearsalId`, then check permission `await checkPermission(userId, performanceId, 'EDITOR')`. Throw if false."
        *    "In `addComment` action, get `performanceId`, then check permission `await checkPermission(userId, performanceId, 'VIEWER')`. Throw if false."
    5.  **4.5 Secure Mutations (Update):**
        *    "In `updatePerformance` action, check `await checkPermission(userId, performanceId, 'EDITOR')`. Throw if false."
        *    "In `updateRehearsal` action, get `performanceId`, check `await checkPermission(userId, performanceId, 'EDITOR')`. Throw if false."
        *    "In `updateRecordingMetadata` action, get `performanceId`, check `await checkPermission(userId, performanceId, 'EDITOR')`. Throw if false."
    6.  **4.6 Secure Mutations (Delete):**
        *    "In `deletePerformance` action, check `await checkPermission(userId, performanceId, 'OWNER')`. Throw if false."
        *    "In `deleteRehearsal` action, get `performanceId`, check `await checkPermission(userId, performanceId, 'OWNER')`. Throw if false."
        *    "In `deleteRecordingMetadata` action, get `performanceId`, check `await checkPermission(userId, performanceId, 'EDITOR')` (or OWNER depending on desired strictness). Throw if false."
    7.  **4.7 Invitation Backend:**
        *    "Create a Server Action `inviteUserToPerformance(performanceId: string, inviteeEmail: string, role: Role, inviterId: string)`. First, check if `inviterId` has 'OWNER' permission for `performanceId`. Then, use `clerkClient.users.getUserList({ emailAddress: [inviteeEmail] })` to find the invitee's Clerk ID. If found, use Prisma (`prisma.membership.create`) to add the membership. Handle errors: no permission, user not found, user already member, DB error. Return success or error object."
    8.  **4.8 Invitation UI:**
        *    "Create `components/InviteUserForm.tsx`. Accept `performanceId`. Add inputs for email and a select dropdown for `Role`. Use `useState` for `email`, `role`, `isInviting`, `inviteStatus` ('idle' | 'success' | 'error'), `errorMessage`. On submit, call `inviteUserToPerformance` action. Update states based on result."
    9.  **4.9 UI Feedback (Permissions):**
        *    "In components calling secured actions (e.g., edit/delete buttons in `PerformanceSelector`), wrap calls in try/catch. If the caught error message includes 'PERMISSION_DENIED', set a UI error state: `setError('You do not have permission to perform this action.')`."
        *    "Conditionally render edit/delete buttons based on preliminary permission checks if possible (e.g., if the fetched performance data includes the current user's role)."
    10. **4.10 UI Feedback (Invitations):**
        *    "In `InviteUserForm`, disable inputs/button when `isInviting` is true. Show a spinner. If `inviteStatus` is 'success', show a success message (e.g., 'Invitation sent to [email]'). If 'error', display the `errorMessage`."
    11. **4.11 (Optional) UI: Manage Members:**
        *    "Create `components/MemberList.tsx`. Fetch members for a performance (requires backend action querying `Membership` + `User`). Display list. Add buttons to change role or remove (requires backend actions with OWNER permission checks)." Add loading/error feedback.

*   **Verification:** RBAC enforced on data access and mutations; Invites work; UI shows appropriate feedback for permissions and invitations.

---

**Phase 5: UI Overhaul & Feedback Integration**

*   **Goal:** Implement the new user interface, ensuring all feedback mechanisms are integrated correctly.
*   **Sub-Steps:**
    1.  **5.1 Setup Design System:**
        *    "Run `npx shadcn-ui@latest init` (or follow guide for chosen library). Configure `tailwind.config.ts` and `globals.css` as needed."
    2.  **5.2 Refactor Layout & Navigation:**
        *    "Update `app/layout.tsx` and `components/MainNavbar.tsx`. Replace `div`, `nav`, `a` tags with appropriate Shadcn components like `<main>`, `<header>`, `<NavigationMenu>`, `<Button variant='link'>`, ensuring responsiveness."
    3.  **5.3 Refactor Performance/Rehearsal List:**
        *    "Refactor `components/PerformanceSelector.tsx`. Use Shadcn `<Tabs>` for performance selection and `<Accordion>` or `<Card>` for rehearsals. Ensure loading skeletons or spinners (`isLoading` from Phase 2) and error Alerts (`error` from Phase 2) are displayed using Shadcn components."
    4.  **5.4 Refactor Recording List/Grid:**
        *    "Within the refactored `PerformanceSelector` (or dedicated component), use Shadcn `<Card>` for grid view and a custom list item component (using `div`, `img`, `span`) for list view. Integrate loading/error feedback."
    5.  **5.5 Refactor Forms:**
        *    "Refactor `PerformanceForm`, `RehearsalForm`, `MetadataForm`. Replace HTML inputs/selects/textareas/buttons with Shadcn `<Input>`, `<Select>`, `<Textarea>`, `<Button>`. Use `<Label>` and integrate Shadcn form handling if desired. Ensure `disabled={isLoading}` on buttons and error messages (using e.g., `<p className='text-sm text-destructive'>`) are correctly wired."
    6.  **5.6 Refactor Modals/Dialogs:**
        *    "Replace the modal wrappers in `app/page.tsx` (or wherever modals are rendered) with Shadcn `<Dialog>`, `<DialogContent>`, `<DialogHeader>`, `<DialogTitle>`, `<DialogFooter>`. Ensure content (like forms) is placed correctly."
    7.  **5.7 Refactor Video Player & Controls:**
        *    "In `VideoPlayer.tsx`, use Tailwind classes for styling. Wrap controls in divs with `flex`, `space-x-*`. Use Shadcn `<Button variant='outline' size='sm'>` for playback speed, loop, frame controls. Use Shadcn `<Tooltip>` for help icons."
    8.  **5.8 Refactor Comments UI:**
        *    "Refactor `CommentsList` and `AddCommentForm`. Use Shadcn `<Card>` for each comment, `<Avatar>` for user image, `<Textarea>` and `<Button>` for the form. Integrate loading/error feedback using Shadcn `<Skeleton>` and `<Alert>`."
    9.  **5.9 Refactor RBAC/Invitation UI:**
        *    "Refactor `InviteUserForm` and `MemberList` (if created) using Shadcn form components, `<Table>` (for member list), `<Select>` (for roles), `<Button>`. Ensure loading/error/success feedback (e.g., using Shadcn `<Toast>`) is integrated."
    10. **5.10 Refactor Authentication UI:**
        *    "Add Tailwind utility classes to `app/sign-in/[[...sign-in]]/page.tsx` and `app/sign-up/[[...sign-up]]/page.tsx` wrappers to center Clerk components and match overall page styling. Style `AuthNav` buttons if needed."
    11. **5.11 Consistency Check:**
        *    "Review components [List specific components, e.g., PerformanceSelector, MetadataForm]. Ensure consistent use of spacing (e.g., `p-4`, `mb-4`), button variants/sizes, font sizes (`text-sm`, `text-lg`), and error display patterns (`Alert variant='destructive'`)."

*   **Verification:** App uses the new UI library consistently; All loading, error, success, and permission feedback is visually integrated and coherent.

---

**Phase 6: Testing, Monitoring & Polish**

*   **Goal:** Ensure application stability, monitor production, and refine.
*   **Sub-Steps:**
    1.  **6.1 Setup Testing Framework:**
        *    "Run `npm install --save-dev jest @types/jest @testing-library/react @testing-library/jest-dom jest-environment-jsdom`. Create `jest.config.js` and `jest.setup.js` with basic Next.js configurations."
    2.  **6.2 Unit Tests (Backend Logic):**
        *    "Create test file `lib/permissions.test.ts`. Write Jest tests for `checkPermission` function, mocking Prisma Client (`jest.mock('@prisma/client')`) to return different `Membership` scenarios."
        *    "Create test file `lib/GoogleDriveService.test.ts`. Write Jest tests for methods like `ensurePerformanceFolder`, mocking `googleapis` and `fetch` to simulate API responses and errors."
    3.  **6.3 Unit Tests (Frontend Components):**
        *    "Create `components/AddCommentForm.test.tsx`. Use React Testing Library (`render`, `screen`, `fireEvent`) to test rendering the form, typing in the textarea, clicking submit, and verifying the `addComment` action mock is called."
    4.  **6.4 Integration Tests (API/Actions):**
        *    "Create `app/actions/performanceActions.test.ts`. Set up Prisma testing utilities (e.g., using a separate test database or mocking). Write tests that call `createPerformance`, then `getPerformancesForUser` to verify creation and retrieval, including permission checks."
    5.  **6.5 Setup Monitoring:**
        *    "Run `npm install --save @sentry/nextjs`. Follow Sentry's Next.js setup guide: create/update config files (`next.config.js`, `sentry.client.config.ts`, `sentry.server.config.ts`, `sentry.edge.config.ts`), set `SENTRY_DSN` environment variable."
    6.  **6.6 Manual Testing & Bug Fixing:**
        *   *(Manual Step)* Perform end-to-end testing for all core flows (auth, upload, comment, invite, permissions).
        *    "The delete button for rehearsals is still showing for users with only 'VIEWER' role. In [Component File], modify the conditional rendering to correctly check for 'EDITOR' or 'OWNER' role before rendering the button." (Example instruction based on a found bug).
    7.  **6.7 Refine Feedback:**
        *   *(Manual Step)* Review UI during testing. Identify confusing messages or missing loading states.
        *    "The loading spinner during performance list fetch is barely visible. In `components/PerformanceSelector.tsx`, increase its size and add 'Loading performances...' text next to it."
        *    "Change the error message shown when `inviteUser` fails due to 'User not found' to 'Could not find a user with that email address.' in `components/InviteUserForm.tsx`."

*   **Verification:** Test coverage increases; Production errors are logged to Sentry; Major bugs fixed; UI feedback is polished.

---

**Phase 7: (Optional) Reintroduce Offline Sync & Feedback**

*   **Goal:** Add robust offline recording capability with clear sync feedback.
*   **Sub-Steps:**
    1.  **7.1 Re-enable `videoStorage`:**
        *    "Review `services/videoStorage.ts`. Ensure the IndexedDB setup (`openDB`) and CRUD functions (`saveVideo`, `getVideo`, `deleteVideo`) are correctly implemented and handle potential errors."
    2.  **7.2 Re-implement `syncService` Core:**
        *    "Review `services/syncService.ts`. Ensure `loadFromStorage` correctly parses the queue (without blobs) from `localStorage`. Ensure `saveToStorage` correctly saves the queue state (without blobs)."
        *    "Modify `syncService.sync()`:
            *   Inside the loop/logic processing a pending item, add: `const storedVideo = await videoStorage.getVideo(item.recordingId);`.
            *   Check if `storedVideo` exists and contains `videoBlob` and `thumbnailBlob`. If not, mark item as failed ('Blobs missing from local storage') and continue.
            *   Pass `storedVideo.videoBlob` and `storedVideo.thumbnailBlob` to the `FormData` for the upload API call."
    3.  **7.3 Update `addRecording` for Offline:**
        *    "Modify the `addRecording` function (e.g., in `contexts/PerformanceDataContext.tsx`):
            *   Generate a unique `recordingId` upfront.
            *   Call `await videoStorage.saveVideo(recordingId, videoBlob, thumbnailBlob, metadata)` FIRST. Handle potential errors.
            *   Create the queue item metadata (using the same `recordingId`).
            *   Call `syncService.addItemToQueue(queueItem)`.
            *   *Remove* the direct online upload call added in Phase 1.
            *   Optionally, add `if (navigator.onLine) { syncService.sync(); }` after adding to the queue."
    4.  **7.4 Integrate `SyncStatusAdvanced`:**
        *    "Add the `<SyncStatusAdvanced />` component back into a suitable place in the main layout (`app/layout.tsx` or `components/MainNavbar.tsx`)."
        *    "Ensure `SyncStatusAdvanced` correctly uses `useEffect` to `syncService.subscribe()` and updates its internal state based on `syncService.getState()`, displaying counts, status, online state, etc."
    5.  **7.5 Sync Error Handling:**
        *    "In `syncService.sync()`, ensure the `catch` block correctly updates the processed item's status to 'failed', increments `attemptCount`, saves the error message to `item.error`, and saves the state to `localStorage`."
        *    "Consider adding basic retry logic: In `sync()`, if an item fails and `item.attemptCount < MAX_RETRIES`, don't immediately mark as 'failed', just update `lastAttempt` and leave as 'pending'. If `attemptCount >= MAX_RETRIES`, then mark as 'failed'."
    6.  **7.6 UI for Failed Syncs:**
        *    "In `SyncStatusAdvanced`, ensure the 'Failed Uploads' table correctly renders data from `syncService.getFailedItems()`, showing the recording title and error message."
        *    "Implement the `onClick` handlers for the 'Retry Failed' and 'Clear Failed' buttons, ensuring they correctly call `syncService.retryFailedItems()` and `syncService.clearFailedItems()` respectively."
    7.  **7.7 Blob Retrieval for Sync:**
        *    "Verify step 7.2's implementation: Confirm that `syncService.sync()` successfully retrieves blobs from `videoStorage` before attempting the upload fetch call." Test this by reloading the page while items are pending and then going online.

*   **Verification:** Offline recordings save locally; Sync starts when online; `SyncStatusAdvanced` accurately reflects state; Failed uploads can be retried/cleared; Local blobs are cleaned up after successful sync (optional enhancement).