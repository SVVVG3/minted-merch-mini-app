-- Allow Moguls / Whales to split vote weight across multiple submissions.
-- One row per (drop, voter, submission); total vote_weight per voter still capped in API.

ALTER TABLE drop_votes
  DROP CONSTRAINT IF EXISTS drop_votes_drop_id_voter_fid_key;

CREATE UNIQUE INDEX IF NOT EXISTS drop_votes_drop_voter_submission_unique
  ON drop_votes (drop_id, voter_fid, submission_id);
