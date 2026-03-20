'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import confetti from 'canvas-confetti';
import { ArrowLeft, ArrowRight, Check, Eye, EyeOff } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { SentinelWordmark } from '@/components/sentinel-wordmark';

type AuthStep = 'email' | 'login' | 'signup' | 'success';

function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none">
      <path
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
        fill="#4285F4"
      />
      <path
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
        fill="#34A853"
      />
      <path
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
        fill="#FBBC05"
      />
      <path
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
        fill="#EA4335"
      />
    </svg>
  );
}

function TextLoop() {
  const phrases = [
    'Discipline is edge.',
    'Eyes on the process.',
    'Protect the process.',
    'Drift detected.',
  ];
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setIndex((i) => (i + 1) % phrases.length);
    }, 3000);
    return () => clearInterval(interval);
  }, [phrases.length]);

  return (
    <AnimatePresence mode="wait">
      <motion.span
        key={index}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -8 }}
        transition={{ duration: 0.4 }}
        className="block font-mono text-[12px] tracking-[0.15em] text-text-muted"
      >
        {phrases[index]}
      </motion.span>
    </AnimatePresence>
  );
}

export function AuthFlow() {
  const router = useRouter();
  const [step, setStep] = useState<AuthStep>('email');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const confettiRef = useRef<HTMLCanvasElement>(null);

  const fireConfetti = useCallback(() => {
    if (!confettiRef.current) return;
    const myConfetti = confetti.create(confettiRef.current, {
      resize: true,
      useWorker: true,
    });
    // Teal and white themed bursts
    const colors = ['#FFFFFF', '#E2E8F0', '#C0C8D8', '#94A3B8'];
    myConfetti({
      particleCount: 80,
      spread: 80,
      origin: { y: 0.6 },
      colors,
      startVelocity: 30,
    });
    setTimeout(() => {
      myConfetti({
        particleCount: 40,
        spread: 60,
        origin: { y: 0.65, x: 0.3 },
        colors,
        startVelocity: 25,
      });
    }, 200);
    setTimeout(() => {
      myConfetti({
        particleCount: 40,
        spread: 60,
        origin: { y: 0.65, x: 0.7 },
        colors,
        startVelocity: 25,
      });
    }, 400);
  }, []);

  async function handleEmailSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    setLoading(true);
    setError(null);

    try {
      const supabase = createClient();
      // Try signing in with a wrong password to check if user exists
      // If we get "Invalid login credentials", user exists
      // If we get nothing or different error, user might not exist
      // Better approach: try signInWithOtp to check, or just use a simple heuristic

      // We'll attempt a sign-in with an empty password - if user exists we get "Invalid login credentials"
      // If user doesn't exist, we also get that. So instead, let's check via a different approach.
      //
      // Actually the cleanest approach: try to sign up with a temporary check.
      // But Supabase doesn't have a "check if email exists" endpoint publicly.
      //
      // Best UX approach: let user choose, but default based on a smart guess.
      // We'll try sign-in with OTP (magic link) which returns differently for existing vs non-existing users.
      //
      // Simplest: Use signInWithPassword with empty string -
      // "Invalid login credentials" means user exists OR doesn't exist (Supabase doesn't distinguish for security)
      //
      // Since Supabase intentionally doesn't reveal if an email exists (security best practice),
      // we'll let the user flow through and handle errors at the password step.
      // If they enter an email, we'll try signup first. If the email is taken, we redirect to login.

      // For now: proceed to password step. We'll attempt sign-in first,
      // and if it fails because user doesn't exist, we'll switch to signup.
      setStep('login');
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  async function handlePasswordSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!password) return;
    setLoading(true);
    setError(null);

    try {
      const supabase = createClient();
      const { error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (authError) {
        // If invalid credentials, could mean wrong password or user doesn't exist
        if (authError.message.includes('Invalid login credentials')) {
          setError('Invalid password. If you\'re new, click "Create account" below.');
        } else {
          setError(authError.message);
        }
        setLoading(false);
        return;
      }

      // Success - sign in
      setStep('success');
      setTimeout(() => fireConfetti(), 300);
      setTimeout(() => {
        router.push('/');
        router.refresh();
      }, 2000);
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  async function handleSignupSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!password || !confirmPassword) return;
    setLoading(true);
    setError(null);

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      setLoading(false);
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      setLoading(false);
      return;
    }

    try {
      const supabase = createClient();
      const { error: authError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      });

      if (authError) {
        if (authError.message.includes('already registered')) {
          setError('This email is already registered. Try signing in instead.');
          setStep('login');
          setPassword('');
        } else {
          setError(authError.message);
        }
        setLoading(false);
        return;
      }

      setStep('success');
      setTimeout(() => fireConfetti(), 300);
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  async function handleGoogleAuth() {
    setLoading(true);
    setError(null);
    try {
      const supabase = createClient();
      const { error: authError } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
        },
      });
      if (authError) {
        setError(authError.message);
        setLoading(false);
      }
    } catch {
      setError('Google sign-in failed. Please try again.');
      setLoading(false);
    }
  }

  function goBack() {
    setError(null);
    setPassword('');
    setConfirmPassword('');
    if (step === 'signup') {
      setStep('login');
    } else {
      setStep('email');
    }
  }

  return (
    <div className="relative z-10 flex w-full max-w-md flex-col items-center">
      {/* Confetti canvas */}
      <canvas
        ref={confettiRef}
        className="pointer-events-none fixed inset-0 z-50"
        style={{ width: '100%', height: '100%' }}
      />

      {/* Wordmark logo */}
      <motion.div
        className="mb-10"
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: 'easeOut' }}
      >
        <SentinelWordmark height={80} />
      </motion.div>

      {/* Auth content — no panel, floats on void */}
      <AnimatePresence mode="wait">
        {/* ─── EMAIL STEP ─── */}
        {step === 'email' && (
          <motion.div
            key="email"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.35, delay: 0.1 }}
            className="w-full"
          >
            {/* "Continue with" label */}
            <p className="mb-4 text-center font-mono text-xs tracking-wide text-text-secondary">
              Continue with
            </p>

            {/* Google OAuth */}
            <button
              type="button"
              onClick={handleGoogleAuth}
              disabled={loading}
              className="bg-[rgba(200,169,110,0.03)] backdrop-blur-xl border border-[rgba(200,169,110,0.06)] flex w-full items-center justify-center gap-2.5 rounded-full px-5 py-3 font-mono text-sm text-text-primary transition-all hover:border-[rgba(200,169,110,0.09)] disabled:opacity-50"
            >
              <GoogleIcon className="h-4 w-4" />
              Google
            </button>

            {/* Divider */}
            <div className="my-6 flex items-center gap-4">
              <div className="h-px flex-1 bg-[rgba(200,169,110,0.04)]" />
              <span className="font-mono text-[12px] uppercase tracking-[0.12em] text-text-dim">
                or
              </span>
              <div className="h-px flex-1 bg-[rgba(200,169,110,0.04)]" />
            </div>

            <form onSubmit={handleEmailSubmit}>
              <div className="relative">
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoFocus
                  className="bg-[rgba(200,169,110,0.03)] backdrop-blur-xl border border-[rgba(200,169,110,0.06)] w-full rounded-full px-5 py-3 pl-12 font-mono text-sm text-text-primary placeholder-text-dim outline-none transition-all focus:border-[rgba(200,169,110,0.09)]"
                  placeholder="Email"
                />
                <svg
                  className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-text-dim"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <rect x="2" y="4" width="20" height="16" rx="2" />
                  <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
                </svg>
              </div>

              {error && (
                <p className="mt-3 text-center font-mono text-xs text-breakdown">{error}</p>
              )}

              <button
                type="submit"
                disabled={loading || !email.trim()}
                className="mt-4 flex w-full items-center justify-center gap-2 rounded-full bg-accent-primary py-3 font-mono text-sm font-bold text-void transition-all hover:shadow-[0_0_24px_rgba(255,255,255,0.2)] disabled:opacity-50"
              >
                {loading ? (
                  <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-void/30 border-t-void" />
                ) : (
                  <>
                    Continue
                    <ArrowRight size={14} />
                  </>
                )}
              </button>
            </form>
          </motion.div>
        )}

        {/* ─── LOGIN STEP ─── */}
        {step === 'login' && (
          <motion.div
            key="login"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.35 }}
            className="w-full"
          >
            <p className="mb-4 text-center font-mono text-xs tracking-wide text-text-secondary">
              Sign in
            </p>

            {/* Email badge */}
            <button
              type="button"
              onClick={goBack}
              className="mx-auto mb-5 flex items-center gap-2 rounded-full border border-[rgba(200,169,110,0.06)] bg-[rgba(200,169,110,0.03)] px-4 py-1.5 font-mono text-[12px] text-text-secondary transition-colors hover:border-[rgba(200,169,110,0.1)] hover:text-text-primary"
            >
              <ArrowLeft size={10} />
              {email}
            </button>

            <form onSubmit={handlePasswordSubmit}>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoFocus
                  className="bg-[rgba(200,169,110,0.03)] backdrop-blur-xl border border-[rgba(200,169,110,0.06)] w-full rounded-full px-5 py-3 pr-12 font-mono text-sm text-text-primary placeholder-text-dim outline-none transition-all focus:border-[rgba(200,169,110,0.09)]"
                  placeholder="Password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-text-dim transition-colors hover:text-text-muted"
                >
                  {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>

              {error && (
                <p className="mt-3 text-center font-mono text-xs text-breakdown">{error}</p>
              )}

              <button
                type="submit"
                disabled={loading || !password}
                className="mt-4 flex w-full items-center justify-center gap-2 rounded-full bg-accent-primary py-3 font-mono text-sm font-bold text-void transition-all hover:shadow-[0_0_24px_rgba(255,255,255,0.2)] disabled:opacity-50"
              >
                {loading ? (
                  <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-void/30 border-t-void" />
                ) : (
                  <>
                    Sign In
                    <ArrowRight size={14} />
                  </>
                )}
              </button>
            </form>

            <p className="mt-5 text-center font-mono text-[12px] text-text-dim">
              New here?{' '}
              <button
                type="button"
                onClick={() => {
                  setError(null);
                  setPassword('');
                  setStep('signup');
                }}
                className="text-text-secondary transition-colors hover:text-text-primary"
              >
                Create account
              </button>
            </p>
          </motion.div>
        )}

        {/* ─── SIGNUP STEP ─── */}
        {step === 'signup' && (
          <motion.div
            key="signup"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.35 }}
            className="w-full"
          >
            <p className="mb-4 text-center font-mono text-xs tracking-wide text-text-secondary">
              Create account
            </p>

            {/* Email badge */}
            <button
              type="button"
              onClick={goBack}
              className="mx-auto mb-5 flex items-center gap-2 rounded-full border border-[rgba(200,169,110,0.06)] bg-[rgba(200,169,110,0.03)] px-4 py-1.5 font-mono text-[12px] text-text-secondary transition-colors hover:border-[rgba(200,169,110,0.1)] hover:text-text-primary"
            >
              <ArrowLeft size={10} />
              {email}
            </button>

            <form onSubmit={handleSignupSubmit} className="space-y-3">
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoFocus
                  className="bg-[rgba(200,169,110,0.03)] backdrop-blur-xl border border-[rgba(200,169,110,0.06)] w-full rounded-full px-5 py-3 pr-12 font-mono text-sm text-text-primary placeholder-text-dim outline-none transition-all focus:border-[rgba(200,169,110,0.09)]"
                  placeholder="Password (min 6 chars)"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-text-dim transition-colors hover:text-text-muted"
                >
                  {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>

              <div className="relative">
                <input
                  type={showConfirm ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  className="bg-[rgba(200,169,110,0.03)] backdrop-blur-xl border border-[rgba(200,169,110,0.06)] w-full rounded-full px-5 py-3 pr-12 font-mono text-sm text-text-primary placeholder-text-dim outline-none transition-all focus:border-[rgba(200,169,110,0.09)]"
                  placeholder="Confirm password"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirm(!showConfirm)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-text-dim transition-colors hover:text-text-muted"
                >
                  {showConfirm ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>

              {/* Password match indicator */}
              {confirmPassword && (
                <div className="flex items-center justify-center gap-1.5 font-mono text-[12px]">
                  {password === confirmPassword ? (
                    <>
                      <Check size={10} className="text-white/70" />
                      <span className="text-white/70">Passwords match</span>
                    </>
                  ) : (
                    <span className="text-breakdown">Passwords don&apos;t match</span>
                  )}
                </div>
              )}

              {error && (
                <p className="text-center font-mono text-xs text-breakdown">{error}</p>
              )}

              <button
                type="submit"
                disabled={loading || !password || !confirmPassword || password !== confirmPassword}
                className="flex w-full items-center justify-center gap-2 rounded-full bg-accent-primary py-3 font-mono text-sm font-bold text-void transition-all hover:shadow-[0_0_24px_rgba(255,255,255,0.2)] disabled:opacity-50"
              >
                {loading ? (
                  <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-void/30 border-t-void" />
                ) : (
                  <>
                    Create Account
                    <ArrowRight size={14} />
                  </>
                )}
              </button>
            </form>

            <p className="mt-5 text-center font-mono text-[12px] text-text-dim">
              Already have an account?{' '}
              <button
                type="button"
                onClick={() => {
                  setError(null);
                  setPassword('');
                  setConfirmPassword('');
                  setStep('login');
                }}
                className="text-text-secondary transition-colors hover:text-text-primary"
              >
                Sign in
              </button>
            </p>
          </motion.div>
        )}

        {/* ─── SUCCESS STEP ─── */}
        {step === 'success' && (
          <motion.div
            key="success"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.4 }}
            className="flex w-full flex-col items-center py-4"
          >
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', stiffness: 200, damping: 12, delay: 0.1 }}
              className="mb-4 flex h-14 w-14 items-center justify-center rounded-full border border-[rgba(200,169,110,0.15)] bg-[rgba(200,169,110,0.035)]"
            >
              <Check size={24} className="text-white" />
            </motion.div>

            <h2 className="font-display text-xl font-bold text-text-primary">
              Welcome aboard
            </h2>
            <p className="mt-2 text-center font-mono text-xs text-text-muted">
              {email}
            </p>
            <p className="mt-1 text-center font-mono text-[12px] text-text-dim">
              Redirecting to your dashboard...
            </p>

            {/* Loading bar */}
            <div className="mt-4 h-0.5 w-32 overflow-hidden rounded-full bg-[rgba(200,169,110,0.04)]">
              <motion.div
                className="h-full bg-white"
                initial={{ width: 0 }}
                animate={{ width: '100%' }}
                transition={{ duration: 1.8, ease: 'easeInOut' }}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Footer */}
      {step !== 'success' && (
        <motion.div
          className="mt-8 flex flex-col items-center gap-3"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
        >
          <TextLoop />
          <div className="flex items-center gap-2 opacity-20">
            <div className="h-px w-8 bg-white" />
            <div className="h-1 w-1 rounded-full bg-white" />
            <div className="h-px w-8 bg-white" />
          </div>
        </motion.div>
      )}
    </div>
  );
}
