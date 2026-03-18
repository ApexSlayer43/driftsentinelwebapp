'use client';

import { AuthFlow } from '@/components/ui/auth-flow';
import { CelestialSphere } from '@/components/ui/celestial-sphere';
export default function LoginPage() {
  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden px-4">
      {/* WebGL nebula background — gold hue, visible, slow drift */}
      <CelestialSphere
        speed={0.2}
        zoom={1.6}
        starDensity={500}
        nebulaIntensity={0.18}
        className="absolute inset-0 h-full w-full opacity-60"
      />
      {/* Vignette overlay — heavy, lots of void breathing room */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(ellipse at center, transparent 15%, rgba(8,10,14,0.6) 45%, rgba(8,10,14,0.92) 70%, rgba(8,10,14,0.98) 100%)',
        }}
      />
      <AuthFlow />
    </div>
  );
}
