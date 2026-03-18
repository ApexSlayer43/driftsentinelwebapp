import { createClient as createAuthClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

/**
 * PATCH /api/violations — Acknowledge or resolve a pattern
 *
 * Body: { violation_id: string, status: 'acknowledged' | 'resolved', resolution_note?: string }
 */
export async function PATCH(req: Request) {
  const supabase = await createAuthClient();
  const {
    data: { user },
    error: authErr,
  } = await supabase.auth.getUser();

  if (authErr || !user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  if (!body || !body.violation_id || !body.status) {
    return NextResponse.json({ error: 'Missing violation_id or status' }, { status: 400 });
  }

  const { violation_id, status, resolution_note } = body as {
    violation_id: string;
    status: string;
    resolution_note?: string;
  };

  if (!['acknowledged', 'resolved', 'active'].includes(status)) {
    return NextResponse.json({ error: 'Invalid status. Must be active, acknowledged, or resolved.' }, { status: 400 });
  }

  // Verify the violation belongs to the user's account
  const { data: accounts } = await supabase
    .from('accounts')
    .select('account_ref')
    .eq('user_id', user.id)
    .limit(1);

  if (!accounts || accounts.length === 0) {
    return NextResponse.json({ error: 'No account found' }, { status: 404 });
  }

  const ref = accounts[0].account_ref;

  // Build update payload
  const update: Record<string, unknown> = { status };

  if (status === 'acknowledged' || status === 'resolved') {
    update.acknowledged_at = new Date().toISOString();
  }

  if (status === 'active') {
    // Re-opening: clear acknowledgment
    update.acknowledged_at = null;
    update.resolution_note = null;
  }

  if (resolution_note !== undefined) {
    update.resolution_note = resolution_note;
  }

  const { error: updateErr } = await supabase
    .from('violations')
    .update(update)
    .eq('violation_id', violation_id)
    .eq('account_ref', ref);

  if (updateErr) {
    return NextResponse.json({ error: updateErr.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, violation_id, status });
}
