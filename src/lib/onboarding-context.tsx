'use client';

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';

/* ── Step definitions ── */

export interface OnboardingStep {
  id: string;
  group: 'setup' | 'upload' | 'dashboard' | 'sessions' | 'protocol' | 'senti' | 'traderId';
  title: string;
  description: string;
  href: string;            // page to navigate to
  targetSelector?: string; // CSS selector for tooltip anchor
  tooltipPosition?: 'top' | 'bottom' | 'left' | 'right';
}

export const ONBOARDING_STEPS: OnboardingStep[] = [
  // ── Setup — first things first ────────────────────────────────
  {
    id: 'set-timezone',
    group: 'setup',
    title: 'Set your timezone',
    description: 'We detected your timezone automatically. Confirm it here — this lets Drift Sentinel resolve your session windows correctly across daylight saving transitions. No manual clock math required.',
    href: '/settings',
    targetSelector: '[data-onboard="timezone-picker"]',
    tooltipPosition: 'bottom',
  },
  {
    id: 'configure-sessions',
    group: 'setup',
    title: 'Choose your trading sessions',
    description: 'Pick a market preset (US Futures, CME Globex, Eurex) or create a custom window. Times are in the exchange\'s local timezone — the system converts for you. Any fill outside these windows gets flagged.',
    href: '/settings',
    targetSelector: '[data-onboard="session-windows"]',
    tooltipPosition: 'bottom',
  },
  {
    id: 'set-trading-rules',
    group: 'setup',
    title: 'Define your trading rules',
    description: 'Set your max contracts and max fills per day. These are your guardrails — the rules you\'re imposing on yourself. The engine enforces them back on you so you stay disciplined even when emotions say otherwise.',
    href: '/settings',
    targetSelector: '[data-onboard="trading-rules"]',
    tooltipPosition: 'bottom',
  },
  // ── Upload ────────────────────────────────────────────────────
  {
    id: 'upload-data',
    group: 'upload',
    title: 'Upload your trading data',
    description: 'Drop a Tradovate CSV here. Drift Sentinel will parse your trades, generate fills, and run the full behavioral compute pipeline automatically.',
    href: '/ingest',
    targetSelector: '[data-onboard="upload-zone"]',
    tooltipPosition: 'bottom',
  },
  {
    id: 'review-upload-results',
    group: 'upload',
    title: 'Review your upload results',
    description: 'After uploading, you\'ll see how many trades were parsed, fills accepted, and any duplicates or rejections. This confirms your data is in the system.',
    href: '/ingest',
    targetSelector: '[data-onboard="upload-results"]',
    tooltipPosition: 'top',
  },
  // ── Dashboard ─────────────────────────────────────────────────
  {
    id: 'check-bss',
    group: 'dashboard',
    title: 'Check your BSS score',
    description: 'Your Behavioral Stability Score (BSS) tracks discipline over time using an exponential moving average. Clean sessions build it up — violations knock it down. Tap the gauge to open the evidence sheet.',
    href: '/',
    targetSelector: '[data-onboard="bss-gauge"]',
    tooltipPosition: 'bottom',
  },
  // ── Sessions & Evidence ───────────────────────────────────────
  {
    id: 'session-heatmap',
    group: 'sessions',
    title: 'Explore the session heatmap',
    description: 'Each cell is a trading day. Color intensity shows your DSI score — bright cyan for clean sessions, darker for violations. Click any day to drill into the session detail.',
    href: '/sessions',
    targetSelector: '[data-onboard="session-heatmap"]',
    tooltipPosition: 'bottom',
  },
  // ── Protocol ──────────────────────────────────────────────────
  {
    id: 'setup-protocol',
    group: 'protocol',
    title: 'Upload your trading protocol',
    description: 'Upload your written trading protocol and the engine will extract rules automatically. These rules power violation detection — turning your own plan into enforceable guardrails.',
    href: '/settings',
    targetSelector: '[data-onboard="protocol-settings"]',
    tooltipPosition: 'bottom',
  },
  // ── Senti AI ──────────────────────────────────────────────────
  {
    id: 'meet-senti',
    group: 'senti',
    title: 'Meet Senti — your AI companion',
    description: 'Senti is your behavioral co-pilot. It speaks from your data — morning briefings, post-session after-action reviews, or ambient session companion mode. It knows your timezone, session state, and every fill on record.',
    href: '/senti',
    targetSelector: '[data-onboard="senti-header"]',
    tooltipPosition: 'bottom',
  },
  {
    id: 'senti-modes',
    group: 'senti',
    title: 'Explore Senti modes',
    description: 'Switch between Session Companion (ambient, speaks when spoken to), Morning Briefing (proactive daily patterns), After Action Review (deep post-session analysis), and Onboarding (get oriented fast).',
    href: '/senti',
    targetSelector: '[data-onboard="senti-input"]',
    tooltipPosition: 'top',
  },
  // ── DS Trader ID ──────────────────────────────────────────────
  {
    id: 'view-trader-id',
    group: 'traderId',
    title: 'View your DS Trader ID',
    description: 'Your behavioral profile card — BSS score, tier, streak, delta, and 90-day trajectory all in one place. This is your discipline identity. Share it or keep it private.',
    href: '/trader-id',
    targetSelector: '[data-onboard="trader-id-hero"]',
    tooltipPosition: 'bottom',
  },
  {
    id: 'share-profile',
    group: 'traderId',
    title: 'Share your profile link',
    description: 'Copy your unique DS Trader ID link to share your behavioral track record. It shows your BSS score, tier, and performance — proof of discipline, not just P/L.',
    href: '/trader-id',
    targetSelector: '[data-onboard="trader-id-share"]',
    tooltipPosition: 'top',
  },
];

