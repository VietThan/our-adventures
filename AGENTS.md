# AGENTS.md

This file provides guidance to coding agents when working with code in this repository.

## What this is

A full-stack couples' activity tracker for Viet and Linh. Replaces a frontend-only prototype (`nyc-adventure`) with real data persistence. Private — 2 users only.

## Architecture

Monorepo with three packages:

- **`apps/web/`** — Next.js (App Router, server mode, TypeScript, Tailwind) on port `3000`. Owns both the UI and server-side routes. No ORM — raw `pg` queries in `src/db/queries/`. Auth.js handles Google OAuth. Never `output: 'export'` — server mode is required for Auth.js routes.
- **`infra/`** — AWS CDK (TypeScript). Three stacks: `network` (VPC), `database` (RDS PostgreSQL t4g.micro), `compute` (EC2 t4g.nano). Run manually, not in CI.

In production, the Next.js app runs on a single EC2 t4g.nano behind nginx.

## Database

PostgreSQL. Three tables: `activities`, `users`, `completions` in schema `our_adventures` inside database `vietthan`. See `db/migrations/001_initial_schema.sql` for the full schema.

Migrations live under `db/` and should be run against the `our_adventures` schema in the shared `vietthan` database.

## Local development

Requires Docker. Start the local Postgres instance:

```bash
docker compose up -d
```

This starts Postgres on port `5432` with database `vietthan`, user `postgres`, password `postgres`.

Each app reads `DATABASE_URL` from a `.env.local` file — copy `.env.local.example` if present.

## Auth

Auth.js (NextAuth v5) with Google provider. The `signIn` callback enforces an email allowlist — only the two configured emails can log in.

Required env vars for auth: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `AUTH_SECRET`.

## Deployment

GitHub Actions — two workflows:

- **`deploy-app.yml`** — triggers on push to `main`. Builds the Next.js app, rsyncs to EC2, runs migrations, restarts the web systemd service via SSH.
- **`deploy-infra.yml`** — manual trigger only. Runs `cdk deploy`.

Infra changes (`infra/`) are never deployed automatically.

## Planning docs

`ai/` contains planning documents for this project. Check there for architectural decisions and rationale before making structural changes.
