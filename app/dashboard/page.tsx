import { SignedIn, SignedOut } from '@clerk/nextjs';
import { redirect } from 'next/navigation';
import DriveFilesList from '../../components/DriveFilesList';

export default function DashboardPage() {
  return (
    <div className="container mx-auto py-8">
      <SignedIn>
        <h1 className="text-2xl font-bold mb-6">Your Google Drive Files</h1>
        <p className="mb-6">
          Manage your Google Drive files directly through the application.
        </p>
        <DriveFilesList />
      </SignedIn>
      
      <SignedOut>
        {redirect('/sign-in')}
      </SignedOut>
    </div>
  );
} 