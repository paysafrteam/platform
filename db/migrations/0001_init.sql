-- PaySafr schema v1. All money is integer kobo (bigint). Ledger and audit log are append-only.

CREATE TABLE users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  email_verified_at timestamptz,
  password_hash text NOT NULL,
  name text NOT NULL,
  phone text NOT NULL,
  seller_type text NOT NULL DEFAULT 'freelancer' CHECK (seller_type IN ('freelancer','seller')),
  business_name text,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','limited','suspended')),
  status_reason text,
  terms_accepted_at timestamptz,
  trust_score integer CHECK (trust_score BETWEEN 0 AND 100),
  trust_level text NOT NULL DEFAULT 'new' CHECK (trust_level IN ('new','rising','trusted','verified')),
  completed_orders integer NOT NULL DEFAULT 0,
  last_login_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX users_email_lower_uq ON users (lower(email));

CREATE TABLE payout_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES users(id) ON DELETE RESTRICT,
  bank_code text NOT NULL,
  bank_name text NOT NULL,
  account_number text NOT NULL CHECK (account_number ~ '^[0-9]{10}$'),
  account_name text NOT NULL,
  verified boolean NOT NULL DEFAULT false,
  verified_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  token_hash text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  ip text,
  user_agent text,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX sessions_user_idx ON sessions (user_id);

CREATE TABLE admin_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  name text NOT NULL,
  password_hash text NOT NULL,
  role text NOT NULL DEFAULT 'super_admin',
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','disabled')),
  failed_attempts integer NOT NULL DEFAULT 0,
  locked_until timestamptz,
  password_changed_at timestamptz,
  last_login_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX admin_users_email_lower_uq ON admin_users (lower(email));

CREATE TABLE admin_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id uuid NOT NULL REFERENCES admin_users(id) ON DELETE RESTRICT,
  token_hash text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  ip text,
  user_agent text,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE otp_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  purpose text NOT NULL CHECK (purpose IN ('verify_email','reset_password')),
  code_hash text NOT NULL,
  attempts integer NOT NULL DEFAULT 0,
  expires_at timestamptz NOT NULL,
  consumed_at timestamptz,
  send_count integer NOT NULL DEFAULT 1,
  last_sent_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (email, purpose)
);

CREATE TABLE orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  token text NOT NULL UNIQUE,
  title text NOT NULL,
  description text NOT NULL DEFAULT '',
  total_kobo bigint NOT NULL CHECK (total_kobo > 0),
  currency text NOT NULL DEFAULT 'NGN' CHECK (currency = 'NGN'),
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','awaiting_payment','funded','completed','expired','cancelled')),
  buyer_email text,
  buyer_phone text,
  delivery_deadline timestamptz NOT NULL,
  review_window_hours integer NOT NULL CHECK (review_window_hours BETWEEN 1 AND 720),
  fee_kobo bigint NOT NULL CHECK (fee_kobo >= 0),
  amount_funded_kobo bigint NOT NULL DEFAULT 0 CHECK (amount_funded_kobo >= 0),
  overpaid_kobo bigint NOT NULL DEFAULT 0 CHECK (overpaid_kobo >= 0),
  order_account_bank text,
  order_account_number text,
  order_account_name text,
  order_account_expires_at timestamptz,
  expires_at timestamptz,
  published_at timestamptz,
  funded_at timestamptz,
  completed_at timestamptz,
  cancelled_at timestamptz,
  needs_refund_flag boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX orders_seller_idx ON orders (seller_id, created_at DESC);
CREATE INDEX orders_status_expiry_idx ON orders (status, expires_at);
CREATE UNIQUE INDEX orders_account_number_uq ON orders (order_account_number) WHERE order_account_number IS NOT NULL;

CREATE TABLE milestones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES orders(id) ON DELETE RESTRICT,
  position integer NOT NULL CHECK (position >= 1),
  title text NOT NULL,
  amount_kobo bigint NOT NULL CHECK (amount_kobo > 0),
  fee_kobo bigint NOT NULL CHECK (fee_kobo >= 0),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','delivered','released','disputed','refunded')),
  proof_kind text CHECK (proof_kind IN ('link','note')),
  proof_content text,
  delivered_at timestamptz,
  release_at timestamptz,
  released_at timestamptz,
  reminder_sent_at timestamptz,
  revision_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (order_id, position)
);
CREATE INDEX milestones_due_idx ON milestones (status, release_at);

