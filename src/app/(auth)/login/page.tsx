'use client';

import { AuthFlow } from '@/components/ui/auth-flow';
import { CelestialSphere } from '@/components/ui/celestial-sphere';
export default function LoginPage() {
  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden px-4">
      {/* WebGL nebula background — gold hue, visible, slow drift */}
      <CelestialSphere
        speed={0.25}
        zoom={1.3}
        starDensity={400}
        nebulaIntensity={0.55}
        className="absolute inset-0 h-full w-full"
      />
      {/* Vignette overlay to keep center content readable */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(ellipse at center, transparent 25%, rgba(8,10,14,0.7) 65%, rgba(8,10,14,0.92) 100%)',
        }}
      />
      <AuthFlow />
    </div>
  );
}
