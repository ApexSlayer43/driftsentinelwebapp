import { createClient as createAuthClient } from '@/lib/supabase/server';
import { createClient } from '@supabase/supabase-js';
import { createHash } from 'crypto';

function deriveWebToken(userId: string): string {
  return createHash('sha256')
    .update(`web:${userId}:drift-sentinel`)
    .digest('hex');
}

/**
 * POST /api/compute/trigger
 * Manual BSS recompute trigger — calls the Express backend's /v1/compute/trigger
 */
export async function POST() {
  /* 1. Authenticate */
  const supabase = await createAuthClient();
  const {
    data: { user },
    error: authErr,
  } = await supabase.auth.getUser();

  if (!user || authErr) {
    return Response.json({ error: 'Not authenticated' }, { status: 401 });
  }

  /* 2. Get account ref */
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) {
    return Response.json({ error: 'Server misconfigured' }, { status: 500 });
  }

  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    serviceKey,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );

  const { data: accounts } = await admin
    .from('accounts')
    .select('account_ref')
    .eq('user_id', user.id)
    .limit(1);

  if (!accounts || accounts.length === 0) {
    return Response.json({ error: 'No account found' }, { status: 404 });
  }

  const accountRef = accounts[0].account_ref;
  const rawToken = deriveWebToken(user.id);
  const apiUrl = process.env.API_URL || 'https://api.driftsentinel.io';

  /* 3. Trigger compute */
  try {
    const computeRes = await fetch(`${apiUrl}/v1/compute/trigger`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${rawToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ account_ref: accountRef }),
    });

    const computeBody = await computeRes.text();
    console.log(`[Manual compute] Trigger response: ${computeRes.status} ${computeBody.slice(0, 500)}`);

    if (!computeRes.ok) {
      return Response.json(
        { error: 'Compute trigger failed', status: computeRes.status, detail: computeBody.slice(0, 200) },
        { status: 502 },
      );
    }

    /* 4. Verify — read back state */
    let bssScore: number | null = null;
    let bssTier: string | null = null;
    try {
      const stateRes = await fetch(`${apiUrl}/v1/state`, {
        method: 'GET',
        headers: { Authorization: `Bearer ${rawToken}` },
      });
      if (stateRes.ok) {
        const stateData = await stateRes.json();
        bssScore = stateData?.bss_score ?? stateData?.bss?.score ?? null;
        bssTier = stateData?.bss_tier ?? stateData?.bss?.tier ?? null;
      }
    } catch {
      // Non-critical
    }

    return Response.json({
      ok: true,
      account_ref: accountRef,
      bss_score: bssScore,
      bss_tier: bssTier,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[Manual compute] Trigger fetch error:', msg);
    return Response.json({ error: 'Backend unreachable', detail: msg }, { status: 502 });
  }
}
