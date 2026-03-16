// app/api/chat/route.ts
// Senti chat endpoint — Vercel AI SDK v6 + full personality engine.
// Uses streamText() with composeSentiPromptString() for streaming.
// Persists conversations and messages to Supabase after completion.

import { anthropic } from '@ai-sdk/anthropic';
import { streamText, convertToModelMessages, type UIMessage } from 'ai';
import { createClient } from '@/lib/supabase/server';
import { composeSentiPromptString, type SentiMode } from '@/lib/senti';
import type { TraderProfile } from '@/lib/senti';

export const maxDuration = 60;

export async function POST(req: Request) {
  try {
    // 1. Authenticate
    const supabase = await createClient();
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

    // 2. Parse request
    const body = await req.json();
    const messages: UIMessage[] = body.messages;
    const mode: SentiMode = body.mode || 'sessionCompanion';
    const conversationId: string | undefined = body.conversationId;

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return new Response(JSON.stringify({ error: 'Messages required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // 3. Get user's account data
    const { data: account } = await supabase
      .from('accounts')
      .select('account_ref')
      .eq('user_id', user.id)
      .limit(1)
      .single();

    if (!account) {
      return new Response(JSON.stringify({ error: 'No account found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const accountRef = account.account_ref;

    // 4. Parallel data fetch for dynamic context
    const [driversResult, violationsResult, dailyResult, driftResult, profileResult, streakResult] =
      await Promise.all([
        supabase
          .from('mode_state')
          .select('mode, points')
          .eq('account_ref', accountRef)
          .eq('state', 'ACTIVE'),
        supabase
          .from('violations')
          .select('mode, severity, points, rule_id, first_seen_utc')
          .eq('account_ref', accountRef)
          .order('first_seen_utc', { ascending: false })
          .limit(30),
        supabase
          .from('daily_scores')
          .select('trading_date, dsi_score, violation_count, fills_count')
          .eq('account_ref', accountRef)
          .order('trading_date', { ascending: false })
          .limit(30),
        supabase
          .from('drift_scores')
          .select('bss_score, bss_tier, dsi_score, behavioral_state, drift_index')
          .eq('account_ref', accountRef)
          .order('computed_at', { ascending: false })
          .limit(1)
          .single(),
        supabase
          .from('accounts')
          .select('display_name')
          .eq('account_ref', accountRef)
          .single(),
        supabase
          .from('daily_scores')
          .select('trading_date, streak_count')
          .eq('account_ref', accountRef)
          .order('trading_date', { ascending: false })
          .limit(7),
      ]);

    // 5. Build trader profile for dynamic context
    const drift = driftResult.data;
    const violations = violationsResult.data ?? [];
    const dailyScores = dailyResult.data ?? [];
    const totalDeductions = violations.reduce((sum, v) => sum + (v.points ?? 0), 0);
    const streakData = streakResult.data ?? [];

    const traderProfile: TraderProfile = {
      displayName: profileResult.data?.display_name || 'Trader',
      accountRef,
      bssScore: drift?.bss_score ?? 0,
      tier: drift?.bss_tier ?? 'DORMANT',
      dsiScore: drift?.dsi_score ?? 100,
      behavioralState: drift?.behavioral_state ?? 'BUILDING',
      driftIndex: drift?.drift_index ?? 0,
      activeProtocol: null,
      weeklySessionCount: streakData.length,
      currentStreak: streakData[0]?.streak_count ?? 0,
      lastSessionDate: streakData[0]?.trading_date ?? null,
      activeDrivers: driversResult.data ?? [],
      recentViolations: violations,
      dailyScores,
      totalViolations: violations.length,
      totalDeductions,
    };

    // 6. Build the full layered system prompt
    const systemPrompt = composeSentiPromptString(mode, traderProfile);

    // 7. Stream from Claude via Vercel AI SDK
    const result = streamText({
      model: anthropic('claude-sonnet-4-20250514'),
      system: systemPrompt,
      messages: await convertToModelMessages(messages),
      maxOutputTokens: 4096,
      temperature: 0.3,
      abortSignal: req.signal,
      onFinish: async ({ text, usage }) => {
        // 8. Persist conversation + messages to Supabase
        try {
          let convId = conversationId;

          if (!convId) {
            // Extract text from last user message
            const lastMsg = messages[messages.length - 1];
            const titleText = lastMsg?.parts
              ?.filter((p): p is { type: 'text'; text: string } => p.type === 'text')
              .map((p) => p.text)
              .join(' ')
              .slice(0, 100) || 'New conversation';

            const { data: newConv } = await supabase
              .from('conversations')
              .insert({
                user_id: user.id,
                title: titleText,
                conversation_type: 'trader',
                mode,
              })
              .select('id')
              .single();

            convId = newConv?.id;
          }

          if (convId) {
            const lastUserMsg = messages[messages.length - 1];
            if (lastUserMsg?.role === 'user') {
              const userText = lastUserMsg.parts
                ?.filter((p): p is { type: 'text'; text: string } => p.type === 'text')
                .map((p) => p.text)
                .join(' ') || '';

              await supabase.from('messages').insert({
                conversation_id: convId,
                user_id: user.id,
                role: 'user',
                content: userText,
              });
            }

            await supabase.from('messages').insert({
              conversation_id: convId,
              user_id: user.id,
              role: 'assistant',
              content: text,
              metadata: { mode },
              input_tokens: usage?.inputTokens ?? 0,
              output_tokens: usage?.outputTokens ?? 0,
            });

            await supabase
              .from('conversations')
              .update({
                total_tokens_used: (usage?.inputTokens ?? 0) + (usage?.outputTokens ?? 0),
                updated_at: new Date().toISOString(),
              })
              .eq('id', convId);
          }
        } catch (persistErr) {
          console.error('[Senti] Failed to persist conversation:', persistErr);
        }
      },
    });

    return result.toTextStreamResponse();
  } catch (err) {
    console.error('[Senti API]', err);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