CREATE TABLE change_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  milestone_id uuid NOT NULL REFERENCES milestones(id) ON DELETE RESTRICT,
  note text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX change_requests_milestone_idx ON change_requests (milestone_id);

CREATE TABLE payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES orders(id) ON DELETE RESTRICT,
  provider text NOT NULL,
  provider_reference text NOT NULL,
  amount_kobo bigint NOT NULL CHECK (amount_kobo > 0),
  status text NOT NULL CHECK (status IN ('applied','flagged_late','flagged_over')),
  received_at timestamptz NOT NULL DEFAULT now(),
  raw jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (provider, provider_reference)
);
CREATE INDEX payments_order_idx ON payments (order_id);

CREATE TABLE ledger_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES orders(id) ON DELETE RESTRICT,
  milestone_id uuid REFERENCES milestones(id) ON DELETE RESTRICT,
  type text NOT NULL CHECK (type IN ('funding','release','fee','refund')),
  amount_kobo bigint NOT NULL CHECK (amount_kobo > 0),
  reference text NOT NULL,
  idempotency_key text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ledger_order_idx ON ledger_entries (order_id);
CREATE INDEX ledger_created_idx ON ledger_entries (created_at DESC);

CREATE TABLE payouts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES orders(id) ON DELETE RESTRICT,
  milestone_id uuid REFERENCES milestones(id) ON DELETE RESTRICT,
  kind text NOT NULL DEFAULT 'seller_payout' CHECK (kind IN ('seller_payout','buyer_refund')),
  amount_kobo bigint NOT NULL CHECK (amount_kobo > 0),
  status text NOT NULL DEFAULT 'queued' CHECK (status IN ('queued','processing','paid','failed')),
  provider_reference text,
  attempts integer NOT NULL DEFAULT 0,
  last_error text,
  idempotency_key text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX payouts_milestone_kind_uq ON payouts (milestone_id, kind) WHERE milestone_id IS NOT NULL;
CREATE INDEX payouts_status_idx ON payouts (status);


CREATE TABLE disputes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  number integer GENERATED ALWAYS AS IDENTITY (START WITH 1001) UNIQUE,
  order_id uuid NOT NULL REFERENCES orders(id) ON DELETE RESTRICT,
  milestone_id uuid NOT NULL REFERENCES milestones(id) ON DELETE RESTRICT,
  opened_by text NOT NULL CHECK (opened_by IN ('buyer','seller')),
  reason text NOT NULL CHECK (reason IN ('not_delivered','not_as_described','delivered_late','other')),
  note text NOT NULL,
  status text NOT NULL DEFAULT 'awaiting_response' CHECK (status IN ('open','awaiting_response','under_review','resolved')),
  response_due_at timestamptz NOT NULL,
  outcome text CHECK (outcome IN ('release_to_seller','refund_to_buyer','split')),
  split_to_seller_kobo bigint CHECK (split_to_seller_kobo >= 0),
  decision_reason text,
  decided_early boolean NOT NULL DEFAULT false,
  decided_by uuid REFERENCES admin_users(id) ON DELETE RESTRICT,
  opened_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX disputes_one_open_per_milestone_uq ON disputes (milestone_id) WHERE status <> 'resolved';
CREATE INDEX disputes_status_idx ON disputes (status);
CREATE INDEX disputes_order_idx ON disputes (order_id);

