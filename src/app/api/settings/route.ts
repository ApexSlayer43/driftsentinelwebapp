import { createClient as createAuthClient } from '@/lib/supabase/server';
import { createClient } from '@supabase/supabase-js';

/**
 * POST /api/settings — Save user settings (trading rules, sessions, timezone, goal).
 *
 * RLS on user_configs blocks all client-side writes, so this route
 * authenticates the user via session cookie, verifies account ownership,
 * then writes via the service-role client.
 */

export async function POST(req: Request) {
  /* 1. Authenticate */
  const supabase = await createAuthClient();
  const {
    data: { user },
    error: authErr,
  } = await supabase.auth.getUser();

  if (!user || authErr) {
    return Response.json({ error: 'Not authenticated' }, { status: 401 });
  }

  /* 2. Parse body */
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const accountRef = body.account_ref as string | undefined;
  if (!accountRef) {
    return Response.json({ error: 'Missing account_ref' }, { status: 400 });
  }

  /* 3. Verify this user owns the account_ref */
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) {
    return Response.json({ error: 'Server misconfigured' }, { status: 500 });
  }

  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    serviceKey,
  );

  const { data: account } = await admin
    .from('accounts')
    .select('account_ref')
    .eq('account_ref', accountRef)
    .eq('user_id', user.id)
    .single();

  if (!account) {
    return Response.json({ error: 'Account not found or not owned by user' }, { status: 403 });
  }

  /* 4. Build the upsert payload — only allow known fields */
  const payload: Record<string, unknown> = {
    account_ref: accountRef,
    updated_at: new Date().toISOString(),
  };

  if (body.max_contracts !== undefined) payload.max_contracts = body.max_contracts;
  if (body.max_fills_per_day !== undefined) payload.max_fills_per_day = body.max_fills_per_day;
  if (body.baseline_window_fills !== undefined) payload.baseline_window_fills = body.baseline_window_fills;
  if (body.scoring_window_fills !== undefined) payload.scoring_window_fills = body.scoring_window_fills;
  if (body.sessions_utc !== undefined) payload.sessions_utc = body.sessions_utc;
  if (body.timezone !== undefined) payload.timezone = body.timezone || null;
  if (body.profile_goal !== undefined) payload.profile_goal = body.profile_goal || null;

  /* 5. Upsert via service role (bypasses RLS) */
  const { error: upsertErr } = await admin
    .from('user_configs')
    .upsert(payload, { onConflict: 'account_ref' });

  if (upsertErr) {
    console.error('Settings upsert failed:', upsertErr);
    return Response.json({ error: 'Failed to save settings' }, { status: 500 });
  }

  return Response.json({ ok: true });
}
