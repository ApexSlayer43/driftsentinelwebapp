"use client";
import React, { useRef, useEffect } from "react";
import * as THREE from "three";

interface CelestialSphereProps {
  speed?: number;
  zoom?: number;
  starDensity?: number;
  nebulaIntensity?: number;
  className?: string;
}

/**
 * CelestialSphere — DS monochrome animated background.
 * White/silver nebula clouds with gold warmth, silver twinkling stars.
 * Sits behind the UI as a full-bleed WebGL shader.
 */
export const CelestialSphere: React.FC<CelestialSphereProps> = ({
  speed = 0.3,
  zoom = 1.5,
  starDensity = 500.0,
  nebulaIntensity = 0.5,
  className = "",
}) => {
  const mountRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!mountRef.current) return;
    const currentMount = mountRef.current;

    let scene: THREE.Scene,
      camera: THREE.OrthographicCamera,
      renderer: THREE.WebGLRenderer,
      material: THREE.ShaderMaterial;
    let animationFrameId: number;

    const vertexShader = `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `;

    const fragmentShader = `
      precision highp float;
      varying vec2 vUv;

      uniform vec2 u_resolution;
      uniform float u_time;
      uniform vec2 u_mouse;
      uniform float u_zoom;
      uniform float u_star_density;
      uniform float u_nebula_intensity;

      // Hash-based random
      float hash(vec2 p) {
        vec3 p3 = fract(vec3(p.xyx) * 0.1031);
        p3 += dot(p3, p3.yzx + 33.33);
        return fract((p3.x + p3.y) * p3.z);
      }

      // Smooth noise
      float noise(vec2 p) {
        vec2 i = floor(p);
        vec2 f = fract(p);
        vec2 u = f * f * (3.0 - 2.0 * f);

        return mix(
          mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x),
          mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x),
          u.y
        );
      }

      // Fractal brownian motion — 5 octaves
      float fbm(vec2 p) {
        float value = 0.0;
        float amp = 0.5;
        float freq = 1.0;
        for (int i = 0; i < 5; i++) {
          value += amp * noise(p * freq);
          freq *= 2.0;
          amp *= 0.5;
        }
        return value;
      }

      // Warped fbm for organic nebula shapes
      float warpedFbm(vec2 p, float t) {
        vec2 q = vec2(
          fbm(p + vec2(0.0, 0.0) + t * 0.04),
          fbm(p + vec2(5.2, 1.3) + t * 0.03)
        );
        vec2 r = vec2(
          fbm(p + 4.0 * q + vec2(1.7, 9.2) + t * 0.02),
          fbm(p + 4.0 * q + vec2(8.3, 2.8) + t * 0.025)
        );
        return fbm(p + 4.0 * r);
      }

      void main() {
        vec2 uv = (gl_FragCoord.xy - 0.5 * u_resolution.xy) / min(u_resolution.y, u_resolution.x);
        uv *= u_zoom;

        // Mouse parallax
        vec2 mouse_norm = u_mouse / max(u_resolution, vec2(1.0));
        uv += (mouse_norm - 0.5) * 0.15;

        float t = u_time;

        // --- NEBULA ---
        // Primary nebula layer — large billowing clouds
        float neb1 = warpedFbm(uv * 1.5, t);
        // Secondary layer — finer detail
        float neb2 = warpedFbm(uv * 2.5 + vec2(10.0), t * 0.8);

        // Shape the nebula — softer power curve so it's actually visible
        float nebula = pow(neb1, 1.5) * 0.7 + pow(neb2, 1.8) * 0.3;

        // Silver base color
        vec3 silver = vec3(0.78, 0.82, 0.88);
        // Gold warmth for nebula peaks
        vec3 gold = vec3(0.92, 0.82, 0.52);

        // Mix silver to gold at brighter regions
        float goldMix = smoothstep(0.2, 0.6, nebula);
        vec3 nebulaColor = mix(silver, gold, goldMix * 0.5);

        // Void base (#0D0F15)
        vec3 base = vec3(0.051, 0.059, 0.082);

        // Apply nebula
        vec3 color = base + nebulaColor * nebula * u_nebula_intensity;

        // --- STARS ---
        // Use screen-space UVs for stars so they're evenly distributed
        vec2 starUv = gl_FragCoord.xy / u_resolution.xy;

        // Primary bright stars
        float grid1 = u_star_density;
        vec2 cell1 = floor(starUv * grid1);
        vec2 cellUv1 = fract(starUv * grid1) - 0.5;
        float starRand1 = hash(cell1);

        if (starRand1 > 0.97) {
          // Star position jitter within cell
          vec2 starPos = vec2(hash(cell1 + vec2(1.0, 0.0)), hash(cell1 + vec2(0.0, 1.0))) - 0.5;
          float dist = length(cellUv1 - starPos * 0.4);

          // Star brightness with twinkle
          float twinkle = 0.6 + 0.4 * sin(t * (2.0 + starRand1 * 4.0) + starRand1 * 62.83);
          float starSize = 0.02 + starRand1 * 0.015;
          float star = smoothstep(starSize, 0.0, dist) * twinkle;

          // Slight glow halo
          float glow = smoothstep(starSize * 4.0, 0.0, dist) * 0.15 * twinkle;

          vec3 starColor = mix(vec3(0.85, 0.88, 0.95), vec3(1.0), starRand1);
          color += starColor * (star + glow);
        }

        // Secondary dimmer stars — more numerous, smaller
        float grid2 = u_star_density * 2.0;
        vec2 cell2 = floor(starUv * grid2);
        vec2 cellUv2 = fract(starUv * grid2) - 0.5;
        float starRand2 = hash(cell2 + vec2(42.0, 17.0));

        if (starRand2 > 0.96) {
          vec2 starPos2 = vec2(hash(cell2 + vec2(3.0, 7.0)), hash(cell2 + vec2(11.0, 5.0))) - 0.5;
          float dist2 = length(cellUv2 - starPos2 * 0.4);
          float twinkle2 = 0.5 + 0.5 * sin(t * (1.5 + starRand2 * 3.0) + starRand2 * 100.0);
          float star2 = smoothstep(0.012, 0.0, dist2) * twinkle2 * 0.4;

          // Warmer tint for dim stars
          vec3 dimColor = vec3(0.9, 0.85, 0.75);
          color += dimColor * star2;
        }

        // --- VIGNETTE ---
        vec2 vigUv = gl_FragCoord.xy / u_resolution.xy;
        float vignette = 1.0 - 0.35 * pow(length((vigUv - 0.5) * 1.5), 2.0);
        color *= vignette;

        gl_FragColor = vec4(color, 1.0);
      }
    `;

    const init = () => {
      scene = new THREE.Scene();
      camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

      renderer = new THREE.WebGLRenderer({ antialias: false, alpha: false });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      renderer.domElement.style.display = "block";
      renderer.domElement.style.width = "100%";
      renderer.domElement.style.height = "100%";
      currentMount.appendChild(renderer.domElement);

      material = new THREE.ShaderMaterial({
        vertexShader,
        fragmentShader,
        uniforms: {
          u_time: { value: 0.0 },
          u_resolution: { value: new THREE.Vector2() },
          u_mouse: { value: new THREE.Vector2() },
          u_zoom: { value: zoom },
          u_star_density: { value: starDensity },
          u_nebula_intensity: { value: nebulaIntensity },
        },
      });

      const geometry = new THREE.PlaneGeometry(2, 2);
      const mesh = new THREE.Mesh(geometry, material);
      scene.add(mesh);

      addEventListeners();
      resize();
      animate();
    };

    const animate = () => {
      material.uniforms.u_time.value += 0.005 * speed;
      renderer.render(scene, camera);
      animationFrameId = requestAnimationFrame(animate);
    };

    const dpr = () => Math.min(window.devicePixelRatio, 2);

    const resize = () => {
      const { clientWidth, clientHeight } = currentMount;
      if (clientWidth === 0 || clientHeight === 0) return;
      renderer.setSize(clientWidth, clientHeight);
      material.uniforms.u_resolution.value.set(clientWidth * dpr(), clientHeight * dpr());
      camera.updateProjectionMatrix();
    };

    const onMouseMove = (event: MouseEvent) => {
      const rect = currentMount.getBoundingClientRect();
      const x = event.clientX - rect.left;
      const y = event.clientY - rect.top;
      material.uniforms.u_mouse.value.set(x * dpr(), (currentMount.clientHeight - y) * dpr());
    };

    const addEventListeners = () => {
      window.addEventListener("resize", resize);
      window.addEventListener("mousemove", onMouseMove);
    };

    const removeEventListeners = () => {
      window.removeEventListener("resize", resize);
      window.removeEventListener("mousemove", onMouseMove);
    };

    init();

    return () => {
      removeEventListeners();
      cancelAnimationFrame(animationFrameId);
      if (currentMount && renderer.domElement) {
        currentMount.removeChild(renderer.domElement);
      }
      renderer.dispose();
    };
  }, [speed, zoom, starDensity, nebulaIntensity]);

  return <div ref={mountRef} className={className || "w-full h-full"} />;
};

export default CelestialSphere;
