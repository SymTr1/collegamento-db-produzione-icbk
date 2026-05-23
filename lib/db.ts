import { Pool, QueryResult } from "pg";

// ---------------------------------------------------------------------------
// BLOCKED SQL KEYWORDS — any query containing these is rejected BEFORE
// it ever reaches PostgreSQL.  This is the first layer of defence.
// ---------------------------------------------------------------------------
const WRITE_KEYWORDS = [
  "INSERT",
  "UPDATE",
  "DELETE",
  "DROP",
  "ALTER",
  "TRUNCATE",
  "CREATE",
  "REPLACE",
  "GRANT",
  "REVOKE",
  "COPY",
  "EXECUTE",
  "CALL",
  "DO",
  "LOCK",
  "VACUUM",
  "REINDEX",
  "CLUSTER",
  "COMMENT",
  "SECURITY",
  "SET ",          // SET followed by space (avoid matching OFFSET)
  "MERGE",
  "UPSERT",
  "NOTIFY",
  "LISTEN",
  "UNLISTEN",
  "PREPARE",
  "DEALLOCATE",
  "DISCARD",
  "REASSIGN",
  "REFRESH",
];

/**
 * Validates that a SQL string is strictly a SELECT query.
 * Throws an error if any write-capable keyword is detected.
 */
export function assertReadOnly(sql: string): void {
  const upper = sql.toUpperCase().trim();

  // Must start with SELECT or WITH (for CTEs)
  if (!upper.startsWith("SELECT") && !upper.startsWith("WITH")) {
    throw new Error(
      "BLOCKED: Only SELECT queries are allowed. " +
        "This proxy is read-only by design."
    );
  }

  // Reject if any write keyword appears anywhere in the query
  for (const keyword of WRITE_KEYWORDS) {
    // Use word-boundary-style matching to reduce false positives
    const pattern = new RegExp(`\\b${keyword.trim()}\\b`, "i");
    if (pattern.test(sql)) {
      throw new Error(
        `BLOCKED: Query contains forbidden keyword "${keyword.trim()}". ` +
          "This proxy is read-only by design."
      );
    }
  }

  // Block semicolons that could allow statement chaining
  const withoutStrings = sql.replace(/'[^']*'/g, ""); // strip string literals
  if (withoutStrings.includes(";")) {
    // Allow a single trailing semicolon
    const trimmed = withoutStrings.trim();
    if (trimmed.indexOf(";") !== trimmed.length - 1) {
      throw new Error(
        "BLOCKED: Multiple statements detected. " +
          "Only single SELECT queries are allowed."
      );
    }
  }
}

// ---------------------------------------------------------------------------
// Connection pool — created once, reused across requests
// ---------------------------------------------------------------------------
let pool: Pool | null = null;

function getPool(): Pool {
  if (!pool) {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      throw new Error("DATABASE_URL environment variable is not set.");
    }
    pool = new Pool({
      connectionString,
      max: 5, // keep connections low — this is a read proxy
      ssl: process.env.DATABASE_SSL === "false"
        ? false
        : { rejectUnauthorized: false }, // DigitalOcean managed DBs use SSL
    });
  }
  return pool;
}

// ---------------------------------------------------------------------------
// The ONLY function that can run queries. It enforces read-only at TWO levels:
//   1. Application-level: assertReadOnly() blocks non-SELECT queries
//   2. PostgreSQL-level: SET TRANSACTION READ ONLY prevents any writes
//      even if a query somehow bypasses the keyword check
// ---------------------------------------------------------------------------
export async function readOnlyQuery(
  sql: string,
  params?: unknown[]
): Promise<QueryResult> {
  // LAYER 1: Application-level validation
  assertReadOnly(sql);

  const client = await getPool().connect();
  try {
    // LAYER 2: PostgreSQL-level enforcement
    await client.query("BEGIN TRANSACTION READ ONLY");
    const result = await client.query(sql, params);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {}); // best-effort rollback
    throw error;
  } finally {
    client.release();
  }
}
