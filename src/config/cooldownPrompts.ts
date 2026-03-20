/**
 * Cooldown Mode — Senti Prompt Engine
 *
 * Server-side curated prompt bank. Not in the database — this is versioned
 * content, not user data. The backend assembles the final prompt from one
 * of five sources based on what data is available for the trader.
 *
 * Priority cascade (three tiers):
 *   Tier 1 — Personal reflection (uses trader's own words)
 *     1a. daily_intention + profile_goal → blended reflection
 *     1b. daily_intention only           → daily goal reflection
 *     1c. profile_goal only              → north star reflection
 *   Tier 2 — Behavioral data
 *     2.  behavioral_insight             → cooldown history stats
 *   Tier 3 — Universal
 *     3a. question_bank                  → Socratic prompts (80%)
 *     3b. mark_douglas                   → Quote fallback (20%)
 */

// ── Types ────────────────────────────────────────────────────────

export type PromptType =
  | 'goal_reflection'
  | 'profile_reflection'
  | 'blended_reflection'
  | 'behavioral_insight'
  | 'question_bank'
  | 'mark_douglas';

export interface CooldownPromptResult {
  prompt: string;
  promptType: PromptType;
}

export interface BehavioralInsightData {
  cleanSessionsAfterCooldown: number;
  totalCooldownsUsed: number;
  avgBssAfterCooldown: number;
  avgBssWithoutCooldown: number;
}

/** Today's live session context — fed from DB at cooldown activation */
export interface SessionContext {
  fillsToday: number;
  violationsToday: number;
  violationModes: string[];    // e.g. ['OVERSIZE', 'FREQUENCY']
  dsiToday: number | null;     // null if no score yet
  bssCurrent: number | null;
  isOffSession: boolean;
  maxQtyToday: number;
  sessionDuration: string | null; // e.g. "2h 15m" or null
}

// ── Prompt Generators ────────────────────────────────────────────

/**
 * Blended Reflection — combines daily intention with profile goal.
 * The one-two punch: tactical focus + strategic why.
 */
export function blendedReflectionPrompt(dailyGoal: string, profileGoal: string): string {
  return (
    `This morning you said: "${dailyGoal}"\n\n` +
    `And the reason you trade at all:\n"${profileGoal}"\n\n` +
    `Is the next trade aligned with both?`
  );
}

/**
 * Daily Goal Reflection — mirrors today's intention back.
 */
export function goalReflectionPrompt(goal: string): string {
  return `This morning you said: "${goal}"\n\nIs the trader in this chair right now the one who wrote that?`;
}

/**
 * Profile Goal Reflection — references the trader's north star.
 * Always available once the trader sets their profile goal.
 */
export function profileReflectionPrompt(profileGoal: string): string {
  return (
    `You said the reason you trade is:\n"${profileGoal}"\n\n` +
    `Is what you're doing right now building that — or burning it?`
  );
}

/**
 * Behavioral Insight — uses cooldown history to show the data.
 * Returns null if insufficient data.
 *
 * Adapts the message based on whether cooldowns are actually helping:
 * - If cooldown BSS > non-cooldown BSS → reinforce the behavior
 * - If roughly equal → neutral encouragement
 * - If cooldown BSS < non-cooldown BSS → reframe around building the habit
 */
export function behavioralInsightPrompt(
  data: BehavioralInsightData
): string | null {
  if (data.totalCooldownsUsed < 3) return null;

  const delta = data.avgBssAfterCooldown - data.avgBssWithoutCooldown;

  // Cooldowns are clearly helping
  if (delta > 2) {
    return (
      `The last ${data.totalCooldownsUsed} times you paused here, ` +
      `your next session averaged BSS ${data.avgBssAfterCooldown}. ` +
      `Sessions without a pause averaged ${data.avgBssWithoutCooldown}.\n\n` +
      `The data already answered the question.`
    );
  }

  // Roughly equal — neutral framing
  if (delta >= -2) {
    return (
      `You've paused ${data.totalCooldownsUsed} times now. ` +
      `That's ${data.totalCooldownsUsed} moments where you chose awareness over impulse.\n\n` +
      `Consistency compounds. Keep building the habit.`
    );
  }

  // Cooldowns not yet showing results — reframe around awareness
  return (
    `You've stopped to think ${data.totalCooldownsUsed} times. ` +
    `The pattern you're building isn't about one session — it's about who you're becoming.\n\n` +
    `The trader who pauses is already different from the one who doesn't.`
  );
}

/**
 * Session-aware prompts — generated from today's actual trading data.
 * These make the cooldown feel intelligent, not generic.
 */
