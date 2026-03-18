"use client";
import React, { useRef, useEffect } from "react";
import * as THREE from "three";

/**
 * CelestialSphere — Vibrant WebGL nebula background.
 *
 * HSL-based nebula with fbm warping, starfield overlay, mouse parallax.
 * Default hue 40° = DS gold (#c8a96e). Looks like floating in deep space
 * with a luminous gold/amber nebula drifting through darkness.
 */
interface CelestialSphereProps {
  /** HSL hue in degrees (default 40 = gold) */
  hue?: number;
  /** Animation speed multiplier */
  speed?: number;
  /** Camera zoom — higher = tighter framing */
  zoom?: number;
  /** Star brightness multiplier */
  particleSize?: number;
  /** Star grid density (default 500) */
  starDensity?: number;
  /** Nebula brightness multiplier (default 2.5) */
  nebulaIntensity?: number;
  className?: string;
}

export const CelestialSphere: React.FC<CelestialSphereProps> = ({
  hue = 40.0,
  speed = 0.3,
  zoom = 1.5,
  particleSize = 3.0,
  starDensity = 500.0,
  nebulaIntensity = 2.5,
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
    const mouse = new THREE.Vector2(0.5, 0.5);

    const vertexShader = `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `;

    // Vibrant HSL nebula shader — same algorithm as Celestial Sphere demo
    // but with configurable hue, intensity, and star density
    const fragmentShader = `
      precision highp float;
      varying vec2 vUv;

      uniform vec2 u_resolution;
      uniform float u_time;
      uniform vec2 u_mouse;
      uniform float u_hue;
      uniform float u_zoom;
      uniform float u_particle_size;
      uniform float u_star_density;
      uniform float u_nebula_intensity;

      // HSL to RGB conversion
      vec3 hsl2rgb(vec3 c) {
        vec3 rgb = clamp(abs(mod(c.x * 6.0 + vec3(0.0, 4.0, 2.0), 6.0) - 3.0) - 1.0, 0.0, 1.0);
        return c.z * mix(vec3(1.0), rgb, c.y);
      }

      // 2D Random
      float random(vec2 st) {
        return fract(sin(dot(st.xy, vec2(12.9898, 78.233))) * 43758.5453123);
      }

      // 2D Noise
      float noise(vec2 st) {
        vec2 i = floor(st);
        vec2 f = fract(st);
        float a = random(i);
        float b = random(i + vec2(1.0, 0.0));
        float c = random(i + vec2(0.0, 1.0));
        float d = random(i + vec2(1.0, 1.0));
        vec2 u = f * f * (3.0 - 2.0 * f);
        return mix(a, b, u.x) + (c - a) * u.y * (1.0 - u.x) + (d - b) * u.y * u.x;
      }

      // Fractional Brownian Motion — 6 octaves for rich detail
      float fbm(vec2 st) {
        float value = 0.0;
        float amplitude = 0.5;
        for (int i = 0; i < 6; i++) {
          value += amplitude * noise(st);
          st *= 2.0;
          amplitude *= 0.5;
        }
        return value;
      }

      void main() {
        vec2 uv = (gl_FragCoord.xy - 0.5 * u_resolution.xy) / min(u_resolution.y, u_resolution.x);
        uv *= u_zoom;

        // Mouse warp — subtle parallax
        vec2 mouse_normalized = u_mouse / u_resolution;
        uv += (mouse_normalized - 0.5) * 0.8;

        // Time-varying warped noise — two-pass for organic nebula shapes
        float f = fbm(uv + vec2(u_time * 0.1, u_time * 0.05));
        float t = fbm(uv + f + vec2(u_time * 0.05, u_time * 0.02));

        // Shape the nebula — power curve creates dark voids + bright cores
        float nebula = pow(t, 2.0);

        // HSL color — hue shifts slightly through the nebula for depth
        vec3 color = hsl2rgb(vec3(u_hue / 360.0 + nebula * 0.15, 0.7, 0.5));
        color *= nebula * u_nebula_intensity;

        // Starfield — scattered point stars with warm tint
        float star_val = random(vUv * u_star_density);
        if (star_val > 0.998) {
          float star_brightness = (star_val - 0.998) / 0.002;
          // Warm-tinted stars to match gold theme
          vec3 starColor = mix(vec3(1.0, 0.95, 0.85), vec3(1.0), star_brightness);
          color += starColor * star_brightness * u_particle_size;
        }

        // Dimmer background stars — more numerous
        float star_val2 = random(vUv * u_star_density * 1.7 + vec2(42.0, 17.0));
        if (star_val2 > 0.997) {
          float star_brightness2 = (star_val2 - 0.997) / 0.003;
          color += vec3(0.9, 0.88, 0.82) * star_brightness2 * 0.4;
        }

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
          u_hue: { value: hue },
          u_zoom: { value: zoom },
          u_particle_size: { value: particleSize },
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

    const resize = () => {
      const { clientWidth, clientHeight } = currentMount;
      if (clientWidth === 0 || clientHeight === 0) return;
      renderer.setSize(clientWidth, clientHeight);
      material.uniforms.u_resolution.value.set(
        clientWidth * Math.min(window.devicePixelRatio, 2),
        clientHeight * Math.min(window.devicePixelRatio, 2)
      );
      camera.updateProjectionMatrix();
    };

    const onMouseMove = (event: MouseEvent) => {
      const rect = currentMount.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio, 2);
      mouse.x = event.clientX - rect.left;
      mouse.y = event.clientY - rect.top;
      material.uniforms.u_mouse.value.set(
        mouse.x * dpr,
        (currentMount.clientHeight - mouse.y) * dpr
      );
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
  }, [hue, speed, zoom, particleSize, starDensity, nebulaIntensity]);

  return <div ref={mountRef} className={className || "w-full h-full"} />;
};

export default CelestialSphere;
