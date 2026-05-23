import { NextResponse } from "next/server";
import { readOnlyQuery } from "../../../lib/db";

/**
 * GET /api/health
 *
 * Public health-check endpoint (no API key required).
 * Returns whether the database connection is alive.
 */
export async function GET() {
  try {
    await readOnlyQuery("SELECT 1 AS ok");
    return NextResponse.json({ status: "ok", database: "connected" });
  } catch {
    return NextResponse.json(
      { status: "error", database: "unreachable" },
      { status: 503 }
    );
  }
}
