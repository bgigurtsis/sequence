'use client';

import { useAuth } from '@/contexts/AuthContext';

export default function AuthTest() {
  const { user, loading, error } = useAuth();
  
  return (
    <div className="p-4 bg-gray-100 rounded-lg">
      <h2 className="text-lg font-bold mb-2">Authentication Status</h2>
      
      {loading ? (
        <p>Loading authentication state...</p>
      ) : user ? (
        <div>
          <p className="text-green-600">✅ Authenticated</p>
          <p>User ID: {user.uid}</p>
          <p>Email: {user.email}</p>
        </div>
      ) : (
        <p className="text-red-600">❌ Not authenticated</p>
      )}
      
      {error && (
        <div className="mt-2 text-red-600">
          <p>Error: {error}</p>
        </div>
      )}
    </div>
  );
} 