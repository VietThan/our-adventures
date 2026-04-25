import { readFileSync } from "node:fs";
import { Pool, type PoolClient } from "pg";

declare global {
  // Reuse the pool during local hot reload to avoid runaway connections.
  var __ourAdventuresPool: Pool | undefined;
}

const RDS_CA_PATH = "/etc/ssl/certs/rds-combined-ca-bundle.pem";

export function getPool() {
  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error("DATABASE_URL is not set");
  }

  const hostname = getDatabaseHostname(connectionString);
  const ssl = buildSslConfig(hostname);

  if (!global.__ourAdventuresPool) {
    global.__ourAdventuresPool = new Pool({
      connectionString,
      ssl,
    });
  }

  return global.__ourAdventuresPool;
}

function getDatabaseHostname(connectionString: string) {
  try {
    return new URL(connectionString).hostname;
  } catch {
    return null;
  }
}

function shouldUseSsl(hostname: string | null) {
  if (!hostname) {
    return false;
  }

  return !["localhost", "127.0.0.1", "::1"].includes(hostname);
}

function buildSslConfig(hostname: string | null) {
  if (!shouldUseSsl(hostname)) return undefined;

  try {
    return { ca: readFileSync(RDS_CA_PATH, "utf8") };
  } catch {
    if (process.env.NODE_ENV === "production") {
      throw new Error(`RDS CA bundle not found at ${RDS_CA_PATH}`);
    }

    // CA bundle not found — likely local dev hitting a non-localhost PG.
    // Fall back to unverified TLS rather than crashing, but log a warning.
    console.warn(
      `RDS CA bundle not found at ${RDS_CA_PATH} — using unverified TLS`,
    );
    return { rejectUnauthorized: false };
  }
}

export async function withSchemaSearchPath<T>(
  run: (client: PoolClient) => Promise<T>,
) {
  const client = await getPool().connect();

  try {
    await client.query("SET search_path TO our_adventures, public");
    return await run(client);
  } finally {
    client.release();
  }
}
