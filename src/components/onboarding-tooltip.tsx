'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { X, ChevronRight, CheckCircle } from 'lucide-react';
import { useOnboarding, ONBOARDING_STEPS } from '@/lib/onboarding-context';

/** Floating tooltip that highlights a specific UI element during onboarding */
export default function OnboardingTooltip() {
  const { currentTooltipStep, completeStep, hideTooltip, isActive } = useOnboarding();
  const [position, setPosition] = useState<{ x: number; y: number; width: number; height: number } | null>(null);
  const [mounted, setMounted] = useState(false);
  const tooltipRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  const step = currentTooltipStep
    ? ONBOARDING_STEPS.find((s) => s.id === currentTooltipStep)
    : null;

  // Position the tooltip relative to the target element
  const updatePosition = useCallback(() => {
    if (!step?.targetSelector) {
      setPosition(null);
      return;
    }
    const el = document.querySelector(step.targetSelector);
    if (!el) {
      setPosition(null);
      return;
    }
    const rect = el.getBoundingClientRect();
    // Treat zero-size elements (hidden divs) as not found
    if (rect.width === 0 && rect.height === 0) {
      setPosition(null);
      return;
    }
    setPosition({
      x: rect.left,
      y: rect.top,
      width: rect.width,
      height: rect.height,
    });
  }, [step]);

  useEffect(() => {
    if (!currentTooltipStep) {
      setPosition(null);
      return;
    }
    // Retry with increasing delay — handles modals/sheets that animate open
    const timers = [
      setTimeout(updatePosition, 200),
      setTimeout(updatePosition, 500),
      setTimeout(updatePosition, 900),
    ];
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);

    return () => {
      timers.forEach(clearTimeout);
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    };
  }, [currentTooltipStep, updatePosition]);

  if (!mounted || !isActive || !step || !currentTooltipStep) return null;

  const stepIndex = ONBOARDING_STEPS.findIndex((s) => s.id === currentTooltipStep);

  // Calculate tooltip position — always use top/left with viewport clamping
  const TOOLTIP_WIDTH = 320;
  const TOOLTIP_HEIGHT_EST = 180; // approximate max height
  let tooltipStyle: React.CSSProperties = {};
  if (position) {
    const pos = step.tooltipPosition ?? 'bottom';
    const gap = 12;
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    let top: number;
    let left: number;

    if (pos === 'bottom') {
      top = position.y + position.height + gap;
      left = position.x + position.width / 2 - TOOLTIP_WIDTH / 2;
    } else if (pos === 'top') {
      top = position.y - TOOLTIP_HEIGHT_EST - gap;
      left = position.x + position.width / 2 - TOOLTIP_WIDTH / 2;
    } else if (pos === 'right') {
      top = position.y + position.height / 2 - TOOLTIP_HEIGHT_EST / 2;
      left = position.x + position.width + gap;
    } else {
      top = position.y + position.height / 2 - TOOLTIP_HEIGHT_EST / 2;
      left = position.x - TOOLTIP_WIDTH - gap;
    }

    // Clamp within viewport with 16px padding
    top = Math.max(16, Math.min(top, vh - TOOLTIP_HEIGHT_EST - 16));
    left = Math.max(16, Math.min(left, vw - TOOLTIP_WIDTH - 16));

    tooltipStyle = { position: 'fixed', top, left, zIndex: 9999 };
  } else {
    // No target found — center on screen
    tooltipStyle = {
      position: 'fixed',
      top: '50%',
      left: '50%',
      transform: 'translate(-50%, -50%)',
      zIndex: 9999,
    };
  }

  return createPortal(
    <>
      {/* Spotlight overlay — dim everything except target */}
      {position && (
        <div
          className="fixed inset-0 z-[9998] pointer-events-none"
          style={{
            background: `radial-gradient(ellipse ${position.width + 40}px ${position.height + 40}px at ${position.x + position.width / 2}px ${position.y + position.height / 2}px, transparent 50%, rgba(0,0,0,0.6) 100%)`,
          }}
        />
      )}

      {/* Tooltip card */}
      <div
        ref={tooltipRef}
        style={tooltipStyle}
        className="w-[320px] rounded-xl border border-[rgba(200,169,110,0.1)] bg-[rgba(8,10,14,0.95)] backdrop-blur-xl shadow-2xl animate-in fade-in slide-in-from-bottom-2 duration-300"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 pt-3 pb-2">
          <span className="font-mono text-[10px] font-bold uppercase tracking-[0.15em] text-[#c8a96e]">
            Step {stepIndex + 1} of {ONBOARDING_STEPS.length}
          </span>
          <button
            onClick={hideTooltip}
            className="rounded-full p-1 hover:bg-[rgba(200,169,110,0.06)] transition-colors"
          >
            <X size={14} className="text-text-muted" />
          </button>
        </div>

        {/* Content */}
        <div className="px-4 pb-2">
          <h3 className="font-display text-sm font-bold text-text-primary">
            {step.title}
          </h3>
          <p className="mt-1.5 font-mono text-[11px] leading-relaxed text-text-secondary">
            {step.description}
          </p>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between px-4 py-3 border-t border-[rgba(200,169,110,0.06)]">
          <button
            onClick={hideTooltip}
            className="font-mono text-[10px] font-semibold uppercase tracking-wider text-text-muted hover:text-text-secondary transition-colors"
          >
            Skip
          </button>
          <button
            onClick={() => completeStep(currentTooltipStep)}
            className="flex items-center gap-1.5 rounded-full bg-[rgba(200,169,110,0.1)] px-3 py-1.5 font-mono text-[10px] font-bold uppercase tracking-wider text-[#c8a96e] hover:bg-[rgba(200,169,110,0.18)] transition-colors"
          >
            <CheckCircle size={12} />
            Got it
            <ChevronRight size={12} />
          </button>
        </div>
      </div>
    </>,
    document.body,
  );
}
