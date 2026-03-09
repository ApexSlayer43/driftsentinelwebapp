'use client';

import { useState, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  AlertTriangle,
  BarChart3,
  Upload,
  Settings,
  type LucideIcon,
} from 'lucide-react';
import { Particles } from '@/components/ui/particles';
import { GlassFilter } from '@/components/ui/liquid-glass-button';
import { cn } from '@/lib/utils';
import { SentinelChat } from '@/components/sentinel-chat';
import type { BehavioralState } from '@/lib/tokens';

const NAV_ITEMS: { title: string; icon: LucideIcon; href: string }[] = [
  { title: 'Dashboard', icon: LayoutDashboard, href: '/' },
  { title: 'Violations', icon: AlertTriangle, href: '/violations' },
  { title: 'History', icon: BarChart3, href: '/history' },
  { title: 'Ingest', icon: Upload, href: '/ingest' },
  { title: 'Settings', icon: Settings, href: '/settings' },
];

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [currentState, setCurrentState] = useState<BehavioralState>('BUILDING');
  const [bssScore, setBssScore] = useState<number | undefined>(undefined);
  const [bssTier, setBssTier] = useState<string | undefined>(undefined);

  // Listen for state updates from child pages
  useEffect(() => {
    function handleStateUpdate(e: CustomEvent) {
      if (e.detail.state) setCurrentState(e.detail.state as BehavioralState);
      if (e.detail.bssScore !== undefined) setBssScore(e.detail.bssScore);
      if (e.detail.bssTier) setBssTier(e.detail.bssTier);
    }

    window.addEventListener('drift-state-update', handleStateUpdate as EventListener);
    return () => window.removeEventListener('drift-state-update', handleStateUpdate as EventListener);
  }, []);

  return (
    <div className="flex h-screen overflow-hidden relative">
      <Particles
        className="absolute inset-0 z-0"
        quantity={120}
        ease={80}
        color="#ffffff"
        size={0.4}
        staticity={50}
      />
      <GlassFilter />

      {/* Vertical sidebar nav */}
      <nav className="relative z-10 flex w-16 shrink-0 flex-col items-center gap-1 self-start mt-6 ml-4 rounded-2xl py-3 liquid-glass">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href));
          return (
            <button
              key={item.href}
              onClick={() => router.push(item.href)}
              title={item.title}
              className={cn(
                'group relative flex h-10 w-10 items-center justify-center rounded-xl transition-all duration-200',
                isActive
                  ? 'text-stable liquid-glass-tab-active'
                  : 'text-text-muted hover:text-text-secondary liquid-glass-tab'
              )}
            >
              <Icon size={18} />
            </button>
          );
        })}
      </nav>

      {/* Main content area */}
      <div className="flex flex-1 flex-col overflow-hidden relative z-10">
        {/* Top brand bar */}
        <div className="flex items-center justify-center py-4">
          <span className="font-display text-sm font-bold tracking-[0.08em]">
            <span className="text-text-primary">DRIFT</span>
            <span className="text-stable">SENTINEL</span>
          </span>
        </div>

        <main className="flex-1 overflow-auto">
          {children}
        </main>
      </div>

      <SentinelChat />
    </div>
  );
}
