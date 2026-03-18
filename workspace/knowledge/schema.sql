CREATE TABLE IF NOT EXISTS entries (
  id                   INTEGER PRIMARY KEY AUTOINCREMENT,
  path                 TEXT    NOT NULL UNIQUE,
  content_hash         TEXT    NOT NULL,
  openai_file_id       TEXT,
  vector_store_file_id TEXT,
  summary              TEXT,
  outline              TEXT,
  title                TEXT,
  category             TEXT,
  tags                 TEXT,
  created_by           TEXT    DEFAULT 'human',
  word_count           INTEGER,
  created_at           TEXT    DEFAULT (datetime('now')),
  updated_at           TEXT    DEFAULT (datetime('now')),
  last_synced          TEXT,
  sync_error           TEXT,
  status               TEXT    DEFAULT 'pending'
                                CHECK (status IN ('pending','synced','error','deleted'))
);

CREATE INDEX IF NOT EXISTS idx_entries_status   ON entries(status);
CREATE INDEX IF NOT EXISTS idx_entries_category ON entries(category);
CREATE INDEX IF NOT EXISTS idx_entries_hash     ON entries(content_hash);
