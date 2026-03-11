import { createClient as createAuthClient } from '@/lib/supabase/server';
import { createClient } from '@supabase/supabase-js';
import { createHash } from 'crypto';

/** Deterministic device token derived from user ID — same as CSV ingest route */
function deriveWebToken(userId: string): string {
  return createHash('sha256')
    .update(`web:${userId}:drift-sentinel`)
    .digest('hex');
}

function hashToken(raw: string): string {
  return createHash('sha256').update(raw).digest('hex');
}

/**
 * POST /api/device/provision
 *
 * Provisions account, entitlement, device token, and user_configs
 * for the authenticated user. Returns the raw device token so the
 * web app can push it to the Chrome extension via DS_SET_CONFIG.
 *
 * Idempotent — safe to call on every page load.
 */
export async function POST() {
  const supabase = await createAuthClient();
  const {
    data: { user },
    error: authErr,
  } = await supabase.auth.getUser();

  if (!user || authErr) {
    return Response.json({ error: 'not_authenticated' }, { status: 401 });
  }

  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) {
    return Response.json({ error: 'server_misconfigured' }, { status: 500 });
  }

  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    serviceKey,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );

  /* Check / create account */
  /* Check / create account (user may have multiple — prefer WEB source) */
  const { data: accounts } = await admin
    .from('accounts')
    .select('account_ref, source')
    .eq('user_id', user.id);

  let accountRef = (accounts ?? []).find((a: { source: string }) => a.source === 'WEB')?.account_ref as string | undefined
    ?? (accounts ?? [])[0]?.account_ref as string | undefined;

  if (!accountRef) {
    accountRef = `WEB-${user.id.slice(0, 8).toUpperCase()}`;
    const { error } = await admin.from('accounts').insert({
      account_ref: accountRef,
      user_id: user.id,
      source: 'WEB',
    });
    if (error) {
      console.error('provision: accounts insert:', error);
      return Response.json({ error: 'provision_failed' }, { status: 500 });
    }
  }

  /* Check / create entitlement */
  const { data: ent } = await admin
    .from('entitlements')
    .select('status')
    .eq('user_id', user.id)
    .single();

  if (!ent) {
    const trialEnd = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
    const { error } = await admin.from('entitlements').insert({
      user_id: user.id,
      status: 'TRIAL',
      trial_end: trialEnd,
    });
    if (error) {
      console.error('provision: entitlements insert:', error);
      return Response.json({ error: 'provision_failed' }, { status: 500 });
    }
  }

  /* Check / create device token */
  const rawToken = deriveWebToken(user.id);
  const hash = hashToken(rawToken);
  const deviceId = `web-${user.id.slice(0, 8)}`;

  const { data: tok } = await admin
    .from('device_tokens')
    .select('device_id')
    .eq('device_id', deviceId)
    .single();

  if (!tok) {
    const { error } = await admin.from('device_tokens').insert({
      device_id: deviceId,
      user_id: user.id,
      account_ref: accountRef,
      token_hash: hash,
      status: 'ACTIVE',
    });
    if (error) {
      console.error('provision: device_tokens insert:', error);
      return Response.json({ error: 'provision_failed' }, { status: 500 });
    }
  }

  /* Check / create user_configs */
  const { data: cfg } = await admin
    .from('user_configs')
    .select('account_ref')
    .eq('account_ref', accountRef)
    .single();

  if (!cfg) {
    const { error } = await admin.from('user_configs').insert({
      account_ref: accountRef,
      sessions_utc: [
        {
          name: 'Regular',
          start_utc: '13:30',
          end_utc: '20:00',
          days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'],
        },
      ],
    });
    if (error) {
      console.error('provision: user_configs insert:', error);
      return Response.json({ error: 'provision_failed' }, { status: 500 });
    }
  }

  const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL || 'https://api.driftsentinel.io';

  return Response.json({
    ok: true,
    device_token: rawToken,
    api_base_url: apiBaseUrl,
    account_ref: accountRef,
  });
}
