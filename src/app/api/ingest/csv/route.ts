import { createClient as createAuthClient } from '@/lib/supabase/server';
import { createClient } from '@supabase/supabase-js';
import { createHash } from 'crypto';
import { parsePerformanceCsv, extractRoot } from '@/lib/parse-performance-csv';

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

  /* 7. Parse CSV */
  const body = await req.json();
  const csvText: string = body.csv_text;
  const fileName: string = body.source_file ?? 'performance.csv';

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

  /* 8. Insert fills into Supabase */
  const fileHash = createHash('sha256').update(csvText).digest('hex');

  // Check for duplicate file upload
  const { data: existingRun } = await admin
    .from('ingest_runs')
    .select('ingest_run_id')
    .eq('file_hash', fileHash)
    .eq('account_ref', accountRef)
    .single();

  if (existingRun) {
    return Response.json({
      ok: true,
      source: 'performance_csv',
      file_name: fileName,
      trades_parsed: csvResult.tradeCount,
      date_range: csvResult.dateRange,
      summary: csvResult.summary,
      fills_generated: csvResult.fills.length,
      fills_new: 0,
      fills_duplicate: csvResult.fills.length,
      fills_rejected: 0,
    });
  }

  // Create ingest run record
  const { data: runData, error: runErr } = await admin
    .from('ingest_runs')
    .insert({
      user_id: user.id,
      account_ref: accountRef,
      device_id: deviceId,
      file_name: fileName,
      file_hash: fileHash,
      accepted_count: 0,
      dup_count: 0,
      reject_count: 0,
    })
    .select('ingest_run_id')
    .single();

  if (runErr || !runData) {
    console.error('ingest_runs insert:', runErr);
    return Response.json({ error: 'Failed to create ingest run' }, { status: 500 });
  }

  const ingestRunId = runData.ingest_run_id;

  // Deduplicate against existing fills using Tradovate fill IDs
  // We store fill_id in event_id for CSV imports, so check both
  const existingFills = new Set<string>();
  const { data: existing } = await admin
    .from('fills_canonical')
    .select('timestamp_utc, contract, side, price, qty')
    .eq('account_ref', accountRef);

  if (existing) {
    for (const f of existing) {
      existingFills.add(`${f.timestamp_utc}|${f.contract}|${f.side}|${f.price}|${f.qty}`);
    }
  }

  // Build fill records
  const fillsToInsert = [];
  let dupCount = 0;
  let rejectCount = 0;

  for (const fill of csvResult.fills) {
    // Validate
    if (!fill.timestamp_utc || !fill.contract || !fill.side || fill.qty <= 0 || fill.price <= 0) {
      rejectCount++;
      continue;
    }

    // Dedup by full composite key (timestamp + contract + side + price + qty)
    const dedupKey = `${fill.timestamp_utc}|${fill.contract}|${fill.side}|${fill.price}|${fill.qty}`;
    if (existingFills.has(dedupKey)) {
      dupCount++;
      continue;
    }
    existingFills.add(dedupKey);

    // Use Tradovate's fill_id + side + qty for a stable unique event_id
    const eventId = createHash('sha256')
      .update(`${accountRef}:csv:${fill.fill_id}:${fill.side}:${fill.qty}:${fill.price}`)
      .digest('hex');

    fillsToInsert.push({
      event_id: eventId,
      account_ref: accountRef,
      ingest_run_id: ingestRunId,
      timestamp_utc: fill.timestamp_utc,
      instrument_root: extractRoot(fill.contract),
      contract: fill.contract,
      side: fill.side,
      qty: fill.qty,
      price: fill.price,
      commission: 0,
      off_session: false,
    });
  }

  let acceptedCount = 0;

  if (fillsToInsert.length > 0) {
    // Insert one at a time to avoid entire batch failing on a single conflict
    for (const fill of fillsToInsert) {
      const { error: insertErr } = await admin
        .from('fills_canonical')
        .insert(fill);

      if (insertErr) {
        if (insertErr.code === '23505') {
          dupCount++;
        } else {
          console.error('fill insert error:', insertErr.message, fill.event_id);
          rejectCount++;
        }
      } else {
        acceptedCount++;
      }
    }
  }

  // Update ingest run with final counts
  await admin
    .from('ingest_runs')
    .update({
      accepted_count: acceptedCount,
      dup_count: dupCount,
      reject_count: rejectCount,
      compute_triggered: acceptedCount > 0,
    })
    .eq('ingest_run_id', ingestRunId);

  // If fills were accepted, trigger compute pipeline (best-effort)
  if (acceptedCount > 0) {
    const apiUrl = process.env.API_URL || 'https://api.driftsentinel.io';
    try {
      await fetch(`${apiUrl}/v1/compute/trigger`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${rawToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ account_ref: accountRef }),
      });
    } catch {
      // Best-effort — compute will pick up on next cycle
    }
  }

  /* 9. Return response */
  return Response.json({
    ok: true,
    source: 'performance_csv',
    file_name: fileName,
    trades_parsed: csvResult.tradeCount,
    date_range: csvResult.dateRange,
    summary: csvResult.summary,
    fills_generated: csvResult.fills.length,
    fills_new: acceptedCount,
    fills_duplicate: dupCount,
    fills_rejected: rejectCount,
  });
}
