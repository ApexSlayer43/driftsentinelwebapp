"use client";
import { useEffect, useRef, useState, useCallback } from "react";
interface LiveEyeProps {
  size?: number;
}
export default function LiveEye({ size = 80 }: LiveEyeProps) {
  const eyeRef = useRef<SVGSVGElement>(null);
  const [pupilOffset, setPupilOffset] = useState({ x: 0, y: 0 });
  const [blinkProgress, setBlinkProgress] = useState(0); // 0 = open, 1 = closed
  const [isBlinking, setIsBlinking] = useState(false);
  const [dilationScale, setDilationScale] = useState(1);
  const blinkTimeoutRef = useRef<NodeJS.Timeout>(null);
  const animFrameRef = useRef<number>(null);
  const cx = size / 2;
  const cy = size / 2;
  const eyeW = size * 0.42;
  const eyeH = size * 0.22;
  const irisR = size * 0.14;
  const pupilR = size * 0.085;
  const dotR = size * 0.036;
  // Cursor tracking
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!eyeRef.current) return;
      const rect = eyeRef.current.getBoundingClientRect();
      const eyeCenterX = rect.left + rect.width / 2;
      const eyeCenterY = rect.top + rect.height / 2;
      const dx = e.clientX - eyeCenterX;
      const dy = e.clientY - eyeCenterY;
      const angle = Math.atan2(dy, dx);
      const distance = Math.sqrt(dx * dx + dy * dy);
      const maxTravel = size * 0.07;
      const travel = Math.min(distance / 200, 1) * maxTravel;
      setPupilOffset({
        x: Math.cos(angle) * travel,
        y: Math.sin(angle) * travel,
      });
      // Dilate when cursor is close
      const proximity = Math.max(0, 1 - distance / 300);
      setDilationScale(1 + proximity * 0.25);
    };
    window.addEventListener("mousemove", handleMouseMove);
    return () => window.removeEventListener("mousemove", handleMouseMove);
  }, [size]);
  // Blink animation
  const triggerBlink = useCallback(() => {
    setIsBlinking(true);
    let start: number | null = null;
    const duration = 180; // ms total blink
    const animate = (timestamp: number) => {
      if (!start) start = timestamp;
      const elapsed = timestamp - start;
      const progress = elapsed / duration;
      if (progress < 0.5) {
        // Closing
        setBlinkProgress(progress * 2);
      } else if (progress < 1) {
        // Opening
        setBlinkProgress((1 - progress) * 2);
      } else {
        setBlinkProgress(0);
        setIsBlinking(false);
        return;
      }
      animFrameRef.current = requestAnimationFrame(animate);
    };
    animFrameRef.current = requestAnimationFrame(animate);
  }, []);
  // Schedule random blinks
  useEffect(() => {
    const scheduleNextBlink = () => {
      // Blink every 2-6 seconds randomly, occasionally double blink
      const delay = 2000 + Math.random() * 4000;
      blinkTimeoutRef.current = setTimeout(() => {
        triggerBlink();
        // 20% chance of double blink
        if (Math.random() < 0.2) {
          setTimeout(() => triggerBlink(), 320);
        }
        scheduleNextBlink();
      }, delay);
    };
    scheduleNextBlink();
    return () => {
      if (blinkTimeoutRef.current) clearTimeout(blinkTimeoutRef.current);
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [triggerBlink]);
  // Compute eyelid clip based on blink progress
  // blinkProgress 0 = fully open, 1 = fully closed
  const lidOffset = blinkProgress * eyeH;
  // Upper and lower eyelid paths that close over the eye
  const eyePath = `M${cx - eyeW},${cy} C${cx - eyeW * 0.55},${cy - eyeH} ${cx + eyeW * 0.55},${cy - eyeH} ${cx + eyeW},${cy} C${cx + eyeW * 0.55},${cy + eyeH} ${cx - eyeW * 0.55},${cy + eyeH} ${cx - eyeW},${cy} Z`;
  // Upper lid closes downward, lower lid closes upward
  const upperLidY = cy - eyeH + lidOffset * 0.9;
  const lowerLidY = cy + eyeH - lidOffset * 0.9;
  return (
    <svg
      ref={eyeRef}
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      xmlns="http://www.w3.org/2000/svg"
      style={{ overflow: "visible", cursor: "none" }}
    >
      <defs>
        <filter id="liveGlow" x="-40%" y="-40%" width="180%" height="180%">
          <feGaussianBlur stdDeviation="1.8" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <filter id="liveGlowStrong" x="-60%" y="-60%" width="220%" height="220%">
          <feGaussianBlur stdDeviation="3" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <filter id="liveGlowAmbient" x="-80%" y="-80%" width="260%" height="260%">
          <feGaussianBlur stdDeviation="6" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <filter id="liveGlowGold" x="-60%" y="-60%" width="220%" height="220%">
          <feGaussianBlur stdDeviation="2.5" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        {/* Clip to eye shape for eyelids */}
        <clipPath id="eyeShape">
          <path d={eyePath} />
        </clipPath>
        {/* Clip pupil inside iris */}
        <clipPath id="irisShape">
          <circle cx={cx} cy={cy} r={irisR * 1.15} />
        </clipPath>
      </defs>
      {/* Ambient glow behind eye */}
      <ellipse
        cx={cx} cy={cy}
        rx={eyeW * 0.8} ry={eyeH * 2}
        fill="#c8a96e"
        opacity={0.04}
        filter="url(#liveGlowAmbient)"
      />
      {/* Outer orbit ring */}
      <circle
        cx={cx} cy={cy}
        r={size * 0.46}
        fill="none"
        stroke="#c8a96e"
        strokeWidth="0.5"
        strokeDasharray="2 8"
        opacity={0.12}
      />
      <circle
        cx={cx} cy={cy}
        r={size * 0.42}
        fill="none"
        stroke="#c8a96e"
        strokeWidth="0.3"
        opacity={0.07}
      />
      {/* Eye almond outline */}
      <path
        d={eyePath}
        fill="none"
        stroke="#c8a96e"
        strokeWidth={size * 0.025}
        filter="url(#liveGlow)"
      />
      {/* Eye interior — clipped to almond */}
      <g clipPath="url(#eyeShape)">
        {/* Subtle iris fill */}
        <circle cx={cx} cy={cy} r={irisR * 1.4} fill="#c8a96e" opacity={0.04} />
        {/* Iris ring — static */}
        <circle
          cx={cx} cy={cy}
          r={irisR}
          fill="none"
          stroke="#c8a96e"
          strokeWidth={size * 0.018}
          opacity={0.5}
          filter="url(#liveGlow)"
        />
        {/* Vertical axis ticks — inside eye, from almond edge to iris */}
        <line
          x1={cx} y1={cy - eyeH * 1.5}
          x2={cx} y2={cy - irisR * 1.15}
          stroke="#c8a96e" strokeWidth={size * 0.025}
          filter="url(#liveGlow)"
        />
        <line
          x1={cx} y1={cy + irisR * 1.15}
          x2={cx} y2={cy + eyeH * 1.5}
          stroke="#c8a96e" strokeWidth={size * 0.025}
          filter="url(#liveGlow)"
        />
        {/* Pupil group — cursor tracking + dilation */}
        <g
          clipPath="url(#irisShape)"
          style={{
            transform: `translate(${pupilOffset.x}px, ${pupilOffset.y}px)`,
            transition: "transform 0.1s ease-out",
          }}
        >
          <circle
            cx={cx} cy={cy}
            r={pupilR * dilationScale}
            fill="#FFD700"
            opacity={0.15}
            style={{ transition: "r 0.3s ease-out" }}
          />
          <circle
            cx={cx} cy={cy}
            r={pupilR * dilationScale}
            fill="none"
            stroke="#FFD700"
            strokeWidth={size * 0.022}
            filter="url(#liveGlowGold)"
            style={{ transition: "r 0.3s ease-out" }}
          />
          {/* Center dot — gold */}
          <circle
            cx={cx} cy={cy}
            r={dotR}
            fill="#FFD700"
            filter="url(#liveGlowGold)"
          />
          {/* Tiny specular highlight */}
          <circle
            cx={cx - dotR * 0.8} cy={cy - dotR * 0.8}
            r={dotR * 0.4}
            fill="white"
            opacity={0.6}
          />
        </g>
        {/* EYELIDS — blink animation */}
        {/* Upper eyelid */}
        <path
          d={`M${cx - eyeW},${cy} C${cx - eyeW * 0.55},${cy - eyeH} ${cx + eyeW * 0.55},${cy - eyeH} ${cx + eyeW},${cy} L${cx + eyeW},${upperLidY} C${cx + eyeW * 0.55},${upperLidY - eyeH * 0.3} ${cx - eyeW * 0.55},${upperLidY - eyeH * 0.3} ${cx - eyeW},${upperLidY} Z`}
          fill="#080A0E"
          style={{ transition: isBlinking ? "none" : "d 0.05s" }}
        />
        {/* Lower eyelid */}
        <path
          d={`M${cx - eyeW},${cy} C${cx - eyeW * 0.55},${cy + eyeH} ${cx + eyeW * 0.55},${cy + eyeH} ${cx + eyeW},${cy} L${cx + eyeW},${lowerLidY} C${cx + eyeW * 0.55},${lowerLidY + eyeH * 0.3} ${cx - eyeW * 0.55},${lowerLidY + eyeH * 0.3} ${cx - eyeW},${lowerLidY} Z`}
          fill="#080A0E"
          style={{ transition: isBlinking ? "none" : "d 0.05s" }}
        />
      </g>
      {/* Horizontal axis ticks — outside eye, always visible */}
      <line
        x1={cx - eyeW - size * 0.12} y1={cy}
        x2={cx - eyeW} y2={cy}
        stroke="#c8a96e" strokeWidth={size * 0.03}
        filter="url(#liveGlow)"
      />
      <line
        x1={cx + eyeW} y1={cy}
        x2={cx + eyeW + size * 0.12} y2={cy}
        stroke="#c8a96e" strokeWidth={size * 0.03}
        filter="url(#liveGlow)"
      />
      {/* Corner reticle marks */}
      {([
        [cx + eyeW * 0.65, cy - eyeH * 0.8, cx + eyeW * 0.78, cy - eyeH * 1.1],
        [cx - eyeW * 0.65, cy - eyeH * 0.8, cx - eyeW * 0.78, cy - eyeH * 1.1],
        [cx + eyeW * 0.65, cy + eyeH * 0.8, cx + eyeW * 0.78, cy + eyeH * 1.1],
        [cx - eyeW * 0.65, cy + eyeH * 0.8, cx - eyeW * 0.78, cy + eyeH * 1.1],
      ] as [number,number,number,number][]).map(([x1, y1, x2, y2], i) => (
        <line
          key={i}
          x1={x1} y1={y1} x2={x2} y2={y2}
          stroke="#c8a96e"
          strokeWidth={size * 0.016}
          opacity={0.5}
        />
      ))}
    </svg>
  );
}
