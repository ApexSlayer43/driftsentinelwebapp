'use client';

import { AuthFlow } from '@/components/ui/auth-flow';
import { CelestialSphere } from '@/components/ui/celestial-sphere';
export default function LoginPage() {
  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden px-4">
      {/* WebGL nebula background — gold hue, slow drift, dimmed */}
      <CelestialSphere
        speed={0.25}
        zoom={1.3}
        starDensity={400}
        nebulaIntensity={0.10}
        className="absolute inset-0 h-full w-full opacity-35"
      />
      {/* Vignette overlay to keep center content readable */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(ellipse at center, transparent 30%, rgba(8,10,14,0.85) 75%)',
        }}
      />
      <AuthFlow />
    </div>
  );
}
