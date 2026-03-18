'use client';

import { AuthFlow } from '@/components/ui/auth-flow';
import { CelestialSphere } from '@/components/ui/celestial-sphere';
export default function LoginPage() {
  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden px-4 bg-[#020204]">
      {/* WebGL nebula — vibrant gold in dark space, floating feel */}
      <CelestialSphere
        hue={40}
        speed={0.3}
        zoom={1.4}
        particleSize={3.0}
        starDensity={500}
        nebulaIntensity={2.2}
        className="absolute inset-0 h-full w-full"
      />
      {/* Soft vignette — darkens edges, keeps floating-in-space depth */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(ellipse at center, transparent 30%, rgba(2,2,4,0.4) 60%, rgba(2,2,4,0.75) 85%, rgba(2,2,4,0.95) 100%)',
        }}
      />
      <AuthFlow />
    </div>
  );
}
