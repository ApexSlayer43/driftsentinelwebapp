import { NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { createClient } from '@/lib/supabase/server';
import { buildSentiPrompt, type SentiContext } from '@/lib/senti-prompt';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export async function POST(request: Request) {
  try {
    // 1. Authenticate
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 2. Parse request body
    const body = await request.json();
    const messages: ChatMessage[] = body.messages;

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json({ error: 'Messages required' }, { status: 400 });
    }

    // 3. Get user's account_ref
    const { data: account } = await supabase
      .from('accounts')
      .select('account_ref')
      .eq('user_id', user.id)
      .limit(1)
      .single();

    if (!account) {
      return NextResponse.json({ error: 'No account found' }, { status: 404 });
    }

    const accountRef = account.account_ref;

    // 4. Parallel data fetch
    const [driversResult, violationsResult, dailyResult, driftResult] =
      await Promise.all([
        // Active drift drivers
        supabase
          .from('mode_state')
          .select('mode, points')
          .eq('account_ref', accountRef)
          .eq('state', 'ACTIVE'),

        // Last 30 violations
        supabase
          .from('violations')
          .select(
            'mode, severity, points, rule_id, first_seen_utc'
          )
          .eq('account_ref', accountRef)
          .order('first_seen_utc', { ascending: false })
          .limit(30),

        // Last 30 daily scores
        supabase
          .from('daily_scores')
          .select('trading_date, dsi_score, violation_count, fills_count')
          .eq('account_ref', accountRef)
          .order('trading_date', { ascending: false })
          .limit(30),

        // Latest drift score (BSS, DSI, tier, state)
        supabase
          .from('drift_scores')
          .select(
            'bss_score, bss_tier, dsi_score, behavioral_state, drift_index'
          )
          .eq('account_ref', accountRef)
          .order('computed_at', { ascending: false })
          .limit(1)
          .single(),
      ]);

    // 5. Build context
    const drift = driftResult.data;
    const violations = violationsResult.data ?? [];
    const totalDeductions = violations.reduce((sum, v) => sum + (v.points ?? 0), 0);

    const context: SentiContext = {
      accountRef,
      bssScore: drift?.bss_score ?? 0,
      bssTier: drift?.bss_tier ?? 'DORMANT',
      dsiScore: drift?.dsi_score ?? 100,
      behavioralState: drift?.behavioral_state ?? 'BUILDING',
      driftIndex: drift?.drift_index ?? 0,
      activeDrivers: driversResult.data ?? [],
      recentViolations: violations,
      dailyScores: dailyResult.data ?? [],
      totalViolations: violations.length,
      totalDeductions,
    };

    // 6. Build system prompt
    const systemPrompt = buildSentiPrompt(context);

    // 7. Stream from Claude
    const stream = anthropic.messages.stream({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      temperature: 0.3,
      system: systemPrompt,
      messages: messages.map((m) => ({
        role: m.role,
        content: m.content,
      })),
    });

    // 8. Create readable stream for the client
    const encoder = new TextEncoder();
    const readable = new ReadableStream({
      async start(controller) {
        try {
          for await (const event of stream) {
            if (
              event.type === 'content_block_delta' &&
              event.delta.type === 'text_delta'
            ) {
              controller.enqueue(encoder.encode(event.delta.text));
            }
          }
          controller.close();
        } catch (err) {
          controller.error(err);
        }
      },
    });

    return new Response(readable, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      },
    });
  } catch (err) {
    console.error('[Senti API]', err);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
