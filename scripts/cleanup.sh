#!/bin/bash

# Remove unused files
echo "Removing unused files..."

# NextAuth related
rm -rf pages/api/auth/[...nextauth].ts

# Firebase related
rm -rf lib/firebase.ts
rm -rf services/firebaseStorage.ts

# Offline-first/sync related
rm -rf components/SyncStatusAdvanced
rm -rf lib/syncService.ts
rm -rf hooks/useOfflineStorage.ts

# Calendar, Collections, Timeline
rm -rf components/Calendar
rm -rf components/Collections
rm -rf components/Timeline

echo "Cleaning up dependencies in package.json..."
# Run npm command to remove unused dependencies
npm uninstall next-auth firebase @firebase/auth pg

echo "Cleanup complete!" 