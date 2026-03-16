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
    pdfResult = parsePerformancePdf(parsed.text);
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

  /* 8. Convert fills to CSV-like format and proxy to backend ingest */
  // Build a CSV string that the existing backend parser can handle
  // The backend expects Tradovate Position History CSV format, so we need to
  // convert our parsed trades into that format
  const csvHeader = 'Buy Time,Sell Time,Buy Price,Sell Price,Qty,P&L,Symbol,Duration';
  const csvRows = pdfResult.trades.map((t) =>
    `${t.buyTime},${t.sellTime},${t.buyPrice},${t.sellPrice},${t.qty},${t.pnl},${t.symbol},${t.duration}`
  );
  const csvText = [csvHeader, ...csvRows].join('\n');

  // Also try to send fills directly to the backend
  const apiUrl = process.env.API_URL || 'https://api.driftsentinel.io';

  let ingestResult = null;
  try {
    const upstream = await fetch(`${apiUrl}/v1/ingest/fills/csv`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${rawToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ csv_text: csvText, source_file: fileName }),
    });

    const rawText = await upstream.text();
    try {
      ingestResult = JSON.parse(rawText);
    } catch {
      console.error('PDF ingest: upstream non-JSON:', upstream.status, rawText.slice(0, 500));
    }
  } catch (err) {
    console.error('PDF ingest: upstream fetch failed:', err instanceof Error ? err.message : err);
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

    // Ingest pipeline result (if backend accepted)
    ingest: ingestResult,

    // Fills generated (count)
    fills_generated: pdfResult.fills.length,
  });
}
