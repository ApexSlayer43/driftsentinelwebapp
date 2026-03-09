'use client';

import { redirect } from 'next/navigation';

// All auth is now handled by the unified flow on /login
export default function SignupPage() {
  redirect('/login');
}
