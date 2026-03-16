// app/api/chat/ingest/route.ts
// Senti ingest endpoint — parses a PDF, ingests it, then returns
// a conversational analysis prompt for Senti to stream.

import { anthropic } from '@ai-sdk/anthropic';
import { streamText } from 'ai';
import { createClient as createAuthClient } from '@/lib/supabase/server';
import { createClient } from '@supabase/supabase-js';
import { createHash } from 'crypto';
import { parsePerformancePdf, type PerformancePdfResult } from '@/lib/parse-performance-pdf';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const pdfParse = require('pdf-parse');

export const maxDuration = 60;

function deriveWebToken(userId: string): string {
  return createHash('sha256')
    .update(`web:${userId}:drift-sentinel`)
    .digest('hex');
}

function buildAnalysisPrompt(result: PerformancePdfResult, fileName: string): string {
  const s = result.summary;
  const trades = result.trades;

  // Compute per-day breakdown
  const dayMap = new Map<string, { trades: number; pnl: number; wins: number; losses: number }>();
  for (const t of trades) {
    const date = t.buyTime.split(' ')[0]; // MM/DD/YYYY
    const existing = dayMap.get(date) || { trades: 0, pnl: 0, wins: 0, losses: 0 };
    existing.trades++;
    existing.pnl += t.pnl;
    if (t.pnl > 0) existing.wins++;
    else if (t.pnl < 0) existing.losses++;
    dayMap.set(date, existing);
  }

  const dayBreakdown = Array.from(dayMap.entries())
    .map(([date, d]) => `  ${date}: ${d.trades} trades, P&L $${d.pnl.toFixed(2)}, ${d.wins}W/${d.losses}L`)
    .join('\n');

  // Find biggest win/loss
  const biggestWin = trades.reduce((best, t) => t.pnl > best.pnl ? t : best, trades[0]);
  const biggestLoss = trades.reduce((worst, t) => t.pnl < worst.pnl ? t : worst, trades[0]);

  // Find potential revenge trades (loss followed by quick re-entry)
  const revengeCandidates: string[] = [];
  for (let i = 1; i < trades.length; i++) {
    const prev = trades[i - 1];
    const curr = trades[i];
    if (prev.pnl < -100 && curr.pnl < 0) {
      // Both losses, check if same session (within 5 min)
      const prevEnd = new Date(prev.sellTime.replace(/(\d{2})\/(\d{2})\/(\d{4})/, '$3-$1-$2'));
      const currStart = new Date(curr.buyTime.replace(/(\d{2})\/(\d{2})\/(\d{4})/, '$3-$1-$2'));
      const gapMs = currStart.getTime() - prevEnd.getTime();
      if (gapMs >= 0 && gapMs < 300000) {
        revengeCandidates.push(
          `After -$${Math.abs(prev.pnl).toFixed(2)} loss on ${prev.symbol}, re-entered ${curr.symbol} within ${Math.round(gapMs / 1000)}s → another -$${Math.abs(curr.pnl).toFixed(2)} loss`
        );
      }
    }
  }

  // Size escalation check
  const avgQty = trades.reduce((s, t) => s + t.qty, 0) / trades.length;
  const oversized = trades.filter(t => t.qty > avgQty * 1.5);

  return `You are Senti, the behavioral AI companion for Drift Sentinel. The trader just uploaded a Tradovate Performance Report (${fileName}). You have parsed it completely. Now give them a conversational, insightful walkthrough of what you found.

IMPORTANT: You are NOT an analytics tool. You are a behavioral mirror. Focus on PATTERNS, not just numbers. What does this data reveal about the trader's behavior, discipline, and emotional state?

Here is the complete parsed data:

FILE: ${fileName}
DATE RANGE: ${result.dateRange?.start ?? '?'} → ${result.dateRange?.end ?? '?'}
TRADES PARSED: ${result.tradeCount}

SUMMARY:
- Gross P/L: $${s.grossPnl.toFixed(2)}
- Net P/L (after fees): $${s.totalPnl.toFixed(2)}
- Trade Count: ${s.tradeCount} trades, ${s.contractCount} contracts
- Win Rate: ${s.winRate}%
- Expectancy: $${s.expectancy.toFixed(2)}/trade
- Fees: $${Math.abs(s.fees).toFixed(2)}
- Avg Trade Time: ${s.avgTradeTime}
- Winning: ${s.winningTrades} trades, avg $${s.avgWin.toFixed(2)}, largest $${s.largestWin.toFixed(2)}
- Losing: ${s.losingTrades} trades, avg $${Math.abs(s.avgLoss).toFixed(2)}, largest $${Math.abs(s.largestLoss).toFixed(2)}
- Max Run-up: $${s.maxRunUp.toFixed(2)}
- Max Drawdown: $${Math.abs(s.maxDrawdown).toFixed(2)}
${s.lossBreakdown ? `- Loss Breakdown: ${s.lossBreakdown.tradePct}% trade losses, ${s.lossBreakdown.commissionPct}% commission` : ''}

PER-DAY BREAKDOWN:
${dayBreakdown}

BIGGEST WIN: ${biggestWin.symbol} ${biggestWin.qty}x @ ${biggestWin.buyTime} → $${biggestWin.pnl.toFixed(2)}
BIGGEST LOSS: ${biggestLoss.symbol} ${biggestLoss.qty}x @ ${biggestLoss.buyTime} → $${biggestLoss.pnl.toFixed(2)}

AVERAGE POSITION SIZE: ${avgQty.toFixed(1)} contracts
OVERSIZED TRADES (>1.5x avg): ${oversized.length} trades
${oversized.length > 0 ? oversized.map(t => `  - ${t.symbol} ${t.qty}x @ ${t.buyTime} → $${t.pnl.toFixed(2)}`).join('\n') : ''}

${revengeCandidates.length > 0 ? `POTENTIAL REVENGE PATTERNS DETECTED:\n${revengeCandidates.map(r => `  - ${r}`).join('\n')}` : 'NO OBVIOUS REVENGE PATTERNS DETECTED'}

INSTRUMENTS TRADED: ${[...new Set(trades.map(t => t.symbol))].join(', ')}

Now respond to the trader conversationally. Walk them through:
1. The headline numbers (but briefly — they can see these)
2. The behavioral patterns you spotted (this is the valuable part)
3. Day-by-day rhythm — which days were clean, which were messy
4. Any flags: revenge trading, size escalation, off-session activity
5. End with one specific, actionable observation

Keep the tone direct, warm, and honest. You're their behavioral mirror. Short paragraphs. No bullet points in your response — write naturally.`;
}

