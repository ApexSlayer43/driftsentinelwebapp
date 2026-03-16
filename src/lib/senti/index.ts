// src/lib/senti/index.ts
// Barrel export for Senti personality engine

export { SENTI_CORE_IDENTITY, SENTI_VOICE } from './identity';
export { SENTI_MODES, MODE_LABELS, MODE_DESCRIPTIONS, type SentiMode } from './modes';
export { buildDynamicContext, type TraderProfile } from './context';
export { composeSentiPrompt, composeSentiPromptString, type SystemPromptBlock } from './compose';
