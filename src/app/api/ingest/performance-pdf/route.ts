import { createClient as createAuthClient } from '@/lib/supabase/server';
import { createClient } from '@supabase/supabase-js';
import { createHash } from 'crypto';
import { parsePerformancePdf } from '@/lib/parse-performance-pdf';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const pdfParse = require('pdf-parse');

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

  /* 7. Parse PDF */
  let pdfBuffer: Buffer;
  let fileName: string;

  const contentType = req.headers.get('content-type') ?? '';

  if (contentType.includes('multipart/form-data')) {
    const formData = await req.formData();
    const file = formData.get('file');
    if (!file || !(file instanceof Blob)) {
      return Response.json({ error: 'No PDF file provided' }, { status: 400 });
    }
    fileName = file instanceof File ? file.name : 'performance.pdf';
    if (!fileName.toLowerCase().endsWith('.pdf')) {
      return Response.json({ error: 'File must be a PDF' }, { status: 400 });
    }
    if (file.size > 10 * 1024 * 1024) {
      return Response.json({ error: 'File too large (max 10MB)' }, { status: 400 });
    }
    pdfBuffer = Buffer.from(await file.arrayBuffer());
  } else {
    // JSON body with base64-encoded PDF
    const body = await req.json();
    if (!body.pdf_base64) {
      return Response.json({ error: 'Missing pdf_base64 field' }, { status: 400 });
    }
    fileName = body.source_file ?? 'performance.pdf';
    pdfBuffer = Buffer.from(body.pdf_base64, 'base64');
  }

  let pdfResult;
  try {
    const parsed = await pdfParse(pdfBuffer);
    const rawText = parsed.text ?? '';
    console.log('[PDF ingest] text length:', rawText.length, 'TRADES header:', rawText.includes('TRADES'));
    console.log('[PDF ingest] text preview:', rawText.slice(0, 1500));
    pdfResult = parsePerformancePdf(rawText);
    console.log('[PDF ingest] trades parsed:', pdfResult.trades.length);
  } catch (err) {
    console.error('PDF parse error:', err);
    return Response.json(
      { error: 'Failed to parse PDF', detail: err instanceof Error ? err.message : 'Unknown error' },
      { status: 400 },
    );
  }

  if (pdfResult.trades.length === 0) {
    return Response.json(
      { error: 'No trades found in PDF. Make sure this is a Tradovate Performance report.' },
      { status: 400 },
    );
  }

  /* 8. Insert fills directly into Supabase (bypasses Express backend) */
  const fileHash = createHash('sha256').update(pdfBuffer).digest('hex');

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
      source: 'performance_pdf',
      file_name: fileName,
      summary: pdfResult.summary,
      trades_parsed: pdfResult.tradeCount,
      date_range: pdfResult.dateRange,
      fills_generated: pdfResult.fills.length,
      ingest: {
        fills_new: 0,
        fills_duplicate: pdfResult.fills.length,
        fills_rejected: 0,
      },
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

  // Extract instrument root from contract (e.g., "MESH6" → "MES")
  function extractRoot(contract: string): string {
    const match = contract.match(/^([A-Z]{2,4})[FGHJKMNQUVXZ]\d{1,2}$/);
    return match ? match[1] : contract;
  }

  // Deduplicate against existing fills
  const existingFills = new Set<string>();
  const { data: existing } = await admin
    .from('fills_canonical')
    .select('timestamp_utc, contract, side, price')
    .eq('account_ref', accountRef);

  if (existing) {
    for (const f of existing) {
      existingFills.add(`${f.timestamp_utc}|${f.contract}|${f.side}|${f.price}`);
    }
  }

  // Build fill records, skipping duplicates
  const fillsToInsert = [];
  let dupCount = 0;
  let rejectCount = 0;
  const seenEventIds = new Set<string>();

  for (let idx = 0; idx < pdfResult.fills.length; idx++) {
    const fill = pdfResult.fills[idx];

    // Validate required fields
    if (!fill.timestamp_utc || !fill.contract || !fill.side || fill.qty == null || fill.price == null) {
      rejectCount++;
      continue;
    }

    const dedupKey = `${fill.timestamp_utc}|${fill.contract}|${fill.side}|${fill.price}`;
    if (existingFills.has(dedupKey)) {
      dupCount++;
      continue;
    }

    // Include index to guarantee unique event_id even for identical fills
    const eventId = createHash('sha256')
      .update(`${accountRef}:${ingestRunId}:${idx}:${fill.timestamp_utc}:${fill.contract}:${fill.side}:${fill.price}:${fill.qty}`)
      .digest('hex');

    if (seenEventIds.has(eventId)) {
      dupCount++;
      continue;
    }
    seenEventIds.add(eventId);

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

  // If fills were accepted, trigger compute pipeline via Express backend (best-effort)
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

  /* 9. Return rich response with both parsed data + ingest result */
  return Response.json({
    ok: true,
    source: 'performance_pdf',
    file_name: fileName,

    // Summary stats from the PDF
    summary: pdfResult.summary,

    // Trade details
    trades_parsed: pdfResult.tradeCount,
    date_range: pdfResult.dateRange,

    // Ingest pipeline result
    ingest: {
      fills_new: acceptedCount,
      fills_duplicate: dupCount,
      fills_rejected: rejectCount,
    },

    // Fills generated (count)
    fills_generated: pdfResult.fills.length,
  });
}
