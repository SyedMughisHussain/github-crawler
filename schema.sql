-- schema.sql
-- Primary metadata table
CREATE TABLE IF NOT EXISTS repositories (
  id BIGSERIAL PRIMARY KEY,
  github_id BIGINT UNIQUE NOT NULL,       -- GitHub GraphQL id (numeric if available)
  full_name TEXT NOT NULL UNIQUE,         -- owner/name
  name TEXT NOT NULL,
  owner TEXT NOT NULL,
  url TEXT,
  description TEXT,
  primary_language TEXT,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  last_crawled_at TIMESTAMPTZ
);

-- Time-series of star counts (append-only)
CREATE TABLE IF NOT EXISTS stars_snapshots (
  id BIGSERIAL PRIMARY KEY,
  repository_id BIGINT NOT NULL REFERENCES repositories(id) ON DELETE CASCADE,
  snapshot_date TIMESTAMPTZ NOT NULL DEFAULT now(),
  stargazers_count INTEGER NOT NULL,
  UNIQUE(repository_id, snapshot_date)   -- optional: prevents duplicate per-run snapshots
);

-- Optional: small metadata table for flexible adding of other fields
CREATE TABLE IF NOT EXISTS repo_extra (
  id BIGSERIAL PRIMARY KEY,
  repository_id BIGINT NOT NULL REFERENCES repositories(id) ON DELETE CASCADE,
  key TEXT NOT NULL,
  value JSONB,
  UNIQUE(repository_id, key)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_repos_github_id ON repositories (github_id);
CREATE INDEX IF NOT EXISTS idx_snapshots_repo_date ON stars_snapshots (repository_id, snapshot_date DESC);
