-- Add Daimo payment tracking fields to orders table
ALTER TABLE orders
ADD COLUMN IF NOT EXISTS daimo_payment_id TEXT,
ADD COLUMN IF NOT EXISTS daimo_source_chain TEXT,
ADD COLUMN IF NOT EXISTS daimo_source_token TEXT,
ADD COLUMN IF NOT EXISTS payment_verified_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS payment_verification_source TEXT,
ADD COLUMN IF NOT EXISTS payment_failure_reason TEXT,
ADD COLUMN IF NOT EXISTS refund_tx_hash TEXT,
ADD COLUMN IF NOT EXISTS refunded_at TIMESTAMPTZ;

-- Create index on daimo_payment_id for fast webhook lookups
CREATE INDEX IF NOT EXISTS idx_orders_daimo_payment_id ON orders(daimo_payment_id);

-- Create webhook_logs table for audit trail
CREATE TABLE IF NOT EXISTS webhook_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source TEXT NOT NULL, -- 'daimo', 'shopify', etc.
  event_type TEXT NOT NULL, -- 'payment_completed', 'payment_started', etc.
  payment_id TEXT, -- External payment ID (e.g., Daimo payment ID)
  external_id TEXT, -- Our order ID
  tx_hash TEXT, -- Transaction hash
  chain_id TEXT, -- Chain ID where transaction occurred
  raw_payload JSONB NOT NULL, -- Full webhook payload for debugging
  processed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes for webhook_logs
CREATE INDEX IF NOT EXISTS idx_webhook_logs_source ON webhook_logs(source);
CREATE INDEX IF NOT EXISTS idx_webhook_logs_payment_id ON webhook_logs(payment_id);
CREATE INDEX IF NOT EXISTS idx_webhook_logs_external_id ON webhook_logs(external_id);
CREATE INDEX IF NOT EXISTS idx_webhook_logs_tx_hash ON webhook_logs(tx_hash);
CREATE INDEX IF NOT EXISTS idx_webhook_logs_created_at ON webhook_logs(created_at DESC);

-- Add comment
COMMENT ON TABLE webhook_logs IS 'Audit trail for all webhook events received from payment providers';
COMMENT ON COLUMN orders.daimo_payment_id IS 'Daimo payment ID for correlating with webhooks';
COMMENT ON COLUMN orders.payment_verified_at IS 'When the payment was verified via webhook';
COMMENT ON COLUMN orders.payment_verification_source IS 'Source of payment verification (client, webhook, manual)';

