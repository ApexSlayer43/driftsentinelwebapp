"use client"

import { useEffect, useRef } from "react"
import * as THREE from "three"

interface MorphingLightProps {
  /** Animation speed multiplier. Default 0.6 for cooldown (slow breathing). */
  speed?: number
  /** CSS class for the container */
  className?: string
}

/**
 * Morphing Light — WebGL shader visual for Cooldown Mode.
 *
 * Full-screen fragment shader creating an organic, breathing light sphere.
 * Adapted from 21st.dev morphing-light with Drift Sentinel color palette:
 *   - Deep blue core → brand teal (#22D3EE) → green edge
 *   - Slowed to 0.6x for meditative breathing rhythm
 *
 * Used as the background visual during cooldown interventions.
 * The 8-second silence before the Senti prompt lets this visual do its work.
 */
export function MorphingLight({ speed = 0.6, className = "" }: MorphingLightProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const sceneRef = useRef<{
    camera?: THREE.Camera
    scene?: THREE.Scene
    renderer?: THREE.WebGLRenderer
    clock?: THREE.Clock
    uniforms?: Record<string, { type: string; value: number | THREE.Vector2 }>
    animationId?: number
  }>({})

  useEffect(() => {
    if (!containerRef.current) return
    const container = containerRef.current

    const vertexShader = `
      void main() {
        gl_Position = vec4(position, 1.0);
      }
    `

    // Fragment shader — morphing light with DS color palette
    // Deep navy void → breathing teal/cyan core → no pink/magenta
    const fragmentShader = `
      precision highp float;
      uniform vec2 u_resolution;
      uniform float u_time;

      void main() {
        vec2 uv = (gl_FragCoord.xy - u_resolution * 0.5) / u_resolution.yy;

        // Rotate UVs by -90 degrees
        float angle = -1.5708;
        mat2 rotation = mat2(cos(angle), -sin(angle),
                             sin(angle),  cos(angle));
        uv = rotation * uv;

        float c = distance(uv, vec2(0.0));
        float a = u_time * 2.5;

        // Organic distortion pattern — used for breathing movement
        float wave1 = sin(c * 4.0 + a) * 0.5 + 0.5;
        float wave2 = sin(c * 8.0 + a * 0.7) * 0.5 + 0.5;
        float wave3 = sin(c * 2.0 - a * 0.4 + uv.x * 3.0) * 0.5 + 0.5;
        float pattern = mix(wave1, wave2, wave3);

        // Three DS palette anchors
        vec3 deepNavy = vec3(0.02, 0.04, 0.12);    // Almost black — the void
        vec3 midBlue  = vec3(0.06, 0.16, 0.55);    // Deep blue
        vec3 teal     = vec3(0.13, 0.83, 0.93);    // #22D3EE brand cyan

        // Radial gradient: teal center → blue → navy edge
        float radialFade = smoothstep(0.0, 0.7, c);
        vec3 baseColor = mix(teal, midBlue, radialFade);
        baseColor = mix(baseColor, deepNavy, smoothstep(0.4, 1.0, c));

        // Breathing brightness modulation from pattern
        float brightness = 0.6 + pattern * 0.6;
        vec3 color = baseColor * brightness;

        // Hot white core glow — tight center bloom
        float coreGlow = exp(-c * c * 12.0);
        color += vec3(0.7, 0.9, 1.0) * coreGlow * (0.5 + 0.3 * sin(a * 0.5));

        // Subtle teal atmospheric scatter
        float scatter = exp(-c * c * 3.0) * pattern * 0.15;
        color += teal * scatter;

        gl_FragColor = vec4(color, 1.0);
      }
    `

    const clock = new THREE.Clock()
    const camera = new THREE.Camera()
    camera.position.z = 1

    const scene = new THREE.Scene()
    const geometry = new THREE.PlaneGeometry(2, 2)

    const uniforms = {
      u_time: { type: "f", value: 1.0 },
      u_resolution: { type: "v2", value: new THREE.Vector2() },
    }

    const material = new THREE.ShaderMaterial({
      uniforms,
      vertexShader,
      fragmentShader,
    })

    const mesh = new THREE.Mesh(geometry, material)
    scene.add(mesh)

    const renderer = new THREE.WebGLRenderer({ antialias: true })
    renderer.setPixelRatio(window.devicePixelRatio)
    container.appendChild(renderer.domElement)

    sceneRef.current = { camera, scene, renderer, clock, uniforms }

    const onResize = () => {
      const w = container.clientWidth
      const h = container.clientHeight
      renderer.setSize(w, h)
      uniforms.u_resolution.value.x = renderer.domElement.width
      uniforms.u_resolution.value.y = renderer.domElement.height
    }

    const animate = () => {
      if (!sceneRef.current.uniforms || !sceneRef.current.clock) return
      // Apply speed multiplier for breathing rhythm
      sceneRef.current.uniforms.u_time.value =
        sceneRef.current.clock.getElapsedTime() * speed
      renderer.render(scene, camera)
      sceneRef.current.animationId = requestAnimationFrame(animate)
    }

    onResize()
    window.addEventListener("resize", onResize)
    animate()

    return () => {
      window.removeEventListener("resize", onResize)
      if (sceneRef.current.animationId) {
        cancelAnimationFrame(sceneRef.current.animationId)
      }
      if (sceneRef.current.renderer) {
        container.removeChild(sceneRef.current.renderer.domElement)
        sceneRef.current.renderer.dispose()
      }
      geometry.dispose()
      material.dispose()
    }
  }, [speed])

  return (
    <div
      ref={containerRef}
      className={`absolute inset-0 -z-10 ${className}`}
    />
  )
}
