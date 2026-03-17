import { createClient as createAuthClient } from '@/lib/supabase/server';
import { createClient } from '@supabase/supabase-js';

/**
 * GET /api/insights/weekly-wrap
 *
 * Aggregates the trailing 7 days of:
 *   - session_intentions  (daily goals the trader set)
 *   - cooldown_activations (when they hit reset + BSS at that moment)
 *   - daily_scores         (BSS trajectory across the week)
 *   - user_configs         (profile_goal / north star)
 *
 * Returns a structured wrap object that the front-end renders,
 * plus a Senti narrative summary generated from the data.
 */
export async function GET() {
  /* 1. Auth */
  const supabase = await createAuthClient();
  const {
    data: { user },
    error: authErr,
  } = await supabase.auth.getUser();

  if (!user || authErr) {
    return Response.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) {
    return Response.json({ error: 'Server misconfigured' }, { status: 500 });
  }

  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    serviceKey,
  );

  /* 2. Resolve account_ref */
  const { data: accounts } = await admin
    .from('accounts')
    .select('account_ref')
    .eq('user_id', user.id)
    .limit(1);

  if (!accounts || accounts.length === 0) {
    return Response.json({ error: 'No account found' }, { status: 404 });
  }

  const accountRef = accounts[0].account_ref;

  /* 3. Date window — trailing 7 days (today inclusive) */
  const today = new Date();
  const weekAgo = new Date(today);
  weekAgo.setDate(weekAgo.getDate() - 6);
  const startDate = weekAgo.toISOString().slice(0, 10);
  const endDate = today.toISOString().slice(0, 10);

  /* 4. Parallel fetch */
  const [intentionsRes, cooldownsRes, scoresRes, profileRes] =
    await Promise.all([
      // All intentions this week
      admin
        .from('session_intentions')
        .select('session_date, goal_text, created_at')
        .eq('account_ref', accountRef)
        .gte('session_date', startDate)
        .lte('session_date', endDate)
        .order('session_date', { ascending: true }),

      // All cooldown activations this week
      admin
        .from('cooldown_activations')
        .select(
          'activation_id, activated_at, closed_at, duration_seconds, bss_at_activation, prompt_type',
        )
        .eq('account_ref', accountRef)
        .gte('activated_at', `${startDate}T00:00:00`)
        .lte('activated_at', `${endDate}T23:59:59`)
        .order('activated_at', { ascending: true }),

      // Daily BSS scores this week
      admin
        .from('daily_scores')
        .select('trading_date, bss_score')
        .eq('account_ref', accountRef)
        .gte('trading_date', startDate)
        .lte('trading_date', endDate)
        .order('trading_date', { ascending: true }),

      // Profile goal (north star)
      admin
        .from('user_configs')
        .select('profile_goal')
        .eq('user_id', user.id)
        .limit(1),
    ]);

  const intentions = intentionsRes.data ?? [];
  const cooldowns = cooldownsRes.data ?? [];
  const scores = scoresRes.data ?? [];
  const profileGoal = (profileRes.data?.[0]?.profile_goal as string) ?? null;

  /* 5. Compute aggregates */
  const daysWithIntentions = intentions.length;
  const totalCooldowns = cooldowns.length;
  const avgCooldownDuration =
    totalCooldowns > 0
      ? Math.round(
          cooldowns
            .filter((c) => c.duration_seconds != null)
            .reduce((sum, c) => sum + (c.duration_seconds ?? 0), 0) /
            Math.max(
              cooldowns.filter((c) => c.duration_seconds != null).length,
              1,
            ),
        )
      : null;

  const bssValues = scores.map((s) => s.bss_score).filter((v): v is number => v != null);
  const bssStart = bssValues.length > 0 ? bssValues[0] : null;
  const bssEnd = bssValues.length > 0 ? bssValues[bssValues.length - 1] : null;
  const bssDelta = bssStart != null && bssEnd != null ? bssEnd - bssStart : null;
  const bssHigh = bssValues.length > 0 ? Math.max(...bssValues) : null;
  const bssLow = bssValues.length > 0 ? Math.min(...bssValues) : null;

  // Find most common intention theme (simple word frequency)
  const intentionTexts = intentions.map((i) => i.goal_text?.toLowerCase() ?? '');
  const wordFreq: Record<string, number> = {};
  const stopWords = new Set([
    'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
    'of', 'with', 'by', 'i', 'my', 'me', 'is', 'be', 'do', 'no', 'not',
    'only', 'just', 'today', 'this', 'that', 'it', 'if', 'so', 'up',
  ]);
  for (const text of intentionTexts) {
    for (const word of text.split(/\s+/)) {
      const clean = word.replace(/[^a-z]/g, '');
      if (clean.length > 2 && !stopWords.has(clean)) {
        wordFreq[clean] = (wordFreq[clean] || 0) + 1;
      }
    }
  }
  const topThemes = Object.entries(wordFreq)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([word, count]) => ({ word, count }));

  // Cooldown BSS context — what was BSS when they hit reset?
  const cooldownBssValues = cooldowns
    .map((c) => c.bss_at_activation)
    .filter((v): v is number => v != null);
  const avgBssAtCooldown =
    cooldownBssValues.length > 0
      ? Math.round(
          cooldownBssValues.reduce((s, v) => s + v, 0) / cooldownBssValues.length,
        )
      : null;

  /* 6. Generate Senti narrative */
  const narrative = buildSentiNarrative({
    daysWithIntentions,
    totalDays: 7,
    totalCooldowns,
    avgCooldownDuration,
    bssStart,
    bssEnd,
    bssDelta,
    topThemes,
    profileGoal,
    avgBssAtCooldown,
    intentionTexts,
  });

  /* 7. Response */
  return Response.json({
    period: { start: startDate, end: endDate },
    intentions: {
      days_set: daysWithIntentions,
      entries: intentions,
      top_themes: topThemes,
    },
    cooldowns: {
      total: totalCooldowns,
      avg_duration_seconds: avgCooldownDuration,
      avg_bss_at_activation: avgBssAtCooldown,
      entries: cooldowns,
    },
    bss: {
      start: bssStart,
      end: bssEnd,
      delta: bssDelta,
      high: bssHigh,
      low: bssLow,
      daily: scores,
    },
    profile_goal: profileGoal,
    narrative,
  });
}

