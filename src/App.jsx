import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { OrbitControls, Line, Text } from '@react-three/drei'
import { useState, useRef, useEffect, useCallback, useMemo } from 'react'
import * as THREE from 'three'

// --- FIREBASE IMPORTS (Keep your existing config) ---
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, doc, setDoc, onSnapshot } from 'firebase/firestore';

// --- CONFIGURATION ---
// Boosted particle count for "Galaxy" density
const PARTICLE_COUNT_INNER = 20000;
const PARTICLE_COUNT_OUTER = 40000;

// --- AXIOMATIC DATA ---
const INITIAL_SYSTEM_STATE = {
  nodes: [
    { id: 'rag-orch', name: 'Multi-Agent RAG', color: '#00ffff', position: [3.5, 1.0, 0] },
    { id: 'glyph-eng', name: 'GΛLYPH Engine', color: '#32cd32', position: [-3.5, 1.0, 0] },
    { id: 'vgm-anchor', name: 'VGM Anchor', color: '#00ffff', position: [0, 4.0, -2.0] },
    { id: 'manifold', name: 'Manifold Constraint', color: '#32cd32', position: [0, -4.0, 2.0] },
    { id: 'hax', name: 'HIL Agent X', color: '#ffaa00', position: [4.5, -1.0, -1.0] },
  ],
  constraints: [
    ['rag-orch', 'glyph-eng', '#32cd32'],
    ['rag-orch', 'vgm-anchor', '#00ffff'],
    ['glyph-eng', 'manifold', '#32cd32'],
    ['vgm-anchor', 'hax', '#ffaa00'],
    ['manifold', 'hax', '#ffaa00'],
  ],
};

// --- PARTICLE PLANET SHADER MATERIAL ---
const ParticleShaderMaterial = {
  vertexShader: `
    uniform float time;
    attribute float sizes;
    attribute vec4 shift;
    varying vec3 vColor;
    void main() {
      vec3 color1 = vec3(227., 155., 0.) / 255.; // Orange Core
      vec3 color2 = vec3(100., 50., 255.) / 255.; // Purple Outer
      
      vec3 newPos = position;
      
      float t = time;
      float moveT = mod(shift.x + shift.z * t, 6.28318);
      float moveS = mod(shift.y + shift.z * t, 6.28318);
      
      newPos += vec3(cos(moveS) * sin(moveT), cos(moveT), sin(moveS) * sin(moveT)) * shift.w;
      
      float d = length(abs(position) / vec3(40., 10., 40.));
      d = clamp(d, 0., 1.);
      
      vColor = mix(color1, color2, d);
      
      vec4 mvPosition = modelViewMatrix * vec4(newPos, 1.0);
      // Increased size multiplier (20.0) for mobile visibility
      gl_PointSize = sizes * (20.0 / -mvPosition.z);
      gl_Position = projectionMatrix * mvPosition;
    }
  `,
  fragmentShader: `
    varying vec3 vColor;
    void main() {
      float d = length(gl_PointCoord.xy - 0.5);
      if (d > 0.5) discard;
      gl_FragColor = vec4(vColor, smoothstep(0.5, 0.1, d));
    }
  `
};

