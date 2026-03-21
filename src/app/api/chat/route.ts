// app/api/chat/route.ts
// Senti chat endpoint — Vercel AI SDK v6 + full personality engine.
// Uses streamText() with composeSentiPromptString() for streaming.
// Persists conversations and messages to Supabase after completion.

import { anthropic } from '@ai-sdk/anthropic';
import { streamText, convertToModelMessages, type UIMessage } from 'ai';
import { createClient } from '@/lib/supabase/server';
import { composeSentiPromptString, computeSessionState, type SentiMode } from '@/lib/senti';
import type { TraderProfile } from '@/lib/senti';
import type { SessionConfig } from '@/lib/types';
import { resolveTier } from '@/lib/tokens';

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

    // 4. Parallel data fetch — full historical access
    const [
      driversResult, violationsResult, dailyResult, driftResult,
      profileResult, streakResult, fillsResult, protocolResult,
      configResult,
    ] = await Promise.all([
        // Active drift drivers
        supabase
          .from('mode_state')
          .select('mode, points')
          .eq('account_ref', accountRef)
          .eq('state', 'ACTIVE'),
        // ALL violations (full history with window times)
        supabase
          .from('violations')
          .select('mode, severity, points, rule_id, first_seen_utc, window_start_utc, window_end_utc, protocol_rule_id')
          .eq('account_ref', accountRef)
          .order('first_seen_utc', { ascending: false })
          .limit(200),
        // ALL daily scores with BSS progression
        supabase
          .from('daily_scores')
          .select('trading_date, dsi_score, violation_count, fills_count, bss_score, bss_previous, streak_count, alpha_effective')
          .eq('account_ref', accountRef)
          .order('trading_date', { ascending: false })
          .limit(200),
        // Latest drift score
        supabase
          .from('drift_scores')
          .select('bss_score, bss_tier, dsi_score, behavioral_state, drift_index')
          .eq('account_ref', accountRef)
          .order('computed_at', { ascending: false })
          .limit(1)
          .single(),
        // Profile
        supabase
          .from('accounts')
          .select('display_name')
          .eq('account_ref', accountRef)
          .single(),
        // Weekly streak data
        supabase
          .from('daily_scores')
          .select('trading_date, streak_count')
          .eq('account_ref', accountRef)
          .order('trading_date', { ascending: false })
          .limit(7),
        // Historical fills (last 500 trades)
        supabase
          .from('fills_canonical')
          .select('timestamp_utc, instrument_root, contract, side, qty, price, commission, off_session')
          .eq('account_ref', accountRef)
          .order('timestamp_utc', { ascending: false })
          .limit(500),
        // Active protocol rules
        supabase
          .from('protocol_rules')
          .select('rule_id, category, name, description, params, enabled, enforcement')
          .eq('account_ref', accountRef)
          .eq('enabled', true),
        // User config (sessions + timezone)
        supabase
          .from('user_configs')
          .select('sessions_utc, timezone')
          .eq('account_ref', accountRef)
          .maybeSingle(),
      ]);

    // 5. Build trader profile for dynamic context
    const drift = driftResult.data;
    const violations = violationsResult.data ?? [];
    const dailyScores = dailyResult.data ?? [];
    const fills = fillsResult.data ?? [];
    const protocolRules = protocolResult.data ?? [];
    const totalDeductions = violations.reduce((sum, v) => sum + (v.points ?? 0), 0);
    const streakData = streakResult.data ?? [];

    // Compute session state from user config
    const userSessions = (configResult.data?.sessions_utc as SessionConfig[]) ?? [];
    const userTimezone = (configResult.data?.timezone as string) ?? null;
    const sessionState = computeSessionState(userSessions, userTimezone);

    const traderProfile: TraderProfile = {
      displayName: profileResult.data?.display_name || 'Trader',
      accountRef,
      bssScore: drift?.bss_score ?? 0,
      tier: drift?.bss_score != null ? resolveTier(drift.bss_score) : 'DORMANT',
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
      fills,
      protocolRules,
      sessionState,
    };

    // 6. Build the full layered system prompt
    const systemPrompt = composeSentiPromptString(mode, traderProfile);

    // 7. Append intelligence panel awareness to system prompt
    const panelInstruction = `

INTELLIGENCE PANEL CAPABILITY:
You have access to a side panel that can display behavioral data visually. When the trader asks about a specific date's data, a past upload, or says things like "show me March 12th", "pull up today's upload", "what happened last Tuesday", "show me my data from yesterday" — include this exact directive on its own line in your response:

[SHOW_PANEL:YYYY-MM-DD]

Replace YYYY-MM-DD with the relevant date. The frontend will detect this and open the intelligence panel with that day's data. You can include this directive naturally within your response — it will be hidden from the displayed text and replaced with the panel.

Only use this when the trader explicitly asks to see or review data for a specific date. Do not use it unprompted.`;

    const fullSystemPrompt = systemPrompt + panelInstruction;

    // 8. Stream from Claude via Vercel AI SDK
    const result = streamText({
      model: anthropic('claude-sonnet-4-20250514'),
      system: fullSystemPrompt,
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
