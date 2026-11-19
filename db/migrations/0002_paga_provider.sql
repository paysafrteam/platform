ALTER TABLE orders
  ADD COLUMN order_account_total_payment_kobo bigint;

CREATE TABLE paga_payment_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES orders(id) ON DELETE RESTRICT,
  reference_number text NOT NULL UNIQUE,
  request_amount_kobo bigint NOT NULL CHECK (request_amount_kobo > 0),
  total_payment_amount_kobo bigint CHECK (total_payment_amount_kobo > 0),
  bank_name text,
  account_number text,
  account_name text,
  expires_at timestamptz NOT NULL,
  status text NOT NULL CHECK (status IN ('creating','pending','paid','expired','failed','review')),
  last_status_code text,
  last_error text,
  last_checked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (
    status <> 'pending'
    OR (total_payment_amount_kobo IS NOT NULL AND bank_name IS NOT NULL AND account_number IS NOT NULL)
  )
);
CREATE INDEX paga_payment_requests_order_idx ON paga_payment_requests (order_id, created_at DESC);
CREATE INDEX paga_payment_requests_reconcile_idx ON paga_payment_requests (status, updated_at)
  WHERE status IN ('creating','pending','review');
CREATE UNIQUE INDEX paga_one_active_request_per_order_uq ON paga_payment_requests (order_id)
  WHERE status IN ('creating','pending','review');

CREATE TABLE paga_notifications (
  notification_id text PRIMARY KEY,
  external_reference_number text NOT NULL,
  event text,
  received_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE paga_payout_notifications (
  reference_number text PRIMARY KEY,
  received_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE payouts
  ADD COLUMN paga_reference_number text,
  ADD COLUMN paga_transaction_id text,
  ADD COLUMN reversal_id text,
  ADD COLUMN paga_same_ref_retry_used boolean NOT NULL DEFAULT false,
  ADD COLUMN paga_destination_bank_code text,
  ADD COLUMN paga_destination_account_number text,
  ADD COLUMN paga_destination_account_name text;
CREATE UNIQUE INDEX payouts_paga_reference_uq ON payouts (paga_reference_number)
  WHERE paga_reference_number IS NOT NULL;

ALTER TABLE payouts DROP CONSTRAINT payouts_status_check;
ALTER TABLE payouts ADD CONSTRAINT payouts_status_check
  CHECK (status IN ('queued','processing','pending','paid','failed','reversed'));
