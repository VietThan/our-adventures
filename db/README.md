# Database Contract

This directory owns the repository-level PostgreSQL contract for `our-adventures`.

## Scope

- Database: `vietthan`
- Schema: `our_adventures`
- Canonical baseline dataset: [`../data/activities.json`](../data/activities.json)

`db/migrations/` defines schema only: schema creation, enum types, tables, indexes, and constraints.

## Initialize A Fresh Database

Run migrations only:

```bash
docker compose up -d

node scripts/migrate.mjs
```

Run the full Phase 1 bootstrap from the repo root:

```bash
node scripts/bootstrap-phase1.mjs
```

This script:

- applies all SQL files in `db/migrations/` in filename order
- seeds the two allowlisted users idempotently
- bootstraps baseline activities once from `data/activities.json`

Routine deploys should prefer `scripts/migrate.mjs`. `scripts/bootstrap-phase1.mjs`
is for first-time environment setup.

Docker is only responsible for running the local Postgres service and keeping
its data volume. Schema setup and bootstrap now flow through the repo scripts,
not through `/docker-entrypoint-initdb.d/`.

For local development, these repo scripts automatically read `apps/web/.env.local`
when it exists. In production or CI, pass environment variables explicitly.

The app expects to run queries with:

```sql
SET search_path TO our_adventures, public;
```

## Loading Baseline Activities

The source dataset lives in [`../data/activities.json`](../data/activities.json) and is imported by `scripts/bootstrap-phase1.mjs`.

Activity bootstrap is intentionally fresh-db-oriented:

- user rows are idempotent
- activity rows are only inserted when the table is empty
- the database becomes the authoritative catalog after bootstrap

That keeps:

- schema history in `db/migrations/`
- baseline content in `data/activities.json`
- production dumps reserved for backup, restore, or debugging

## Notes

- Categories are part of the DB contract and validated by the `our_adventures.activity_category` enum.
- Seasons remain flexible for now and stay as plain text.
- `users.email` is the allowlist key.
- `users.google_sub` is attached on first successful Google login and then treated as fixed.
