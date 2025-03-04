'use client';

import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { LogOut } from 'lucide-react';

export default function Navigation() {
  const { user, loading, logout, isGoogleDriveConnected } = useAuth();

  return (
    <nav className="bg-blue-600 text-white p-4">
      <div className="container mx-auto flex justify-between items-center">
        <Link href="/" className="text-xl font-bold">StageVault</Link>
        
        <div className="flex space-x-4 items-center">
          <Link href="/" className="hover:underline">Home</Link>
          
          {user && (
            <Link href="/settings" className="hover:underline">Settings</Link>
          )}
          
          {loading ? (
            <div className="text-sm opacity-75">Loading...</div>
          ) : user ? (
            <div className="flex items-center space-x-3">
              {user.photoURL && (
                <img 
                  src={user.photoURL} 
                  alt={user.displayName || 'User'} 
                  className="w-8 h-8 rounded-full"
                />
              )}
              
              <span className="text-sm">{user.displayName || user.email}</span>
              
              <div className="ml-2">
                {isGoogleDriveConnected ? (
                  <span className="text-xs bg-green-500 text-white px-2 py-0.5 rounded-full">
                    Drive Connected
                  </span>
                ) : (
                  <span className="text-xs bg-orange-500 text-white px-2 py-0.5 rounded-full">
                    Drive Not Connected
                  </span>
                )}
              </div>
              
              <button 
                onClick={logout}
                className="flex items-center text-sm hover:underline"
              >
                <LogOut className="h-4 w-4 mr-1" />
                Sign Out
              </button>
            </div>
          ) : (
            <Link href="/signin" className="flex items-center hover:underline">
              Sign In
            </Link>
          )}
        </div>
      </div>
    </nav>
  );
} 