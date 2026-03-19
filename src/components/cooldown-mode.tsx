'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { X, Timer, Infinity as InfinityIcon } from 'lucide-react';
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
 * Timing sequence (spaced out — let each prompt sink in):
 *   0s:        Visual appears. Full opacity. No text. Just the light breathing.
 *   10s:       First prompt fades in over 2.5s.
 *   10+12=22s: First prompt fades out over 2s.
 *   22+6=28s:  Silence between prompts (breathing room).
 *   28s:       Second prompt fades in over 2.5s.
 *   ...        Each subsequent prompt: 12s hold → 2s out → 6s silence → 2.5s in
 *
 * Timer: Default 90s countdown shown bottom-center.
 * Toggle to indefinite mode — no timer, close manually.
 */

// Timing constants (ms)
const INITIAL_SILENCE = 10000;
const FADE_IN_DURATION = 2500;
const HOLD_DURATION = 12000;
const FADE_OUT_DURATION = 2000;
const BETWEEN_SILENCE = 6000; // breathing room between prompts
const DEFAULT_TIMER_SECONDS = 90;

type FadePhase = 'silent' | 'fading-in' | 'visible' | 'fading-out' | 'between';

export function CooldownMode({
  isOpen,
  onClose,
  promptSequence,
  activationId,
}: CooldownModeProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [phase, setPhase] = useState<FadePhase>('silent');
  const [closing, setClosing] = useState(false);
  const [indefiniteMode, setIndefiniteMode] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(DEFAULT_TIMER_SECONDS);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);

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
      setSecondsLeft(DEFAULT_TIMER_SECONDS);
      clearTimer();
      if (countdownRef.current) clearInterval(countdownRef.current);
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
    setSecondsLeft(DEFAULT_TIMER_SECONDS);

    schedulePhase('fading-in', INITIAL_SILENCE);

    // Countdown timer
    countdownRef.current = setInterval(() => {
      if (cancelled) return;
      setSecondsLeft(prev => {
        if (prev <= 1) return 0;
        return prev - 1;
      });
    }, 1000);

    return () => {
      cancelled = true;
      clearTimer();
      if (countdownRef.current) clearInterval(countdownRef.current);
    };
  }, [isOpen, promptSequence, activationId]);

  // Auto-close when timer hits 0 (unless indefinite mode)
  useEffect(() => {
    if (secondsLeft === 0 && !indefiniteMode && isOpen && !closing) {
      handleClose();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [secondsLeft, indefiniteMode, isOpen, closing]);

  // Phase transitions — includes breathing room between prompts
  useEffect(() => {
    if (!isOpen || promptSequence.length === 0) return;

    let cancelled = false;

    if (phase === 'fading-in') {
      timerRef.current = setTimeout(() => {
        if (!cancelled) setPhase('visible');
      }, FADE_IN_DURATION);
    } else if (phase === 'visible') {
      timerRef.current = setTimeout(() => {
        if (!cancelled) setPhase('fading-out');
      }, HOLD_DURATION);
    } else if (phase === 'fading-out') {
      // After fade-out → breathing silence before next prompt
      timerRef.current = setTimeout(() => {
        if (cancelled) return;
        setPhase('between');
      }, FADE_OUT_DURATION);
    } else if (phase === 'between') {
      // Silence between prompts — let it sink in
      timerRef.current = setTimeout(() => {
        if (cancelled) return;
        const nextIndex = (currentIndex + 1) % promptSequence.length;
        setCurrentIndex(nextIndex);
        setPhase('fading-in');
      }, BETWEEN_SILENCE);
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
    phase === 'fading-in' || phase === 'visible'
      ? 'opacity-100'
      : 'opacity-0';

  // Transition duration matches the current phase
  const transitionDuration =
    phase === 'fading-in'
      ? 'duration-[2500ms]'
      : phase === 'fading-out'
        ? 'duration-[2000ms]'
        : 'duration-[300ms]';

  // Format timer
  const minutes = Math.floor(secondsLeft / 60);
  const seconds = secondsLeft % 60;
  const timerDisplay = `${minutes}:${seconds.toString().padStart(2, '0')}`;

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

      {/* Timer + indefinite toggle — bottom center */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-[110] flex items-center gap-4">
        {!indefiniteMode && (
          <span
            className="font-mono text-[28px] font-light text-white/30 tabular-nums tracking-wider"
            style={{ textShadow: '0 1px 8px rgba(0,0,0,0.3)' }}
          >
            {timerDisplay}
          </span>
        )}
        <button
          onClick={() => setIndefiniteMode(!indefiniteMode)}
          className={`flex items-center gap-2 rounded-full px-3 py-1.5 font-mono text-[9px] uppercase tracking-[0.15em] transition-all backdrop-blur-sm ${
            indefiniteMode
              ? 'bg-white/15 text-white/60 border border-white/20'
              : 'bg-white/5 text-white/25 border border-white/10 hover:text-white/40 hover:bg-white/10'
          }`}
        >
          {indefiniteMode ? (
            <>
              <InfinityIcon size={12} />
              Indefinite
            </>
          ) : (
            <>
              <Timer size={12} />
              Stay longer
            </>
          )}
        </button>
      </div>

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
