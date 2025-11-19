import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { OrbitControls, Line, Text } from '@react-three/drei'
import { useState, useRef, useEffect, useCallback, useMemo } from 'react'
import * as THREE from 'three'

// --- CONFIGURATION ---
const PARTICLE_COUNT_INNER = 15000;
const PARTICLE_COUNT_OUTER = 35000;
const MAX_GALAXY_RADIUS = 45; // Galaxy width is 90 units
const CAMERA_FOV = 60;
const REFERENCE_Z = 25; // Base distance for target visual size (Landscape distance)

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

// --- RESPONSIVE CAMERA CONTROLLER & STATE PUSHER ---

// 1. Component to read the camera Z position and push it to parent state
function CameraState({ setCameraZ }) {
  const { camera, size } = useThree();
  const tanHalfFOV = useMemo(() => Math.tan(THREE.MathUtils.degToRad(CAMERA_FOV / 2)), []);
  const controlsRef = useRef();

  // Use a ref to store the previous Z to prevent redundant updates
  const lastZ = useRef(0);

  // Calculate new camera position on resize
  useEffect(() => {
    const aspect = size.width / size.height;
    const objectWidth = MAX_GALAXY_RADIUS * 2; 

    const requiredZ = objectWidth / (2 * tanHalfFOV * aspect); 
    
    let finalZ = requiredZ * 1.05;
    finalZ = Math.min(Math.max(finalZ, 20), 200); 

    if (aspect > 1.2) {
      finalZ = REFERENCE_Z; // Landscape: Z=25
    }

    camera.position.set(0, 2, finalZ); 
    camera.updateProjectionMatrix();
    
    // Update controls and push state to parent
    if (controlsRef.current) {
      controlsRef.current.target.set(0, 0, 0);
      controlsRef.current.update();
    }
    
    // Only update parent state if the Z value has changed significantly
    if (Math.abs(lastZ.current - finalZ) > 1) {
        setCameraZ(finalZ);
        lastZ.current = finalZ;
    }

  }, [size, camera, tanHalfFOV, setCameraZ]);

  // Read camera Z position on every frame if the user is dragging (for smooth line/node scaling)
  useFrame(() => {
    const currentZ = camera.position.z;
    if (Math.abs(lastZ.current - currentZ) > 1) {
        setCameraZ(currentZ);
        lastZ.current = currentZ;
    }
  });

  return (
    <OrbitControls 
      ref={controlsRef}
      enableDamping 
      dampingFactor={0.05} 
      minDistance={5} 
      maxDistance={200}
      enablePan={false}
    />
  );
}

