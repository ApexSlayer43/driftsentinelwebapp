import { createClient as createAuthClient } from '@/lib/supabase/server';
import { createClient } from '@supabase/supabase-js';

const ADMIN_USER_ID = '4c8b3b98-7a0e-4862-a67c-bcce026468d6';

export async function GET() {
  /* 1. Auth check */
  const supabase = await createAuthClient();
  const {
    data: { user },
    error: authErr,
  } = await supabase.auth.getUser();

  if (!user || authErr) {
    return Response.json({ error: 'Not authenticated' }, { status: 401 });
  }

  /* 2. Admin gate */
  if (user.id !== ADMIN_USER_ID) {
    return Response.json({ error: 'Not authorized' }, { status: 403 });
  }

  /* 3. Service role client */
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

  /* 4. Fetch all accounts with aggregated data */
  try {
    // Get all accounts
    const { data: accounts, error: accErr } = await admin
      .from('accounts')
      .select('account_ref, user_id, source, created_at')
      .order('created_at', { ascending: false });

    if (accErr) {
      return Response.json({ error: `Accounts query failed: ${accErr.message}` }, { status: 500 });
    }

    // Get auth users for email + last sign-in
    const { data: authData } = await admin.auth.admin.listUsers();
    const authUsers = authData?.users ?? [];
    const authMap = new Map(authUsers.map((u) => [u.id, u]));

    // Get user configs
    const { data: configs } = await admin
      .from('user_configs')
      .select('account_ref, timezone, sessions_utc, profile_goal, max_contracts, max_fills_per_day');
    const configMap = new Map((configs ?? []).map((c) => [c.account_ref, c]));

    // Get counts per account in parallel
    const accountRefs = (accounts ?? []).map((a) => a.account_ref);

    const [fillCounts, sessionCounts, violationCounts, scoreCounts, uploadCounts] =
      await Promise.all([
        admin.from('fills_canonical').select('account_ref', { count: 'exact', head: false })
          .in('account_ref', accountRefs),
        admin.from('sessions').select('account_ref', { count: 'exact', head: false })
          .in('account_ref', accountRefs),
        admin.from('violations').select('account_ref', { count: 'exact', head: false })
          .in('account_ref', accountRefs),
        admin.from('daily_scores').select('account_ref, bss_score, trading_date')
          .in('account_ref', accountRefs)
          .order('trading_date', { ascending: false }),
        admin.from('upload_events').select('account_ref, uploaded_at')
          .in('account_ref', accountRefs)
          .order('uploaded_at', { ascending: false }),
      ]);

    // Build count maps
    const countByRef = (rows: { account_ref: string }[] | null) => {
      const map: Record<string, number> = {};
      for (const r of rows ?? []) {
        map[r.account_ref] = (map[r.account_ref] ?? 0) + 1;
      }
      return map;
    };

    const fills = countByRef(fillCounts.data);
    const sessions = countByRef(sessionCounts.data);
    const violations = countByRef(violationCounts.data);

    // Latest BSS per account
    const latestBss: Record<string, number> = {};
    for (const row of scoreCounts.data ?? []) {
      if (!(row.account_ref in latestBss)) {
        latestBss[row.account_ref] = Number(row.bss_score);
      }
    }

    // Latest upload per account
    const latestUpload: Record<string, string> = {};
    const uploadCountMap: Record<string, number> = {};
    for (const row of uploadCounts.data ?? []) {
      uploadCountMap[row.account_ref] = (uploadCountMap[row.account_ref] ?? 0) + 1;
      if (!(row.account_ref in latestUpload)) {
        latestUpload[row.account_ref] = row.uploaded_at;
      }
    }

    // Score count per account
    const scoreCountMap = countByRef(scoreCounts.data);

    // Assemble response
    const roster = (accounts ?? []).map((acct) => {
      const authUser = authMap.get(acct.user_id);
      const config = configMap.get(acct.account_ref);
      const fillCount = fills[acct.account_ref] ?? 0;
      const bss = latestBss[acct.account_ref] ?? null;

      let status: 'empty' | 'uploaded' | 'active' = 'empty';
      if (fillCount > 0 && bss === null) status = 'uploaded';
      if (bss !== null) status = 'active';

      return {
        account_ref: acct.account_ref,
        email: authUser?.email ?? '—',
        joined: acct.created_at?.slice(0, 10) ?? '—',
        last_sign_in: authUser?.last_sign_in_at?.slice(0, 10) ?? null,
        status,
        fills_count: fillCount,
        sessions_count: sessions[acct.account_ref] ?? 0,
        violations_count: violations[acct.account_ref] ?? 0,
        days_scored: scoreCountMap[acct.account_ref] ?? 0,
        bss_score: bss,
        timezone: config?.timezone ?? null,
        has_sessions: config ? config.sessions_utc !== '[]' && config.sessions_utc?.length > 2 : false,
        has_goal: config?.profile_goal != null && config.profile_goal !== '',
        max_contracts: config?.max_contracts ?? null,
        last_upload: latestUpload[acct.account_ref] ?? null,
        uploads_count: uploadCountMap[acct.account_ref] ?? 0,
      };
    });

    // Summary stats
    const summary = {
      total_accounts: roster.length,
      active: roster.filter((r) => r.status === 'active').length,
      uploaded: roster.filter((r) => r.status === 'uploaded').length,
      empty: roster.filter((r) => r.status === 'empty').length,
      total_fills: Object.values(fills).reduce((a, b) => a + b, 0),
      total_auth_users: authUsers.length,
    };

    return Response.json({ ok: true, summary, roster });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[admin/overview] Error:', msg);
    return Response.json({ error: msg }, { status: 500 });
  }
}
