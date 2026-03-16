'use client';

import { useState, useEffect, useCallback } from 'react';
import { Upload, CheckCircle, XCircle, Copy, FileText, FileSpreadsheet } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { GlowPanel } from '@/components/ui/glow-panel';
import type { IngestRun } from '@/lib/types';

type UploadMode = 'csv' | 'pdf';

interface PdfResult {
  summary: {
    grossPnl: number;
    totalPnl: number;
    tradeCount: number;
    contractCount: number;
    winRate: number;
    expectancy: number;
    fees: number;
    maxDrawdown: number;
    maxRunUp: number;
  };
  trades_parsed: number;
  date_range: { start: string; end: string } | null;
  fills_generated: number;
  ingest: { fills_new?: number; fills_duplicate?: number; fills_rejected?: number } | null;
}

export default function IngestPage() {
  const [dragOver, setDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [mode, setMode] = useState<UploadMode>('pdf');
  const [csvResult, setCsvResult] = useState<{ accepted: number; duplicate: number; rejected: number } | null>(null);
  const [pdfResult, setPdfResult] = useState<PdfResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [recentRuns, setRecentRuns] = useState<IngestRun[]>([]);

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
  }, [csvResult, pdfResult]);

  const handleFile = useCallback(async (file: File) => {
    const isPdf = file.name.toLowerCase().endsWith('.pdf');
    const isCsv = file.name.toLowerCase().endsWith('.csv');

    if (!isPdf && !isCsv) {
      setError('Supported formats: PDF (Performance Report) or CSV (Position History)');
      return;
    }

    setUploading(true);
    setError(null);
    setCsvResult(null);
    setPdfResult(null);

    try {
      if (isPdf) {
        const formData = new FormData();
        formData.append('file', file);

        const res = await fetch('/api/ingest/performance-pdf', {
          method: 'POST',
          body: formData,
        });

        if (!res.ok) {
          const errBody = await res.json().catch(() => null);
          throw new Error(errBody?.error || `Upload failed: ${res.status}`);
        }

        const data: PdfResult = await res.json();
        setPdfResult(data);
        setMode('pdf');
      } else {
        const csvText = await file.text();

        const res = await fetch('/api/ingest/csv', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ csv_text: csvText, source_file: file.name }),
        });

        if (!res.ok) {
          const errBody = await res.json().catch(() => null);
          throw new Error(errBody?.error || `Upload failed: ${res.status}`);
        }

        const data = await res.json();
        setCsvResult({
          accepted: data.fills_new ?? 0,
          duplicate: data.fills_duplicate ?? 0,
          rejected: data.fills_rejected ?? 0,
        });
        setMode('csv');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploading(false);
    }
  }, []);

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
        Import your trading data — Performance PDF or Position History CSV
      </p>

      {/* Format toggle */}
      <div className="mt-4 flex gap-2">
        <button
          onClick={() => setMode('pdf')}
          className={`flex items-center gap-1.5 rounded-full px-4 py-1.5 font-mono text-[10px] font-bold uppercase tracking-[0.1em] transition-colors ${
            mode === 'pdf'
              ? 'bg-white/[0.06] text-text-primary'
              : 'hover:bg-white/[0.04] transition-colors text-text-muted hover:text-text-secondary'
          }`}
        >
          <FileText size={12} />
          Performance PDF
        </button>
        <button
          onClick={() => setMode('csv')}
          className={`flex items-center gap-1.5 rounded-full px-4 py-1.5 font-mono text-[10px] font-bold uppercase tracking-[0.1em] transition-colors ${
            mode === 'csv'
              ? 'bg-white/[0.06] text-text-primary'
              : 'hover:bg-white/[0.04] transition-colors text-text-muted hover:text-text-secondary'
          }`}
        >
          <FileSpreadsheet size={12} />
          Position CSV
        </button>
      </div>

      {/* Upload zone — accepts both formats regardless of mode toggle */}
      <div
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
              {mode === 'pdf' ? 'Parsing performance report...' : 'Processing CSV...'}
            </p>
          </>
        ) : (
          <>
            {mode === 'pdf' ? (
              <FileText size={32} className="text-text-muted" strokeWidth={1} />
            ) : (
              <Upload size={32} className="text-text-muted" strokeWidth={1} />
            )}
            <p className="mt-3 font-mono text-sm text-text-secondary">
              {mode === 'pdf'
                ? 'Drop your Tradovate Performance PDF here'
                : 'Drop your Position History CSV here'}
            </p>
            <p className="mt-1 font-mono text-[12px] text-text-muted">
              or click to browse
            </p>
            <p className="mt-3 font-mono text-[12px] text-text-dim">
              {mode === 'pdf'
                ? 'Extracts trades, summary stats, and P&L data automatically'
                : 'Supports Tradovate Position History CSV exports'}
            </p>
            <input
              type="file"
              accept=".pdf,.csv"
              onChange={handleInputChange}
              className="absolute inset-0 cursor-pointer opacity-0"
              style={{ position: 'relative', width: 'auto', marginTop: 12 }}
            />
          </>
        )}
      </div>

      {/* PDF Result */}
      {pdfResult && (
        <GlowPanel className="mt-4 p-5 border border-positive/20 bg-positive/[0.04]">
          <div className="flex items-center gap-2 mb-3">
            <CheckCircle size={16} className="text-positive" />
            <span className="font-mono text-sm font-semibold text-positive">
              Performance Report Parsed — {pdfResult.trades_parsed} Trades
            </span>
          </div>

          {pdfResult.date_range && (
            <p className="font-mono text-[11px] text-text-muted mb-3">
              Date range: {pdfResult.date_range.start} → {pdfResult.date_range.end}
            </p>
          )}

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-3">
            <PdfStat label="Gross P/L" value={`$${pdfResult.summary.grossPnl.toFixed(2)}`} color={pdfResult.summary.grossPnl >= 0 ? '#FFFFFF' : '#8891A0'} />
            <PdfStat label="Net P/L" value={`$${pdfResult.summary.totalPnl.toFixed(2)}`} color={pdfResult.summary.totalPnl >= 0 ? '#FFFFFF' : '#8891A0'} />
            <PdfStat label="Win Rate" value={`${pdfResult.summary.winRate}%`} color={pdfResult.summary.winRate >= 50 ? '#FFFFFF' : '#8891A0'} />
            <PdfStat label="Expectancy" value={`$${pdfResult.summary.expectancy.toFixed(2)}`} color={pdfResult.summary.expectancy >= 0 ? '#FFFFFF' : '#8891A0'} />
            <PdfStat label="Trades" value={String(pdfResult.summary.tradeCount)} />
            <PdfStat label="Contracts" value={String(pdfResult.summary.contractCount)} />
            <PdfStat label="Max Run-up" value={`$${pdfResult.summary.maxRunUp.toFixed(2)}`} color="#FFFFFF" />
            <PdfStat label="Max Drawdown" value={`$${Math.abs(pdfResult.summary.maxDrawdown).toFixed(2)}`} color="#8891A0" />
          </div>

          {pdfResult.ingest && (
            <div className="border-t border-border-dim pt-3 mt-3">
              <p className="font-mono text-[10px] uppercase tracking-wider text-text-muted mb-2">Pipeline Result</p>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <div className="font-mono text-[12px] uppercase tracking-[0.15em] text-text-muted">Accepted</div>
                  <div className="font-display text-xl font-bold text-positive">{pdfResult.ingest.fills_new ?? 0}</div>
                </div>
                <div>
                  <div className="font-mono text-[12px] uppercase tracking-[0.15em] text-text-muted">Duplicate</div>
                  <div className="font-display text-xl font-bold text-text-secondary">{pdfResult.ingest.fills_duplicate ?? 0}</div>
                </div>
                <div>
                  <div className="font-mono text-[12px] uppercase tracking-[0.15em] text-text-muted">Rejected</div>
                  <div className="font-display text-xl font-bold text-negative">{pdfResult.ingest.fills_rejected ?? 0}</div>
                </div>
              </div>
            </div>
          )}
        </GlowPanel>
      )}

      {/* CSV Result */}
      {csvResult && (
        <GlowPanel className="mt-4 p-4 border border-positive/20 bg-positive/[0.04]">
          <div className="flex items-center gap-2">
            <CheckCircle size={16} className="text-positive" />
            <span className="font-mono text-sm font-semibold text-positive">Upload Complete</span>
          </div>
          <div className="mt-2 grid grid-cols-3 gap-4">
            <div>
              <div className="font-mono text-[12px] uppercase tracking-[0.15em] text-text-muted">Accepted</div>
              <div className="font-display text-xl font-bold text-positive">{csvResult.accepted}</div>
            </div>
            <div>
              <div className="font-mono text-[12px] uppercase tracking-[0.15em] text-text-muted">Duplicate</div>
              <div className="font-display text-xl font-bold text-text-secondary">{csvResult.duplicate}</div>
            </div>
            <div>
              <div className="font-mono text-[12px] uppercase tracking-[0.15em] text-text-muted">Rejected</div>
              <div className="font-display text-xl font-bold text-negative">{csvResult.rejected}</div>
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

      {/* Recent uploads */}
      <div className="mt-8">
        <h3 className="font-mono text-[12px] font-semibold uppercase tracking-[0.2em] text-text-muted">
          Recent Uploads
        </h3>
        {recentRuns.length === 0 ? (
          <div className="mt-3 rounded-xl glass p-6 text-center">
            <Copy size={20} className="mx-auto text-text-dim" />
            <p className="mt-2 font-mono text-xs text-text-muted">No uploads yet</p>
          </div>
        ) : (
          <GlowPanel className="mt-3 overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border-dim glass-raised">
                  <th className="px-4 py-2 text-left font-mono text-[12px] font-semibold uppercase tracking-[0.15em] text-text-dim">File</th>
                  <th className="px-4 py-2 text-left font-mono text-[12px] font-semibold uppercase tracking-[0.15em] text-text-dim">Date</th>
                  <th className="px-4 py-2 text-right font-mono text-[12px] font-semibold uppercase tracking-[0.15em] text-text-dim">Accepted</th>
                  <th className="px-4 py-2 text-right font-mono text-[12px] font-semibold uppercase tracking-[0.15em] text-text-dim">Dup</th>
                  <th className="px-4 py-2 text-right font-mono text-[12px] font-semibold uppercase tracking-[0.15em] text-text-dim">Rejected</th>
                </tr>
              </thead>
              <tbody>
                {recentRuns.map((run) => (
                  <tr key={run.ingest_run_id} className="border-b border-border-dim hover:bg-raised">
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

function PdfStat({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="rounded-lg border border-border-dim px-3 py-2">
      <div className="font-mono text-[8px] uppercase tracking-wider text-text-muted">{label}</div>
      <div className="font-mono text-sm font-bold mt-0.5" style={{ color: color ?? '#E8EDF5' }}>{value}</div>
    </div>
  );
}
