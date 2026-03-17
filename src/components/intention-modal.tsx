'use client';

import { useState, useEffect, useCallback } from 'react';
import { X } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

/**
 * Pre-session Intention Modal
 *
 * Appears on the dashboard when no session_intentions record exists for today.
 * Not mandatory — dismissible. But if dismissed, cooldown mode falls back
 * to question_bank rather than goal_reflection.
 *
 * Senti voice: "Before you start — what's the one thing
 * that matters most in today's session?"
 */
export function IntentionModal() {
  const [visible, setVisible] = useState(false);
  const [goal, setGoal] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    // Check if today's intention already exists
    async function check() {
      // Skip if already dismissed today
      const dismissed = sessionStorage.getItem('ds_intention_dismissed');
      if (dismissed === new Date().toISOString().slice(0, 10)) return;

      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const { data: accounts } = await supabase
        .from('accounts')
        .select('account_ref')
        .eq('user_id', user.id)
        .limit(1);

      if (!accounts || accounts.length === 0) return;

      const today = new Date().toISOString().slice(0, 10);
      const { data: existing } = await supabase
        .from('session_intentions')
        .select('intention_id')
        .eq('account_ref', accounts[0].account_ref)
        .eq('session_date', today)
        .limit(1);

      // Show modal if no intention exists for today
      if (!existing || existing.length === 0) {
        setVisible(true);
      }
    }

    // Delay slightly so dashboard loads first
    const timer = setTimeout(check, 1500);
    return () => clearTimeout(timer);
  }, []);

  const handleSubmit = useCallback(async () => {
    if (!goal.trim() || submitting) return;
    setSubmitting(true);

    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    const { data: accounts } = await supabase
      .from('accounts')
      .select('account_ref')
      .eq('user_id', user.id)
      .limit(1);

    if (!accounts || accounts.length === 0) return;

    await supabase.from('session_intentions').insert({
      user_id: user.id,
      account_ref: accounts[0].account_ref,
      session_date: new Date().toISOString().slice(0, 10),
      goal_text: goal.trim(),
    });

    setVisible(false);
  }, [goal, submitting]);

  const handleDismiss = useCallback(() => {
    sessionStorage.setItem(
      'ds_intention_dismissed',
      new Date().toISOString().slice(0, 10),
    );
    setVisible(false);
  }, []);

  if (!visible) return null;

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={handleDismiss}
      />

      {/* Modal */}
      <div className="relative z-10 w-full max-w-md mx-4 rounded-2xl bg-white/[0.06] backdrop-blur-2xl border border-white/[0.1] p-8 shadow-2xl animate-in fade-in slide-in-from-bottom-4 duration-300">
        {/* Close */}
        <button
          onClick={handleDismiss}
          className="absolute top-4 right-4 rounded-full p-1 text-text-dim hover:text-text-muted transition-colors"
        >
          <X size={14} />
        </button>

        {/* Senti voice */}
        <p className="font-mono text-[13px] text-text-secondary leading-relaxed">
          Before you start — what&apos;s the one thing that matters most in today&apos;s session?
        </p>

        {/* Input */}
        <input
          type="text"
          value={goal}
          onChange={(e) => setGoal(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
          placeholder="e.g., Only A+ setups. Max 3 trades."
          className="mt-5 w-full rounded-xl border border-white/[0.1] bg-white/[0.04] backdrop-blur-xl px-4 py-3 font-mono text-sm text-text-primary outline-none focus:border-positive/40 placeholder:text-text-dim transition-colors"
          autoFocus
        />

        {/* Actions */}
        <div className="mt-5 flex items-center gap-3">
          <button
            onClick={handleSubmit}
            disabled={!goal.trim() || submitting}
            className="flex-1 rounded-xl bg-positive/10 border border-positive/20 px-4 py-2.5 font-mono text-[12px] font-bold uppercase tracking-[0.1em] text-positive transition-all hover:bg-positive/20 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Set Intention
          </button>
          <button
            onClick={handleDismiss}
            className="rounded-xl px-4 py-2.5 font-mono text-[12px] text-text-dim hover:text-text-muted transition-colors"
          >
            Skip for today
          </button>
        </div>
      </div>
    </div>
  );
}
