'use client';

import { useEffect } from 'react';
import { Pause } from 'lucide-react';
import { useCooldown } from '@/lib/cooldown-context';

/**
 * Cooldown Trigger — nav button that activates cooldown mode.
 *
 * Lives in the sidebar/nav. Always accessible.
 * Also registers ⌘+Shift+K keyboard shortcut.
 */
export function CooldownTrigger() {
  const { activate, loading, isActive } = useCooldown();

  // Keyboard shortcut: ⌘+Shift+K (Mac) or Ctrl+Shift+K (Windows)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === 'K') {
        e.preventDefault();
        if (!isActive && !loading) activate();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [activate, isActive, loading]);

  return (
    <button
      onClick={activate}
      disabled={loading || isActive}
      className="group flex items-center gap-2.5 rounded-xl px-3 py-2 font-mono text-[11px] font-medium uppercase tracking-[0.12em] text-text-muted transition-all hover:bg-white/[0.04] hover:text-positive disabled:opacity-40 disabled:cursor-not-allowed"
      title="Cooldown Mode (⌘⇧K)"
    >
      <Pause
        size={14}
        className="transition-colors group-hover:text-positive"
      />
      <span className="hidden lg:inline">Reset</span>
    </button>
  );
}
