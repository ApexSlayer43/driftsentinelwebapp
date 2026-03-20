'use client';

import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';
import type { PerformanceSummary, ParsedTrade } from '@/lib/parse-performance-pdf';

/* ── Panel data types ── */

export interface PanelDayBreakdown {
  date: string;
  trades: number;
  pnl: number;
  wins: number;
  losses: number;
}

export interface PanelBehavioralFlag {
  type: 'revenge' | 'oversize' | 'off_session' | 'frequency' | 'size_escalation';
  description: string;
  severity: 'low' | 'medium' | 'high';
}

export interface IntelligencePanelData {
  fileName: string;
  dateRange: { start: string; end: string } | null;
  tradeCount: number;
  fillCount: number;
  summary: PerformanceSummary;
  dayBreakdown: PanelDayBreakdown[];
  behavioralFlags: PanelBehavioralFlag[];
  keyTrades: {
    biggestWin: ParsedTrade | null;
    biggestLoss: ParsedTrade | null;
    oversized: ParsedTrade[];
  };
  /** Source: 'upload' for fresh upload, 'recall' for pulled from history */
  source: 'upload' | 'recall';
  /** ISO timestamp of when this data was generated/recalled */
  timestamp: string;
}

/* ── Context ── */

interface IntelligencePanelContextValue {
  isOpen: boolean;
  data: IntelligencePanelData | null;
  openPanel: (data: IntelligencePanelData) => void;
  closePanel: () => void;
}

const IntelligencePanelContext = createContext<IntelligencePanelContextValue>({
  isOpen: false,
  data: null,
  openPanel: () => {},
  closePanel: () => {},
});

export function IntelligencePanelProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [data, setData] = useState<IntelligencePanelData | null>(null);

  const openPanel = useCallback((panelData: IntelligencePanelData) => {
    setData(panelData);
    setIsOpen(true);
  }, []);

  const closePanel = useCallback(() => {
    setIsOpen(false);
  }, []);

  return (
    <IntelligencePanelContext.Provider value={{ isOpen, data, openPanel, closePanel }}>
      {children}
    </IntelligencePanelContext.Provider>
  );
}

export function useIntelligencePanel() {
  return useContext(IntelligencePanelContext);
}
