'use client';

import { useState, useEffect } from 'react';
import { resolveTier, TIER_STYLES } from '@/lib/tokens';

const ADMIN_USER_ID = '4c8b3b98-7a0e-4862-a67c-bcce026468d6';

interface AccountRow {
  account_ref: string;
  email: string;
  joined: string;
  last_sign_in: string | null;
  status: 'empty' | 'uploaded' | 'active';
  fills_count: number;
  sessions_count: number;
  violations_count: number;
  days_scored: number;
  bss_score: number | null;
  timezone: string | null;
  has_sessions: boolean;
  has_goal: boolean;
  max_contracts: number | null;
  last_upload: string | null;
  uploads_count: number;
}

interface AdminSummary {
  total_accounts: number;
  active: number;
  uploaded: number;
  empty: number;
  total_fills: number;
  total_auth_users: number;
}

interface AdminData {
  ok: boolean;
  summary: AdminSummary;
  roster: AccountRow[];
  error?: string;
}

const STATUS_BADGE: Record<string, { label: string; bg: string; text: string }> = {
  active: {
    label: 'Active',
    bg: 'rgba(34,211,238,0.12)',
    text: '#22D3EE',
  },
  uploaded: {
    label: 'Uploaded',
    bg: 'rgba(245,158,11,0.12)',
    text: '#F59E0B',
  },
  empty: {
    label: 'Empty',
    bg: 'rgba(251,146,60,0.10)',
    text: '#FB923C',
  },
};

