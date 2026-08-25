-- BURSAR application state. Proof of payment is on-chain, not in this table.
-- Isolation: every invoice and event is keyed by workspace_id.

CREATE TABLE IF NOT EXISTS workspaces (
  id TEXT PRIMARY KEY,
  owner TEXT NOT NULL,
  vault TEXT NOT NULL UNIQUE,
  session_id TEXT NOT NULL,
  agent_address TEXT NOT NULL,
  agent_pk_enc TEXT NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,
  demo BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS invoices (
  workspace_id TEXT NOT NULL,
  invoice_hash TEXT NOT NULL,
  storage_root TEXT,
  flow_tx TEXT,
  tx_seq BIGINT,
  go_proof_ok BOOLEAN,
  go_proof_log TEXT,
  status TEXT NOT NULL DEFAULT 'received',
  flags JSONB NOT NULL DEFAULT '[]'::jsonb,
  extracted JSONB,
  vendor TEXT,
  remittance TEXT,
  amount_units BIGINT,
  chat_id TEXT,
  signed_text TEXT,
  request_half TEXT,
  response_hash TEXT,
  recovered_signer TEXT,
  process_response TEXT,
  attestation_ok BOOLEAN,
  register_tx TEXT,
  pay_tx TEXT,
  pay_session TEXT,
  source TEXT NOT NULL DEFAULT 'pdf',
  kind TEXT NOT NULL DEFAULT 'invoice',
  pipeline TEXT,
  decision TEXT,
  decision_why JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (workspace_id, invoice_hash)
);

CREATE TABLE IF NOT EXISTS events (
  id BIGSERIAL PRIMARY KEY,
  workspace_id TEXT,
  invoice_hash TEXT,
  kind TEXT NOT NULL,
  detail JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS events_invoice_idx ON events (invoice_hash);

CREATE TABLE IF NOT EXISTS integrations (
  workspace_id TEXT NOT NULL,
  kind TEXT NOT NULL,
  config JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (workspace_id, kind)
);

CREATE TABLE IF NOT EXISTS telegram_identities (
  telegram_user_id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  chat_id TEXT NOT NULL,
  username TEXT,
  bound_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  revoked_at TIMESTAMPTZ,
  last_action_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS telegram_identities_ws_idx ON telegram_identities (workspace_id);

CREATE TABLE IF NOT EXISTS telegram_bind_codes (
  code_hash TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS telegram_updates (
  update_id BIGINT PRIMARY KEY,
  received_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS telegram_actions (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  telegram_user_id TEXT NOT NULL,
  kind TEXT NOT NULL,
  payload JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS email_messages (
  workspace_id TEXT NOT NULL,
  message_id TEXT NOT NULL,
  attachment_hash TEXT NOT NULL,
  invoice_hash TEXT,
  from_addr TEXT,
  subject TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (workspace_id, message_id)
);

CREATE INDEX IF NOT EXISTS email_messages_hash_idx ON email_messages (workspace_id, attachment_hash);

CREATE TABLE IF NOT EXISTS jobs (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  kind TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'queued',
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  invoice_hash TEXT,
  error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS jobs_status_idx ON jobs (status, created_at);
CREATE INDEX IF NOT EXISTS jobs_invoice_idx ON jobs (workspace_id, invoice_hash);

-- Remembered obligations. Matching is not a blind transfer. Policy still decides.
CREATE TABLE IF NOT EXISTS obligations (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  vendor TEXT NOT NULL,
  remittance TEXT NOT NULL,
  cadence TEXT NOT NULL DEFAULT 'monthly',
  expected_min BIGINT,
  expected_max BIGINT,
  last_matched_hash TEXT,
  last_matched_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS obligations_ws_idx ON obligations (workspace_id);
