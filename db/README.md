# Database Contract

This directory owns the repository-level PostgreSQL contract for `our-adventures`.

## Scope

- Database: `vietthan`
- Schema: `our_adventures`
- Canonical baseline dataset: [`../data/activities.json`](../data/activities.json)

`db/migrations/` defines schema only: schema creation, enum types, tables, indexes, and constraints.

## Initialize A Fresh Database

Apply the initial schema:

```bash
psql "$DATABASE_URL" -f db/migrations/001_initial_schema.sql
```

The app expects to run queries with:

```sql
SET search_path TO our_adventures, public;
```

## Loading Baseline Activities

The schema migration intentionally does not import baseline activity rows. The source dataset lives in [`../data/activities.json`](../data/activities.json) and should be imported separately.

That keeps:

- schema history in `db/migrations/`
- baseline content in `data/activities.json`
- production dumps reserved for backup, restore, or debugging

## Notes

- Categories are part of the DB contract and validated by the `our_adventures.activity_category` enum.
- Seasons remain flexible for now and stay as plain text.