export default function AdminPage() {
  const [data, setData] = useState<AdminData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [authorized, setAuthorized] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch('/api/admin/overview');
        if (res.status === 403) {
          setAuthorized(false);
          setLoading(false);
          return;
        }
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          setError(body.error || `Request failed: ${res.status}`);
          setLoading(false);
          return;
        }
        const json: AdminData = await res.json();
        setData(json);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  if (!authorized) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-[#94A3B8] font-['DM_Sans']">Not authorized.</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-[#94A3B8] font-['DM_Sans'] animate-pulse">Loading admin data...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-[#FB923C] font-['DM_Sans']">{error}</p>
      </div>
    );
  }

  if (!data) return null;

  const { summary, roster } = data;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-8">
      {/* Header */}
      <div>
        <h1
          className="text-3xl font-light tracking-wide"
          style={{ fontFamily: 'Cormorant Garamond, serif', color: '#c8a96e' }}
        >
          Admin — Beta Overview
        </h1>
        <p className="text-sm text-[#94A3B8] font-['DM_Sans'] mt-1">
          Real-time status of all beta accounts
        </p>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <StatCard label="Total Accounts" value={summary.total_accounts} />
        <StatCard label="Active" value={summary.active} color="#22D3EE" />
        <StatCard label="Uploaded Only" value={summary.uploaded} color="#F59E0B" />
        <StatCard label="Empty" value={summary.empty} color="#FB923C" />
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        <StatCard label="Auth Users" value={summary.total_auth_users} />
        <StatCard label="Total Fills" value={summary.total_fills.toLocaleString()} />
        <StatCard
          label="Pipeline Rate"
          value={
            summary.total_accounts > 0
              ? `${Math.round((summary.active / summary.total_accounts) * 100)}%`
              : '—'
          }
          color="#22D3EE"
        />
      </div>

      {/* Account Roster Table */}
      <div
        className="rounded-xl border overflow-hidden"
        style={{
          background: 'rgba(200,169,110,0.03)',
          borderColor: 'rgba(200,169,110,0.08)',
          backdropFilter: 'blur(16px)',
        }}
      >
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr
                className="text-left border-b"
                style={{ borderColor: 'rgba(200,169,110,0.10)' }}
              >
                <TH>Email</TH>
                <TH>Status</TH>
                <TH>Joined</TH>
                <TH>Last Login</TH>
                <TH>Fills</TH>
                <TH>Sessions</TH>
                <TH>Violations</TH>
                <TH>BSS</TH>
                <TH>Tier</TH>
                <TH>TZ</TH>
                <TH>Config</TH>
                <TH>Uploads</TH>
              </tr>
            </thead>
            <tbody>
              {roster.map((acct) => {
                const tier = acct.bss_score !== null ? resolveTier(acct.bss_score) : null;
                const tierStyle = tier ? TIER_STYLES[tier] : null;
                const badge = STATUS_BADGE[acct.status];
                const configFlags = [
                  acct.timezone ? '✓ TZ' : '✗ TZ',
                  acct.has_sessions ? '✓ Sess' : '✗ Sess',
                  acct.has_goal ? '✓ Goal' : '✗ Goal',
                ].join(' · ');

                return (
                  <tr
                    key={acct.account_ref}
                    className="border-b hover:bg-white/[0.02] transition-colors"
                    style={{ borderColor: 'rgba(200,169,110,0.05)' }}
                  >
                    <TD mono={false}>
                      <span className="text-[#E2E8F0]">{acct.email}</span>
                    </TD>
                    <TD mono={false}>
                      <span
                        className="px-2 py-0.5 rounded-full text-xs font-medium"
                        style={{ background: badge.bg, color: badge.text }}
                      >
                        {badge.label}
                      </span>
                    </TD>
                    <TD>{acct.joined}</TD>
                    <TD>{acct.last_sign_in ?? '—'}</TD>
                    <TD>{acct.fills_count}</TD>
                    <TD>{acct.sessions_count}</TD>
                    <TD>{acct.violations_count}</TD>
                    <TD>
                      <span style={{ color: tierStyle?.color ?? '#6B7280' }}>
                        {acct.bss_score ?? '—'}
                      </span>
                    </TD>
                    <TD mono={false}>
                      {tier ? (
                        <span
                          className="text-xs font-medium"
                          style={{ color: tierStyle?.color }}
                        >
                          {tier}
                        </span>
                      ) : (
                        <span className="text-[#6B7280]">—</span>
                      )}
                    </TD>
                    <TD mono={false}>
                      <span className="text-[#94A3B8] text-xs">
                        {acct.timezone?.replace('Europe/', 'EU/').replace('America/', 'US/') ?? '—'}
                      </span>
                    </TD>
                    <TD mono={false}>
                      <span className="text-[#94A3B8] text-xs">{configFlags}</span>
                    </TD>
                    <TD>{acct.uploads_count}</TD>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

/* ── Helper Components ── */

function StatCard({
  label,
  value,
  color,
}: {
  label: string;
  value: string | number;
  color?: string;
}) {
  return (
    <div
      className="rounded-xl border px-4 py-3"
      style={{
        background: 'rgba(200,169,110,0.03)',
        borderColor: 'rgba(200,169,110,0.08)',
      }}
    >
      <p className="text-xs text-[#94A3B8] font-['DM_Sans'] mb-1">{label}</p>
      <p
        className="text-2xl font-light"
        style={{
          fontFamily: 'JetBrains Mono, monospace',
          color: color ?? '#E2E8F0',
        }}
      >
        {value}
      </p>
    </div>
  );
}

function TH({ children }: { children: React.ReactNode }) {
  return (
    <th
      className="px-3 py-3 text-xs font-medium uppercase tracking-wider"
      style={{ color: '#c8a96e', fontFamily: 'DM Sans, sans-serif' }}
    >
      {children}
    </th>
  );
}

function TD({
  children,
  mono = true,
}: {
  children: React.ReactNode;
  mono?: boolean;
}) {
  return (
    <td
      className="px-3 py-2.5 whitespace-nowrap"
      style={{
        fontFamily: mono ? 'JetBrains Mono, monospace' : 'DM Sans, sans-serif',
        color: '#94A3B8',
        fontSize: '0.8125rem',
      }}
    >
      {children}
    </td>
  );
}
