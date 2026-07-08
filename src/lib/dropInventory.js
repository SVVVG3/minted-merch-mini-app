import { supabaseAdmin } from '@/lib/supabase';

/** Fixed limits once a drop goes live for purchase. */
export const DROP_LIVE_HOURS = 48;
export const DROP_DEFAULT_MAX_UNITS = 37;

export function getDropLiveEndsAt(drop) {
  if (drop?.drop_ends_at) return drop.drop_ends_at;
  if (drop?.drop_starts_at) {
    return computeDropLiveEndsAt(new Date(drop.drop_starts_at));
  }
  return null;
}

export function isDropLiveWindowOpen(drop, now = new Date()) {
  if (!drop || drop.status !== 'live') return false;
  const endsAt = getDropLiveEndsAt(drop);
  if (endsAt && new Date(endsAt) <= now) return false;
  if ((drop.units_sold || 0) >= (drop.max_units || DROP_DEFAULT_MAX_UNITS)) return false;
  return true;
}

export function getDropUnitsLeft(drop) {
  if (!drop) return 0;
  return Math.max(0, (drop.max_units || DROP_DEFAULT_MAX_UNITS) - (drop.units_sold || 0));
}

export async function findLiveDropForCartItem(item) {
  const dropId = item?.customMeta?.dropId;
  const designRequestId = item?.customMeta?.designRequestId;

  if (!dropId && !designRequestId) return null;

  let query = supabaseAdmin.from('weekly_drops').select('*').eq('status', 'live');

  if (dropId) {
    query = query.eq('id', dropId);
  } else {
    query = query.eq('design_request_id', designRequestId);
  }

  const { data, error } = await query.maybeSingle();
  if (error) throw error;
  return data;
}

/**
 * Validate limited-drop cart lines before checkout (server-side guard).
 */
export async function validateLimitedDropCheckout(cartItems) {
  const dropLines = (cartItems || []).filter((item) => item?.customMeta?.dropId);

  if (dropLines.length === 0) {
    return { ok: true, sales: [] };
  }

  const salesByDrop = new Map();

  for (const item of dropLines) {
    const drop = await findLiveDropForCartItem(item);
    if (!drop) {
      return { ok: false, error: 'This limited drop is no longer available for purchase.' };
    }

    if (!isDropLiveWindowOpen(drop)) {
      const endsAt = getDropLiveEndsAt(drop);
      if (endsAt && new Date(endsAt) <= new Date()) {
        return { ok: false, error: 'This limited drop sale window has ended (48-hour limit).' };
      }
      return { ok: false, error: 'This limited drop is sold out.' };
    }

    const qty = Math.max(1, parseInt(item.quantity, 10) || 1);
    const prev = salesByDrop.get(drop.id) || { drop, quantity: 0 };
    prev.quantity += qty;
    salesByDrop.set(drop.id, prev);
  }

  for (const { drop, quantity } of salesByDrop.values()) {
    const unitsLeft = getDropUnitsLeft(drop);
    if (quantity > unitsLeft) {
      return {
        ok: false,
        error: unitsLeft > 0
          ? `Only ${unitsLeft} unit${unitsLeft === 1 ? '' : 's'} left for this drop.`
          : 'This limited drop is sold out.',
      };
    }
  }

  return {
    ok: true,
    sales: [...salesByDrop.values()].map(({ drop, quantity }) => ({ dropId: drop.id, quantity })),
  };
}

/**
 * Increment units_sold after a successful order. Marks sold_out at max_units.
 */
export async function incrementDropUnitsSold(dropId, quantity) {
  const qty = Math.max(1, parseInt(quantity, 10) || 1);
  const maxAttempts = 3;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const { data: drop, error: fetchErr } = await supabaseAdmin
      .from('weekly_drops')
      .select('id, status, units_sold, max_units, drop_ends_at')
      .eq('id', dropId)
      .single();

    if (fetchErr || !drop) {
      return { success: false, error: 'Drop not found' };
    }

    if (!isDropLiveWindowOpen(drop)) {
      return { success: false, error: 'Drop no longer available' };
    }

    const newSold = (drop.units_sold || 0) + qty;
    if (newSold > (drop.max_units || DROP_DEFAULT_MAX_UNITS)) {
      return { success: false, error: 'Insufficient drop inventory' };
    }

    const now = new Date().toISOString();
    const updates = {
      units_sold: newSold,
      updated_at: now,
      ...(newSold >= (drop.max_units || DROP_DEFAULT_MAX_UNITS) ? { status: 'sold_out' } : {}),
    };

    const { data: updated, error: updateErr } = await supabaseAdmin
      .from('weekly_drops')
      .update(updates)
      .eq('id', dropId)
      .eq('status', 'live')
      .eq('units_sold', drop.units_sold)
      .select()
      .maybeSingle();

    if (updateErr) {
      return { success: false, error: updateErr.message };
    }

    if (updated) {
      return { success: true, drop: updated, soldOut: updated.status === 'sold_out' };
    }
  }

  return { success: false, error: 'Inventory update conflict — please retry' };
}

/** Close live drops whose 48-hour purchase window has ended. */
export async function closeExpiredLiveDrops() {
  const now = new Date().toISOString();
  const nowMs = Date.now();

  const { data: liveDrops, error: fetchErr } = await supabaseAdmin
    .from('weekly_drops')
    .select('id, week_label, drop_ends_at, drop_starts_at')
    .eq('status', 'live');

  if (fetchErr) throw fetchErr;

  const expiredIds = (liveDrops || [])
    .filter((drop) => {
      const endsAt = getDropLiveEndsAt(drop);
      return endsAt && new Date(endsAt).getTime() <= nowMs;
    })
    .map((drop) => drop.id);

  if (expiredIds.length === 0) return [];

  const { data, error } = await supabaseAdmin
    .from('weekly_drops')
    .update({ status: 'closed', updated_at: now })
    .in('id', expiredIds)
    .select('id, week_label');

  if (error) throw error;
  return data || [];
}

export function computeDropLiveEndsAt(fromDate = new Date()) {
  return new Date(fromDate.getTime() + DROP_LIVE_HOURS * 60 * 60 * 1000).toISOString();
}
