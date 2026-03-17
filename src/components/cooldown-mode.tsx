'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { X } from 'lucide-react';
import { MorphingLight } from '@/components/ui/morphing-light';
import type { PromptSequenceItem } from '@/lib/cooldown-context';

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
    <div className="fixed inset-0 z-[100] bg-[#020408]">
      {/* WebGL shader background */}
      <MorphingLight speed={0.6} />

      {/* Close button — always visible, subtle */}
      <button
        onClick={handleClose}
        className="absolute top-6 right-6 z-[110] rounded-full p-2 text-white/20 transition-colors hover:text-white/50 hover:bg-white/5"
        aria-label="Close cooldown mode"
      >
        <X size={20} />
      </button>

      {/* Prompt carousel — floats over shader, no container box */}
      <div
        className={`absolute inset-0 z-[105] flex items-center justify-center transition-opacity ease-in-out ${textOpacity} ${transitionDuration}`}
      >
        {currentPrompt && (
          <div className="max-w-lg mx-8 text-center">
            {/* Main prompt text — floating with text shadow for readability */}
            <p
              className="font-mono text-[16px] leading-[1.8] text-white/90 whitespace-pre-line"
              style={{
                textShadow:
                  '0 0 40px rgba(0,0,0,0.9), 0 0 80px rgba(0,0,0,0.7), 0 2px 4px rgba(0,0,0,0.8)',
              }}
            >
              {currentPrompt.text}
            </p>

            {/* Attribution for Mark Douglas quotes */}
            {isMarkDouglas && (
              <p
                className="mt-4 font-mono text-[11px] tracking-[0.15em] uppercase text-white/30"
                style={{
                  textShadow: '0 0 20px rgba(0,0,0,0.8)',
                }}
              >
                — Mark Douglas, Trading in the Zone
              </p>
            )}

            {/* Subtle progress dots */}
            {promptSequence.length > 1 && (
              <div className="mt-8 flex items-center justify-center gap-2">
                {promptSequence.map((_, i) => (
                  <div
                    key={i}
                    className={`h-1 rounded-full transition-all duration-700 ${
                      i === currentIndex
                        ? 'w-4 bg-white/40'
                        : i < currentIndex
                          ? 'w-1.5 bg-white/15'
                          : 'w-1.5 bg-white/8'
                    }`}
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Overlay entry animation */}
      <style>{`
        @keyframes cooldownFadeIn {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
      `}</style>
    </div>
  );
}
