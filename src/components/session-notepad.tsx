'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';

/**
 * Session Notepad — freeform scratchpad for the trader.
 *
 * Persisted per-day in session_intentions table as `notes` field,
 * or stored in localStorage if DB write fails. Auto-saves on blur
 * and after 2 seconds of inactivity.
 *
 * This is the trader's internal monologue — stream of consciousness
 * during a session. Not structured, not scored, just theirs.
 */
export function SessionNotepad() {
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const accountRefRef = useRef<string | null>(null);

  // Load today's notes on mount
  useEffect(() => {
    async function load() {
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
      accountRefRef.current = accounts[0].account_ref;

      const today = new Date().toISOString().slice(0, 10);

      // Try DB first
      const { data: existing } = await supabase
        .from('session_intentions')
        .select('notes')
        .eq('account_ref', accounts[0].account_ref)
        .eq('session_date', today)
        .limit(1);

      if (existing && existing.length > 0 && existing[0].notes) {
        setNotes(existing[0].notes);
      } else {
        // Fallback to localStorage
        const local = localStorage.getItem(`ds_notes_${today}`);
        if (local) setNotes(local);
      }
    }

    load();
  }, []);

  const saveNotes = useCallback(async (text: string) => {
    if (saving) return;
    setSaving(true);

    const today = new Date().toISOString().slice(0, 10);

    // Always save to localStorage as backup
    localStorage.setItem(`ds_notes_${today}`, text);

    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user && accountRefRef.current) {
        // Upsert — update notes on existing intention row, or create one
        const { data: existing } = await supabase
          .from('session_intentions')
          .select('intention_id')
          .eq('account_ref', accountRefRef.current)
          .eq('session_date', today)
          .limit(1);

        if (existing && existing.length > 0) {
          await supabase
            .from('session_intentions')
            .update({ notes: text })
            .eq('intention_id', existing[0].intention_id);
        } else {
          await supabase.from('session_intentions').insert({
            user_id: user.id,
            account_ref: accountRefRef.current,
            session_date: today,
            goal_text: '',
            notes: text,
          });
        }
      }

      setLastSaved(new Date());
    } catch {
      // Silent fail — localStorage has the backup
    } finally {
      setSaving(false);
    }
  }, [saving]);

  // Auto-save after 2s of inactivity
  const handleChange = useCallback(
    (text: string) => {
      setNotes(text);

      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      saveTimerRef.current = setTimeout(() => saveNotes(text), 2000);
    },
    [saveNotes]
  );

  // Save on blur
  const handleBlur = useCallback(() => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveNotes(notes);
  }, [notes, saveNotes]);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <span className="font-mono text-[11px] font-bold uppercase tracking-[0.12em] text-text-muted">
          Session Notes
        </span>
        {lastSaved && (
          <span className="font-mono text-[9px] text-text-dim">
            saved
          </span>
        )}
      </div>

      {/* Textarea */}
      <textarea
        value={notes}
        onChange={(e) => handleChange(e.target.value)}
        onBlur={handleBlur}
        placeholder="What are you noticing today..."
        className="flex-1 w-full resize-none rounded-xl bg-white/[0.03] border border-white/[0.06] backdrop-blur-md p-3 font-mono text-[12px] leading-relaxed text-text-secondary placeholder:text-text-dim outline-none focus:border-white/[0.12] transition-colors"
        spellCheck={false}
      />
    </div>
  );
}
