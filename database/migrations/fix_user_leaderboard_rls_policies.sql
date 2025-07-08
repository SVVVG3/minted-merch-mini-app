-- Fix RLS policies for user_leaderboard table
-- Update policies to match existing codebase pattern allowing anonymous access

-- Drop existing policies
DROP POLICY IF EXISTS "Allow read access to user_leaderboard" ON user_leaderboard;
DROP POLICY IF EXISTS "Allow service operations on user_leaderboard" ON user_leaderboard;

-- Create new policies that match the existing codebase pattern
CREATE POLICY "Allow all operations on user_leaderboard" ON user_leaderboard
    FOR ALL USING (true);

-- Add comment for documentation
COMMENT ON POLICY "Allow all operations on user_leaderboard" ON user_leaderboard IS 'Allow all operations for anonymous and authenticated users - matches project pattern'; 