// --- PARTICLE SHADER (remains the same) ---
const ParticleShaderMaterial = {
  vertexShader: `
    uniform float time;
    attribute float sizes;
    attribute vec4 shift;
    varying vec3 vColor;
    void main() {
      vec3 color1 = vec3(227., 155., 0.) / 255.; 
      vec3 color2 = vec3(100., 50., 255.) / 255.; 
      
      vec3 newPos = position;
      float t = time;
      float moveT = mod(shift.x + shift.z * t, 6.28318); 
      float moveS = mod(shift.y + shift.z * t, 6.28318);
      newPos += vec3(cos(moveS) * sin(moveT), cos(moveT), sin(moveS) * sin(moveT)) * shift.w;
      
      float d = length(abs(position) / vec3(${MAX_GALAXY_RADIUS}., 10., ${MAX_GALAXY_RADIUS}.));
      d = clamp(d, 0., 1.);
      vColor = mix(color1, color2, d);
      
      vec4 mvPosition = modelViewMatrix * vec4(newPos, 1.0);
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

// --- FUSION PARTICLE PLANET (remains the same) ---
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
      const r = Math.random() * 3.0 + 8.0; 
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

    // Outer Shell
    for (let i = 0; i < PARTICLE_COUNT_OUTER; i++) {
      const r = 12; 
      const R = MAX_GALAXY_RADIUS;
      const rand = Math.pow(Math.random(), 1.5);
      const radius = Math.sqrt(R * R * rand + (1 - rand) * r * r);
      const theta = Math.random() * 2 * Math.PI;
      const y = (Math.random() - 0.5) * 12.0; 

      const v = new THREE.Vector3().setFromCylindricalCoords(radius, theta, y);
      
      positions[ptr * 3] = v.x;
      positions[ptr * 3 + 1] = v.y;
      positions[ptr * 3 + 2] = v.z;
      
      sizes[ptr] = Math.random() * 2.5 + 1.0; 
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
      mesh.current.rotation.z = 0.1; 
      mesh.current.rotation.x = -0.2; 
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

// --- AXIOMATIC NODE (Dynamically scaled) ---
function GlyphNode({ id, position, color, name, onSelect, cameraZ }) {
  const meshRef = useRef();

  // --- Dynamic Scaling Logic (Using reliable cameraZ prop) ---
  const currentZ = Math.max(cameraZ, 1); 
  const distanceRatio = currentZ / REFERENCE_Z; 
  
  // Use a slight "boost" in the numerator for far-away nodes (portrait mode)
  const nodeScale = (3.0 * 1.2) / distanceRatio; 
  const labelScale = (1.5 * 1.2) / distanceRatio;

  // --- Animation and Click ---
  useFrame((state, delta) => {
    if (meshRef.current) {
      meshRef.current.rotation.x += delta * 0.2
      meshRef.current.rotation.y += delta * 0.1
    }
  })

  const handleClick = useCallback((e) => {
    // This is the key fix for clickability on mobile
    e.stopPropagation(); 
    onSelect(id);
  }, [id, onSelect]);

  return (
    // Clickable group
    <group position={position} onClick={handleClick}>
      
      {/* 1. Wireframe Icosahedron */}
      <mesh ref={meshRef}>
        <icosahedronGeometry args={[nodeScale, 0]} /> 
        <meshBasicMaterial color={color} wireframe thickness={0.15} />
      </mesh>
      
      {/* 2. Transparent Sphere (The actual easy-to-click target) */}
      <mesh>
        <sphereGeometry args={[nodeScale * 1.1, 16, 16]} />
        {/* The object opacity is 0.0, making it invisible but fully clickable */}
        <meshBasicMaterial color={color} transparent opacity={0.0} /> 
      </mesh>
      
      {/* 3. Text Label (Fixed position relative to node scale) */}
      <group position={[0, nodeScale + 0.3, 0]}>
         <Text
            fontSize={labelScale}
            color="white"
            anchorX="center"
            anchorY="middle"
            outlineWidth={0.03}
            outlineColor="black"
            depthTest={false} 
          >
            {name}
          </Text>
      </group>
    </group>
  )
}

// --- MAIN APP ---
export default function App() {
  const [nodes] = useState(INITIAL_SYSTEM_STATE.nodes)
  const [constraints] = useState(INITIAL_SYSTEM_STATE.constraints)
  // New state to hold the dynamically updated camera Z position
  const [cameraZ, setCameraZ] = useState(REFERENCE_Z); 

  const handleNodeSelect = (id) => {
    console.log("Node Selected:", id);
    // You can now add UI feedback here, as clicking is fixed.
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

  // Calculate dynamic line width based on reliable cameraZ state
  const lineDistanceRatio = Math.max(cameraZ, 1) / REFERENCE_Z; 
  // Base line width of 4.0 at Z=25. Divide by the ratio. Use the 1.2 boost for consistency.
  const dynamicLineWidth = (4.0 * 1.2) / lineDistanceRatio;


  return (
    // CSS is final and locks the screen height
    <div 
      style={{ 
        position: 'fixed', 
        inset: 0, 
        width: '100vw', 
        height: '100vh',
        height: '100lvh',
        height: '100svh', 
        cursor: 'pointer'
      }} 
      className="bg-black overflow-hidden touch-none"
    >
      {/* HUD (remains the same) */}
      <div style={{
        position: 'absolute', top: 20, left: 20, zIndex: 10,
        color: 'cyan', fontFamily: 'monospace', pointerEvents: 'none',
        textShadow: '0 0 10px cyan'
      }}>
        CAPSULE OS | **DEX View** <br/>
        Status: IMMERSION LOCK <br/>
        Input: TOUCH ENABLED
      </div>

      <Canvas dpr={[1, 2]} camera={{ fov: CAMERA_FOV }}>
        {/* Pass the state setter down */}
        <CameraState setCameraZ={setCameraZ} />
        
        <ParticlePlanet />

        {nodes.map(node => (
          <GlyphNode 
            key={node.id}
            {...node}
            onSelect={handleNodeSelect}
            cameraZ={cameraZ} // Pass the reliable Z position down
          />
        ))}

        {/* Dynamic Line Width (Lattice Constraints) */}
        {linePoints.map((l, i) => (
          <Line 
            key={i} 
            points={[l.start, l.end]} 
            color={l.color} 
            lineWidth={dynamicLineWidth} // Use reliable dynamic width
            transparent 
            opacity={0.5} 
          />
        ))}
      </Canvas>
    </div>
  )
}
