'use client';

import { useEffect, useCallback } from 'react';
import { X } from 'lucide-react';
import { EvidenceSessions } from './evidence-sessions';
import { EvidenceViolations } from './evidence-violations';
import { EvidenceTrends } from './evidence-trends';

interface EvidenceSheetProps {
  isOpen: boolean;
  onClose: () => void;
  accountRef?: string;
}

/**
 * Evidence Sheet — bottom sheet showing all 3 sections at once.
 * Opens from gauge tap. Slides up with spring animation.
 * 3-column grid: Sessions | Violations | Trends
 */
export function EvidenceSheet({ isOpen, onClose, accountRef }: EvidenceSheetProps) {
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') onClose();
  }, [onClose]);

  useEffect(() => {
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
      return () => document.removeEventListener('keydown', handleKeyDown);
    }
  }, [isOpen, handleKeyDown]);

  if (!isOpen) return null;

  return (
    <div data-onboard="evidence-sheet" className="fixed inset-0 z-50">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/30 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Sheet */}
      <div
        className="absolute bottom-0 left-0 right-0 bg-white/[0.06] backdrop-blur-2xl border border-white/[0.1] rounded-t-3xl flex flex-col"
        style={{
          height: '70vh',
          animation: 'sheetSlideUp 0.35s cubic-bezier(0.16, 1, 0.3, 1)',
        }}
      >
        {/* Header — drag handle + title + close */}
        <div className="flex items-center justify-between px-6 pt-3 pb-2 shrink-0">
          <div className="flex items-center gap-3">
            <div className="h-1 w-10 rounded-full bg-text-dim" />
            <span className="font-mono text-[11px] font-semibold uppercase tracking-[0.15em] text-text-muted">
              Score Breakdown
            </span>
          </div>
          <button
            onClick={onClose}
            className="rounded-full p-1.5 transition-colors hover:bg-elevated"
          >
            <X size={14} className="text-text-muted" />
          </button>
        </div>

        {/* Separator */}
        <div className="mx-6 h-px bg-border-subtle shrink-0" />

        {/* 3-column grid filling the panel */}
        <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-3 gap-0 overflow-hidden">
          {/* Sessions column */}
          <div data-onboard="evidence-sessions" className="flex flex-col min-h-0 border-r border-white/[0.08]">
            <div className="px-4 py-2.5 shrink-0">
              <h3 className="font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-text-muted">
                Sessions
              </h3>
            </div>
            <div className="flex-1 overflow-y-auto px-4 pb-4">
              <EvidenceSessions accountRef={accountRef} />
            </div>
          </div>

          {/* Violations column */}
          <div data-onboard="evidence-violations" className="flex flex-col min-h-0 border-r border-white/[0.08]">
            <div className="px-4 py-2.5 shrink-0">
              <h3 className="font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-text-muted">
                Patterns
              </h3>
            </div>
            <div className="flex-1 overflow-y-auto px-4 pb-4">
              <EvidenceViolations accountRef={accountRef} />
            </div>
          </div>

          {/* Trends column */}
          <div data-onboard="evidence-trends" className="flex flex-col min-h-0">
            <div className="px-4 py-2.5 shrink-0">
              <h3 className="font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-text-muted">
                Trends
              </h3>
            </div>
            <div className="flex-1 overflow-y-auto px-4 pb-4">
              <EvidenceTrends accountRef={accountRef} />
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes sheetSlideUp {
          from { transform: translateY(100%); opacity: 0; }
          to   { transform: translateY(0);    opacity: 1; }
        }
      `}</style>
    </div>
  );
}
