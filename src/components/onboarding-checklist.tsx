'use client';

import { useState, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import {
  ChevronRight,
  ChevronDown,
  ChevronUp,
  X,
  Rocket,
  Upload,
  BarChart3,
  Radar,
  Shield,
  Bot,
  UserCircle,
  CheckCircle2,
  Circle,
  Sparkles,
  Settings,
  type LucideIcon,
} from 'lucide-react';
import { useOnboarding, ONBOARDING_STEPS, type OnboardingStep } from '@/lib/onboarding-context';

const GROUP_META: Record<string, { label: string; icon: LucideIcon }> = {
  setup: { label: 'Setup', icon: Settings },
  upload: { label: 'Upload', icon: Upload },
  dashboard: { label: 'Dashboard', icon: BarChart3 },
  sessions: { label: 'Sessions', icon: Radar },
  protocol: { label: 'Protocol', icon: Shield },
  senti: { label: 'Senti AI', icon: Bot },
  traderId: { label: 'Trader ID', icon: UserCircle },
};

export default function OnboardingChecklist() {
  const {
    isActive,
    completedSteps,
    progress,
    dismissOnboarding,
    completeStep,
    showTooltip,
    isStepCompleted,
    getNextIncompleteStep,
  } = useOnboarding();

  const router = useRouter();
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted || !isActive) return null;

  // All steps done
  const allDone = progress >= 100;

  function handleStepClick(step: OnboardingStep) {
    // Navigate if needed
    if (pathname !== step.href) {
      router.push(step.href);
      // Show tooltip after navigation settles
      setTimeout(() => showTooltip(step.id), 600);
    } else {
      showTooltip(step.id);
    }
  }

  function handleContinue() {
    const next = getNextIncompleteStep();
    if (next) handleStepClick(next);
  }

  // Group steps
  const groups = ['setup', 'upload', 'dashboard', 'sessions', 'protocol', 'senti', 'traderId'];

  return (
    <div className="fixed bottom-5 left-5 z-40 w-[300px] animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="rounded-2xl border border-white/[0.08] bg-[rgba(15,17,23,0.92)] backdrop-blur-xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.04]">
          <div className="flex items-center gap-2">
            <Rocket size={16} className="text-positive" />
            <span className="font-display text-xs font-bold uppercase tracking-wider text-text-primary">
              Getting Started
            </span>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setCollapsed(!collapsed)}
              className="rounded-full p-1 hover:bg-white/[0.06] transition-colors"
            >
              {collapsed ? (
                <ChevronUp size={14} className="text-text-muted" />
              ) : (
                <ChevronDown size={14} className="text-text-muted" />
              )}
            </button>
            <button
              onClick={dismissOnboarding}
              className="rounded-full p-1 hover:bg-white/[0.06] transition-colors"
            >
              <X size={14} className="text-text-muted" />
            </button>
          </div>
        </div>

        {/* Progress bar */}
        <div className="px-4 py-2 border-b border-white/[0.04]">
          <div className="flex items-center justify-between mb-1.5">
            <span className="font-mono text-[10px] text-text-muted">
              {Math.min(completedSteps.size, ONBOARDING_STEPS.length)} of {ONBOARDING_STEPS.length} complete
            </span>
            <span className="font-mono text-[10px] font-bold text-positive">{progress}%</span>
          </div>
          <div className="h-1 rounded-full bg-white/[0.06] overflow-hidden">
            <div
              className="h-full rounded-full bg-positive transition-all duration-500 ease-out"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        {/* Collapsed state */}
        {collapsed ? (
          <div className="px-4 py-3">
            <button
              onClick={() => {
                setCollapsed(false);
                handleContinue();
              }}
              className="w-full flex items-center justify-center gap-2 rounded-lg bg-positive/[0.1] px-3 py-2 font-mono text-[11px] font-bold text-positive hover:bg-positive/[0.15] transition-colors"
            >
              Continue Setup
              <ChevronRight size={14} />
            </button>
          </div>
        ) : (
          <>
            {/* Step list */}
            <div className="max-h-[300px] overflow-y-auto">
              {groups.map((groupKey) => {
                const meta = GROUP_META[groupKey];
                const groupSteps = ONBOARDING_STEPS.filter((s) => s.group === groupKey);
                const groupDone = groupSteps.every((s) => isStepCompleted(s.id));
                const GroupIcon = meta.icon;

                return (
                  <div key={groupKey} className="border-b border-white/[0.03] last:border-0">
                    {/* Group header */}
                    <div className="flex items-center gap-2 px-4 py-2">
                      <GroupIcon size={12} className={groupDone ? 'text-positive' : 'text-text-dim'} />
                      <span
                        className={`font-mono text-[9px] font-bold uppercase tracking-[0.15em] ${
                          groupDone ? 'text-positive' : 'text-text-muted'
                        }`}
                      >
                        {meta.label}
                      </span>
                      {groupDone && <CheckCircle2 size={10} className="text-positive" />}
                    </div>

                    {/* Steps */}
                    {groupSteps.map((step) => {
                      const done = isStepCompleted(step.id);
                      const isNext = !done && getNextIncompleteStep()?.id === step.id;

                      return (
                        <button
                          key={step.id}
                          onClick={() => (done ? null : handleStepClick(step))}
                          disabled={done}
                          className={`w-full flex items-center gap-2.5 px-4 py-2 text-left transition-colors ${
                            done
                              ? 'opacity-50 cursor-default'
                              : 'hover:bg-white/[0.03] cursor-pointer'
                          } ${isNext ? 'bg-positive/[0.04]' : ''}`}
                        >
                          {done ? (
                            <CheckCircle2 size={14} className="text-positive shrink-0" />
                          ) : (
                            <Circle
                              size={14}
                              className={`shrink-0 ${isNext ? 'text-positive' : 'text-text-dim'}`}
                            />
                          )}
                          <span
                            className={`font-mono text-[11px] ${
                              done
                                ? 'text-text-muted line-through'
                                : isNext
                                  ? 'text-text-primary font-semibold'
                                  : 'text-text-secondary'
                            }`}
                          >
                            {step.title}
                          </span>
                          {isNext && (
                            <ChevronRight size={12} className="text-positive ml-auto shrink-0" />
                          )}
                        </button>
                      );
                    })}
                  </div>
                );
              })}
            </div>

            {/* Footer */}
            <div className="px-4 py-3 border-t border-white/[0.04]">
              {allDone ? (
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Sparkles size={14} className="text-positive" />
                    <span className="font-mono text-[11px] font-bold text-positive">
                      Setup complete. You&apos;re operational.
                    </span>
                  </div>
                  <p className="font-mono text-[10px] text-text-muted leading-relaxed">
                    Your timezone, sessions, and rules are locked in. Upload data and let the engine work. Stay disciplined.
                  </p>
                  <button
                    onClick={dismissOnboarding}
                    className="w-full flex items-center justify-center gap-2 rounded-lg bg-positive/[0.1] px-3 py-2 font-mono text-[11px] font-bold text-positive hover:bg-positive/[0.15] transition-colors"
                  >
                    <Sparkles size={12} />
                    Dismiss
                  </button>
                </div>
              ) : (
                <button
                  onClick={handleContinue}
                  className="w-full flex items-center justify-center gap-2 rounded-lg bg-positive/[0.1] px-3 py-2 font-mono text-[11px] font-bold text-positive hover:bg-positive/[0.15] transition-colors"
                >
                  Continue
                  <ChevronRight size={14} />
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
