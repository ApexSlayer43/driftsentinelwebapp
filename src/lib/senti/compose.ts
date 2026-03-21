// src/lib/senti/compose.ts
// Full system prompt composition — combines all three layers:
//   1. SENTI_CORE_IDENTITY (stable, cached)
//   2. SENTI_MODES[mode] (swapped per context)
//   3. buildDynamicContext(user) (changes every request)
//
// Returns array format for Anthropic prompt caching:
//   Block 0: identity + mode instructions → cache_control: ephemeral
//   Block 1: dynamic context + RAG → NOT cached

import { SENTI_CORE_IDENTITY } from './identity';
import { SENTI_MODES, type SentiMode } from './modes';
import { buildDynamicContext, type TraderProfile } from './context';

/**
 * resolveMode — auto-detect the best Senti mode from trader context.
 * No manual mode picker needed. The system reads the clock and data.
 */
export function resolveMode(user: TraderProfile): SentiMode {
  // New user with no data → onboarding
  if (user.fills.length === 0 && user.totalViolations === 0 && user.dailyScores.length === 0) {
    return 'onboarding';
  }

  // Session clock drives mode selection
  if (user.sessionState) {
    switch (user.sessionState.state) {
      case 'PRE_SESSION':
        return 'morningBriefing';
      case 'IN_SESSION':
        return 'sessionCompanion';
      case 'POST_SESSION':
        return 'postSessionAAR';
      case 'OFF_DAY':
        return 'sessionCompanion';
    }
  }

  // Fallback — ambient companion
  return 'sessionCompanion';
}

export interface SystemPromptBlock {
  type: 'text';
  text: string;
  cache_control?: { type: 'ephemeral' };
}

/**
 * composeSentiPrompt — builds the full layered system prompt.
 *
 * @param mode - Which behavioral mode Senti operates in
 * @param user - Real-time trader profile data from Supabase
 * @param ragContext - Optional RAG-retrieved behavioral history
 * @returns Array of system prompt blocks (for prompt caching) OR a single string
 */
export function composeSentiPrompt(
  mode: SentiMode | undefined,
  user: TraderProfile,
  ragContext?: string
): SystemPromptBlock[] {
  const resolvedMode = mode ?? resolveMode(user);
  const modeInstructions = SENTI_MODES[resolvedMode];
  const dynamicContext = buildDynamicContext(user);
  const ragSection = ragContext
    ? `\n<retrieved_behavioral_history>\n${ragContext}\n</retrieved_behavioral_history>`
    : '';

  // Array format for prompt caching
  return [
    {
      type: 'text' as const,
      text: SENTI_CORE_IDENTITY + modeInstructions,
      cache_control: { type: 'ephemeral' as const }, // Cache stable personality
    },
    {
      type: 'text' as const,
      text: dynamicContext + ragSection, // Dynamic — changes per request
    },
  ];
}

/**
 * composeSentiPromptString — flat string version for Vercel AI SDK.
 * The AI SDK's `system` param takes a single string; we lose prompt caching
 * but gain simplicity. Good enough for MVP.
 */
export function composeSentiPromptString(
  mode: SentiMode | undefined,
  user: TraderProfile,
  ragContext?: string
): string {
  const resolvedMode = mode ?? resolveMode(user);
  const modeInstructions = SENTI_MODES[resolvedMode];
  const dynamicContext = buildDynamicContext(user);
  const ragSection = ragContext
    ? `\n<retrieved_behavioral_history>\n${ragContext}\n</retrieved_behavioral_history>`
    : '';

  return SENTI_CORE_IDENTITY + modeInstructions + '\n\n' + dynamicContext + ragSection;
}
