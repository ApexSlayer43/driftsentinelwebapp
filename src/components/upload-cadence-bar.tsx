'use client';

import type { UploadEvent } from '@/lib/types';
import { getCadenceStyle } from '@/lib/tokens';

interface UploadCadenceBarProps {
  uploads: UploadEvent[];
}

export function UploadCadenceBar({ uploads }: UploadCadenceBarProps) {
  if (uploads.length === 0) {
    return (
      <div className="rounded-xl bg-[rgba(13,15,21,0.85)] backdrop-blur-xl border border-white/[0.04] p-5 h-full flex flex-col">
        <h3 className="font-mono text-[8px] font-semibold uppercase tracking-[0.2em] text-text-muted mb-3">
          Upload Cadence
        </h3>
        <div className="flex-1 flex items-center justify-center">
          <p className="font-mono text-[10px] text-text-muted text-center">
            No uploads recorded yet.
          </p>
        </div>
      </div>
    );
  }

  // Show newest at top
  const ordered = [...uploads];
  const maxGap = Math.max(...ordered.map((u) => u.gap_hours ?? 0), 1);

  return (
    <div className="rounded-xl bg-[rgba(13,15,21,0.85)] backdrop-blur-xl border border-white/[0.04] p-5 h-full flex flex-col">
      <h3 className="font-mono text-[8px] font-semibold uppercase tracking-[0.2em] text-text-muted mb-3">
        Upload Cadence
      </h3>

      <div className="flex-1 flex flex-col gap-1.5 overflow-y-auto">
        {ordered.map((upload) => {
          const style = getCadenceStyle(upload.cadence_status);
          const widthPercent = upload.gap_hours !== null
            ? Math.max(8, Math.min(100, (upload.gap_hours / maxGap) * 100))
            : 100;

          const dateLabel = upload.uploaded_at
            ? new Date(upload.uploaded_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
            : '—';

          return (
            <div key={upload.upload_event_id} className="group relative">
              <div className="flex items-center gap-2">
                {/* Date label */}
                <span className="font-mono text-[7px] text-text-muted w-12 text-right shrink-0">
                  {dateLabel}
                </span>

                {/* Bar */}
                <div className="flex-1 h-3 rounded-full overflow-hidden" style={{ backgroundColor: 'rgba(255,255,255,0.03)' }}>
                  <div
                    className="h-full rounded-full transition-all duration-300"
                    style={{
                      width: `${widthPercent}%`,
                      backgroundColor: style.color,
                      opacity: 0.7,
                    }}
                  />
                </div>

                {/* Gap label */}
                <span className="font-mono text-[7px] w-14 shrink-0" style={{ color: style.color }}>
                  {upload.gap_hours !== null ? `${upload.gap_hours}h` : '—'}
                </span>
              </div>

              {/* Hover detail */}
              <div className="hidden group-hover:block absolute left-14 bottom-full mb-1 z-50 rounded-lg bg-[rgba(13,15,21,0.85)] backdrop-blur-xl border border-white/[0.04] px-3 py-1.5 whitespace-nowrap pointer-events-none">
                <p className="font-mono text-[8px] text-text-primary">
                  {style.label} — {upload.trade_count} trades, {upload.session_count} sessions
                </p>
                <p className="font-mono text-[7px] text-text-muted">
                  Platform: {upload.detected_platform}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Summary */}
      <div className="mt-3 pt-2 border-t border-border-dim">
        <p className="font-mono text-[7px] text-text-muted uppercase tracking-wider">
          {uploads.length} uploads tracked
        </p>
      </div>
    </div>
  );
}
