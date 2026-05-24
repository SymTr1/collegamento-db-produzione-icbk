import { NextRequest, NextResponse } from "next/server";

/**
 * Validates the API key sent in the request headers.
 * Returns null if valid, or a NextResponse error if invalid.
 *
 * Usage in any API route:
 *   const authError = validateApiKey(request);
 *   if (authError) return authError;
 */
export function validateApiKey(
  request: NextRequest
): NextResponse | null {
  const apiKey = request.headers.get("x-api-key");
  const expectedKey = process.env.API_KEY;

  if (!expectedKey) {
    console.error("API_KEY environment variable is not set.");
    return NextResponse.json(
      { error: "Internal server error." },
      { status: 500 }
    );
  }

  if (!apiKey || apiKey !== expectedKey) {
    return NextResponse.json(
      { error: "Unauthorized. Provide a valid x-api-key header." },
      { status: 401 }
    );
  }

  return null; // all good
}