// --- COMPONENT: FUSION PARTICLE PLANET ---
function ParticlePlanet() {
  const mesh = useRef();
  
  const { positions, sizes, shifts } = useMemo(() => {
    const particles = PARTICLE_COUNT_INNER + PARTICLE_COUNT_OUTER;
    const positions = new Float32Array(particles * 3);
    const sizes = new Float32Array(particles);
    const shifts = new Float32Array(particles * 4);

    let ptr = 0;

    // Inner Core
    for (let i = 0; i < PARTICLE_COUNT_INNER; i++) {
      const r = Math.random() * 0.5 + 9.5;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      
      positions[ptr * 3] = r * Math.sin(phi) * Math.cos(theta);
      positions[ptr * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
      positions[ptr * 3 + 2] = r * Math.cos(phi);
      
      // Larger particles for core
      sizes[ptr] = Math.random() * 2.0 + 1.0; 
      shifts[ptr * 4] = Math.random() * Math.PI;
      shifts[ptr * 4 + 1] = Math.random() * Math.PI * 2;
      shifts[ptr * 4 + 2] = (Math.random() * 0.9 + 0.1) * Math.PI * 0.1;
      shifts[ptr * 4 + 3] = Math.random() * 0.9 + 0.1;
      ptr++;
    }

    // Outer Shell (Galaxy Ring)
    for (let i = 0; i < PARTICLE_COUNT_OUTER; i++) {
      const r = 10; 
      const R = 40;
      const rand = Math.pow(Math.random(), 1.5);
      const radius = Math.sqrt(R * R * rand + (1 - rand) * r * r);
      const theta = Math.random() * 2 * Math.PI;
      const y = (Math.random() - 0.5) * 2;

      const v = new THREE.Vector3().setFromCylindricalCoords(radius, theta, y);
      
      positions[ptr * 3] = v.x;
      positions[ptr * 3 + 1] = v.y;
      positions[ptr * 3 + 2] = v.z;
      
      sizes[ptr] = Math.random() * 2.0 + 1.0;
      shifts[ptr * 4] = Math.random() * Math.PI;
      shifts[ptr * 4 + 1] = Math.random() * Math.PI * 2;
      shifts[ptr * 4 + 2] = (Math.random() * 0.9 + 0.1) * Math.PI * 0.1;
      shifts[ptr * 4 + 3] = Math.random() * 0.9 + 0.1;
      ptr++;
    }

    return { positions, sizes, shifts };
  }, []);

  useFrame((state) => {
    if (mesh.current) {
      mesh.current.material.uniforms.time.value = state.clock.elapsedTime;
      mesh.current.rotation.y = state.clock.elapsedTime * 0.05;
      mesh.current.rotation.z = 0.2; 
    }
  });

  return (
    <points ref={mesh}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" count={positions.length / 3} array={positions} itemSize={3} />
        <bufferAttribute attach="attributes-sizes" count={sizes.length} array={sizes} itemSize={1} />
        <bufferAttribute attach="attributes-shift" count={shifts.length / 4} array={shifts} itemSize={4} />
      </bufferGeometry>
      <shaderMaterial
        uniforms={{ time: { value: 0 } }}
        vertexShader={ParticleShaderMaterial.vertexShader}
        fragmentShader={ParticleShaderMaterial.fragmentShader}
        transparent={true}
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </points>
  );
}

// --- AXIOMATIC NODE COMPONENT ---
function GlyphNode({ id, position, color, name, onSelect }) {
  const meshRef = useRef()
  
  useFrame((state, delta) => {
    if (meshRef.current) {
      meshRef.current.rotation.x += delta * 0.2
      meshRef.current.rotation.y += delta * 0.1
    }
  })

  const handleClick = useCallback((e) => {
    e.stopPropagation();
    onSelect(id);
  }, [id, onSelect]);

  return (
    <group position={position} onClick={handleClick}>
      <mesh ref={meshRef}>
        <icosahedronGeometry args={[0.6, 0]} /> 
        <meshBasicMaterial color={color} wireframe thickness={0.1} />
      </mesh>
      <mesh>
        <sphereGeometry args={[0.65, 16, 16]} />
        <meshBasicMaterial color={color} transparent opacity={0.1} />
      </mesh>
      <group position={[0, 0.9, 0]}>
         <Text
            fontSize={0.3}
            color="white"
            anchorX="center"
            anchorY="middle"
            outlineWidth={0.02}
            outlineColor="black"
          >
            {name}
          </Text>
      </group>
    </group>
  )
}

// --- MAIN APP ---
export default function App() {
  const [nodes, setNodes] = useState(INITIAL_SYSTEM_STATE.nodes)
  const [constraints, setConstraints] = useState(INITIAL_SYSTEM_STATE.constraints)
  
  const handleNodeSelect = (id) => {
    console.log("Axiomatic Node Selected:", id);
  }

  const linePoints = useMemo(() => {
    const nodeMap = new Map(nodes.map(n => [n.id, n.position]));
    const points = [];
    constraints.forEach(([start, end, color]) => {
      if(nodeMap.has(start) && nodeMap.has(end)) {
        points.push({ 
          start: new THREE.Vector3(...nodeMap.get(start)), 
          end: new THREE.Vector3(...nodeMap.get(end)),
          color 
        });
      }
    });
    return points;
  }, [nodes, constraints]);

  return (
    // FIXED: Use 100dvh and fixed positioning for absolute mobile coverage
    <div className="fixed inset-0 w-screen h-[100dvh] bg-black overflow-hidden">
      {/* HUD Overlay */}
      <div style={{
        position: 'absolute', top: 20, left: 20, zIndex: 10,
        color: 'cyan', fontFamily: 'monospace', pointerEvents: 'none',
        textShadow: '0 0 10px cyan'
      }}>
        CAPSULE OS | **DEX View** <br/>
        Structural Fidelity: 99.2% <br/>
        Manifold: LOCKED
      </div>

      {/* DEX View: 3D Graph */}
      <Canvas camera={{ position: [0, 2, 14], fov: 60 }}>
        <OrbitControls 
          enableDamping 
          dampingFactor={0.05} 
          minDistance={5} 
          maxDistance={50} 
        />
        
        <ParticlePlanet />

        {nodes.map(node => (
          <GlyphNode 
            key={node.id}
            {...node}
            onSelect={handleNodeSelect}
          />
        ))}

        {linePoints.map((l, i) => (
          <Line 
            key={i} 
            points={[l.start, l.end]} 
            color={l.color} 
            lineWidth={1} 
            transparent 
            opacity={0.6} 
          />
        ))}
      </Canvas>
    </div>
  )
}
