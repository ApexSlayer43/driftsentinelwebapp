'use client';

import { useState, useEffect, useCallback } from 'react';
import { X } from 'lucide-react';
import { MorphingLight } from '@/components/ui/morphing-light';

interface CooldownModeProps {
  isOpen: boolean;
  onClose: () => void;
  prompt: string | null;
  activationId: string | null;
}

/**
 * Cooldown Mode — full-screen behavioral intervention overlay.
 *
 * Timing sequence:
 *   0s:  Visual appears. Full opacity. No text. Just the light breathing.
 *   8s:  Senti prompt fades in over 2 seconds.
 *   ∞:   No auto-close. Trader closes when ready.
 *
 * The silence is the feature. Do not shorten it.
 */
export function CooldownMode({
  isOpen,
  onClose,
  prompt,
  activationId,
}: CooldownModeProps) {
  const [showPrompt, setShowPrompt] = useState(false);
  const [closing, setClosing] = useState(false);

  // 8-second silence before prompt reveal
  useEffect(() => {
    if (!isOpen) {
      setShowPrompt(false);
      setClosing(false);
      return;
    }

    const timer = setTimeout(() => setShowPrompt(true), 8000);
    return () => clearTimeout(timer);
  }, [isOpen]);

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

  return (
    <div className="fixed inset-0 z-[100] bg-[#0a0a0f]">
      {/* WebGL shader background */}
      <MorphingLight speed={0.6} />

      {/* Close button — always visible, subtle */}
      <button
        onClick={handleClose}
        className="absolute top-6 right-6 z-[110] rounded-full p-2 text-white/30 transition-colors hover:text-white/70 hover:bg-white/5"
        aria-label="Close cooldown mode"
      >
        <X size={20} />
      </button>

      {/* Senti prompt — fades in at 8 seconds */}
      <div
        className={`absolute inset-0 z-[105] flex items-center justify-center transition-opacity duration-[2000ms] ${
          showPrompt ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
      >
        <div className="max-w-lg mx-8 text-center">
          {/* Semi-transparent backdrop for readability */}
          <div className="rounded-2xl bg-black/40 backdrop-blur-sm px-8 py-10 border border-white/[0.06]">
            <p className="font-mono text-[15px] leading-relaxed text-white/90 whitespace-pre-line">
              {prompt}
            </p>
          </div>
        </div>
      </div>

      {/* Fade-in animation for the whole overlay */}
      <style>{`
        @keyframes cooldownFadeIn {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
      `}</style>
    </div>
  );
}
