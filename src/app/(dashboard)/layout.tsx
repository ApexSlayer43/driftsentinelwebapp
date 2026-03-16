'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Upload,
  Settings,
  LogOut,
  Shield,
  UserCircle,
  Clock,
  Crosshair,
  Bot,
  Radar,
  Menu as MenuIcon,
  X,
  type LucideIcon,
} from 'lucide-react';
import { Particles } from '@/components/ui/particles';
import { MenuContainer, MenuItem } from '@/components/ui/fluid-menu';
import LiveEye from '@/components/live-eye';
import { createClient } from '@/lib/supabase/client';
import type { BehavioralState } from '@/lib/tokens';
import { OnboardingProvider } from '@/lib/onboarding-context';
import OnboardingChecklist from '@/components/onboarding-checklist';
import OnboardingTooltip from '@/components/onboarding-tooltip';

const NAV_ITEMS: { title: string; icon: LucideIcon; href: string }[] = [
  { title: 'Dashboard', icon: LayoutDashboard, href: '/' },
  { title: 'Upload', icon: Upload, href: '/ingest' },
  { title: 'Historical', icon: Clock, href: '/violations' },
  { title: 'Sessions', icon: Radar, href: '/sessions' },
  { title: 'Forensics', icon: Crosshair, href: '/forensics' },
  { title: 'Signal Config', icon: Shield, href: '/protocol' },
  { title: 'DS Trader ID', icon: UserCircle, href: '/trader-id' },
  { title: 'Senti', icon: Bot, href: '/senti' },
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

  // Auto-configure extension: detect it, provision a device token, push config
  const autoConfigRan = useRef(false);
  useEffect(() => {
    if (autoConfigRan.current) return;

    // Skip if user already auto-configured this session
    if (sessionStorage.getItem('ds_auto_configured')) return;

    let cancelled = false;

    function handlePong(event: MessageEvent) {
      if (event.source !== window) return;
      if (!event.data || event.data.target !== 'drift-sentinel-webapp') return;
      if (event.data.type !== 'DS_PONG' && event.data.type !== 'DS_EXTENSION_READY') return;
      if (cancelled || autoConfigRan.current) return;

      autoConfigRan.current = true;
      window.removeEventListener('message', handlePong);
      pushConfigToExtension();
    }

    async function pushConfigToExtension() {
      try {
        const res = await fetch('/api/device/provision', { method: 'POST' });
        if (!res.ok) return;
        const data = await res.json();
        if (!data.ok || !data.device_token) return;

        window.postMessage({
          target: 'drift-sentinel-companion',
          type: 'DS_SET_CONFIG',
          config: {
            deviceToken: data.device_token,
            apiBaseUrl: data.api_base_url,
          },
        }, '*');

        sessionStorage.setItem('ds_auto_configured', '1');
      } catch {
        // Silent fail — extension config is best-effort
      }
    }

    window.addEventListener('message', handlePong);

    // Ping the extension to check if it's installed
    window.postMessage({ target: 'drift-sentinel-companion', type: 'DS_PING' }, '*');

    return () => {
      cancelled = true;
      window.removeEventListener('message', handlePong);
    };
  }, []);

  // Navigate and auto-close menu helper
  function navTo(href: string) {
    router.push(href);
  }

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  }

  return (
    <OnboardingProvider>
      <div className="relative h-screen overflow-hidden">
        <Particles
          className="absolute inset-0 z-0"
          quantity={120}
          ease={80}
          color="#ffffff"
          size={0.4}
          staticity={50}
        />
        {/* Fluid nav — fixed top-right */}
        <div className="fixed top-5 right-5 z-50">
          <MenuContainer>
            {/* Toggle button — hamburger / X */}
            <MenuItem
              icon={
                <div className="relative w-5 h-5">
                  <div className="absolute inset-0 transition-all duration-300 ease-in-out origin-center opacity-100 scale-100 rotate-0 [div[data-expanded=true]_&]:opacity-0 [div[data-expanded=true]_&]:scale-0 [div[data-expanded=true]_&]:rotate-180">
                    <MenuIcon size={20} strokeWidth={1.5} />
                  </div>
                  <div className="absolute inset-0 transition-all duration-300 ease-in-out origin-center opacity-0 scale-0 -rotate-180 [div[data-expanded=true]_&]:opacity-100 [div[data-expanded=true]_&]:scale-100 [div[data-expanded=true]_&]:rotate-0">
                    <X size={20} strokeWidth={1.5} />
                  </div>
                </div>
              }
            />
            {/* Nav items */}
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href));
              return (
                <MenuItem
                  key={item.href}
                  icon={<Icon size={20} strokeWidth={1.5} />}
                  onClick={() => navTo(item.href)}
                  isActive={isActive}
                  title={item.title}
                />
              );
            })}
            {/* Sign out */}
            <MenuItem
              icon={<LogOut size={20} strokeWidth={1.5} />}
              onClick={handleSignOut}
              title="Sign out"
            />
          </MenuContainer>
        </div>

        {/* Main content area — full width now */}
        <div className="flex flex-col h-full overflow-hidden relative z-10">
          {/* Top brand bar with live eye */}
          <div className="flex items-center justify-center py-2">
            <LiveEye size={40} />
          </div>

          <main className="flex-1 overflow-auto">
            {children}
          </main>
        </div>

        {/* Onboarding system */}
        <OnboardingChecklist />
        <OnboardingTooltip />
      </div>
    </OnboardingProvider>
  );
}
