'use client';

import { useEffect, useRef, useCallback } from 'react';

type BehavioralState = 'STABLE' | 'DRIFT_FORMING' | 'COMPROMISED' | 'BREAKDOWN' | 'BUILDING';

interface AmbientDotsProps {
  state: BehavioralState;
}

interface DotConfig {
  dotColor: [number, number, number];
  dotSize: number;
  animationSpeed: number;
  opacity: number;
  mouseReactivity: number;
}

const STATE_DOT_CONFIG: Record<BehavioralState, DotConfig> = {
  STABLE: {
    dotColor: [0, 212, 170],
    dotSize: 2,
    animationSpeed: 0.002,
    opacity: 0.12,
    mouseReactivity: 0.3,
  },
  DRIFT_FORMING: {
    dotColor: [245, 166, 35],
    dotSize: 2.5,
    animationSpeed: 0.004,
    opacity: 0.16,
    mouseReactivity: 0.5,
  },
  COMPROMISED: {
    dotColor: [255, 107, 53],
    dotSize: 3,
    animationSpeed: 0.006,
    opacity: 0.20,
    mouseReactivity: 0.7,
  },
  BREAKDOWN: {
    dotColor: [255, 59, 92],
    dotSize: 3.5,
    animationSpeed: 0.008,
    opacity: 0.25,
    mouseReactivity: 0.9,
  },
  BUILDING: {
    dotColor: [90, 106, 133],
    dotSize: 1.5,
    animationSpeed: 0.001,
    opacity: 0.08,
    mouseReactivity: 0.15,
  },
};

const GRID_SPACING = 30;

export function AmbientDots({ state }: AmbientDotsProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mouseRef = useRef({ x: -1000, y: -1000 });
  const configRef = useRef<DotConfig>({ ...STATE_DOT_CONFIG[state] });
  const targetConfigRef = useRef<DotConfig>(STATE_DOT_CONFIG[state]);
  const animFrameRef = useRef<number>(0);
  const reducedMotionRef = useRef(false);

  // Smoothly transition config on state change
  useEffect(() => {
    targetConfigRef.current = STATE_DOT_CONFIG[state];
  }, [state]);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    mouseRef.current = { x: e.clientX, y: e.clientY };
  }, []);

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    reducedMotionRef.current = mq.matches;
    const handler = (e: MediaQueryListEvent) => {
      reducedMotionRef.current = e.matches;
    };
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d', { willReadFrequently: false })!;
    if (!ctx) return;

    window.addEventListener('mousemove', handleMouseMove);

    let width = window.innerWidth;
    let height = window.innerHeight;
    canvas.width = width;
    canvas.height = height;

    const handleResize = () => {
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = width;
      canvas.height = height;
    };
    window.addEventListener('resize', handleResize);

    // Generate dot phases
    const cols = Math.ceil(width / GRID_SPACING) + 1;
    const rows = Math.ceil(height / GRID_SPACING) + 1;
    const phases = new Float32Array(cols * rows);
    for (let i = 0; i < phases.length; i++) {
      phases[i] = Math.random() * Math.PI * 2;
    }

    let lastTime = 0;
    const FPS_INTERVAL = 1000 / 30; // 30fps cap

    function animate(time: number) {
      animFrameRef.current = requestAnimationFrame(animate);

      // Throttle to 30fps
      if (time - lastTime < FPS_INTERVAL) return;
      lastTime = time;

      // Lerp config for smooth transitions
      const current = configRef.current;
      const target = targetConfigRef.current;
      const lerpSpeed = 0.03;
      configRef.current = {
        dotColor: [
          current.dotColor[0] + (target.dotColor[0] - current.dotColor[0]) * lerpSpeed,
          current.dotColor[1] + (target.dotColor[1] - current.dotColor[1]) * lerpSpeed,
          current.dotColor[2] + (target.dotColor[2] - current.dotColor[2]) * lerpSpeed,
        ] as [number, number, number],
        dotSize: current.dotSize + (target.dotSize - current.dotSize) * lerpSpeed,
        animationSpeed: current.animationSpeed + (target.animationSpeed - current.animationSpeed) * lerpSpeed,
        opacity: current.opacity + (target.opacity - current.opacity) * lerpSpeed,
        mouseReactivity: current.mouseReactivity + (target.mouseReactivity - current.mouseReactivity) * lerpSpeed,
      };

      const cfg = configRef.current;
      const [r, g, b] = cfg.dotColor;

      ctx.clearRect(0, 0, width, height);

      const mx = mouseRef.current.x;
      const my = mouseRef.current.y;
      const mouseRadius = 120;

      for (let col = 0; col < cols; col++) {
        for (let row = 0; row < rows; row++) {
          const x = col * GRID_SPACING;
          const y = row * GRID_SPACING;
          const idx = col * rows + row;

          // Skip offscreen dots
          if (x < -10 || x > width + 10 || y < -10 || y > height + 10) continue;

          let size = cfg.dotSize;
          let opacity = cfg.opacity;

          if (!reducedMotionRef.current) {
            // Ambient breathing
            const breath = Math.sin(time * cfg.animationSpeed + phases[idx]);
            size += breath * 0.5;

            // Mouse proximity
            const dx = x - mx;
            const dy = y - my;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist < mouseRadius) {
              const proximity = 1 - dist / mouseRadius;
              const swell = proximity * proximity * cfg.mouseReactivity;
              size += swell * cfg.dotSize * 2;
              opacity += swell * 0.3;
            }
          }

          ctx.beginPath();
          ctx.arc(x, y, Math.max(0.5, size), 0, Math.PI * 2);
          ctx.fillStyle = `rgba(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)}, ${Math.min(opacity, 0.6)})`;
          ctx.fill();
        }
      }
    }

    animFrameRef.current = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(animFrameRef.current);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('resize', handleResize);
    };
  }, [handleMouseMove]);

  return (
    <canvas
      ref={canvasRef}
      className="pointer-events-none fixed inset-0 z-0"
      style={{ opacity: 1 }}
    />
  );
}
