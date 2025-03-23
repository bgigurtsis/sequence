import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';

export const runtime = 'edge';

export async function GET() {
  try {
    const authResult = await auth();
    const userId = authResult?.userId;

    // Return early with false if no user
    if (!userId) {
      return new NextResponse(
        JSON.stringify({ connected: false }),
        {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );
    }

    // Return success response
    return new NextResponse(
      JSON.stringify({ connected: true }),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );

  } catch (error) {
    console.error('Error checking Google status:', error);

    // Return error response
    return new NextResponse(
      JSON.stringify({ connected: false, error: 'Failed to check connection' }),
      {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );
  }
} 