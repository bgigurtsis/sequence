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
4. Create a service account with the following roles:
   - Drive Admin (roles/drive.admin)
5. Create a key for the service account (JSON format)
6. Copy the contents of the JSON file and paste it in the `GOOGLE_SERVICE_ACCOUNT_CREDENTIALS` variable in your `.env.local` file
7. Share the Google Drive folder you want to use with the service account email address

### Development

Run the development server:

```bash
npm run dev
```

### Troubleshooting Google Drive Integration

If you're experiencing issues with Google Drive synchronization:

1. Check if the Google Drive API is enabled in your Google Cloud Console
2. Verify that your service account has the correct permissions
3. Ensure your service account credentials are correctly formatted in the `.env.local` file
4. Look for error messages in the browser console and server logs
5. Use the "Test API Connection" button in the Sync Status panel to diagnose connection issues

### File Structure

- `/app` - Next.js App Router pages and API routes
- `/components` - React components
- `/contexts` - React context providers
- `/lib` - Utility functions and helpers
- `/services` - Client-side services like sync and storage
- `/types` - TypeScript type definitions

### API Routes

- `/api/ping` - Tests Google Drive API connectivity
- `/api/upload` - Uploads videos to Google Drive
- `/api/delete` - Deletes videos from Google Drive

## Features

- Record videos directly in the browser
- Upload existing video files
- Add external video links
- Organize videos by performances and rehearsals
- Add metadata to recordings
- Synchronize recordings with Google Drive
- Offline-first approach - work even without internet
- Background synchronization when online
