import { createClient as createAuthClient } from '@/lib/supabase/server';
import { createClient } from '@supabase/supabase-js';
import {
  selectCooldownPrompt,
  buildCooldownSequence,
  type BehavioralInsightData,
} from '@/config/cooldownPrompts';

/**
 * POST /api/cooldown/start
 *
 * Assembles and returns the Senti cooldown prompt.
 * Called the moment the trader activates cooldown mode.
 *
 * Body (optional): { template: 'orb' | 'orbital' | 'minimal' }
 * Response: { activation_id, prompt, prompt_type, bss_at_activation }
 */
export async function POST(req: Request) {
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
  const today = new Date().toISOString().slice(0, 10);

  /* 3. Gather context in parallel */
  const [intentionRes, profileRes, cooldownHistoryRes, latestScoreRes] =
    await Promise.all([
      // Today's daily intention
      admin
        .from('session_intentions')
        .select('goal_text')
        .eq('account_ref', accountRef)
        .eq('session_date', today)
        .order('created_at', { ascending: false })
        .limit(1),

      // Profile goal (north star)
      admin
        .from('user_configs')
        .select('profile_goal')
        .eq('user_id', user.id)
        .limit(1),

      // Cooldown activation history
      admin
        .from('cooldown_activations')
        .select('activation_id, activated_at, bss_at_activation')
        .eq('account_ref', accountRef)
        .order('activated_at', { ascending: false })
        .limit(50),

      // Latest BSS score
      admin
        .from('daily_scores')
        .select('bss_score')
        .eq('account_ref', accountRef)
        .order('trading_date', { ascending: false })
        .limit(1),
    ]);

  const todayGoal = intentionRes.data?.[0]?.goal_text ?? null;
  const profileGoal = profileRes.data?.[0]?.profile_goal ?? null;
  const bssAtActivation = latestScoreRes.data?.[0]?.bss_score ?? null;

  /* 4. Build behavioral insight data if enough history */
  let insightData: BehavioralInsightData | null = null;
  const cooldownHistory = cooldownHistoryRes.data ?? [];

  if (cooldownHistory.length >= 3) {
    const cooldownBssValues = cooldownHistory
      .map((c) => c.bss_at_activation)
      .filter((v): v is number => v !== null);

    if (cooldownBssValues.length >= 3) {
      const avgBssAfterCooldown = Math.round(
        cooldownBssValues.reduce((s, v) => s + v, 0) / cooldownBssValues.length,
      );

      insightData = {
        cleanSessionsAfterCooldown: cooldownBssValues.filter((v) => v >= 70).length,
        totalCooldownsUsed: cooldownHistory.length,
        avgBssAfterCooldown,
        avgBssWithoutCooldown: bssAtActivation ?? 50,
      };
    }
  }

  /* 5. Select prompt — three-tier cascade (primary for DB) + full sequence */
  const { prompt, promptType } = selectCooldownPrompt({
    todayGoal,
    profileGoal,
    insightData,
  });

  const promptSequence = buildCooldownSequence({
    todayGoal,
    profileGoal,
    insightData,
  });

  /* 6. Parse optional template from request body */
  let templateUsed = 'orb';
  try {
    const body = await req.json();
    if (body.template && ['orb', 'orbital', 'minimal'].includes(body.template)) {
      templateUsed = body.template;
    }
  } catch {
    // No body or invalid JSON — use default
  }

  /* 7. Insert activation record */
  const { data: activation, error: insertErr } = await admin
    .from('cooldown_activations')
    .insert({
      user_id: user.id,
      account_ref: accountRef,
      template_used: templateUsed,
      prompt_delivered: prompt,
      prompt_type: promptType,
      bss_at_activation: bssAtActivation,
    })
    .select('activation_id')
    .single();

  if (insertErr || !activation) {
    return Response.json(
      { error: 'Failed to create activation' },
      { status: 500 },
    );
  }

  return Response.json({
    activation_id: activation.activation_id,
    prompt,
    prompt_type: promptType,
    prompt_sequence: promptSequence,
    bss_at_activation: bssAtActivation,
  });
}
