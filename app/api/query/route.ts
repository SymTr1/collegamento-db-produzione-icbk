import { NextRequest, NextResponse } from "next/server";
import { validateApiKey } from "../../../lib/auth";
import { readOnlyQuery } from "../../../lib/db";

/**
 * POST /api/query
 *
 * Executes a read-only SQL query against the production database.
 * The query is validated at two levels before execution:
 *   1. Application-level keyword blocking
 *   2. PostgreSQL READ ONLY transaction
 *
 * Body (JSON):
 *   {
 *     "sql": "SELECT * FROM orders WHERE id = $1",
 *     "params": [123]          // optional
 *   }
 *
 * Headers:
 *   x-api-key: <your-api-key>
 */
export async function POST(request: NextRequest) {
  // --- Auth check ---
  const authError = validateApiKey(request);
  if (authError) return authError;

  // --- Parse body ---
  let body: { sql?: string; params?: unknown[] };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body." },
      { status: 400 }
    );
  }

  const { sql, params } = body;

  if (!sql || typeof sql !== "string") {
    return NextResponse.json(
      { error: "Missing or invalid 'sql' field. Must be a string." },
      { status: 400 }
    );
  }

  // --- Execute read-only query ---
  try {
    const result = await readOnlyQuery(sql, params);
    return NextResponse.json({
      success: true,
      rowCount: result.rowCount,
      rows: result.rows,
      fields: result.fields.map((f: { name: string; dataTypeID: number }) => ({
        name: f.name,
        dataTypeID: f.dataTypeID,
      })),
    });
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Unknown error";

    // If it's a BLOCKED error, return 403 (Forbidden)
    if (message.startsWith("BLOCKED:")) {
      return NextResponse.json(
        { error: message },
        { status: 403 }
      );
    }

    // Other database errors
    return NextResponse.json(
      { error: `Database error: ${message}` },
      { status: 500 }
    );
  }
}
