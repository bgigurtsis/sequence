import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
    console.log("Test API route accessed", {
        url: request.url,
        headers: Object.fromEntries(request.headers.entries())
    });

    return NextResponse.json(
        { success: true, message: "API is working correctly" },
        { headers: { 'Content-Type': 'application/json' } }
    );
} 