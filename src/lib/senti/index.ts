// src/lib/senti/index.ts
// Barrel export for Senti personality engine

export { SENTI_CORE_IDENTITY, SENTI_VOICE } from './identity';
export { SENTI_MODES, MODE_LABELS, MODE_DESCRIPTIONS, type SentiMode } from './modes';
export { buildDynamicContext, type TraderProfile, type Fill, type ProtocolRule, type Violation, type DailyScore } from './context';
export { composeSentiPrompt, composeSentiPromptString, type SystemPromptBlock } from './compose';
