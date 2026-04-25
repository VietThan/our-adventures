import { Pool, type PoolClient } from "pg";

declare global {
  // Reuse the pool during local hot reload to avoid runaway connections.
  var __ourAdventuresPool: Pool | undefined;
}

export function getPool() {
  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error("DATABASE_URL is not set");
  }

  const hostname = getDatabaseHostname(connectionString);
  const ssl = shouldUseSsl(hostname)
    ? { rejectUnauthorized: false }
    : undefined;

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
