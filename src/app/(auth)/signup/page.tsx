'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Shield } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

export default function SignupPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      setLoading(false);
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters');
      setLoading(false);
      return;
    }

    const supabase = createClient();
    const { error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    if (authError) {
      setError(authError.message);
      setLoading(false);
      return;
    }

    setSuccess(true);
    setLoading(false);
  }

  if (success) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4">
        <div className="w-full max-w-sm text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl border border-stable/30 bg-stable/10">
            <Shield size={24} className="text-stable" strokeWidth={1.5} />
          </div>
          <h1 className="font-display text-xl font-bold text-text-primary">
            Check your email
          </h1>
          <p className="mt-3 font-mono text-xs leading-relaxed text-text-muted">
            We sent a confirmation link to{' '}
            <span className="text-text-secondary">{email}</span>.
            <br />
            Click the link to activate your account.
          </p>
          <a
            href="/login"
            className="mt-6 inline-block font-mono text-[10px] text-stable hover:underline"
          >
            Back to sign in
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm">
        {/* Header */}
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl border border-border-subtle bg-surface">
            <Shield size={24} className="text-stable" strokeWidth={1.5} />
          </div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-text-primary">
            DRIFT SENTINEL
          </h1>
          <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.2em] text-text-muted">
            Create Account
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1.5 block font-mono text-[9px] font-semibold uppercase tracking-[0.15em] text-text-muted">
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full rounded-lg border border-border-subtle bg-raised px-3 py-2.5 font-mono text-sm text-text-primary placeholder-text-dim outline-none transition-colors focus:border-stable"
              placeholder="trader@example.com"
            />
          </div>
          <div>
            <label className="mb-1.5 block font-mono text-[9px] font-semibold uppercase tracking-[0.15em] text-text-muted">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full rounded-lg border border-border-subtle bg-raised px-3 py-2.5 font-mono text-sm text-text-primary placeholder-text-dim outline-none transition-colors focus:border-stable"
              placeholder="Min 6 characters"
            />
          </div>
          <div>
            <label className="mb-1.5 block font-mono text-[9px] font-semibold uppercase tracking-[0.15em] text-text-muted">
              Confirm Password
            </label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              className="w-full rounded-lg border border-border-subtle bg-raised px-3 py-2.5 font-mono text-sm text-text-primary placeholder-text-dim outline-none transition-colors focus:border-stable"
              placeholder="Confirm password"
            />
          </div>

          {error && (
            <p className="font-mono text-xs text-breakdown">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-stable py-2.5 font-mono text-sm font-bold text-void transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {loading ? 'Creating account...' : 'Create Account'}
          </button>
        </form>

        <p className="mt-6 text-center font-mono text-[10px] text-text-muted">
          Already have an account?{' '}
          <a href="/login" className="text-stable hover:underline">
            Sign in
          </a>
        </p>
      </div>
    </div>
  );
}
