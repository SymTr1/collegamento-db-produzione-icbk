import { NextRequest, NextResponse } from "next/server";
import { validateApiKey } from "../../../lib/auth";
import { readOnlyQuery } from "../../../lib/db";

/**
 * GET /api/tables
 *
 * Returns a list of all tables in the database with their schemas.
 * Useful to discover what data is available before querying.
 *
 * Headers:
 *   x-api-key: <your-api-key>
 */
export async function GET(request: NextRequest) {
  const authError = validateApiKey(request);
  if (authError) return authError;

  try {
    const result = await readOnlyQuery(`
      SELECT table_schema, table_name, table_type
      FROM information_schema.tables
      WHERE table_schema NOT IN ('pg_catalog', 'information_schema')
      ORDER BY table_schema, table_name
    `);

    return NextResponse.json({
      success: true,
      tables: result.rows,
    });
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: `Database error: ${message}` },
      { status: 500 }
    );
  }
}
