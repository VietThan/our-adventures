import { applyMigrations, withDatabase } from "./lib/db-bootstrap.mjs";

async function main() {
  try {
    await withDatabase(async (client) => {
      await client.query("BEGIN");
      await applyMigrations(client);
      await client.query("COMMIT");
    });

    console.log("Migrations complete.");
  } catch (error) {
    console.error("Migration failed.");
    console.error(error);
    process.exitCode = 1;
  }
}

await main();
