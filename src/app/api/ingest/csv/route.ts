import { createClient as createAuthClient } from '@/lib/supabase/server';
import { createClient } from '@supabase/supabase-js';
import { createHash } from 'crypto';

/* ---------- helpers ---------- */

/** Deterministic device token derived from user ID — reproducible without storage */
function deriveWebToken(userId: string): string {
  return createHash('sha256')
    .update(`web:${userId}:drift-sentinel`)
    .digest('hex');
}

function hashToken(raw: string): string {
  return createHash('sha256').update(raw).digest('hex');
}

/* ---------- route ---------- */

export async function POST(req: Request) {
  /* 1. Authenticate via Supabase session cookie */
  const supabase = await createAuthClient();
  const {
    data: { user },
    error: authErr,
  } = await supabase.auth.getUser();

  if (!user || authErr) {
    return Response.json({ error: 'Not authenticated' }, { status: 401 });
  }

  /* 2. Admin client (service role — bypasses RLS) */
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) {
    return Response.json(
      { error: 'Server misconfigured — missing service role key' },
      { status: 500 },
    );
  }

  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    serviceKey,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );

  /* 3. Check / create account (user may have multiple — prefer WEB source) */
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
      console.error('accounts insert:', error);
      return Response.json({ error: 'Failed to provision account' }, { status: 500 });
    }
  }

  /* 4. Check / create entitlement */
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
      console.error('entitlements insert:', error);
      return Response.json({ error: 'Failed to provision entitlement' }, { status: 500 });
    }
  }

  /* 5. Check / create device token */
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
      console.error('device_tokens insert:', error);
      return Response.json({ error: 'Failed to provision device token' }, { status: 500 });
    }
  }

  /* 6. Check / create user_configs */
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
      console.error('user_configs insert:', error);
      return Response.json({ error: 'Failed to provision config' }, { status: 500 });
    }
  }

  /* 7. Proxy CSV upload to Express backend */
  const apiUrl = process.env.API_URL || 'https://api.driftsentinel.io';
  const body = await req.json();

  try {
    const upstream = await fetch(`${apiUrl}/v1/ingest/fills/csv`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${rawToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    const rawText = await upstream.text();
    let data;
    try {
      data = JSON.parse(rawText);
    } catch {
      console.error('ingest proxy: upstream returned non-JSON:', upstream.status, rawText.slice(0, 500));
      return Response.json(
        { error: 'upstream_invalid_response', status: upstream.status, body: rawText.slice(0, 200) },
        { status: 502 },
      );
    }

    return Response.json(data, { status: upstream.status });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('ingest proxy: upstream fetch failed:', msg);
    return Response.json({ error: 'upstream_unreachable', detail: msg }, { status: 502 });
  }
}
