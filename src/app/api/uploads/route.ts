import { createClient as createAuthClient } from '@/lib/supabase/server';
import { createClient } from '@supabase/supabase-js';

/**
 * GET /api/uploads
 *
 * Query params:
 *   ?latest=true       — returns the most recent ingest run
 *   ?date=YYYY-MM-DD   — returns ingest runs for a specific date
 *   ?limit=N           — max results (default 10)
 *
 * Returns ingest runs with their upload events for the current user.
 */
export async function GET(req: Request) {
  /* 1. Authenticate */
  const supabase = await createAuthClient();
  const {
    data: { user },
    error: authErr,
  } = await supabase.auth.getUser();

  if (!user || authErr) {
    return Response.json({ error: 'Not authenticated' }, { status: 401 });
  }

  /* 2. Admin client */
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) {
    return Response.json({ error: 'Server misconfigured' }, { status: 500 });
  }

  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    serviceKey,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );

  /* 3. Parse query params */
  const url = new URL(req.url);
  const latest = url.searchParams.get('latest') === 'true';
  const date = url.searchParams.get('date');
  const limit = Math.min(parseInt(url.searchParams.get('limit') ?? '10', 10), 50);

  /* 4. Get account ref */
  const { data: accounts } = await admin
    .from('accounts')
    .select('account_ref')
    .eq('user_id', user.id)
    .limit(1);

  if (!accounts || accounts.length === 0) {
    return Response.json({ uploads: [] });
  }

  const accountRef = accounts[0].account_ref;

  /* 5. Query ingest_runs */
  let query = admin
    .from('ingest_runs')
    .select('ingest_run_id, file_name, file_hash, accepted_count, dup_count, reject_count, compute_triggered, created_at')
    .eq('account_ref', accountRef)
    .order('created_at', { ascending: false });

  if (date) {
    // Filter by date — match runs created on that day (UTC)
    query = query.gte('created_at', `${date}T00:00:00Z`).lt('created_at', `${date}T23:59:59Z`);
  }

  if (latest) {
    query = query.limit(1);
  } else {
    query = query.limit(limit);
  }

  const { data: runs, error: runsErr } = await query;

  if (runsErr) {
    console.error('uploads query error:', runsErr);
    return Response.json({ error: 'Failed to query uploads' }, { status: 500 });
  }

  /* 6. For each run, get upload_events if they exist */
  const uploads = [];
  for (const run of (runs ?? [])) {
    const { data: events } = await admin
      .from('upload_events')
      .select('uploaded_at, cadence_status, session_count, trade_count, date_range_start, date_range_end, detected_platform')
      .eq('ingest_run_id', run.ingest_run_id)
      .limit(1);

    uploads.push({
      ...run,
      upload_event: events?.[0] ?? null,
    });
  }

  /* 7. Also get daily_scores for the date range if available */
  let dailyScores: Array<{ trading_date: string; dsi_score: number; bss_score: number; fills_count: number; violation_count: number }> = [];
  if (date) {
    const { data: scores } = await admin
      .from('daily_scores')
      .select('trading_date, dsi_score, bss_score, fills_count, violation_count')
      .eq('account_ref', accountRef)
      .eq('trading_date', date);
    dailyScores = scores ?? [];
  } else if (latest && uploads.length > 0 && uploads[0].upload_event) {
    const evt = uploads[0].upload_event;
    if (evt.date_range_start && evt.date_range_end) {
      const { data: scores } = await admin
        .from('daily_scores')
        .select('trading_date, dsi_score, bss_score, fills_count, violation_count')
        .eq('account_ref', accountRef)
        .gte('trading_date', evt.date_range_start)
        .lte('trading_date', evt.date_range_end)
        .order('trading_date', { ascending: true });
      dailyScores = scores ?? [];
    }
  }

  return Response.json({
    uploads,
    daily_scores: dailyScores,
  });
}
