import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { OrbitControls, Line, Text } from '@react-three/drei'
import { useState, useRef, useEffect, useCallback, useMemo } from 'react'
import * as THREE from 'three'

// --- CONFIGURATION ---
const PARTICLE_COUNT_INNER = 15000;
const PARTICLE_COUNT_OUTER = 35000;

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

// --- RESPONSIVE CAMERA CONTROLLER ---
// Automatically adjusts zoom based on screen orientation
function ResponsiveCamera() {
  const { camera, size } = useThree();
  
  useEffect(() => {
    const aspect = size.width / size.height;
    // If Portrait (aspect < 1), move camera BACK to fit the width
    // If Landscape (aspect > 1), move camera CLOSER for detail
    const targetZ = aspect < 1 ? 35 : 18;
    
    camera.position.set(0, 2, targetZ);
    camera.updateProjectionMatrix();
  }, [size, camera]);

  return null;
}

// --- PARTICLE SHADER ---
const ParticleShaderMaterial = {
  vertexShader: `
    uniform float time;
    attribute float sizes;
    attribute vec4 shift;
    varying vec3 vColor;
    void main() {
      vec3 color1 = vec3(227., 155., 0.) / 255.; // Orange
      vec3 color2 = vec3(100., 50., 255.) / 255.; // Purple
      
      vec3 newPos = position;
      float t = time;
      // Orbital mechanics
      float moveT = mod(shift.x + shift.z * t, 6.28318); 
      float moveS = mod(shift.y + shift.z * t, 6.28318);
      newPos += vec3(cos(moveS) * sin(moveT), cos(moveT), sin(moveS) * sin(moveT)) * shift.w;
      
      float d = length(abs(position) / vec3(40., 10., 40.));
      d = clamp(d, 0., 1.);
      vColor = mix(color1, color2, d);
      
      vec4 mvPosition = modelViewMatrix * vec4(newPos, 1.0);
      // Boost size for mobile visibility
      gl_PointSize = sizes * (30.0 / -mvPosition.z);
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

// --- FUSION PARTICLE PLANET ---
function ParticlePlanet() {
  const mesh = useRef();
  
  const { positions, sizes, shifts } = useMemo(() => {
    const particles = PARTICLE_COUNT_INNER + PARTICLE_COUNT_OUTER;
    const positions = new Float32Array(particles * 3);
    const sizes = new Float32Array(particles);
    const shifts = new Float32Array(particles * 4);

    let ptr = 0;

    // Inner Core (Volumetric Sphere)
    for (let i = 0; i < PARTICLE_COUNT_INNER; i++) {
      const r = Math.random() * 3.0 + 8.0; // Thicker core (8-11 radius)
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      
      positions[ptr * 3] = r * Math.sin(phi) * Math.cos(theta);
      positions[ptr * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
      positions[ptr * 3 + 2] = r * Math.cos(phi);
      
      sizes[ptr] = Math.random() * 2.0 + 1.0;
      shifts[ptr * 4] = Math.random() * Math.PI;
      shifts[ptr * 4 + 1] = Math.random() * Math.PI * 2;
      shifts[ptr * 4 + 2] = (Math.random() * 0.9 + 0.1) * Math.PI * 0.1;
      shifts[ptr * 4 + 3] = Math.random() * 0.9 + 0.1;
      ptr++;
    }

    // Outer Shell (Thickened Galaxy)
    for (let i = 0; i < PARTICLE_COUNT_OUTER; i++) {
      const r = 12; 
      const R = 45; // Wider galaxy
      const rand = Math.pow(Math.random(), 1.5);
      const radius = Math.sqrt(R * R * rand + (1 - rand) * r * r);
      const theta = Math.random() * 2 * Math.PI;
      
      // Vertical spread (Y) increased from 2.0 to 12.0 to fill mobile screen
      const y = (Math.random() - 0.5) * 12.0; 

      const v = new THREE.Vector3().setFromCylindricalCoords(radius, theta, y);
      
      positions[ptr * 3] = v.x;
      positions[ptr * 3 + 1] = v.y;
      positions[ptr * 3 + 2] = v.z;
      
      sizes[ptr] = Math.random() * 2.5 + 1.0; // Big bright stars
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
      mesh.current.rotation.z = 0.1; // Gentle tilt
      mesh.current.rotation.x = -0.2; // Tilt toward camera to show "face" of galaxy
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

// --- AXIOMATIC NODE (Satellites) ---
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
        <icosahedronGeometry args={[0.8, 0]} /> 
        <meshBasicMaterial color={color} wireframe thickness={0.15} />
      </mesh>
      <mesh>
        <sphereGeometry args={[0.9, 16, 16]} />
        <meshBasicMaterial color={color} transparent opacity={0.15} />
      </mesh>
      <group position={[0, 1.2, 0]}>
         <Text
            fontSize={0.4}
            color="white"
            anchorX="center"
            anchorY="middle"
            outlineWidth={0.03}
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
    console.log("Node Selected:", id);
    // Add haptic feedback here later
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
    // CSS FIX: 100dvh (Dynamic Viewport Height) fixes the address bar scroll issue
    <div className="fixed inset-0 w-full h-[100dvh] bg-black overflow-hidden touch-none">
      {/* HUD */}
      <div style={{
        position: 'absolute', top: 'safe-area-inset-top', left: 20, zIndex: 10, marginTop: 20,
        color: 'cyan', fontFamily: 'monospace', pointerEvents: 'none',
        textShadow: '0 0 10px cyan'
      }}>
        CAPSULE OS | **DEX View** <br/>
        Status: IMMERSION LOCK <br/>
        Input: TOUCH ENABLED
      </div>

      <Canvas dpr={[1, 2]}>
        <ResponsiveCamera />
        <OrbitControls 
          enableDamping 
          dampingFactor={0.05} 
          minDistance={5} 
          maxDistance={80}
          enablePan={false}
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
            lineWidth={1.5} 
            transparent 
            opacity={0.5} 
          />
        ))}
      </Canvas>
    </div>
  )
}
