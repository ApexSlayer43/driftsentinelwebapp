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

  /* 3. Run the behavioral compute engine */
  try {
    const result = await runComputeEngine(admin, accountRef, user.id);

    // TB-005: Check for pipeline errors — return 500 if engine reported failure
    if (result.error) {
      console.error('[compute/trigger] Pipeline error:', result.error);
      return Response.json({
        ok: false,
        account_ref: accountRef,
        error: result.error,
        ...result,
      }, { status: 500 });
    }

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