/* ── Context ── */

interface OnboardingState {
  isActive: boolean;
  completedSteps: Set<string>;
  currentTooltipStep: string | null;
  progress: number; // 0-100
}

interface OnboardingContextValue extends OnboardingState {
  startOnboarding: () => void;
  dismissOnboarding: () => void;
  completeStep: (stepId: string) => void;
  showTooltip: (stepId: string) => void;
  hideTooltip: () => void;
  isStepCompleted: (stepId: string) => boolean;
  getNextIncompleteStep: () => OnboardingStep | null;
}

const OnboardingContext = createContext<OnboardingContextValue | null>(null);

const STORAGE_KEY = 'ds_onboarding';

function loadState(): { completedSteps: string[]; dismissed: boolean } {
  if (typeof window === 'undefined') return { completedSteps: [], dismissed: false };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { completedSteps: [], dismissed: false };
    return JSON.parse(raw);
  } catch {
    return { completedSteps: [], dismissed: false };
  }
}

function saveState(completedSteps: string[], dismissed: boolean) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ completedSteps, dismissed }));
  } catch {
    // Storage full or blocked — ignore
  }
}

export function OnboardingProvider({ children }: { children: ReactNode }) {
  const [isActive, setIsActive] = useState(false);
  const [completedSteps, setCompletedSteps] = useState<Set<string>>(new Set());
  const [currentTooltipStep, setCurrentTooltipStep] = useState<string | null>(null);

  // Load from localStorage on mount
  useEffect(() => {
    const saved = loadState();
    const steps = new Set(saved.completedSteps);
    setCompletedSteps(steps);

    // Auto-activate if not dismissed and not all complete
    if (!saved.dismissed && steps.size < ONBOARDING_STEPS.length) {
      setIsActive(true);
    }
  }, []);

  // Persist changes
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const saved = loadState();
    saveState(Array.from(completedSteps), saved.dismissed || false);
  }, [completedSteps]);

  const progress = Math.round((completedSteps.size / ONBOARDING_STEPS.length) * 100);

  const startOnboarding = useCallback(() => {
    setIsActive(true);
    saveState(Array.from(completedSteps), false);
  }, [completedSteps]);

  const dismissOnboarding = useCallback(() => {
    setIsActive(false);
    setCurrentTooltipStep(null);
    saveState(Array.from(completedSteps), true);
  }, [completedSteps]);

  const completeStep = useCallback((stepId: string) => {
    setCompletedSteps((prev) => {
      const next = new Set(prev);
      next.add(stepId);
      return next;
    });
    setCurrentTooltipStep(null);
  }, []);

  const showTooltip = useCallback((stepId: string) => {
    setCurrentTooltipStep(stepId);
  }, []);

  const hideTooltip = useCallback(() => {
    setCurrentTooltipStep(null);
  }, []);

  const isStepCompleted = useCallback(
    (stepId: string) => completedSteps.has(stepId),
    [completedSteps],
  );

  const getNextIncompleteStep = useCallback((): OnboardingStep | null => {
    return ONBOARDING_STEPS.find((s) => !completedSteps.has(s.id)) ?? null;
  }, [completedSteps]);

  return (
    <OnboardingContext.Provider
      value={{
        isActive,
        completedSteps,
        currentTooltipStep,
        progress,
        startOnboarding,
        dismissOnboarding,
        completeStep,
        showTooltip,
        hideTooltip,
        isStepCompleted,
        getNextIncompleteStep,
      }}
    >
      {children}
    </OnboardingContext.Provider>
  );
}

export function useOnboarding() {
  const ctx = useContext(OnboardingContext);
  if (!ctx) throw new Error('useOnboarding must be used inside OnboardingProvider');
  return ctx;
}
