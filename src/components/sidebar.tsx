'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import {
  LayoutDashboard,
  AlertTriangle,
  BarChart3,
  Upload,
  Settings,
  Shield,
} from 'lucide-react';
import { getTierStyle } from '@/lib/tokens';

const NAV_ITEMS = [
  { label: 'Dashboard', href: '/', icon: LayoutDashboard },
  { label: 'Violations', href: '/violations', icon: AlertTriangle },
  { label: 'History', href: '/history', icon: BarChart3 },
  { label: 'Ingest', href: '/ingest', icon: Upload },
];

const SYSTEM_ITEMS = [
  { label: 'Settings', href: '/settings', icon: Settings },
];

interface SidebarProps {
  bssScore?: number;
  bssTier?: string;
  className?: string;
}

export function Sidebar({ bssScore, bssTier, className = '' }: SidebarProps) {
  const pathname = usePathname();
  const tierStyle = getTierStyle(bssTier ?? 'DRAFT');

  return (
    <aside
      className={`flex h-screen w-[210px] shrink-0 flex-col border-r border-border-dim bg-surface ${className}`}
    >
      {/* Logo */}
      <div className="px-5 pt-5 pb-6">
        <div className="flex items-center gap-2.5">
          <Shield size={18} className="text-building" strokeWidth={1.5} />
          <div>
            <div className="font-display text-[10.5px] font-bold uppercase tracking-[0.12em] text-text-primary">
              Drift Sentinel
            </div>
            <div className="font-mono text-[7px] uppercase tracking-[0.15em] text-text-dim">
              Behavioral Monitor
            </div>
          </div>
        </div>
      </div>

      {/* Main nav */}
      <nav className="flex-1 px-3">
        <div className="mb-2 px-2 font-mono text-[7px] font-semibold uppercase tracking-[0.2em] text-text-dim">
          Main
        </div>
        {NAV_ITEMS.map((item) => {
          const isActive = pathname === item.href;
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`relative flex h-9 items-center gap-2.5 rounded-md px-2.5 font-mono text-[11.5px] transition-colors ${
                isActive
                  ? 'border-l-2 border-stable bg-stable/[0.06] text-text-primary'
                  : 'border-l-2 border-transparent text-text-secondary hover:bg-raised hover:text-text-primary'
              }`}
            >
              <Icon size={15} strokeWidth={1.5} />
              {item.label}
            </Link>
          );
        })}

        <div className="mb-2 mt-6 px-2 font-mono text-[7px] font-semibold uppercase tracking-[0.2em] text-text-dim">
          System
        </div>
        {SYSTEM_ITEMS.map((item) => {
          const isActive = pathname === item.href;
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`relative flex h-9 items-center gap-2.5 rounded-md px-2.5 font-mono text-[11.5px] transition-colors ${
                isActive
                  ? 'border-l-2 border-stable bg-stable/[0.06] text-text-primary'
                  : 'border-l-2 border-transparent text-text-secondary hover:bg-raised hover:text-text-primary'
              }`}
            >
              <Icon size={15} strokeWidth={1.5} />
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* Bottom: Mini BSS */}
      <div className="border-t border-border-dim px-5 py-4">
        <div className="flex items-center gap-3">
          <div
            className="flex h-9 w-9 items-center justify-center rounded-full border font-mono text-sm font-bold"
            style={{
              borderColor: tierStyle.color,
              color: tierStyle.color,
            }}
          >
            {bssScore ?? '\u2014'}
          </div>
          <div>
            <div className="font-mono text-[10px] font-semibold text-text-primary">
              BSS
            </div>
            <div
              className="font-mono text-[8px] font-bold uppercase tracking-[0.12em]"
              style={{ color: tierStyle.color }}
            >
              {bssTier ?? '\u2014'}
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
}
