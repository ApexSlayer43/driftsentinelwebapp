"use client";
import { memo, useCallback, useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import { animate } from "motion/react";

interface GlowingEffectProps {
  blur?: number;
  inactiveZone?: number;
  proximity?: number;
  spread?: number;
  variant?: "default" | "white" | "teal" | "gold" | "teal-gold";
  glow?: boolean;
  className?: string;
  disabled?: boolean;
  movementDuration?: number;
  borderWidth?: number;
}

const GlowingEffect = memo(
  ({
    blur = 0,
    inactiveZone = 0.7,
    proximity = 0,
    spread = 20,
    variant = "default",
    glow = false,
    className,
    movementDuration = 2,
    borderWidth = 1,
    disabled = true,
  }: GlowingEffectProps) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const lastPosition = useRef({ x: 0, y: 0 });
    const animationFrameRef = useRef<number>(0);

    const handleMove = useCallback(
      (e?: MouseEvent | { x: number; y: number }) => {
        if (!containerRef.current) return;

        if (animationFrameRef.current) {
          cancelAnimationFrame(animationFrameRef.current);
        }

        animationFrameRef.current = requestAnimationFrame(() => {
          const element = containerRef.current;
          if (!element) return;

          const { left, top, width, height } = element.getBoundingClientRect();
          const mouseX = e?.x ?? lastPosition.current.x;
          const mouseY = e?.y ?? lastPosition.current.y;

          if (e) {
            lastPosition.current = { x: mouseX, y: mouseY };
          }

          const center = [left + width * 0.5, top + height * 0.5];
          const distanceFromCenter = Math.hypot(
            mouseX - center[0],
            mouseY - center[1]
          );
          const inactiveRadius = 0.5 * Math.min(width, height) * inactiveZone;

          if (distanceFromCenter < inactiveRadius) {
            element.style.setProperty("--active", "0");
            return;
          }

          const isActive =
            mouseX > left - proximity &&
            mouseX < left + width + proximity &&
            mouseY > top - proximity &&
            mouseY < top + height + proximity;

          element.style.setProperty("--active", isActive ? "1" : "0");
          if (!isActive) return;

          const currentAngle =
            parseFloat(element.style.getPropertyValue("--start")) || 0;
          const targetAngle =
            (180 * Math.atan2(mouseY - center[1], mouseX - center[0])) /
              Math.PI +
            90;

          const angleDiff = ((targetAngle - currentAngle + 180) % 360) - 180;
          const newAngle = currentAngle + angleDiff;

          animate(currentAngle, newAngle, {
            duration: movementDuration,
            ease: [0.16, 1, 0.3, 1],
            onUpdate: (value) => {
              element.style.setProperty("--start", String(value));
            },
          });
        });
      },
      [inactiveZone, proximity, movementDuration]
    );

    useEffect(() => {
      if (disabled) return;

      const handleScroll = () => handleMove();
      const handlePointerMove = (e: PointerEvent) => handleMove(e);

      window.addEventListener("scroll", handleScroll, { passive: true });
      document.body.addEventListener("pointermove", handlePointerMove, {
        passive: true,
      });

      return () => {
        if (animationFrameRef.current) {
          cancelAnimationFrame(animationFrameRef.current);
        }
        window.removeEventListener("scroll", handleScroll);
        document.body.removeEventListener("pointermove", handlePointerMove);
      };
    }, [handleMove, disabled]);

    return (
      <>
        <div
          className={cn(
            "pointer-events-none absolute -inset-px hidden rounded-[inherit] border opacity-0 transition-opacity",
            glow && "opacity-100",
            variant === "white" && "border-white",
            variant === "teal" && "border-[#00D4AA]/40",
            variant === "gold" && "border-[#FFD700]/40",
            variant === "teal-gold" && "border-[#00D4AA]/30",
            disabled && "!block"
          )}
        />
        <div
          ref={containerRef}
          style={
            {
              "--blur": `${blur}px`,
              "--spread": spread,
              "--start": "0",
              "--active": "0",
              "--glowingeffect-border-width": `${borderWidth}px`,
              "--repeating-conic-gradient-times": "5",
              "--gradient": (() => {
                const gradients = {
                  white: `repeating-conic-gradient(
                    from 236.84deg at 50% 50%,
                    var(--black),
                    var(--black) calc(25% / var(--repeating-conic-gradient-times))
                  )`,
                  teal: `radial-gradient(circle, #00D4AA 15%, #00D4AA00 25%),
                    radial-gradient(circle at 40% 40%, #00FFD0 8%, #00FFD000 18%),
                    radial-gradient(circle at 60% 60%, #33DDBB 12%, #33DDBB00 22%),
                    radial-gradient(circle at 40% 60%, #00E8BB 12%, #00E8BB00 22%),
                    repeating-conic-gradient(
                      from 236.84deg at 50% 50%,
                      #00FFD0 0%,
                      #00D4AA calc(25% / var(--repeating-conic-gradient-times)),
                      #33FFCC calc(50% / var(--repeating-conic-gradient-times)),
                      #00E8BB calc(75% / var(--repeating-conic-gradient-times)),
                      #00FFD0 calc(100% / var(--repeating-conic-gradient-times))
                    )`,
                  gold: `radial-gradient(circle, #FFD700 10%, #FFD70000 20%),
                    radial-gradient(circle at 40% 40%, #F59E0B 5%, #F59E0B00 15%),
                    radial-gradient(circle at 60% 60%, #FBBF24 10%, #FBBF2400 20%),
                    radial-gradient(circle at 40% 60%, #D4A017 10%, #D4A01700 20%),
                    repeating-conic-gradient(
                      from 236.84deg at 50% 50%,
                      #FFD700 0%,
                      #F59E0B calc(25% / var(--repeating-conic-gradient-times)),
                      #FBBF24 calc(50% / var(--repeating-conic-gradient-times)),
                      #D4A017 calc(75% / var(--repeating-conic-gradient-times)),
                      #FFD700 calc(100% / var(--repeating-conic-gradient-times))
                    )`,
                  "teal-gold": `radial-gradient(circle, #00D4AA 10%, #00D4AA00 20%),
                    radial-gradient(circle at 40% 40%, #FFD700 5%, #FFD70000 15%),
                    radial-gradient(circle at 60% 60%, #33DDBB 10%, #33DDBB00 20%),
                    radial-gradient(circle at 40% 60%, #F59E0B 10%, #F59E0B00 20%),
                    repeating-conic-gradient(
                      from 236.84deg at 50% 50%,
                      #00D4AA 0%,
                      #FFD700 calc(25% / var(--repeating-conic-gradient-times)),
                      #33DDBB calc(50% / var(--repeating-conic-gradient-times)),
                      #F59E0B calc(75% / var(--repeating-conic-gradient-times)),
                      #00D4AA calc(100% / var(--repeating-conic-gradient-times))
                    )`,
                  default: `radial-gradient(circle, #00D4AA 10%, #00D4AA00 20%),
                    radial-gradient(circle at 40% 40%, #FFD700 5%, #FFD70000 15%),
                    radial-gradient(circle at 60% 60%, #33DDBB 10%, #33DDBB00 20%),
                    radial-gradient(circle at 40% 60%, #F59E0B 10%, #F59E0B00 20%),
                    repeating-conic-gradient(
                      from 236.84deg at 50% 50%,
                      #00D4AA 0%,
                      #FFD700 calc(25% / var(--repeating-conic-gradient-times)),
                      #33DDBB calc(50% / var(--repeating-conic-gradient-times)),
                      #F59E0B calc(75% / var(--repeating-conic-gradient-times)),
                      #00D4AA calc(100% / var(--repeating-conic-gradient-times))
                    )`,
                };
                return gradients[variant];
              })(),
            } as React.CSSProperties
          }
          className={cn(
            "pointer-events-none absolute inset-0 rounded-[inherit] opacity-100 transition-opacity",
            glow && "opacity-100",
            blur > 0 && "blur-[var(--blur)] ",
            className,
            disabled && "!hidden"
          )}
        >
          <div
            className={cn(
              "glow",
              "rounded-[inherit]",
              'after:content-[""] after:rounded-[inherit] after:absolute after:inset-[calc(-1*var(--glowingeffect-border-width))]',
              "after:[border:var(--glowingeffect-border-width)_solid_transparent]",
              "after:[background:var(--gradient)] after:[background-attachment:fixed]",
              "after:opacity-[var(--active)] after:transition-opacity after:duration-200",
              "after:[mask-clip:padding-box,border-box]",
              "after:[mask-composite:intersect]",
              "after:[mask-image:linear-gradient(#0000,#0000),conic-gradient(from_calc((var(--start)-var(--spread))*1deg),#00000000_0deg,#fff,#00000000_calc(var(--spread)*2deg))]"
            )}
          />
        </div>
      </>
    );
  }
);

GlowingEffect.displayName = "GlowingEffect";

export { GlowingEffect };
