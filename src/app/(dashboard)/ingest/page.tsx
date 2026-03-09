'use client';

import { useState, useEffect, useCallback } from 'react';
import { Upload, CheckCircle, XCircle, Copy } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import type { IngestRun } from '@/lib/types';

export default function IngestPage() {
  const [dragOver, setDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<{ accepted: number; duplicate: number; rejected: number } | null>(null);
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
  }, [result]);

  const handleFile = useCallback(async (file: File) => {
    if (!file.name.endsWith('.csv')) {
      setError('Only CSV files are supported');
      return;
    }

    setUploading(true);
    setError(null);
    setResult(null);

    try {
      const csvText = await file.text();
      const apiUrl = process.env.NEXT_PUBLIC_API_URL;

      if (!apiUrl) {
        setError('API URL not configured');
        setUploading(false);
        return;
      }

      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setError('Not authenticated');
        setUploading(false);
        return;
      }

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setError('Session expired. Please log in again.');
        setUploading(false);
        return;
      }

      const res = await fetch(`${apiUrl}/v1/ingest/fills/csv`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ csv_text: csvText, source_file: file.name }),
      });

      if (!res.ok) throw new Error(`Upload failed: ${res.status}`);

      const data = await res.json();
      setResult({
        accepted: data.fills_new ?? 0,
        duplicate: data.fills_duplicate ?? 0,
        rejected: data.fills_rejected ?? 0,
      });
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
        Ingest
      </h1>
      <p className="mt-1 font-mono text-xs text-text-muted">
        Upload your trade history CSV
      </p>

      {/* Upload zone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        className={`mt-6 flex flex-col items-center justify-center rounded-xl border-2 border-dashed p-12 transition-colors ${
          dragOver
            ? 'border-stable bg-stable/[0.04]'
            : 'border-border-subtle glass hover:border-border-active'
        }`}
      >
        {uploading ? (
          <>
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-stable border-t-transparent" />
            <p className="mt-3 font-mono text-sm text-text-secondary">Processing...</p>
          </>
        ) : (
          <>
            <Upload size={32} className="text-text-muted" strokeWidth={1} />
            <p className="mt-3 font-mono text-sm text-text-secondary">
              Upload your trade history CSV
            </p>
            <p className="mt-1 font-mono text-[10px] text-text-muted">
              or click to browse
            </p>
            <p className="mt-3 font-mono text-[9px] text-text-dim">
              Currently supports Tradovate CSV exports
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

      {/* Result */}
      {result && (
        <div className="mt-4 rounded-xl border border-stable/20 bg-stable/[0.04] p-4">
          <div className="flex items-center gap-2">
            <CheckCircle size={16} className="text-stable" />
            <span className="font-mono text-sm font-semibold text-stable">Upload Complete</span>
          </div>
          <div className="mt-2 grid grid-cols-3 gap-4">
            <div>
              <div className="font-mono text-[8px] uppercase tracking-[0.15em] text-text-muted">Accepted</div>
              <div className="font-display text-xl font-bold text-stable">{result.accepted}</div>
            </div>
            <div>
              <div className="font-mono text-[8px] uppercase tracking-[0.15em] text-text-muted">Duplicate</div>
              <div className="font-display text-xl font-bold text-text-secondary">{result.duplicate}</div>
            </div>
            <div>
              <div className="font-mono text-[8px] uppercase tracking-[0.15em] text-text-muted">Rejected</div>
              <div className="font-display text-xl font-bold text-breakdown">{result.rejected}</div>
            </div>
          </div>
        </div>
      )}

      {error && (
        <div className="mt-4 flex items-center gap-2 rounded-xl border border-breakdown/20 bg-breakdown/[0.04] p-4">
          <XCircle size={16} className="text-breakdown" />
          <span className="font-mono text-sm text-breakdown">{error}</span>
        </div>
      )}

      {/* Recent uploads */}
      <div className="mt-8">
        <h3 className="font-mono text-[8px] font-semibold uppercase tracking-[0.2em] text-text-muted">
          Recent Uploads
        </h3>
        {recentRuns.length === 0 ? (
          <div className="mt-3 rounded-xl glass p-6 text-center">
            <Copy size={20} className="mx-auto text-text-dim" />
            <p className="mt-2 font-mono text-xs text-text-muted">No uploads yet</p>
          </div>
        ) : (
          <div className="mt-3 overflow-hidden rounded-xl glass">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border-dim glass-raised">
                  <th className="px-4 py-2 text-left font-mono text-[7px] font-semibold uppercase tracking-[0.15em] text-text-dim">File</th>
                  <th className="px-4 py-2 text-left font-mono text-[7px] font-semibold uppercase tracking-[0.15em] text-text-dim">Date</th>
                  <th className="px-4 py-2 text-right font-mono text-[7px] font-semibold uppercase tracking-[0.15em] text-text-dim">Accepted</th>
                  <th className="px-4 py-2 text-right font-mono text-[7px] font-semibold uppercase tracking-[0.15em] text-text-dim">Dup</th>
                  <th className="px-4 py-2 text-right font-mono text-[7px] font-semibold uppercase tracking-[0.15em] text-text-dim">Rejected</th>
                </tr>
              </thead>
              <tbody>
                {recentRuns.map((run) => (
                  <tr key={run.ingest_run_id} className="border-b border-border-dim hover:bg-raised">
                    <td className="px-4 py-2.5 font-mono text-[10px] text-text-secondary">{run.file_name}</td>
                    <td className="px-4 py-2.5 font-mono text-[10px] text-text-muted">
                      {new Date(run.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </td>
                    <td className="px-4 py-2.5 text-right font-mono text-[10px] text-stable">{run.accepted_count}</td>
                    <td className="px-4 py-2.5 text-right font-mono text-[10px] text-text-muted">{run.dup_count}</td>
                    <td className="px-4 py-2.5 text-right font-mono text-[10px] text-breakdown">{run.reject_count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
