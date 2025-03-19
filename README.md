# StageVault

StageVault is a web application for recording, organizing, and sharing rehearsal videos for performing arts. The app allows users to create performances, organize rehearsals, and record or upload videos directly from their browser.

## Architecture Overview

StageVault uses the following architecture:

- **Next.js App Router** - Modern React framework with file-based routing
- **Clerk Authentication** - User authentication and Google OAuth integration
- **Google Drive API** - Storage solution for organizing and managing videos
- **React Query** - Data fetching and state management
- **TailwindCSS** - Utility-first CSS framework for styling

### File Storage Structure

All user data is stored in Google Drive using the following structure:

```
StageVault/ (root folder)
├── Performance Name 1/
│   ├── Rehearsal Name 1/
│   │   ├── recording1.mp4
│   │   └── recording2.mp4
│   └── Rehearsal Name 2/
└── Performance Name 2/
    └── Rehearsal Name 1/
```

Each recording is stored with metadata in the file description field, including:
- Title
- Performers
- Tags
- Notes
- Date/time recorded

## Setup Instructions

### Prerequisites

- Node.js 18+ and npm
- Google Cloud Platform account with Google Drive API enabled
- Clerk account

### Environment Variables

Create a `.env.local` file with the following variables:

```
# Google API credentials
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
GOOGLE_REDIRECT_URI=http://localhost:3000/api/auth/google/callback

# Clerk authentication
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=your_clerk_publishable_key
CLERK_SECRET_KEY=your_clerk_secret_key
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up
NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL=/dashboard
NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL=/dashboard
```

### Installation

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```
3. Run the development server:
   ```bash
   npm run dev
   ```
4. Access the application at http://localhost:3000

## Google Drive API Setup

1. Create a project in Google Cloud Console
2. Enable the Google Drive API
3. Create OAuth credentials (Web application type)
4. Add authorized redirect URIs:
   - `http://localhost:3000/api/auth/google/callback` (for development)
   - Your production callback URL for deployment

## Deployment

The application can be deployed to Vercel:

1. Push your code to a Git repository
2. Connect the repository to Vercel
3. Configure environment variables in Vercel dashboard
4. Deploy

## Mobile Support

The application is fully responsive and works on mobile devices. Key mobile-optimized features include:

- Touch-friendly controls for video recording and playback
- Responsive layout that adapts to different screen sizes
- Optimized video recording on mobile browsers
