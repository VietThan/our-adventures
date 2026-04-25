import { createRequire } from "node:module";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

const rootDir = path.resolve(import.meta.dirname, "../..");
const envFilePath = path.join(rootDir, "apps/web/.env.local");
const require = createRequire(path.join(rootDir, "apps/web/package.json"));
const { Client } = require("pg");

export function getRootDir() {
  return rootDir;
}

export async function withDatabase(run) {
  await loadLocalEnvFile();

  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required.");
  }

  const client = new Client({ connectionString: databaseUrl });
  await client.connect();

  try {
    return await run(client);
  } finally {
    await client.end();
  }
}

export async function applyMigrations(client) {
  const migrationsDir = path.join(rootDir, "db", "migrations");
  const filenames = (await readdir(migrationsDir))
    .filter((filename) => filename.endsWith(".sql"))
    .sort();

  for (const filename of filenames) {
    const fullPath = path.join(migrationsDir, filename);
    const sql = await readFile(fullPath, "utf8");
    console.log(`Applying ${filename}`);
    await client.query(sql);
  }
}

export async function seedUsers(client) {
  const vietEmail = process.env.VIET_EMAIL?.trim().toLowerCase();
  const linhEmail = process.env.LINH_EMAIL?.trim().toLowerCase();

  if (!vietEmail || !linhEmail) {
    throw new Error("VIET_EMAIL and LINH_EMAIL are required.");
  }

  console.log("Seeding allowed users");
  await client.query(
    `
      INSERT INTO users (email, display_name)
      VALUES
        ($1, 'Viet'),
        ($2, 'Linh')
      ON CONFLICT (email)
      DO UPDATE SET display_name = EXCLUDED.display_name
    `,
    [vietEmail, linhEmail],
  );
}

export async function seedActivities(client) {
  const countResult = await client.query(
    "SELECT COUNT(*)::int AS count FROM activities",
  );
  const existingCount = countResult.rows[0]?.count ?? 0;

  if (existingCount > 0) {
    console.log(
      `Skipping activity bootstrap because ${existingCount} activities already exist.`,
    );
    return;
  }

  console.log("Bootstrapping activities from data/activities.json");
  const activitiesPath = path.join(rootDir, "data", "activities.json");
  const activities = JSON.parse(await readFile(activitiesPath, "utf8"));

  for (const activity of activities) {
    await client.query(
      `
        INSERT INTO activities (
          title,
          category,
          season,
          notes,
          tip,
          link,
          is_custom,
          added_by
        )
        VALUES ($1, $2, $3, $4, $5, $6, FALSE, NULL)
      `,
      [
        activity.title,
        activity.category,
        activity.season,
        activity.notes ?? null,
        activity.tip ?? null,
        activity.link ?? null,
      ],
    );
  }

  console.log(`Inserted ${activities.length} baseline activities.`);
}

let hasLoadedEnvFile = false;

async function loadLocalEnvFile() {
  if (hasLoadedEnvFile) {
    return;
  }

  hasLoadedEnvFile = true;

  let raw;
  try {
    raw = await readFile(envFilePath, "utf8");
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") {
      return;
    }

    throw error;
  }

  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();

    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    const separatorIndex = trimmed.indexOf("=");
    if (separatorIndex === -1) {
      continue;
    }

    const key = trimmed.slice(0, separatorIndex).trim();
    if (!key || process.env[key] !== undefined) {
      continue;
    }

    let value = trimmed.slice(separatorIndex + 1).trim();

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    process.env[key] = value;
  }
}
