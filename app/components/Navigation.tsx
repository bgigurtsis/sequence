'use client';

import { UserButton } from '@clerk/nextjs';

export function Navigation() {
    return (
        <nav className="bg-blue-600 text-white p-4">
            <div className="container mx-auto flex justify-between items-center">
                <a href="/" className="text-xl font-bold">StageVault</a>
                <div className="flex space-x-4">
                    <a href="/" className="hover:underline">Home</a>
                    <a href="/settings" className="hover:underline">Settings</a>
                    <UserButton afterSignOutUrl="/" />
                </div>
            </div>
        </nav>
    );
} 