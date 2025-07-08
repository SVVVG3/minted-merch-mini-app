-- Add user leaderboard table for daily check-in system
-- This table tracks points, check-ins, and streaks for the gamification system

-- Create the user_leaderboard table
CREATE TABLE user_leaderboard (
    user_fid INTEGER PRIMARY KEY,
    total_points INTEGER DEFAULT 0 NOT NULL,
    last_checkin_date DATE,
    checkin_streak INTEGER DEFAULT 0 NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add indexes for performance
CREATE INDEX idx_user_leaderboard_total_points ON user_leaderboard(total_points DESC);
CREATE INDEX idx_user_leaderboard_last_checkin ON user_leaderboard(last_checkin_date);
CREATE INDEX idx_user_leaderboard_streak ON user_leaderboard(checkin_streak DESC);

-- Add RLS (Row Level Security) policies
ALTER TABLE user_leaderboard ENABLE ROW LEVEL SECURITY;

-- Allow read access to authenticated and anonymous users (for leaderboard display)
CREATE POLICY "Allow read access to user_leaderboard" ON user_leaderboard
    FOR SELECT USING (auth.role() = 'authenticated' OR auth.role() = 'anon');

-- Allow service role to perform all operations
CREATE POLICY "Allow service operations on user_leaderboard" ON user_leaderboard
    FOR ALL USING (auth.role() = 'service_role');

-- Create function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger to automatically update updated_at
CREATE TRIGGER update_user_leaderboard_updated_at
    BEFORE UPDATE ON user_leaderboard
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Add comments for documentation
COMMENT ON TABLE user_leaderboard IS 'Tracks user points, check-ins, and streaks for daily check-in gamification system';
COMMENT ON COLUMN user_leaderboard.user_fid IS 'Farcaster ID of the user';
COMMENT ON COLUMN user_leaderboard.total_points IS 'Total points earned by user from check-ins and purchases';
COMMENT ON COLUMN user_leaderboard.last_checkin_date IS 'Date of users last daily check-in';
COMMENT ON COLUMN user_leaderboard.checkin_streak IS 'Current consecutive days check-in streak';
COMMENT ON COLUMN user_leaderboard.created_at IS 'When the user first joined the leaderboard';
COMMENT ON COLUMN user_leaderboard.updated_at IS 'When the users leaderboard data was last updated'; 