export async function POST(req: Request) {
  try {
    /* 1. Authenticate */
    const supabase = await createAuthClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    /* 2. Parse the uploaded PDF */
    const formData = await req.formData();
    const file = formData.get('file');

    if (!file || !(file instanceof Blob)) {
      return new Response(JSON.stringify({ error: 'No file provided' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const fileName = file instanceof File ? file.name : 'performance.pdf';
    const pdfBuffer = Buffer.from(await file.arrayBuffer());

    let pdfResult: PerformancePdfResult;
    try {
      const parsed = await pdfParse(pdfBuffer);
      pdfResult = parsePerformancePdf(parsed.text);
    } catch (err) {
      return new Response(JSON.stringify({
        error: 'Failed to parse PDF',
        detail: err instanceof Error ? err.message : 'Unknown error',
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (pdfResult.trades.length === 0) {
      return new Response(JSON.stringify({
        error: 'No trades found in PDF',
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    /* 3. Also run the ingest pipeline (best-effort) */
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (serviceKey) {
      try {
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

        if (accounts && accounts.length > 0) {
          const rawToken = deriveWebToken(user.id);
          const apiUrl = process.env.API_URL || 'https://api.driftsentinel.io';

          const csvHeader = 'Buy Time,Sell Time,Buy Price,Sell Price,Qty,P&L,Symbol,Duration';
          const csvRows = pdfResult.trades.map((t) =>
            `${t.buyTime},${t.sellTime},${t.buyPrice},${t.sellPrice},${t.qty},${t.pnl},${t.symbol},${t.duration}`
          );
          const csvText = [csvHeader, ...csvRows].join('\n');

          fetch(`${apiUrl}/v1/ingest/fills/csv`, {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${rawToken}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ csv_text: csvText, source_file: fileName }),
          }).catch((err) => {
            console.error('[Senti ingest] backend ingest failed:', err);
          });
        }
      } catch (err) {
        console.error('[Senti ingest] ingest pipeline error:', err);
      }
    }

    /* 4. Build the analysis prompt and stream Senti's response */
    const systemPrompt = buildAnalysisPrompt(pdfResult, fileName);

    const result = streamText({
      model: anthropic('claude-sonnet-4-20250514'),
      system: systemPrompt,
      messages: [
        {
          role: 'user',
          content: `I just uploaded my performance report. What do you see?`,
        },
      ],
      maxOutputTokens: 2048,
      temperature: 0.4,
      abortSignal: req.signal,
    });

    // Return both the parsed summary (as a custom header) and the stream
    const response = result.toTextStreamResponse();

    // Attach parsed data as a custom header so the frontend can show summary stats
    response.headers.set(
      'X-Parsed-Summary',
      JSON.stringify({
        trades_parsed: pdfResult.tradeCount,
        date_range: pdfResult.dateRange,
        gross_pnl: pdfResult.summary.grossPnl,
        net_pnl: pdfResult.summary.totalPnl,
        win_rate: pdfResult.summary.winRate,
        trade_count: pdfResult.summary.tradeCount,
      }),
    );

    return response;
  } catch (err) {
    console.error('[Senti ingest API]', err);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
