/**
 * Database Initialization Endpoint
 * Run once to set up the database schema
 *
 * Usage: GET /api/db/init?secret=YOUR_CRON_SECRET
 */

import { NextRequest, NextResponse } from "next/server";
import { initializeDatabase } from "@/lib/db/client";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: NextRequest) {
  try {
    // Simple auth check
    const { searchParams } = new URL(request.url);
    const secret = searchParams.get("secret");

    if (secret !== process.env.CRON_SECRET) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Initialize database
    await initializeDatabase();

    return NextResponse.json({
      success: true,
      message: "Database initialized successfully",
    });
  } catch (error) {
    console.error("[DB Init] Error:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to initialize database",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
