import { createClient as createAuthClient } from '@/lib/supabase/server';
import { createClient } from '@supabase/supabase-js';
import { createHash } from 'crypto';
import { parsePerformanceCsv, extractRoot } from '@/lib/parse-performance-csv';
import { runComputeEngine } from '@/lib/compute-engine';

/* ---------- helpers ---------- */

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

  /* 3. Check / create account */
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
    await admin.from('entitlements').insert({
      user_id: user.id,
      status: 'TRIAL',
      trial_end: trialEnd,
    });
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
    await admin.from('device_tokens').insert({
      device_id: deviceId,
      user_id: user.id,
      account_ref: accountRef,
      token_hash: hash,
      status: 'ACTIVE',
    });
  }

  /* 6. Check / create user_configs */
  const { data: cfg } = await admin
    .from('user_configs')
    .select('account_ref')
    .eq('account_ref', accountRef)
    .single();

  if (!cfg) {
    await admin.from('user_configs').insert({
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
  }

  /* 7. Parse CSV in webapp (Express backend can't parse Performance CSV format) */
  const body = await req.json();
  const csvText: string = body.csv_text;
  const fileName: string = body.source_file ?? 'performance.csv';
  const strategyId: string | undefined = body.strategy_id;

  if (!csvText) {
    return Response.json({ error: 'Missing csv_text field' }, { status: 400 });
  }

  let csvResult;
  try {
    csvResult = parsePerformanceCsv(csvText);
  } catch (err) {
    console.error('CSV parse error:', err);
    return Response.json(
      { error: 'Failed to parse CSV', detail: err instanceof Error ? err.message : 'Unknown error' },
      { status: 400 },
    );
  }

  if (csvResult.fills.length === 0) {
    return Response.json(
      { error: 'No trades found in CSV. Make sure this is a Tradovate Performance CSV export.' },
      { status: 400 },
    );
  }

  /* 8. Format fills as JSON and send to Express backend.
   *    The backend handles insertion + compute pipeline (violations, DSI/BSS, sessions).
   *    We parse CSV here because the backend doesn't understand Performance CSV format. */
  const jsonFills = csvResult.fills
    .filter((f) => f.timestamp_utc && f.contract && f.side && f.qty > 0 && f.price > 0)
    .map((fill) => {
      // Stable event_id from Tradovate's native IDs
      const eventId = createHash('sha256')
        .update(`${accountRef}:csv:${fill.buy_fill_id}:${fill.sell_fill_id}:${fill.side}`)
        .digest('hex');

      return {
        event_id: eventId,
        timestamp_utc: fill.timestamp_utc,
        instrument_root: extractRoot(fill.contract),
        contract: fill.contract,
        side: fill.side,
        qty: fill.qty,
        price: String(fill.price),  // Express backend expects numeric string
        commission: '0',
        off_session: false,
      };
    });

  const apiUrl = process.env.API_URL || 'https://api.driftsentinel.io';

  try {
    const upstream = await fetch(`${apiUrl}/v1/ingest/fills`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${rawToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        source_file: fileName,
        fills: jsonFills,
        ...(strategyId ? { strategy_id: strategyId } : {}),
      }),
    });

    const rawText = await upstream.text();
    let backendResult;
    try {
      backendResult = JSON.parse(rawText);
    } catch {
      console.error('CSV ingest: backend returned non-JSON:', upstream.status, rawText.slice(0, 500));
      return Response.json(
        { error: 'Backend returned invalid response', status: upstream.status },
        { status: 502 },
      );
    }

    if (!upstream.ok) {
      console.error('CSV ingest: backend error:', upstream.status, backendResult);
      return Response.json(
        { error: backendResult?.error || 'Backend ingest failed', status: upstream.status },
        { status: upstream.status },
      );
    }

    // Always trigger compute if the backend didn't — even on duplicate fills.
    // The compute pipeline is idempotent (recalculates from all fills in DB).
    // Without this, re-uploading the same CSV would never update BSS.
    const fillsNew = backendResult.fills_new ?? 0;
    const fillsTotal = fillsNew + (backendResult.fills_duplicate ?? 0);
    let computeTriggered = backendResult.compute_triggered ?? false;

    // Run the behavioral compute engine directly (sessions → violations → DSI → BSS)
    let computeVerified = false;
    let computeResult: { sessions_built: number; violations_found: number; bss_score: number | null } | null = null;
    if (fillsTotal > 0) {
      try {
        computeResult = await runComputeEngine(admin, accountRef, user.id);
        computeTriggered = true;
        computeVerified = computeResult.bss_score !== null;
        console.log(`[CSV ingest] Compute engine result: ${JSON.stringify(computeResult)}`);
      } catch (computeErr) {
        console.error('[CSV ingest] Compute engine error:', computeErr instanceof Error ? computeErr.message : computeErr);
      }
    }

    // Merge backend ingest result with our CSV parse summary
    return Response.json({
      ok: true,
      source: 'performance_csv',
      file_name: fileName,
      trades_parsed: csvResult.tradeCount,
      date_range: csvResult.dateRange,
      summary: csvResult.summary,
      fills_generated: csvResult.fills.length,
      fills_new: fillsNew,
      fills_duplicate: backendResult.fills_duplicate ?? 0,
      fills_rejected: backendResult.fills_rejected ?? 0,
      compute_triggered: computeTriggered,
      compute_verified: computeVerified,
      compute: computeResult ?? null,
      backfill: backendResult.backfill ?? null,
      sessions: backendResult.sessions ?? null,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('CSV ingest: backend fetch failed:', msg);
    return Response.json(
      { error: 'Backend unreachable', detail: msg },
      { status: 502 },
    );
  }
}
