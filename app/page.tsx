// app/page.tsx
'use client';

import React from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { usePerformance } from '@/contexts/PerformanceContext';
import Link from 'next/link';
import AuthTest from '@/components/AuthTest';

export default function Home() {
  const { user, loading } = useAuth();
  const { performances, loading: performancesLoading } = usePerformance();

  if (loading || performancesLoading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-6">Welcome to StageVault</h1>

      {/* Authentication Test Component */}
      <div className="mb-8">
        <AuthTest />
      </div>
      
      {user ? (
        <div>
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-semibold">Your Performances</h2>
            <Link
              href="/performances/new"
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md"
            >
              Add New Performance
            </Link>
              </div>
              
              {performances.length === 0 ? (
            <div className="bg-white rounded-lg shadow-md p-6 text-center">
              <p className="text-gray-600 mb-4">
                You haven't created any performances yet.
              </p>
              <Link
                href="/performances/new"
                className="inline-block bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md"
              >
                Create Your First Performance
              </Link>
                </div>
              ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {performances.map((performance) => (
                <Link
                  key={performance.id}
                  href={`/performances/${performance.id}`}
                  className="block bg-white rounded-lg shadow-md overflow-hidden hover:shadow-lg transition-shadow"
                >
                  <div className="p-6">
                    <h3 className="text-lg font-semibold mb-2">{performance.title}</h3>
                    <p className="text-gray-600 text-sm mb-4">{performance.date}</p>
                    {performance.venue && (
                      <p className="text-gray-500 text-sm">
                        <span className="font-medium">Venue:</span> {performance.venue}
                      </p>
                    )}
          </div>
                </Link>
              ))}
        </div>
      )}
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow-md p-8 text-center">
          <h2 className="text-2xl font-semibold mb-4">Get Started with StageVault</h2>
          <p className="text-gray-600 mb-6">
            Sign in to start managing your performances and recordings.
          </p>
          <Link
            href="/signin"
            className="inline-block bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-md font-medium"
          >
            Sign In
          </Link>
        </div>
      )}
    </div>
  );
}
