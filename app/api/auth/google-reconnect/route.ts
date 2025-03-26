import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { generateAuthUrl } from "@/lib/googleOAuthManager";

/**
 * Handle Google account reconnection requests by providing a URL to trigger OAuth flow
 */
export async function POST(request: NextRequest) {
  const { userId, sessionId } = auth();
  
  // Generate a unique request ID for tracing
  const requestId = `${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
  
  console.log(`[GoogleReconnect][${requestId}] OAuth reconnection requested`, {
    userId: userId || 'not authenticated',
    sessionId: sessionId || 'no session'
  });

  // If no user is authenticated, return error
  if (!userId) {
    console.error(`[GoogleReconnect][${requestId}] No authenticated user found`);
    return NextResponse.json(
      {
        success: false,
        message: "User not authenticated",
      },
      { status: 401 }
    );
  }

  try {
    // Use the centralized utility to generate the OAuth URL with reconnect=true
    const redirectUrl = generateAuthUrl(sessionId || '', userId, true);
    
    console.log(`[GoogleReconnect][${requestId}] Generated redirect URL for reconnection`);
    
    return NextResponse.json({
      success: true,
      reconnectUrl: redirectUrl,
      message: "Please use the provided URL to reconnect your Google account"
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`[GoogleReconnect][${requestId}] Error creating reconnection URL:`, {
      error: errorMessage,
      stack: error instanceof Error ? error.stack : undefined
    });

    return NextResponse.json(
      {
        success: false,
        message: `Error creating reconnection URL: ${errorMessage}`,
      },
      { status: 500 }
    );
  }
} 