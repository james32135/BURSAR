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
