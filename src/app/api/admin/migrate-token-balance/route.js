import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export async function POST(request) {
  try {
    console.log('🔄 Starting token balance migration...');

    // Add token balance columns to profiles table
    const migrationSQL = `
      -- Add token balance column if it doesn't exist
      DO $$ 
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                      WHERE table_name = 'profiles' AND column_name = 'token_balance') THEN
          ALTER TABLE profiles 
          ADD COLUMN token_balance BIGINT DEFAULT 0,
          ADD COLUMN token_balance_updated_at TIMESTAMP WITH TIME ZONE;
          
          -- Add index for efficient leaderboard queries
          CREATE INDEX idx_profiles_token_balance ON profiles (token_balance DESC) WHERE token_balance > 0;
          
          -- Add comments for documentation
          COMMENT ON COLUMN profiles.token_balance IS 'User $MINTEDMERCH token balance (in wei/smallest unit)';
          COMMENT ON COLUMN profiles.token_balance_updated_at IS 'Timestamp when token balance was last updated';
          
          RAISE NOTICE 'Token balance columns added successfully';
        ELSE
          RAISE NOTICE 'Token balance columns already exist';
        END IF;
      END $$;
    `;

    // Execute the migration SQL directly
    const { data, error: migrationError } = await supabaseAdmin.rpc('sql', {
      query: migrationSQL
    });

    if (migrationError) {
      console.error('❌ Migration error:', migrationError);
      return NextResponse.json({
        success: false,
        error: migrationError.message
      }, { status: 500 });
    }

    console.log('✅ Token balance migration completed successfully');

    return NextResponse.json({
      success: true,
      message: 'Token balance columns added to profiles table',
      data
    });

  } catch (error) {
    console.error('❌ Migration error:', error);
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
}
