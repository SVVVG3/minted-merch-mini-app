-- Add Per-Ambassador Submission Limits to Bounties
-- Allows optional limit on how many times a single ambassador can submit to a bounty
-- Created: November 12, 2025

-- Add max_submissions_per_ambassador field to bounties table
ALTER TABLE bounties 
ADD COLUMN IF NOT EXISTS max_submissions_per_ambassador INTEGER DEFAULT NULL 
CHECK (max_submissions_per_ambassador IS NULL OR max_submissions_per_ambassador > 0);

-- Add index for performance when checking submission counts
CREATE INDEX IF NOT EXISTS idx_bounty_submissions_bounty_ambassador 
ON bounty_submissions(bounty_id, ambassador_id);

-- Add comment explaining the field
COMMENT ON COLUMN bounties.max_submissions_per_ambassador IS 
  'Optional limit on submissions per ambassador (NULL = unlimited). Example: meme contest = 5, follow bounty = 1';

-- Examples of how this works:
-- NULL or not set: Unlimited submissions per ambassador (like the old behavior)
-- 1: Each ambassador can submit once (e.g., "Follow us on X")
-- 5: Each ambassador can submit up to 5 times (e.g., "Create a meme")
-- max_completions still controls total approved submissions across all ambassadors

