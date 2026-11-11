CREATE TABLE members (
  id TEXT PRIMARY KEY, email TEXT NOT NULL UNIQUE, username TEXT NOT NULL COLLATE NOCASE UNIQUE,
  password_hash TEXT NOT NULL, relationship TEXT NOT NULL, company TEXT NOT NULL DEFAULT '',
  display_name TEXT NOT NULL DEFAULT '', avatar TEXT NOT NULL DEFAULT '', verified INTEGER NOT NULL DEFAULT 0,
  language TEXT NOT NULL, created_at TEXT NOT NULL
);
CREATE TABLE member_sessions (
  token_hash TEXT PRIMARY KEY, member_id TEXT NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  expires_at INTEGER NOT NULL
);
CREATE INDEX member_sessions_member ON member_sessions(member_id);
CREATE TABLE member_links (
  token_hash TEXT PRIMARY KEY, member_id TEXT NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  purpose TEXT NOT NULL, expires_at INTEGER NOT NULL
);
ALTER TABLE submissions ADD COLUMN member_id TEXT REFERENCES members(id);
CREATE INDEX submissions_member ON submissions(member_id, created_at);
