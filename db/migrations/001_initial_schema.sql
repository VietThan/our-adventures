CREATE SCHEMA IF NOT EXISTS our_adventures;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'activity_category'
      AND n.nspname = 'our_adventures'
  ) THEN
    CREATE TYPE our_adventures.activity_category AS ENUM (
      'cinema',
      'food',
      'bakery',
      'arts',
      'shows',
      'explore',
      'wellness',
      'daytrip',
      'free',
      'classes'
    );
  END IF;
END
$$;

CREATE TABLE IF NOT EXISTS our_adventures.activities (
  id SERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  category our_adventures.activity_category NOT NULL,
  season TEXT NOT NULL,
  notes TEXT,
  tip TEXT,
  link TEXT,
  is_custom BOOLEAN NOT NULL DEFAULT FALSE,
  added_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS our_adventures.users (
  id BIGSERIAL PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  google_sub TEXT UNIQUE,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS our_adventures.completions (
  activity_id INT NOT NULL REFERENCES our_adventures.activities(id) ON DELETE CASCADE,
  user_id BIGINT NOT NULL REFERENCES our_adventures.users(id),
  completed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  rating SMALLINT CHECK (rating BETWEEN 1 AND 5),
  review TEXT,
  PRIMARY KEY (activity_id, user_id)
);

CREATE INDEX IF NOT EXISTS activities_category_idx
  ON our_adventures.activities (category);

CREATE INDEX IF NOT EXISTS completions_user_id_idx
  ON our_adventures.completions (user_id);
