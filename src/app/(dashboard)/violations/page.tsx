'use client';

import { useState, useEffect, useMemo } from 'react';
import { Search, ArrowUpDown, Zap } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { getModeLabel, getModeWeight } from '@/lib/tokens';
import { ViolationDetailPanel } from '@/components/violation-detail';
import type { FillCanonical, ViolationDetail } from '@/lib/types';

/**
 * Historical — Layer 3 (spec Section 2)
 *
 * Trade-level data table with sortable columns:
 * Time | Instrument | Side | Qty | Entry | Exit | P&L | BSS Impact | Violation Flags
 *
 * Master-detail: table on left, selected item's full detail on right.
 * This is the Bloomberg-density zone — filterable, sortable, professional.
 * Font: JetBrains Mono 13px with tabular-nums.
 */

type SortKey = 'timestamp_utc' | 'contract' | 'side' | 'qty' | 'price';
type SortDir = 'asc' | 'desc';

const PAGE_SIZE = 25;

export default function HistoricalPage() {
  const [fills, setFills] = useState<FillCanonical[]>([]);
  const [violations, setViolations] = useState<ViolationDetail[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortKey, setSortKey] = useState<SortKey>('timestamp_utc');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [page, setPage] = useState(0);
  const [filterSide, setFilterSide] = useState<string | null>(null);
  const [filterViolations, setFilterViolations] = useState(false);
  const [selectedViolation, setSelectedViolation] = useState<ViolationDetail | null>(null);

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }

      const { data: accounts } = await supabase
        .from('accounts')
        .select('account_ref')
        .eq('user_id', user.id)
        .limit(1);

      if (!accounts || accounts.length === 0) { setLoading(false); return; }
      const ref = accounts[0].account_ref;

      // Fetch fills and violations in parallel
      const [fillsRes, violationsRes] = await Promise.all([
        supabase
          .from('fills_canonical')
          .select('*')
          .eq('account_ref', ref)
          .order('timestamp_utc', { ascending: false })
          .limit(500),
        supabase
          .from('violations')
          .select('*')
          .eq('account_ref', ref)
          .order('created_at', { ascending: false })
          .limit(200),
      ]);

      if (fillsRes.data) setFills(fillsRes.data as FillCanonical[]);
      if (violationsRes.data) setViolations(violationsRes.data as ViolationDetail[]);
      setLoading(false);
    }

    load();
  }, []);

  // Build a map of event_id → violation(s) for flag lookup
  const violationMap = useMemo(() => {
    const map = new Map<string, ViolationDetail>();
    for (const v of violations) {
      for (const eid of v.evidence_event_ids) {
        map.set(eid, v);
      }
    }
    return map;
  }, [violations]);

  // Filtered fills
  const filtered = useMemo(() => {
    let result = [...fills];
    if (filterSide) result = result.filter(f => f.side === filterSide);
    if (filterViolations) result = result.filter(f => violationMap.has(f.event_id));
    return result;
  }, [fills, filterSide, filterViolations, violationMap]);

  // Sorted fills
  const sorted = useMemo(() => {
    const arr = [...filtered];
    arr.sort((a, b) => {
      let cmp = 0;
      switch (sortKey) {
        case 'timestamp_utc':
          cmp = new Date(a.timestamp_utc).getTime() - new Date(b.timestamp_utc).getTime();
          break;
        case 'contract':
          cmp = (a.contract ?? '').localeCompare(b.contract ?? '');
          break;
        case 'side':
          cmp = a.side.localeCompare(b.side);
          break;
        case 'qty':
          cmp = a.qty - b.qty;
          break;
        case 'price':
          cmp = a.price - b.price;
          break;
      }
      return sortDir === 'desc' ? -cmp : cmp;
    });
    return arr;
  }, [filtered, sortKey, sortDir]);

  // Paginated
  const totalPages = Math.ceil(sorted.length / PAGE_SIZE);
  const paginated = sorted.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDir('desc');
    }
    setPage(0);
  }

  function SortHeader({ label, sortKeyName, className = '' }: { label: string; sortKeyName: SortKey; className?: string }) {
    const isActive = sortKey === sortKeyName;
    return (
      <button
        onClick={() => toggleSort(sortKeyName)}
        className={`flex items-center gap-1 font-mono text-[10px] font-semibold uppercase tracking-[0.15em] transition-colors ${
          isActive ? 'text-accent-primary' : 'text-text-muted hover:text-text-secondary'
        } ${className}`}
      >
        {label}
        <ArrowUpDown size={10} className={isActive ? 'opacity-100' : 'opacity-30'} />
      </button>
    );
  }

  return (
    <div className="flex h-full overflow-hidden">
      {/* ═══ DATA TABLE (left) ═══ */}
      <div className={`flex flex-col overflow-hidden ${selectedViolation ? 'w-[60%]' : 'w-full'} transition-all`}>
        {/* Header */}
        <div className="px-5 pt-6 pb-4 border-b border-white/[0.08] flex items-end justify-between">
          <div>
            <h1 className="font-mono text-[13px] font-semibold uppercase tracking-[0.15em] text-text-secondary">
              Historical
            </h1>
            <p className="mt-1 font-mono text-[12px] text-text-muted">
              {fills.length} fills · {violations.length} patterns detected
            </p>
          </div>
          <div className="flex items-center gap-2">
            {/* Side filter */}
            <button
              onClick={() => setFilterSide(filterSide === 'BUY' ? null : 'BUY')}
              className={`rounded-lg px-2.5 py-1 font-mono text-[10px] font-semibold uppercase tracking-[0.1em] transition-colors ${
                filterSide === 'BUY' ? 'bg-positive/10 text-positive' : 'bg-white/[0.04] border border-white/[0.08] text-text-muted hover:text-text-secondary'
              }`}
            >
              Buy
            </button>
            <button
              onClick={() => setFilterSide(filterSide === 'SELL' ? null : 'SELL')}
              className={`rounded-lg px-2.5 py-1 font-mono text-[10px] font-semibold uppercase tracking-[0.1em] transition-colors ${
                filterSide === 'SELL' ? 'bg-negative/10 text-negative' : 'bg-white/[0.04] border border-white/[0.08] text-text-muted hover:text-text-secondary'
              }`}
            >
              Sell
            </button>
            <button
              onClick={() => { setFilterViolations(!filterViolations); setPage(0); }}
              className={`flex items-center gap-1 rounded-lg px-2.5 py-1 font-mono text-[10px] font-semibold uppercase tracking-[0.1em] transition-colors ${
                filterViolations ? 'bg-warning/10 text-warning' : 'bg-white/[0.04] border border-white/[0.08] text-text-muted hover:text-text-secondary'
              }`}
            >
              <Zap size={10} />
              Flagged
            </button>
          </div>
        </div>

        {/* Table */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex justify-center py-12">
              <div className="h-5 w-5 animate-pulse rounded-full bg-white/[0.06]" />
            </div>
          ) : fills.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20">
              <Search size={24} className="text-text-dim" />
              <p className="mt-3 font-mono text-[12px] text-text-muted">
                No trade data yet. Upload your Tradovate CSV to populate historical data.
              </p>
            </div>
          ) : (
            <table className="w-full">
              <thead className="sticky top-0 bg-white/[0.04] backdrop-blur-xl z-10 border-b border-white/[0.08]">
                <tr>
                  <th className="px-3 py-2.5 text-left"><SortHeader label="Time" sortKeyName="timestamp_utc" /></th>
                  <th className="px-3 py-2.5 text-left"><SortHeader label="Instrument" sortKeyName="contract" /></th>
                  <th className="px-3 py-2.5 text-left"><SortHeader label="Side" sortKeyName="side" /></th>
                  <th className="px-3 py-2.5 text-right"><SortHeader label="Qty" sortKeyName="qty" className="justify-end" /></th>
                  <th className="px-3 py-2.5 text-right"><SortHeader label="Price" sortKeyName="price" className="justify-end" /></th>
                  <th className="px-3 py-2.5 text-center">
                    <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.15em] text-text-muted">Flags</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {paginated.map((fill) => {
                  const violation = violationMap.get(fill.event_id);
                  const time = new Date(fill.timestamp_utc).toLocaleTimeString('en-US', {
                    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
                  });
                  const date = new Date(fill.timestamp_utc).toLocaleDateString('en-US', {
                    month: 'short', day: 'numeric',
                  });
                  const sideColor = fill.side === 'BUY' ? 'rgba(255,255,255,0.7)' : 'rgba(255,255,255,0.4)';
                  const isSelected = violation && selectedViolation?.violation_id === violation.violation_id;

                  return (
                    <tr
                      key={fill.event_id}
                      className={`border-b border-white/[0.08] transition-colors hover:bg-white/[0.04] ${
                        violation ? 'cursor-pointer' : ''
                      } ${isSelected ? 'bg-accent-muted/20' : ''}`}
                      onClick={() => violation && setSelectedViolation(violation)}
                    >
                      {/* Time */}
                      <td className="px-3 py-2">
                        <div className="font-mono text-[13px] text-text-primary" style={{ fontVariantNumeric: 'tabular-nums' }}>
                          {time}
                        </div>
                        <div className="font-mono text-[10px] text-text-dim">{date}</div>
                      </td>
                      {/* Instrument */}
                      <td className="px-3 py-2 font-mono text-[13px] text-text-secondary">
                        {fill.contract}
                      </td>
                      {/* Side */}
                      <td className="px-3 py-2">
                        <span
                          className="rounded px-1.5 py-0.5 font-mono text-[11px] font-bold"
                          style={{ color: sideColor, backgroundColor: `${sideColor}12` }}
                        >
                          {fill.side}
                        </span>
                      </td>
                      {/* Qty */}
                      <td className="px-3 py-2 text-right font-mono text-[13px] text-text-primary" style={{ fontVariantNumeric: 'tabular-nums' }}>
                        {fill.qty}
                      </td>
                      {/* Price */}
                      <td className="px-3 py-2 text-right font-mono text-[13px] text-text-secondary" style={{ fontVariantNumeric: 'tabular-nums' }}>
                        {fill.price.toFixed(2)}
                      </td>
                      {/* Violation Flags */}
                      <td className="px-3 py-2 text-center">
                        {violation ? (
                          <span className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 bg-warning/10 font-mono text-[10px] font-bold text-warning">
                            <Zap size={10} />
                            {getModeLabel(violation.mode).split(' ')[0]}
                          </span>
                        ) : fill.off_session ? (
                          <span className="rounded px-1.5 py-0.5 bg-warning/10 font-mono text-[10px] font-bold text-warning">
                            OFF
                          </span>
                        ) : null}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between border-t border-white/[0.08] px-5 py-3">
              <span className="font-mono text-[11px] text-text-muted">
                Page {page + 1} of {totalPages} · {sorted.length} fills
              </span>
              <div className="flex gap-2">
                <button
                  onClick={() => setPage(p => Math.max(0, p - 1))}
                  disabled={page === 0}
                  className="rounded-lg bg-white/[0.04] border border-white/[0.08] px-3 py-1 font-mono text-[11px] text-text-secondary disabled:opacity-30"
                >
                  Prev
                </button>
                <button
                  onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
                  disabled={page >= totalPages - 1}
                  className="rounded-lg bg-white/[0.04] border border-white/[0.08] px-3 py-1 font-mono text-[11px] text-text-secondary disabled:opacity-30"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ═══ DETAIL PANEL (right) — shows when a flagged fill is selected ═══ */}
      {selectedViolation && (
        <div className="w-[40%] border-l border-white/[0.08] overflow-y-auto p-6">
          <ViolationDetailPanel violation={selectedViolation} onBack={() => setSelectedViolation(null)} />
        </div>
      )}
    </div>
  );
}
