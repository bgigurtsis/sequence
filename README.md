# StageVault - Firebase Migration

This repository contains the migrated version of StageVault, now using Firebase for authentication, storage, and database functionality.

## Migration Overview

The application has been migrated from Clerk to Firebase Authentication, with the following key changes:

1. **Authentication**: Replaced Clerk with Firebase Authentication
2. **Database**: Using Firestore for data storage
3. **Storage**: Using Firebase Storage and Google Drive integration
4. **Functions**: Using Firebase Functions for server-side operations

## Setup Instructions

1. Clone this repository
2. Install dependencies:
   ```
   npm install
   ```
3. Create a Firebase project at [https://console.firebase.google.com/](https://console.firebase.google.com/)
4. Enable the following services:
   - Authentication (with Google provider)
   - Firestore Database
   - Storage
   - Functions
5. Update the `.env.local` file with your Firebase configuration:
   ```
   NEXT_PUBLIC_FIREBASE_API_KEY=your-api-key
   NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your-project-id.firebaseapp.com
   NEXT_PUBLIC_FIREBASE_PROJECT_ID=your-project-id
   NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your-project-id.appspot.com
   NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your-messaging-sender-id
   NEXT_PUBLIC_FIREBASE_APP_ID=your-app-id
   ```
6. Deploy Firebase Functions:
   ```
   cd functions
   npm install
   firebase deploy --only functions
   ```
7. Run the development server:
   ```
   npm run dev
   ```

## Key Features

- **User Authentication**: Sign in with Google
- **Performance Management**: Create, view, edit, and delete performances
- **Recording Management**: Record videos directly in the browser or upload existing videos
- **Google Drive Integration**: Store recordings in Google Drive for better management

## Project Structure

- `/app`: Next.js app router pages
- `/components`: Reusable UI components
- `/contexts`: React context providers
- `/hooks`: Custom React hooks
- `/lib`: Utility functions and configuration
- `/functions`: Firebase Cloud Functions

## Google Drive Integration

To enable Google Drive integration:

1. Create OAuth credentials in the Google Cloud Console
2. Configure the Firebase Functions with the necessary environment variables
3. Users can connect their Google Drive account from the Settings page

## Migration Notes

- User data will need to be migrated from the previous system to Firebase
- Existing recordings will need to be transferred to Firebase Storage or Google Drive
- The database schema has been updated to work with Firestore
