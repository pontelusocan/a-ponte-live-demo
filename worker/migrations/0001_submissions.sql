CREATE TABLE submissions (
  id TEXT PRIMARY KEY,
  request_hash TEXT NOT NULL,
  object_key TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL,
  completed_at TEXT,
  display_name TEXT NOT NULL,
  description TEXT NOT NULL,
  city TEXT NOT NULL DEFAULT '',
  country TEXT NOT NULL DEFAULT '',
  country_code TEXT NOT NULL DEFAULT '',
  language TEXT NOT NULL CHECK(language IN ('EN','FR','PT')),
  processing_consent INTEGER NOT NULL CHECK(processing_consent = 1),
  publication_consent INTEGER NOT NULL CHECK(publication_consent IN (0,1)),
  consent_version TEXT NOT NULL,
  privacy_reference TEXT NOT NULL,
  consent_at TEXT NOT NULL,
  environment TEXT NOT NULL CHECK(environment = 'staging'),
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status = 'pending'),
  processing_state TEXT NOT NULL CHECK(processing_state IN ('receiving','ready','retryable','deleting')),
  processed_bytes INTEGER,
  processed_sha256 TEXT,
  failure_code TEXT,
  expires_at TEXT NOT NULL
);
CREATE INDEX submissions_recovery ON submissions(processing_state,created_at);
CREATE INDEX submissions_expiry ON submissions(expires_at);
-- A hard staging lifetime budget, including failed processing attempts. Never reset automatically.
CREATE TABLE staging_budget (id INTEGER PRIMARY KEY CHECK(id=1), attempts INTEGER NOT NULL DEFAULT 0);
INSERT INTO staging_budget(id,attempts) VALUES(1,0);
