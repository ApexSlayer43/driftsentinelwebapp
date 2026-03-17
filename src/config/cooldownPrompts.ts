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

// ── Prompt Generators ────────────────────────────────────────────

/**
 * Blended Reflection — combines daily intention with profile goal.
 * The one-two punch: tactical focus + strategic why.
 */
export function blendedReflectionPrompt(dailyGoal: string, profileGoal: string): string {
  return (
    `This morning you said: "${dailyGoal}"\n\n` +
    `But the reason you're here at all is because you told me:\n"${profileGoal}"\n\n` +
    `Which version of yourself is sitting in this chair right now?`
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
 */
export function behavioralInsightPrompt(
  data: BehavioralInsightData
): string | null {
  if (data.totalCooldownsUsed < 3) return null;

  return (
    `The last ${data.totalCooldownsUsed} times you stopped here, ` +
    `your next session averaged BSS ${data.avgBssAfterCooldown}. ` +
    `Sessions where you didn't stop averaged ${data.avgBssWithoutCooldown}.\n\n` +
    `The data already answered the question.`
  );
}

// ── Curated Banks ────────────────────────────────────────────────

/**
 * Socratic question bank — always available.
 */
export const QUESTION_BANK: readonly string[] = [
  'Who suffers the most if you continue to trade against your own rules?',
  'The trader you described in your goals — would they take this trade?',
  'What would you tell a trader you were mentoring if they sent you this session so far?',
  'Is the market doing something different right now, or are you?',
  'What does the next version of your account look like if this session continues the way it\'s going?',
  'You built something over the last several sessions. What happens to it in the next 20 minutes if you stay in this chair?',
  'What specifically changed between the start of this session and right now?',
  'If your BSS score is the measure of your discipline — what is it measuring at this moment?',
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
}): PromptSequenceItem[] {
  const sequence: PromptSequenceItem[] = [];

  // Slot 1: Personal reflection
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

  // Slot 2: Behavioral insight
  if (opts.insightData) {
    const insight = behavioralInsightPrompt(opts.insightData);
    if (insight) {
      sequence.push({ text: insight, type: 'behavioral_insight' });
    }
  }

  // Slot 3: Socratic question(s) — fill to ensure at least 3 total
  const questionsNeeded = Math.max(1, 3 - sequence.length);
  const questions = pickUniqueRandom(QUESTION_BANK, questionsNeeded);
  for (const q of questions) {
    sequence.push({ text: q, type: 'question_bank' });
  }

  // Slot 4: Always end with Mark Douglas
  sequence.push({
    text: pickRandom(MARK_DOUGLAS_QUOTES),
    type: 'mark_douglas',
  });

  return sequence;
}
