'use client';

import type { StatePayload } from '@/lib/types';
import { MODE_LABELS } from '@/lib/tokens';

type VerdictTone = 'positive' | 'warning' | 'caution' | 'neutral';

interface VerdictLineProps {
  data: StatePayload;
}

/**
 * One-line behavioral verdict below the gauge.
 * Replaces the old insight text with tier-aware, streak-aware summaries.
 */
export function VerdictLine({ data }: VerdictLineProps) {
  const { text, tone } = computeVerdict(data);

  const toneColors: Record<VerdictTone, string> = {
    positive: 'text-stable',
    warning: 'text-drift',
    caution: 'text-compromised',
    neutral: 'text-text-secondary',
  };

  return (
    <p className={`max-w-md text-center font-mono text-sm leading-relaxed ${toneColors[tone]}`}>
      {text}
    </p>
  );
}

function computeVerdict(data: StatePayload): { text: string; tone: VerdictTone } {
  const { violations_today, onboarding, drift, bss_tier, bss_streak, bss_delta } = data;
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

  // SOVEREIGN + clean streak
  if (violations_today.length === 0 && bss_tier === 'SOVEREIGN') {
    return {
      text: `Discipline is compounding. ${bss_streak}-day streak.`,
      tone: 'positive',
    };
  }

  // DISCIPLINED + clean
  if (violations_today.length === 0 && bss_tier === 'DISCIPLINED') {
    return {
      text: `Strong track record holding. ${bss_streak > 1 ? `${bss_streak}-day streak.` : 'Stay the course.'}`,
      tone: 'positive',
    };
  }

  // CONSISTENT + clean
  if (violations_today.length === 0 && bss_tier === 'CONSISTENT') {
    return {
      text: `Above average and climbing.${bss_delta > 0 ? ` +${bss_delta} today.` : ''}`,
      tone: 'positive',
    };
  }

  // Any clean session
  if (violations_today.length === 0) {
    if (bss_streak >= 3) {
      return {
        text: `Clean session. ${bss_streak}-day streak building.`,
        tone: 'positive',
      };
    }
    return {
      text: 'Clean session so far. Stay inside your rules.',
      tone: 'positive',
    };
  }

  // Primary driver dominance
  if (topDriver && topDriver.points >= 10) {
    return {
      text: `Primary drift source: ${MODE_LABELS[topDriver.mode] ?? topDriver.mode}. ${topDriver.points} points.`,
      tone: 'warning',
    };
  }

  // Generic violations
  if (violations_today.length > 0) {
    return {
      text: `${violations_today.length} violation${violations_today.length > 1 ? 's' : ''} today. Review and adjust.`,
      tone: 'caution',
    };
  }

  return {
    text: `BSS ${data.bss_score}. ${bss_tier} tier.`,
    tone: 'neutral',
  };
}