/* ── Senti Narrative Builder ── */

interface NarrativeInput {
  daysWithIntentions: number;
  totalDays: number;
  totalCooldowns: number;
  avgCooldownDuration: number | null;
  bssStart: number | null;
  bssEnd: number | null;
  bssDelta: number | null;
  topThemes: { word: string; count: number }[];
  profileGoal: string | null;
  avgBssAtCooldown: number | null;
  intentionTexts: string[];
}

function buildSentiNarrative(input: NarrativeInput): string {
  const parts: string[] = [];

  // Opening — intention consistency
  if (input.daysWithIntentions === 0) {
    parts.push(
      "You didn't set any intentions this week. That's data, not judgment — it tells us there's an opportunity to anchor your sessions before they start.",
    );
  } else if (input.daysWithIntentions >= 5) {
    parts.push(
      `You set an intention ${input.daysWithIntentions} out of ${input.totalDays} days this week. That level of consistency is rare — and it compounds.`,
    );
  } else {
    parts.push(
      `You set an intention ${input.daysWithIntentions} out of ${input.totalDays} days this week. Every time you name it before you trade, you're training the pattern.`,
    );
  }

  // Theme recognition
  if (input.topThemes.length > 0 && input.topThemes[0].count >= 2) {
    const theme = input.topThemes[0].word;
    parts.push(
      `The word "${theme}" showed up ${input.topThemes[0].count} times in your intentions. Your subconscious knows what matters — your job is to listen.`,
    );
  }

  // BSS trajectory
  if (input.bssDelta != null && input.bssStart != null && input.bssEnd != null) {
    if (input.bssDelta > 0) {
      parts.push(
        `Your BSS moved from ${input.bssStart} to ${input.bssEnd} — up ${input.bssDelta} points. The discipline is showing in the numbers.`,
      );
    } else if (input.bssDelta < 0) {
      parts.push(
        `Your BSS moved from ${input.bssStart} to ${input.bssEnd} — down ${Math.abs(input.bssDelta)} points. Rough week. But you're here reviewing it, and that's the behavior that turns it around.`,
      );
    } else {
      parts.push(
        `Your BSS held steady at ${input.bssEnd} all week. Stability is underrated — it means you're not bleeding points to impulsive behavior.`,
      );
    }
  }

  // Cooldown usage
  if (input.totalCooldowns > 0) {
    const durationNote =
      input.avgCooldownDuration != null
        ? ` You averaged ${input.avgCooldownDuration} seconds per reset — `
        : ' ';

    if (input.totalCooldowns >= 3) {
      parts.push(
        `You used Cooldown Mode ${input.totalCooldowns} times this week.${durationNote}that tells me you're catching yourself in the moment, not after the damage.`,
      );
    } else {
      parts.push(
        `You hit reset ${input.totalCooldowns} time${input.totalCooldowns > 1 ? 's' : ''} this week.${durationNote}the fact that the button exists in your workflow means you're building the circuit.`,
      );
    }

    if (input.avgBssAtCooldown != null) {
      parts.push(
        `Your average BSS when you activated cooldown was ${input.avgBssAtCooldown}. Pay attention to that number — it's your trigger threshold.`,
      );
    }
  } else {
    parts.push(
      "You didn't use Cooldown Mode this week. Either it was a clean week, or the resets happened off-screen. Only you know which one.",
    );
  }

  // North star reflection
  if (input.profileGoal) {
    parts.push(
      `Your north star: "${input.profileGoal}." Every intention you set, every reset you take — that's the reason underneath it all. Don't lose sight of it.`,
    );
  }

  return parts.join('\n\n');
}
