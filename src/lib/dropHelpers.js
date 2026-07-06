/** Returns the weekly drop currently accepting submissions, or null. */
export async function getOpenSubmissionDrop(supabaseAdmin) {
  const now = new Date().toISOString();

  const { data: drops, error } = await supabaseAdmin
    .from('weekly_drops')
    .select('*')
    .eq('status', 'draft')
    .order('created_at', { ascending: false });

  if (error) throw error;

  for (const drop of drops || []) {
    if (drop.submissions_open_at && drop.submissions_open_at > now) continue;
    if (drop.submissions_close_at && drop.submissions_close_at < now) continue;
    return drop;
  }

  return null;
}
