'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { X } from 'lucide-react';
import { GradientBackground } from '@/components/ui/noisy-gradient-backgrounds';
import type { PromptSequenceItem } from '@/lib/cooldown-context';

/**
 * Sunset palette — warm golden core radiating up through
 * soft peach → lavender → cool blue-gray sky. Matches the
 * reference image Casey provided. The prompts float just
 * above the "sun" in the lower third.
 */
const SUNSET_COLORS = [
  { color: 'rgba(220,120,10,1)', stop: '5%' },
  { color: 'rgba(245,140,30,1)', stop: '12%' },
  { color: 'rgba(248,165,70,1)', stop: '18%' },
  { color: 'rgba(245,175,110,1)', stop: '25%' },
  { color: 'rgba(238,174,192,1)', stop: '38%' },
  { color: 'rgba(212,178,210,1)', stop: '52%' },
  { color: 'rgba(185,180,215,1)', stop: '68%' },
  { color: 'rgba(160,185,220,1)', stop: '82%' },
  { color: 'rgba(148,195,228,1)', stop: '100%' },
];

interface CooldownModeProps {
  isOpen: boolean;
  onClose: () => void;
  promptSequence: PromptSequenceItem[];
  activationId: string | null;
}

/**
 * Cooldown Mode — full-screen behavioral intervention overlay.
 *
 * Timing sequence:
 *   0s:       Visual appears. Full opacity. No text. Just the light breathing.
 *   8s:       First prompt fades in over 2s.
 *   8+8=16s:  First prompt fades out over 1.5s.
 *   17.5s:    Second prompt fades in over 2s.
 *   ...       Each subsequent prompt: 8s hold → 1.5s out → 2s in
 *   ∞:        No auto-close. Trader closes when ready.
 *
 * The silence is the feature. Do not shorten it.
 */

// Timing constants (ms)
const INITIAL_SILENCE = 8000;
const FADE_IN_DURATION = 2000;
const HOLD_DURATION = 8000;
const FADE_OUT_DURATION = 1500;
const CYCLE = FADE_IN_DURATION + HOLD_DURATION + FADE_OUT_DURATION; // 11500ms per prompt

type FadePhase = 'silent' | 'fading-in' | 'visible' | 'fading-out';

