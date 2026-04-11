# our-adventures

A private full-stack activity tracker for Viet and Linh.

## Status

Scaffold in progress. The repo currently holds planning documents and root-level development setup.

## Local Development

Start the local PostgreSQL container:

```bash
docker compose up -d
```

This starts Postgres on port `5432` with:

- database: `vietthan`
- user: `postgres`
- password: `postgres`

The app should use the `our_adventures` schema inside that shared database.

Application packages and schema bootstrap are scaffolded in later steps.
