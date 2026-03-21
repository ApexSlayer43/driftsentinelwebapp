// src/lib/senti/index.ts
// Barrel export for Senti personality engine

export { SENTI_CORE_IDENTITY, SENTI_VOICE } from './identity';
export { SENTI_MODES, MODE_LABELS, MODE_DESCRIPTIONS, type SentiMode } from './modes';
export { buildDynamicContext, type TraderProfile, type Fill, type ProtocolRule, type Violation, type DailyScore, type SessionStateInfo } from './context';
export { composeSentiPrompt, composeSentiPromptString, resolveMode, type SystemPromptBlock } from './compose';
export { computeSessionState } from './session-state';
