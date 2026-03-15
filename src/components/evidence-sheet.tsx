'use client';

import { useState, useEffect, useCallback } from 'react';
import { X } from 'lucide-react';
import { EvidenceSessions } from './evidence-sessions';
import { EvidenceViolations } from './evidence-violations';
import { EvidenceTrends } from './evidence-trends';

type EvidenceTab = 'sessions' | 'violations' | 'trends';

interface EvidenceSheetProps {
  isOpen: boolean;
  onClose: () => void;
  accountRef?: string;
}

const TAB_LABELS: Record<EvidenceTab, string> = {
  sessions: 'Sessions',
  violations: 'Violations',
  trends: 'Trends',
};

/**
 * Evidence Sheet — bottom sheet with 3 tabs.
 * Opens from gauge tap. Slides up with spring animation.
 * Uses the existing liquid-glass design language.
 */
export function EvidenceSheet({ isOpen, onClose, accountRef }: EvidenceSheetProps) {
  const [activeTab, setActiveTab] = useState<EvidenceTab>('sessions');

  // Close on Escape
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

  const TABS: EvidenceTab[] = ['sessions', 'violations', 'trends'];

  return (
    <div className="fixed inset-0 z-50">
      {/* Backdrop — click to close */}
      <div
        className="absolute inset-0 bg-black/30 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Sheet — liquid-glass-raised per spec Section 7 */}
      <div
        className="absolute bottom-0 left-0 right-0 liquid-glass-raised rounded-t-3xl"
        style={{
          maxHeight: '65vh',
          animation: 'sheetSlideUp 0.35s cubic-bezier(0.16, 1, 0.3, 1)',
        }}
      >
        {/* Drag handle + close */}
        <div className="flex items-center justify-between px-5 pt-3 pb-1">
          <div className="h-1 w-10 rounded-full bg-text-dim" />
          <button
            onClick={onClose}
            className="rounded-full p-1.5 transition-colors hover:bg-elevated"
          >
            <X size={14} className="text-text-muted" />
          </button>
        </div>

        {/* Tab bar — liquid glass tabs */}
        <div className="flex gap-1.5 px-5 pb-3">
          {TABS.map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`rounded-full px-4 py-1.5 font-mono text-[12px] font-bold uppercase tracking-[0.12em] transition-all ${
                activeTab === tab
                  ? 'liquid-glass-tab-active text-text-primary'
                  : 'liquid-glass-tab text-text-muted hover:text-text-secondary'
              }`}
            >
              {TAB_LABELS[tab]}
            </button>
          ))}
        </div>

        {/* Separator */}
        <div className="mx-5 h-px bg-border-subtle" />

        {/* Tab content */}
        <div className="overflow-y-auto px-5 py-4" style={{ maxHeight: 'calc(65vh - 100px)' }}>
          {activeTab === 'sessions' && <EvidenceSessions accountRef={accountRef} />}
          {activeTab === 'violations' && <EvidenceViolations accountRef={accountRef} />}
          {activeTab === 'trends' && <EvidenceTrends accountRef={accountRef} />}
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
