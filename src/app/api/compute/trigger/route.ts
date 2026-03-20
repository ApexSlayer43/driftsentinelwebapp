import { createClient as createAuthClient } from '@/lib/supabase/server';
import { createClient } from '@supabase/supabase-js';
import { runComputeEngine } from '@/lib/compute-engine';

/**
 * POST /api/compute/trigger
 * Runs the full behavioral compute engine:
 * fills → sessions → violations → DSI → BSS
 *
 * No longer proxies to Express backend — we own the pipeline.
 */
export async function POST(req: Request) {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) {
    return Response.json({ error: 'Server misconfigured' }, { status: 500 });
  }

  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    serviceKey,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );

  /* Check for admin recompute (service-level, specific account) */
  const url = new URL(req.url);
  const adminKey = url.searchParams.get('admin_key');
  const targetAccount = url.searchParams.get('account_ref');

  if (adminKey && adminKey === process.env.SUPABASE_SERVICE_ROLE_KEY?.slice(-12) && targetAccount) {
    // Admin bypass — recompute specific account without user auth
    const { data: acct } = await admin
      .from('accounts')
      .select('user_id')
      .eq('account_ref', targetAccount)
      .single();

    if (!acct) {
      return Response.json({ error: 'Account not found' }, { status: 404 });
    }

    try {
      const result = await runComputeEngine(admin, targetAccount, acct.user_id);
      return Response.json({ ok: true, account_ref: targetAccount, ...result });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error('[compute/trigger] Admin engine error:', msg);
      return Response.json({ error: 'Compute engine failed', detail: msg }, { status: 500 });
    }
  }

  /* 1. Authenticate (normal user flow) */
  const supabase = await createAuthClient();
  const {
    data: { user },
    error: authErr,
  } = await supabase.auth.getUser();

  if (!user || authErr) {
    return Response.json({ error: 'Not authenticated' }, { status: 401 });
  }

  /* 2. Get account ref */
  const { data: accounts } = await admin
    .from('accounts')
    .select('account_ref')
    .eq('user_id', user.id)
    .limit(1);

  if (!accounts || accounts.length === 0) {
    return Response.json({ error: 'No account found' }, { status: 404 });
  }

  const accountRef = accounts[0].account_ref;

  /* 3. Run the behavioral compute engine */
  try {
    const result = await runComputeEngine(admin, accountRef, user.id);

    return Response.json({
      ok: true,
      account_ref: accountRef,
      ...result,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[compute/trigger] Engine error:', msg);
    return Response.json({ error: 'Compute engine failed', detail: msg }, { status: 500 });
  }
}
