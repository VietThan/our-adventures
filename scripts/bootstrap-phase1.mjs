import {
  applyMigrations,
  seedActivities,
  seedUsers,
  withDatabase,
} from "./lib/db-bootstrap.mjs";

async function main() {
  try {
    await withDatabase(async (client) => {
      await client.query("BEGIN");
      await applyMigrations(client);
      await client.query("SET search_path TO our_adventures, public");
      await seedUsers(client);
      await seedActivities(client);
      await client.query("COMMIT");
    });

    console.log("Phase 1 bootstrap complete.");
  } catch (error) {
    console.error("Bootstrap failed.");
    console.error(error);
    process.exitCode = 1;
  }
}

await main();