export function sessionAwarePrompts(ctx: SessionContext): string[] {
  const prompts: string[] = [];

  // Clean day — reinforce, don't warn
  if (ctx.violationsToday === 0 && ctx.fillsToday > 0) {
    prompts.push(
      `${ctx.fillsToday} fills today. Zero violations. ` +
      `You're in control. This pause isn't because something went wrong — it's because you're building the habit of checking in.`
    );
    if (ctx.dsiToday !== null && ctx.dsiToday >= 90) {
      prompts.push(
        `DSI ${ctx.dsiToday}/100 today. That's discipline in action. ` +
        `The trader who pauses on a good day is the one who stays consistent.`
      );
    }
  }

  // Violations detected — specific, not generic
  if (ctx.violationsToday > 0) {
    const modeLabels = ctx.violationModes.map(m =>
      m === 'OVERSIZE' ? 'position sizing' :
      m === 'FREQUENCY' ? 'trade frequency' :
      m === 'OFF_SESSION' ? 'off-session trading' :
      m === 'REVENGE_ENTRY' ? 'revenge entry' :
      m === 'SIZE_ESCALATION' ? 'size escalation' :
      m === 'HESITATION' ? 'hesitation' :
      m === 'BASELINE_SHIFT' ? 'baseline shift' :
      m.toLowerCase().replace('_', ' ')
    );
    const unique = [...new Set(modeLabels)];

    prompts.push(
      `${ctx.violationsToday} pattern${ctx.violationsToday > 1 ? 's' : ''} detected today: ${unique.join(', ')}.\n\n` +
      `This is what drift looks like from the inside. You don't feel it happening — but the data sees it.`
    );

    if (ctx.dsiToday !== null && ctx.dsiToday < 60) {
      prompts.push(
        `DSI ${ctx.dsiToday}/100. The session is already scored. ` +
        `The question isn't whether today was clean — it wasn't. ` +
        `The question is: does the next trade make it worse or does stopping here protect tomorrow?`
      );
    }
  }

  // Off-session trading
  if (ctx.isOffSession) {
    prompts.push(
      `You're outside your session window right now. ` +
      `Every fill from here gets flagged. Is this trade part of your plan, or part of the pattern?`
    );
  }

  // High fill count — overtrading signal
  if (ctx.fillsToday >= 15) {
    prompts.push(
      `${ctx.fillsToday} fills today. That's a lot of activity. ` +
      `More trades doesn't mean more edge — it usually means less discipline. ` +
      `What's driving the volume?`
    );
  }

  // Large position size
  if (ctx.maxQtyToday >= 5) {
    prompts.push(
      `Your largest position today was ${ctx.maxQtyToday} contracts. ` +
      `Size follows emotion. Is this the size your protocol calls for, or the size your ego wants?`
    );
  }

  // No fills yet — pre-session cooldown
  if (ctx.fillsToday === 0) {
    prompts.push(
      `No trades yet today. You activated cooldown before entering the market. ` +
      `That's awareness. Use this time to set your intention — not just what you'll trade, but how.`
    );
  }

  return prompts;
}

// ── Curated Banks ────────────────────────────────────────────────

/**
 * Socratic question bank — always available.
 */
export const QUESTION_BANK: readonly string[] = [
  // Therapeutic / self-awareness
  'Who suffers the most if you continue to trade against your own rules?',
  'The trader you described in your goals — would they take this trade?',
  'What would you tell a trader you were mentoring if they sent you this session so far?',
  'Is the market doing something different right now, or are you?',
  'What does the next version of your account look like if this session continues the way it\'s going?',
  'You built something over the last several sessions. What happens to it in the next 20 minutes if you stay in this chair?',
  'What specifically changed between the start of this session and right now?',
  'If your BSS score is the measure of your discipline — what is it measuring at this moment?',
  // Emotional regulation
  'Name the emotion you\'re feeling right now. Not the trade — the emotion.',
  'Are you trading to make money, or trading to feel something?',
  'The urge to re-enter after a loss isn\'t strategy. What is it?',
  'If you close the platform right now and come back tomorrow, what do you lose? What do you protect?',
  'Your body knows before your mind does. What is it telling you right now?',
  // Identity / purpose
  'The version of you that\'s funded and consistent — how does that person handle this moment?',
  'You\'re not behind. You\'re building. Is the next trade building or burning?',
  'Discipline isn\'t something you have. It\'s something you do. What are you doing right now?',
  'This pause is proof that something is different about how you trade now.',
  // Pattern recognition
  'How many times have you been in this exact emotional state and traded anyway? What happened?',
  'The last time you felt this way during a session, what did the next 30 minutes look like?',
  'You know what happens next if you don\'t stop. You\'ve seen this movie before.',
] as const;

/**
 * Mark Douglas quotes — fallback when no behavioral data exists.
 */
export const MARK_DOUGLAS_QUOTES: readonly string[] = [
  'The best traders have a winner\'s mindset because they\'ve reconciled their relationship with risk.',
  'You don\'t need to know what the market is going to do next to make money.',
  'The market doesn\'t generate happy or unhappy feelings — you generate those based on what you believe.',
  'The traders who can make money consistently have learned to think in probabilities.',
  'Every loss, every time you move your stop, every time you hesitate — you are creating the consistency of a loser.',
  'Risk is the truth of trading. Accepting it is the edge.',
  'The consistency you seek in the market is a reflection of the consistency within you.',
  'The best signal in the world is worthless if you can\'t execute it with discipline.',
  'Trading is a psychological game. Most people think they\'re playing a money game.',
  'When you genuinely accept the risks, you will be at peace with any outcome.',
] as const;

// ── Prompt Selection Logic ───────────────────────────────────────

