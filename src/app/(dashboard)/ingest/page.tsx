'use client';

import { useState, useEffect, useCallback } from 'react';
import { Upload, CheckCircle, XCircle, Copy, Plus, ChevronDown, RefreshCw } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { GlowPanel } from '@/components/ui/glow-panel';
import { useStrategies } from '@/hooks/use-strategies';
import type { IngestRun } from '@/lib/types';

interface CsvResult {
  summary: {
    grossPnl: number;
    totalTrades: number;
    winningTrades: number;
    losingTrades: number;
    winRate: number;
    contracts: string[];
  };
  trades_parsed: number;
  date_range: { start: string; end: string } | null;
  fills_generated: number;
  fills_new: number;
  fills_duplicate: number;
  fills_rejected: number;
}

export default function IngestPage() {
  const [dragOver, setDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [csvResult, setCsvResult] = useState<CsvResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [recentRuns, setRecentRuns] = useState<IngestRun[]>([]);
  const { strategies, defaultStrategy, createStrategy } = useStrategies();
  const [selectedStrategyId, setSelectedStrategyId] = useState<string>('');
  const [showStrategyDropdown, setShowStrategyDropdown] = useState(false);
  const [newStrategyName, setNewStrategyName] = useState('');
  const [creatingStrategy, setCreatingStrategy] = useState(false);
  const [recomputing, setRecomputing] = useState(false);
  const [recomputeResult, setRecomputeResult] = useState<{ ok: boolean; bss_score?: number; bss_tier?: string; error?: string } | null>(null);

  // Auto-select default strategy when loaded
  useEffect(() => {
    if (!selectedStrategyId && defaultStrategy) {
      setSelectedStrategyId(defaultStrategy.strategy_id);
    }
  }, [defaultStrategy, selectedStrategyId]);

  useEffect(() => {
    async function loadRuns() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data } = await supabase
        .from('ingest_runs')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(10);

      if (data) setRecentRuns(data as IngestRun[]);
    }
    loadRuns();
  }, [csvResult]);

  const handleFile = useCallback(async (file: File) => {
    const isCsv = file.name.toLowerCase().endsWith('.csv');

    if (!isCsv) {
      setError('Please upload a Tradovate Performance CSV file');
      return;
    }

    setUploading(true);
    setError(null);
    setCsvResult(null);

    try {
      const csvText = await file.text();

      const res = await fetch('/api/ingest/csv', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          csv_text: csvText,
          source_file: file.name,
          strategy_id: selectedStrategyId || undefined,
        }),
      });

      if (!res.ok) {
        const errBody = await res.json().catch(() => null);
        throw new Error(errBody?.error || `Upload failed: ${res.status}`);
      }

      const data: CsvResult = await res.json();
      setCsvResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploading(false);
    }
  }, [selectedStrategyId]);

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  }

  return (
    <div className="overflow-auto px-8 py-8">
      <h1 className="font-display text-2xl font-bold text-text-primary">
        Upload
      </h1>
      <p className="mt-1 font-mono text-xs text-text-muted">
        Import your trading data — Tradovate Performance CSV
      </p>

      {/* Strategy picker */}
      {strategies.length > 0 && (
        <div className="mt-4 relative" data-onboard="strategy-picker">
          <div className="font-mono text-[10px] uppercase tracking-[0.15em] text-text-dim mb-1.5">
            Strategy
          </div>
          <button
            onClick={() => setShowStrategyDropdown(!showStrategyDropdown)}
            className="flex items-center gap-2 rounded-lg border border-white/[0.08] bg-white/[0.04] backdrop-blur-xl px-3 py-2 font-mono text-[12px] text-text-secondary hover:border-white/[0.12] transition-colors min-w-[200px]"
          >
            <span className="flex-1 text-left">
              {strategies.find((s) => s.strategy_id === selectedStrategyId)?.tag ?? 'Default'}
            </span>
            <ChevronDown size={12} className="text-text-dim" />
          </button>

          {showStrategyDropdown && (
            <div className="absolute top-full left-0 mt-1 z-50 min-w-[220px] rounded-lg border border-white/[0.1] bg-white/[0.06] backdrop-blur-2xl shadow-xl">
              {strategies.map((s) => (
                <button
                  key={s.strategy_id}
                  onClick={() => {
                    setSelectedStrategyId(s.strategy_id);
                    setShowStrategyDropdown(false);
                  }}
                  className={`w-full text-left px-3 py-2 font-mono text-[12px] transition-colors hover:bg-white/[0.04] ${
                    s.strategy_id === selectedStrategyId ? 'text-text-primary' : 'text-text-muted'
                  }`}
                >
                  {s.tag}
                  {s.is_default && (
                    <span className="ml-2 text-[9px] text-text-dim uppercase">(default)</span>
                  )}
                </button>
              ))}
              <div className="border-t border-white/[0.08] px-3 py-2">
                {creatingStrategy ? (
                  <div className="flex gap-1.5">
                    <input
                      value={newStrategyName}
                      onChange={(e) => setNewStrategyName(e.target.value)}
                      placeholder="Strategy name..."
                      autoFocus
                      className="flex-1 rounded bg-white/[0.04] px-2 py-1 font-mono text-[11px] text-text-primary border border-border-subtle focus:border-border-active outline-none"
                      onKeyDown={async (e) => {
                        if (e.key === 'Enter' && newStrategyName.trim()) {
                          try {
                            const created = await createStrategy(newStrategyName.trim());
                            setSelectedStrategyId(created.strategy_id);
                            setNewStrategyName('');
                            setCreatingStrategy(false);
                            setShowStrategyDropdown(false);
                          } catch { /* error handled in hook */ }
                        }
                        if (e.key === 'Escape') {
                          setCreatingStrategy(false);
                          setNewStrategyName('');
                        }
                      }}
                    />
                  </div>
                ) : (
                  <button
                    onClick={() => setCreatingStrategy(true)}
                    className="flex items-center gap-1.5 font-mono text-[11px] text-text-muted hover:text-positive transition-colors"
                  >
                    <Plus size={12} />
                    New Strategy
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Upload zone — accepts both formats regardless of mode toggle */}
      <div
        data-onboard="upload-zone"
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        className={`mt-4 flex flex-col items-center justify-center rounded-xl border-2 border-dashed p-12 transition-colors ${
          dragOver
            ? 'border-positive bg-positive/[0.04]'
            : 'border-border-subtle glass hover:border-border-active'
        }`}
      >
        {uploading ? (
          <>
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-positive border-t-transparent" />
            <p className="mt-3 font-mono text-sm text-text-secondary">
              Processing CSV...
            </p>
          </>
        ) : (
          <>
            <Upload size={32} className="text-text-muted" strokeWidth={1} />
            <p className="mt-3 font-mono text-sm text-text-secondary">
              Drop your Tradovate Performance CSV here
            </p>
            <p className="mt-1 font-mono text-[12px] text-text-muted">
              or click to browse
            </p>
            <p className="mt-3 font-mono text-[12px] text-text-dim">
              Supports Tradovate Performance CSV exports
            </p>
            <input
              type="file"
              accept=".csv"
              onChange={handleInputChange}
              className="absolute inset-0 cursor-pointer opacity-0"
              style={{ position: 'relative', width: 'auto', marginTop: 12 }}
            />
          </>
        )}
      </div>

      {/* CSV Result */}
      {csvResult && (
        <GlowPanel data-onboard="upload-results" className="mt-4 p-5 border border-positive/20 bg-positive/[0.04]">
          <div className="flex items-center gap-2 mb-3">
            <CheckCircle size={16} className="text-positive" />
            <span className="font-mono text-sm font-semibold text-positive">
              Performance CSV Parsed — {csvResult.trades_parsed} Trades
            </span>
          </div>

          {csvResult.date_range && (
            <p className="font-mono text-[11px] text-text-muted mb-3">
              Date range: {csvResult.date_range.start} → {csvResult.date_range.end}
            </p>
          )}

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-3">
            <StatCell label="Gross P/L" value={`$${csvResult.summary.grossPnl.toFixed(2)}`} color={csvResult.summary.grossPnl >= 0 ? '#FFFFFF' : '#8891A0'} />
            <StatCell label="Win Rate" value={`${csvResult.summary.winRate}%`} color={csvResult.summary.winRate >= 50 ? '#FFFFFF' : '#8891A0'} />
            <StatCell label="Winning" value={String(csvResult.summary.winningTrades)} />
            <StatCell label="Losing" value={String(csvResult.summary.losingTrades)} />
            <StatCell label="Trades" value={String(csvResult.summary.totalTrades)} />
            <StatCell label="Fills" value={String(csvResult.fills_generated)} />
            <StatCell label="Contracts" value={csvResult.summary.contracts.join(', ')} />
          </div>

          <div className="border-t border-white/[0.08] pt-3 mt-3">
            <p className="font-mono text-[10px] uppercase tracking-wider text-text-muted mb-2">Pipeline Result</p>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <div className="font-mono text-[12px] uppercase tracking-[0.15em] text-text-muted">Accepted</div>
                <div className="font-display text-xl font-bold text-positive">{csvResult.fills_new}</div>
              </div>
              <div>
                <div className="font-mono text-[12px] uppercase tracking-[0.15em] text-text-muted">Duplicate</div>
                <div className="font-display text-xl font-bold text-text-secondary">{csvResult.fills_duplicate}</div>
              </div>
              <div>
                <div className="font-mono text-[12px] uppercase tracking-[0.15em] text-text-muted">Rejected</div>
                <div className="font-display text-xl font-bold text-negative">{csvResult.fills_rejected}</div>
              </div>
            </div>
          </div>
        </GlowPanel>
      )}

      {error && (
        <div className="mt-4 flex items-center gap-2 rounded-xl border border-negative/20 bg-negative/[0.04] p-4">
          <XCircle size={16} className="text-negative" />
          <span className="font-mono text-sm text-negative">{error}</span>
        </div>
      )}

      {/* Recompute BSS button */}
      <div className="mt-4 flex items-center gap-3">
        <button
          onClick={async () => {
            setRecomputing(true);
            setRecomputeResult(null);
            try {
              const res = await fetch('/api/compute/trigger', { method: 'POST' });
              const data = await res.json();
              if (res.ok) {
                setRecomputeResult({ ok: true, bss_score: data.bss_score, bss_tier: data.bss_tier });
              } else {
                setRecomputeResult({ ok: false, error: data.error || 'Compute failed' });
              }
            } catch (err) {
              setRecomputeResult({ ok: false, error: err instanceof Error ? err.message : 'Failed' });
            } finally {
              setRecomputing(false);
            }
          }}
          disabled={recomputing}
          className="flex items-center gap-2 rounded-lg border border-white/[0.08] bg-white/[0.04] backdrop-blur-xl px-4 py-2 font-mono text-[12px] text-text-secondary hover:border-white/[0.15] hover:bg-white/[0.06] transition-all disabled:opacity-50"
        >
          <RefreshCw size={14} className={recomputing ? 'animate-spin' : ''} />
          {recomputing ? 'Recomputing...' : 'Recompute BSS'}
        </button>
        {recomputeResult && (
          <span className={`font-mono text-[11px] ${recomputeResult.ok ? 'text-positive' : 'text-negative'}`}>
            {recomputeResult.ok
              ? `BSS updated${recomputeResult.bss_score != null ? `: ${recomputeResult.bss_score} (${recomputeResult.bss_tier})` : ''}`
              : recomputeResult.error}
          </span>
        )}
      </div>

      {/* Recent uploads */}
      <div className="mt-8">
        <h3 className="font-mono text-[12px] font-semibold uppercase tracking-[0.2em] text-text-muted">
          Recent Uploads
        </h3>
        {recentRuns.length === 0 ? (
          <div className="mt-3 rounded-xl bg-white/[0.04] backdrop-blur-xl border border-white/[0.08] p-6 text-center">
            <Copy size={20} className="mx-auto text-text-dim" />
            <p className="mt-2 font-mono text-xs text-text-muted">No uploads yet</p>
          </div>
        ) : (
          <GlowPanel className="mt-3 overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/[0.08] bg-white/[0.04] backdrop-blur-xl">
                  <th className="px-4 py-2 text-left font-mono text-[12px] font-semibold uppercase tracking-[0.15em] text-text-dim">File</th>
                  <th className="px-4 py-2 text-left font-mono text-[12px] font-semibold uppercase tracking-[0.15em] text-text-dim">Date</th>
                  <th className="px-4 py-2 text-right font-mono text-[12px] font-semibold uppercase tracking-[0.15em] text-text-dim">Accepted</th>
                  <th className="px-4 py-2 text-right font-mono text-[12px] font-semibold uppercase tracking-[0.15em] text-text-dim">Dup</th>
                  <th className="px-4 py-2 text-right font-mono text-[12px] font-semibold uppercase tracking-[0.15em] text-text-dim">Rejected</th>
                </tr>
              </thead>
              <tbody>
                {recentRuns.map((run) => (
                  <tr key={run.ingest_run_id} className="border-b border-white/[0.08] hover:bg-white/[0.06]">
                    <td className="px-4 py-2.5 font-mono text-[12px] text-text-secondary">{run.file_name}</td>
                    <td className="px-4 py-2.5 font-mono text-[12px] text-text-muted">
                      {new Date(run.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </td>
                    <td className="px-4 py-2.5 text-right font-mono text-[12px] text-positive">{run.accepted_count}</td>
                    <td className="px-4 py-2.5 text-right font-mono text-[12px] text-text-muted">{run.dup_count}</td>
                    <td className="px-4 py-2.5 text-right font-mono text-[12px] text-negative">{run.reject_count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </GlowPanel>
        )}
      </div>
    </div>
  );
}

function StatCell({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="rounded-lg border border-white/[0.08] px-3 py-2">
      <div className="font-mono text-[8px] uppercase tracking-wider text-text-muted">{label}</div>
      <div className="font-mono text-sm font-bold mt-0.5" style={{ color: color ?? '#E8EDF5' }}>{value}</div>
    </div>
  );
}
