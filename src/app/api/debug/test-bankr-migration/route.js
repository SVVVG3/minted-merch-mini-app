import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { withAdminAuth } from '@/lib/adminAuth';

export const POST = withAdminAuth(async (request, context) => {
  try {
    const { action } = await request.json();
    
    console.log('🔧 Bankr Club Migration Test - Action:', action);
    
    if (!supabase) {
      return NextResponse.json({
        success: false,
        error: 'Supabase not available'
      }, { status: 500 });
    }

    const results = {
      timestamp: new Date().toISOString(),
      action: action
    };

    if (action === 'test_sql') {
      // Test the migration SQL by checking if columns already exist
      try {
        // Check current table structure
        const { data: tableInfo, error: tableError } = await supabase
          .from('profiles')
          .select('*')
          .limit(1);

        if (tableError) {
          throw tableError;
        }

        // Check if our new columns exist by examining the first row
        const sampleRow = tableInfo[0] || {};
        
        results.current_columns = {
          bankr_club_member: 'bankr_club_member' in sampleRow,
          x_username: 'x_username' in sampleRow,
          bankr_membership_updated_at: 'bankr_membership_updated_at' in sampleRow
        };

        results.table_structure_check = 'success';
        results.migration_needed = !results.current_columns.bankr_club_member;

      } catch (error) {
        results.table_structure_check = 'failed';
        results.error = error.message;
      }
    }

    else if (action === 'get_migration_sql') {
      // Return the migration SQL for manual application
      results.migration_sql = `
-- Add Bankr Club columns to profiles table
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS bankr_club_member BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS x_username TEXT,
ADD COLUMN IF NOT EXISTS bankr_membership_updated_at TIMESTAMP WITH TIME ZONE;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_profiles_bankr_club_member ON profiles(bankr_club_member);
CREATE INDEX IF NOT EXISTS idx_profiles_x_username ON profiles(x_username);
CREATE INDEX IF NOT EXISTS idx_profiles_bankr_membership_updated_at ON profiles(bankr_membership_updated_at);

-- Add comments to document the purpose of each field
COMMENT ON COLUMN profiles.bankr_club_member IS 'Whether this user is a member of Bankr Club (verified via Bankr API)';
COMMENT ON COLUMN profiles.x_username IS 'User X/Twitter username for Bankr Club verification';
COMMENT ON COLUMN profiles.bankr_membership_updated_at IS 'Last time Bankr Club membership status was checked via API';
      `.trim();
      
      results.instructions = 'Copy the migration_sql and run it in the Supabase SQL editor to apply the migration.';
      results.success = true;
    }

    else {
      results.error = 'Invalid action. Use "test_sql" or "get_migration_sql"';
    }

    return NextResponse.json(results);

  } catch (error) {
    console.error('Error in Bankr migration test:', error);
    return NextResponse.json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
});

export async function GET() {
  return NextResponse.json({
    endpoint: 'Bankr Club Migration Test',
    usage: 'POST with { "action": "test_sql" } or { "action": "get_migration_sql" }',
    description: 'test_sql checks if migration is needed, get_migration_sql returns SQL for manual application',
    timestamp: new Date().toISOString()
  });
} 