export function CooldownMode({
  isOpen,
  onClose,
  promptSequence,
  activationId,
}: CooldownModeProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [phase, setPhase] = useState<FadePhase>('silent');
  const [closing, setClosing] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTimer = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };

  // Master sequencer — drives the prompt carousel
  useEffect(() => {
    if (!isOpen || promptSequence.length === 0) {
      setCurrentIndex(0);
      setPhase('silent');
      setClosing(false);
      clearTimer();
      return;
    }

    let cancelled = false;

    function schedulePhase(newPhase: FadePhase, delay: number) {
      clearTimer();
      timerRef.current = setTimeout(() => {
        if (cancelled) return;
        setPhase(newPhase);
      }, delay);
    }

    // Start the initial silence → first fade-in
    setPhase('silent');
    setCurrentIndex(0);

    schedulePhase('fading-in', INITIAL_SILENCE);

    return () => {
      cancelled = true;
      clearTimer();
    };
  }, [isOpen, promptSequence]);

  // Phase transitions after first fade-in
  useEffect(() => {
    if (!isOpen || promptSequence.length === 0) return;

    let cancelled = false;

    if (phase === 'fading-in') {
      // After fade-in animation completes → visible (hold)
      timerRef.current = setTimeout(() => {
        if (!cancelled) setPhase('visible');
      }, FADE_IN_DURATION);
    } else if (phase === 'visible') {
      // After hold → fade out
      timerRef.current = setTimeout(() => {
        if (!cancelled) setPhase('fading-out');
      }, HOLD_DURATION);
    } else if (phase === 'fading-out') {
      // After fade-out → advance to next prompt or loop
      timerRef.current = setTimeout(() => {
        if (cancelled) return;
        const nextIndex = (currentIndex + 1) % promptSequence.length;
        setCurrentIndex(nextIndex);
        setPhase('fading-in');
      }, FADE_OUT_DURATION);
    }

    return () => {
      cancelled = true;
      clearTimer();
    };
  }, [phase, currentIndex, isOpen, promptSequence]);

  // Escape key to close
  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') handleClose();
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [isOpen]);

  const handleClose = useCallback(async () => {
    if (closing) return;
    setClosing(true);

    // Close the activation in the DB
    if (activationId) {
      try {
        await fetch('/api/cooldown/close', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ activation_id: activationId }),
        });
      } catch {
        // Non-blocking — UI closes regardless
      }
    }

    onClose();
  }, [activationId, onClose, closing]);

  if (!isOpen) return null;

  const currentPrompt = promptSequence[currentIndex];
  const isMarkDouglas = currentPrompt?.type === 'mark_douglas';

  // Opacity based on phase
  const textOpacity =
    phase === 'fading-in'
      ? 'opacity-100'
      : phase === 'visible'
        ? 'opacity-100'
        : phase === 'fading-out'
          ? 'opacity-0'
          : 'opacity-0';

  // Transition duration matches the current phase
  const transitionDuration =
    phase === 'fading-in'
      ? 'duration-[2000ms]'
      : phase === 'fading-out'
        ? 'duration-[1500ms]'
        : 'duration-[300ms]';

  return (
    <div className="fixed inset-0 z-[100] overflow-hidden" style={{ animation: 'cooldownFadeIn 1.5s ease-out' }}>
      {/* Noisy sunset gradient background */}
      <GradientBackground
        gradientOrigin="bottom-middle"
        gradientSize="130% 130%"
        colors={SUNSET_COLORS}
        noiseIntensity={0.9}
        noisePatternSize={100}
        noisePatternRefreshInterval={2}
        noisePatternAlpha={40}
      />

      {/* Close button — top-right, subtle against the gradient */}
      <button
        onClick={handleClose}
        className="absolute top-6 right-6 z-[110] rounded-full p-2 text-white/25 transition-colors hover:text-white/60 hover:bg-white/10 backdrop-blur-sm"
        aria-label="Close cooldown mode"
      >
        <X size={20} />
      </button>

      {/* Prompt carousel — positioned in upper-center, above the "sun" */}
      <div
        className={`absolute inset-0 z-[105] flex flex-col items-center justify-center transition-opacity ease-in-out ${textOpacity} ${transitionDuration}`}
        style={{ paddingBottom: '15%' }}
      >
        {currentPrompt && (
          <div className="max-w-xl mx-8 text-center">
            {/* Main prompt — serif-style feel, warm shadow against gradient */}
            <p
              className="text-[18px] sm:text-[20px] leading-[1.9] text-white/95 whitespace-pre-line font-light tracking-wide"
              style={{
                fontFamily: "'Georgia', 'Times New Roman', serif",
                textShadow:
                  '0 1px 3px rgba(80,30,0,0.5), 0 0 40px rgba(120,60,0,0.3), 0 0 80px rgba(0,0,0,0.15)',
              }}
            >
              {currentPrompt.text}
            </p>

            {/* Mark Douglas attribution */}
            {isMarkDouglas && (
              <p
                className="mt-5 text-[11px] tracking-[0.18em] uppercase text-white/40 font-light"
                style={{
                  fontFamily: "'Georgia', serif",
                  textShadow: '0 1px 8px rgba(80,30,0,0.3)',
                }}
              >
                — Mark Douglas, Trading in the Zone
              </p>
            )}

            {/* Progress dots — warm tones to match gradient */}
            {promptSequence.length > 1 && (
              <div className="mt-10 flex items-center justify-center gap-2">
                {promptSequence.map((_, i) => (
                  <div
                    key={i}
                    className={`h-1 rounded-full transition-all duration-700 ${
                      i === currentIndex
                        ? 'w-5 bg-white/50'
                        : i < currentIndex
                          ? 'w-1.5 bg-white/25'
                          : 'w-1.5 bg-white/10'
                    }`}
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Entry animation keyframes */}
      <style>{`
        @keyframes cooldownFadeIn {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
      `}</style>
    </div>
  );
}
