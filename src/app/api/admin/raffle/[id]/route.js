import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export async function DELETE(request, { params }) {
  try {
    const { id } = params;

    if (!id) {
      return NextResponse.json({ success: false, error: 'Raffle ID is required' }, { status: 400 });
    }

    // Delete winner entries first (due to foreign key constraint)
    const { error: entriesError } = await supabaseAdmin
      .from('raffle_winner_entries')
      .delete()
      .eq('raffle_id', id);

    if (entriesError) {
      console.error('Error deleting raffle winner entries:', entriesError);
      return NextResponse.json({ success: false, error: 'Failed to delete raffle winner entries' }, { status: 500 });
    }

    // Delete raffle metadata
    const { error: raffleError } = await supabaseAdmin
      .from('raffle_winners')
      .delete()
      .eq('raffle_id', id);

    if (raffleError) {
      console.error('Error deleting raffle:', raffleError);
      return NextResponse.json({ success: false, error: 'Failed to delete raffle' }, { status: 500 });
    }

    return NextResponse.json({ success: true, message: 'Raffle deleted successfully' });

  } catch (error) {
    console.error('Delete raffle error:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
} 