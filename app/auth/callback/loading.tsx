export default function AuthCallbackLoading() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen">
      <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-gray-900"></div>
      <p className="mt-4 text-lg text-gray-700">Processing authentication...</p>
    </div>
  );
} 