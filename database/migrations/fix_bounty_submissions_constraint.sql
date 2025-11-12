-- Fix Bounty Submissions Constraint
-- Remove unique constraint to allow multiple submissions per ambassador per bounty
-- This enables bounties like "create a meme" where ambassadors can submit multiple entries
-- Created: November 12, 2025

-- Drop the unique constraint that prevents multiple submissions
ALTER TABLE bounty_submissions 
DROP CONSTRAINT IF EXISTS bounty_submissions_bounty_id_ambassador_id_key;

-- Add comment to clarify the new behavior
COMMENT ON TABLE bounty_submissions IS 'Ambassador submissions for bounty completion - allows multiple submissions per ambassador per bounty for creative contests';

-- Note: Application logic will handle submission limits if needed
-- The bounty max_completions field controls total approved submissions across all ambassadors

