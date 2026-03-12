import { MODE_LABELS } from './tokens';
import type { StatePayload } from './types';

export type InsightTone = 'positive' | 'warning' | 'caution' | 'neutral';

export interface Insight {
  text: string;
  tone: InsightTone;
}

export function getInsight(data: StatePayload): Insight {
  const { violations_today, onboarding, drift } = data;
  const topDriver = drift.drivers[0];

  // Building state
  if (onboarding.is_building) {
    const progress = onboarding.baseline_progress;
    const pct = Math.round((progress.collected / progress.required) * 100);
    return {
      text: `Calibrating baseline. ${progress.collected}/${progress.required} fills collected (${pct}%).`,
      tone: 'neutral',
    };
  }

  // Clean streak — high score + zero violations signals compounding discipline
  if (violations_today.length === 0 && data.bss_score >= 90) {
    return {
      text: '12 clean days. Your discipline is compounding.',
      tone: 'positive',
    };
  }

  if (violations_today.length === 0) {
    return {
      text: 'Clean session so far. Stay inside your rules.',
      tone: 'positive',
    };
  }

  if (topDriver && topDriver.points >= 10) {
    return {
      text: `Primary drift source: ${MODE_LABELS[topDriver.mode] ?? topDriver.mode}. ${topDriver.points} points accumulated.`,
      tone: 'warning',
    };
  }

  if (violations_today.length > 0) {
    return {
      text: `${violations_today.length} violation${violations_today.length > 1 ? 's' : ''} today. Review and adjust.`,
      tone: 'caution',
    };
  }

  return {
    text: `BSS ${data.bss_score}. ${data.bss_tier} tier.`,
    tone: 'neutral',
  };
}
