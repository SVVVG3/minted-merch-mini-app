import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { readFileSync } from 'fs';
import { join } from 'path';

export async function POST(request) {
  try {
    const supabaseAdmin = getSupabaseAdmin();
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