function pickRandom<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

/** Pick N unique random items from an array (Fisher-Yates partial shuffle) */
function pickUniqueRandom<T>(arr: readonly T[], n: number): T[] {
  const pool = [...arr];
  const result: T[] = [];
  for (let i = 0; i < Math.min(n, pool.length); i++) {
    const idx = Math.floor(Math.random() * (pool.length - i)) + i;
    [pool[i], pool[idx]] = [pool[idx], pool[i]];
    result.push(pool[i]);
  }
  return result;
}

/**
 * Select the best available prompt given the trader's current context.
 * Returns a single prompt (legacy — used for DB storage of primary prompt).
 *
 * Three-tier cascade:
 *   Tier 1: Personal reflection (daily goal, profile goal, or both)
 *   Tier 2: Behavioral insight (cooldown history data)
 *   Tier 3: Universal (question bank or Mark Douglas)
 */
export function selectCooldownPrompt(opts: {
  todayGoal?: string | null;
  profileGoal?: string | null;
  insightData?: BehavioralInsightData | null;
}): CooldownPromptResult {
  // Tier 1a: Both daily intention + profile goal → blended
  if (opts.todayGoal && opts.profileGoal) {
    return {
      prompt: blendedReflectionPrompt(opts.todayGoal, opts.profileGoal),
      promptType: 'blended_reflection',
    };
  }

  // Tier 1b: Daily intention only
  if (opts.todayGoal) {
    return {
      prompt: goalReflectionPrompt(opts.todayGoal),
      promptType: 'goal_reflection',
    };
  }

  // Tier 1c: Profile goal only (the north star)
  if (opts.profileGoal) {
    return {
      prompt: profileReflectionPrompt(opts.profileGoal),
      promptType: 'profile_reflection',
    };
  }

  // Tier 2: Behavioral insight
  if (opts.insightData) {
    const insight = behavioralInsightPrompt(opts.insightData);
    if (insight) {
      return { prompt: insight, promptType: 'behavioral_insight' };
    }
  }

  // Tier 3: Question bank (80%) or Mark Douglas (20%)
  if (Math.random() < 0.8) {
    return {
      prompt: pickRandom(QUESTION_BANK),
      promptType: 'question_bank',
    };
  }

  return {
    prompt: pickRandom(MARK_DOUGLAS_QUOTES),
    promptType: 'mark_douglas',
  };
}

// ── Prompt Sequence Builder ─────────────────────────────────────

export interface PromptSequenceItem {
  text: string;
  type: PromptType;
}

/**
 * Build the full cooldown prompt sequence — multiple messages that
 * fade in one at a time during the cooldown experience.
 *
 * Ordering:
 *   1. Personal reflection (if available)
 *   2. Behavioral insight (if available)
 *   3. Socratic question
 *   4. Mark Douglas quote
 *
 * Always returns 3-4 items. Fills from lower tiers when upper tiers
 * don't have data.
 */
export function buildCooldownSequence(opts: {
  todayGoal?: string | null;
  profileGoal?: string | null;
  insightData?: BehavioralInsightData | null;
  sessionContext?: SessionContext | null;
}): PromptSequenceItem[] {
  const sequence: PromptSequenceItem[] = [];

  // Slot 1: Session-aware insight (most relevant — reads today's actual data)
  if (opts.sessionContext) {
    const sessionPrompts = sessionAwarePrompts(opts.sessionContext);
    if (sessionPrompts.length > 0) {
      // Pick the most relevant one (first is highest priority)
      sequence.push({
        text: sessionPrompts[0],
        type: 'behavioral_insight',
      });
      // If there's a second data-driven insight, queue it for later
      if (sessionPrompts.length > 1) {
        sequence.push({
          text: sessionPrompts[1],
          type: 'behavioral_insight',
        });
      }
    }
  }

  // Slot 2: Personal reflection
  if (opts.todayGoal && opts.profileGoal) {
    sequence.push({
      text: blendedReflectionPrompt(opts.todayGoal, opts.profileGoal),
      type: 'blended_reflection',
    });
  } else if (opts.todayGoal) {
    sequence.push({
      text: goalReflectionPrompt(opts.todayGoal),
      type: 'goal_reflection',
    });
  } else if (opts.profileGoal) {
    sequence.push({
      text: profileReflectionPrompt(opts.profileGoal),
      type: 'profile_reflection',
    });
  }

  // Slot 3: Cooldown history insight
  if (opts.insightData) {
    const insight = behavioralInsightPrompt(opts.insightData);
    if (insight) {
      sequence.push({ text: insight, type: 'behavioral_insight' });
    }
  }

  // Slot 4: Socratic question — fill to ensure at least 4 total
  const questionsNeeded = Math.max(1, 4 - sequence.length);
  const questions = pickUniqueRandom(QUESTION_BANK, questionsNeeded);
  for (const q of questions) {
    sequence.push({ text: q, type: 'question_bank' });
  }

  // Slot 5: Always end with Mark Douglas
  sequence.push({
    text: pickRandom(MARK_DOUGLAS_QUOTES),
    type: 'mark_douglas',
  });

  return sequence;
}
