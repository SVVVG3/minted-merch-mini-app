-- Update missing usernames in user_leaderboard table from profiles table
-- This fixes the issue where many users have null usernames in user_leaderboard
-- but have valid usernames in the profiles table

UPDATE user_leaderboard 
SET username = profiles.username
FROM profiles 
WHERE user_leaderboard.user_fid = profiles.fid 
  AND (user_leaderboard.username IS NULL OR user_leaderboard.username = '')
  AND profiles.username IS NOT NULL 
  AND profiles.username != '';

-- Show the results of the update
SELECT 
  COUNT(*) as total_updated_users,
  COUNT(CASE WHEN username IS NOT NULL AND username != '' THEN 1 END) as users_with_username,
  COUNT(CASE WHEN username IS NULL OR username = '' THEN 1 END) as users_without_username
FROM user_leaderboard
WHERE total_points > 0;