CREATE TABLE evidence (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dispute_id uuid NOT NULL REFERENCES disputes(id) ON DELETE RESTRICT,
  submitted_by text NOT NULL CHECK (submitted_by IN ('buyer','seller')),
  type text NOT NULL CHECK (type IN ('text','link')),
  content text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX evidence_dispute_idx ON evidence (dispute_id);

CREATE SEQUENCE receipt_number_seq START 1;
CREATE TABLE receipts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  number text NOT NULL UNIQUE,
  public_token text NOT NULL UNIQUE,
  type text NOT NULL CHECK (type IN ('payment','completion')),
  order_id uuid NOT NULL REFERENCES orders(id) ON DELETE RESTRICT,
  milestone_id uuid REFERENCES milestones(id) ON DELETE RESTRICT,
  snapshot jsonb NOT NULL,
  issued_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX receipts_unique_per_event_uq
  ON receipts (order_id, type, COALESCE(milestone_id, '00000000-0000-0000-0000-000000000000'::uuid));
CREATE INDEX receipts_order_idx ON receipts (order_id);

CREATE TABLE notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  type text NOT NULL,
  title text NOT NULL,
  message text NOT NULL,
  order_id uuid REFERENCES orders(id) ON DELETE RESTRICT,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX notifications_user_idx ON notifications (user_id, created_at DESC);

CREATE TABLE email_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  to_hash text NOT NULL,
  template text NOT NULL,
  status text NOT NULL CHECK (status IN ('sent','failed')),
  provider_message_id text,
  error text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX email_log_created_idx ON email_log (created_at DESC);

CREATE TABLE trust_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  order_id uuid REFERENCES orders(id) ON DELETE RESTRICT,
  event_type text NOT NULL,
  delta integer NOT NULL,
  score_after integer,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX trust_events_seller_idx ON trust_events (seller_id, created_at DESC);

CREATE TABLE audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_type text NOT NULL CHECK (actor_type IN ('admin','user','system')),
  actor_id text,
  actor_label text NOT NULL,
  action text NOT NULL,
  target_type text,
  target_id text,
  before jsonb,
  after jsonb,
  ip text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX audit_target_idx ON audit_log (target_type, target_id);
CREATE INDEX audit_created_idx ON audit_log (created_at DESC);

CREATE TABLE platform_settings (
  key text PRIMARY KEY,
  value jsonb NOT NULL,
  updated_by text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE rate_limits (
  key text PRIMARY KEY,
  window_start timestamptz NOT NULL,
  count integer NOT NULL
);

CREATE TABLE job_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  ok boolean,
  detail jsonb
);

-- Append-only guards: the ledger and the audit log can never be edited or deleted.
CREATE FUNCTION forbid_mutation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION '% is append-only: % is not allowed', TG_TABLE_NAME, TG_OP USING ERRCODE = 'integrity_constraint_violation';
END $$;
CREATE TRIGGER ledger_entries_append_only BEFORE UPDATE OR DELETE ON ledger_entries
  FOR EACH ROW EXECUTE FUNCTION forbid_mutation();
CREATE TRIGGER ledger_entries_no_truncate BEFORE TRUNCATE ON ledger_entries
  FOR EACH STATEMENT EXECUTE FUNCTION forbid_mutation();
CREATE TRIGGER audit_log_append_only BEFORE UPDATE OR DELETE ON audit_log
  FOR EACH ROW EXECUTE FUNCTION forbid_mutation();
CREATE TRIGGER audit_log_no_truncate BEFORE TRUNCATE ON audit_log
  FOR EACH STATEMENT EXECUTE FUNCTION forbid_mutation();

-- Held balance of an order (funding - release - refund - fee) can never go below zero.
CREATE FUNCTION ledger_check_held() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE held bigint;
BEGIN
  SELECT COALESCE(SUM(CASE WHEN type = 'funding' THEN amount_kobo ELSE -amount_kobo END), 0)
    INTO held FROM ledger_entries WHERE order_id = NEW.order_id;
  IF held < 0 THEN
    RAISE EXCEPTION 'Held balance for order % would go below zero', NEW.order_id USING ERRCODE = 'check_violation';
  END IF;
  RETURN NULL;
END $$;
CREATE CONSTRAINT TRIGGER ledger_entries_held_nonneg AFTER INSERT ON ledger_entries
  DEFERRABLE INITIALLY IMMEDIATE FOR EACH ROW EXECUTE FUNCTION ledger_check_held();

INSERT INTO platform_settings (key, value) VALUES
  ('review_window_hours', '72'), ('unpaid_expiry_hours', '48'), ('dispute_response_hours', '48');
