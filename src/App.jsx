// components/PlanetBackground.jsx
import { useRef, useEffect } from 'react';
import * as THREE from 'three';
import { Canvas, useFrame, extend } from '@react-three/fiber';
import { OrbitControls, Points, PointMaterial } from '@react-three/drei';
import * as dat from 'dat.gui'; // Optional for tweaking params in dev

// Extend for custom shader material if needed (but drei's PointMaterial handles basics)
extend({ OrbitControls });

// Custom shader logic adapted from the original (vertex/fragment tweaks for movement/color)
function ParticleSystem({ count = 150000 }) {
  const ref = useRef();
  const positions = useRef(new Float32Array(count * 3));
  const sizes = useRef(new Float32Array(count));
  const shifts = useRef(new Float32Array(count * 4)); // x, y, z speed, amplitude

  useEffect(() => {
    const pts = [];
    const tempSizes = [];
    const tempShifts = [];

    // Inner sphere particles (50k random directions)
    for (let i = 0; i < 50000; i++) {
      tempSizes.push(Math.random() * 1.5 + 0.5);
      tempShifts.push(
        Math.random() * Math.PI,
        Math.random() * Math.PI * 2,
        (Math.random() * 0.9 + 0.1) * Math.PI * 0.1,
        Math.random() * 0.9 + 0.1
      );
      pts.push(new THREE.Vector3().randomDirection().multiplyScalar(Math.random() * 0.5 + 9.5));
    }

    // Outer torus-like shell (100k cylindrical)
    for (let i = 0; i < 100000; i++) {
      const r = 10, R = 40;
      const rand = Math.pow(Math.random(), 1.5);
      const radius = Math.sqrt(R * R * rand + (1 - rand) * r * r);
      pts.push(new THREE.Vector3().setFromCylindricalCoords(
        radius,
        Math.random() * 2 * Math.PI,
        (Math.random() - 0.5) * 2
      ));
      tempSizes.push(Math.random() * 1.5 + 0.5);
      tempShifts.push(
        Math.random() * Math.PI,
        Math.random() * Math.PI * 2,
        (Math.random() * 0.9 + 0.1) * Math.PI * 0.1,
        Math.random() * 0.9 + 0.1
      );
    }

    // Flatten to buffers
    pts.forEach((pt, i) => {
      positions.current[i * 3] = pt.x;
      positions.current[i * 3 + 1] = pt.y;
      positions.current[i * 3 + 2] = pt.z;
    });
    sizes.current.set(tempSizes);
    shifts.current.set(new Float32Array(tempShifts.flat()));

    // Custom material with shader mods (adapted from original)
    ref.current.material = new THREE.PointsMaterial({
      size: 0.125,
      transparent: true,
      depthTest: false,
      blending: THREE.AdditiveBlending,
      onBeforeCompile: (shader) => {
        shader.uniforms.time = { value: 0 };
        shader.vertexShader = `
          uniform float time;
          attribute float particleSize;
          attribute vec4 shift;
          varying vec3 vColor;
          ${shader.vertexShader}
        `
          .replace(`gl_PointSize = size;`, `gl_PointSize = size * particleSize;`)
          .replace(
            `#include <color_vertex>`,
            `#include <color_vertex>
             float d = length(abs(position) / vec3(40., 10., 40.));
             d = clamp(d, 0., 1.);
             vColor = mix(vec3(227., 155., 0.), vec3(100., 50., 255.), d) / 255.;`
          )
          .replace(
            `#include <begin_vertex>`,
            `#include <begin_vertex>
             float t = time;
             float moveT = mod(shift.x + shift.z * t, 6.28318); // PI * 2
             float moveS = mod(shift.y + shift.z * t, 6.28318);
             transformed += vec3(cos(moveS) * sin(moveT), cos(moveT), sin(moveS) * sin(moveT)) * shift.w;`
          );
        shader.fragmentShader = `
          varying vec3 vColor;
          ${shader.fragmentShader}
        `
          .replace(
            `#include <clipping_planes_fragment>`,
            `#include <clipping_planes_fragment>
             float d = length(gl_PointCoord.xy - 0.5);`
          )
          .replace(
            `vec4 diffuseColor = vec4( diffuse, opacity );`,
            `vec4 diffuseColor = vec4( vColor, smoothstep(0.5, 0.1, d) );`
          );
      },
    });
    ref.current.geometry.setAttribute('particleSize', new THREE.Float32BufferAttribute(sizes.current, 1));
    ref.current.geometry.setAttribute('shift', new THREE.Float32BufferAttribute(shifts.current, 4));
  }, [count]);

  useFrame((state) => {
    ref.current.material.uniforms.time.value = state.clock.elapsedTime * 0.5 * Math.PI;
    ref.current.rotation.y = state.clock.elapsedTime * 0.05; // Tokenizable: getComputedStyle(document.documentElement).getPropertyValue('--animation-speed')
    ref.current.rotation.z = 0.2;
    ref.current.rotation.order = 'ZYX';
  });

  return (
    <primitive
      ref={ref}
      object={new THREE.Points(new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(positions.current, 3)))}
    />
  );
}

export default function PlanetBackground({ className }) {
  return (
    <div className={`fixed inset-0 z-0 ${className}`} style={{ backgroundColor: 'var(--planet-bg)' }}>
      <Canvas camera={{ position: [0, 4, 21], fov: 60 }}>
        <ParticleSystem />
        <OrbitControls enableDamping enablePan={false} dampingFactor={0.05} />
      </Canvas>
      {/* Ensure canvas ignores pointer events for overlays */}
      <style jsx>{`
        canvas {
          pointer-events: none;
        }
      `}</style>
    </div>
  );
}
