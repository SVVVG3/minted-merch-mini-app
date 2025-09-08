import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { join } from 'path';

// Use service role client to bypass RLS for admin endpoints
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
);

export async function POST(request) {
  try {
    console.log('🔧 Running Bankr wallet addresses migration...');

    // Read the migration file
    const migrationPath = join(process.cwd(), 'database', 'migrations', 'add_bankr_wallet_addresses.sql');
    const migrationSQL = readFileSync(migrationPath, 'utf8');

    console.log('📄 Migration SQL loaded, executing...');

    // Execute the migration
    const { data, error } = await supabaseAdmin.rpc('exec', {
      sql: migrationSQL
    });

    if (error) {
      console.error('❌ Migration failed:', error);
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }

    console.log('✅ Bankr wallet addresses migration completed successfully');

    return NextResponse.json({
      success: true,
      message: 'Bankr wallet addresses columns added to profiles table',
      data
    });

  } catch (error) {
    console.error('❌ Error running Bankr wallet addresses migration:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
