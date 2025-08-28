-- Migration: Add token balance tracking to chat_members table
-- Date: January 2025
-- Purpose: Store cached token balances to improve dashboard performance and reliability

-- Add token balance tracking columns to chat_members table
ALTER TABLE chat_members 
ADD COLUMN IF NOT EXISTS token_balance DECIMAL(20, 6) DEFAULT 0,
ADD COLUMN IF NOT EXISTS last_balance_check TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS balance_check_status TEXT DEFAULT 'pending';

-- Create index for efficient querying by token balance
CREATE INDEX IF NOT EXISTS idx_chat_members_token_balance ON chat_members(token_balance DESC);
CREATE INDEX IF NOT EXISTS idx_chat_members_last_balance_check ON chat_members(last_balance_check);
CREATE INDEX IF NOT EXISTS idx_chat_members_balance_status ON chat_members(balance_check_status);

-- Add comments to document the purpose of each field
COMMENT ON COLUMN chat_members.token_balance IS 'Cached token balance in $MINTEDMERCH tokens (updated nightly)';
COMMENT ON COLUMN chat_members.last_balance_check IS 'Timestamp of last successful balance check';
COMMENT ON COLUMN chat_members.balance_check_status IS 'Status of last balance check: pending, success, error';

-- Update existing records to have pending status
UPDATE chat_members 
SET balance_check_status = 'pending' 
WHERE balance_check_status IS NULL;
