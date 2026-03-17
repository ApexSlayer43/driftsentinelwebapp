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
  Search,
  Rocket,
} from 'lucide-react';
import { getTierStyle } from '@/lib/tokens';
import { useOnboarding, ONBOARDING_STEPS } from '@/lib/onboarding-context';

const NAV_ITEMS = [
  { label: 'Dashboard', href: '/', icon: LayoutDashboard },
  { label: 'Historical', href: '/violations', icon: AlertTriangle },
  { label: 'Forensics', href: '/forensics', icon: Search },
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
  const tierStyle = getTierStyle(bssTier ?? 'DORMANT');
  const { isActive: onboardingActive, completedSteps, startOnboarding, progress } = useOnboarding();
  const allDone = completedSteps.size >= ONBOARDING_STEPS.length;
  const showOnboardingToggle = !onboardingActive && !allDone;

  return (
    <aside
      className={`flex h-screen w-[210px] shrink-0 flex-col border-r border-white/[0.08] bg-white/[0.04] backdrop-blur-xl ${className}`}
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
              Behavioral Intelligence
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
                  ? 'border-l-2 border-accent-primary bg-accent-primary/[0.06] text-text-primary'
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
                  ? 'border-l-2 border-accent-primary bg-accent-primary/[0.06] text-text-primary'
                  : 'border-l-2 border-transparent text-text-secondary hover:bg-raised hover:text-text-primary'
              }`}
            >
              <Icon size={15} strokeWidth={1.5} />
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* Resume onboarding */}
      {showOnboardingToggle && (
        <div className="px-3 pb-2">
          <button
            onClick={startOnboarding}
            className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 font-mono text-[11px] text-text-muted hover:bg-positive/[0.06] hover:text-positive transition-colors"
          >
            <Rocket size={14} />
            <span>Resume Setup</span>
            <span className="ml-auto font-mono text-[9px] text-text-dim">{progress}%</span>
          </button>
        </div>
      )}

      {/* Bottom: Mini BSS */}
      <div className="border-t border-white/[0.08] px-5 py-4">
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
