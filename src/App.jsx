import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { OrbitControls, Line, Text } from '@react-three/drei'
import { useState, useRef, useEffect, useCallback, useMemo } from 'react'
import * as THREE from 'three'

// --- CONFIGURATION ---
const PARTICLE_COUNT_INNER = 15000;
const PARTICLE_COUNT_OUTER = 35000;
const MAX_GALAXY_RADIUS = 45; // Galaxy width is 90 units
const CAMERA_FOV = 60;

// Base camera distances used by ResponsiveCamera
const LANDSCAPE_Z = 25; 
const PORTRAIT_Z = 160; 
const Z_RATIO = PORTRAIT_Z / LANDSCAPE_Z; // ~6.4

// Scaling factor for visual pop in portrait mode (optional but good for visual feel)
const SCALE_BOOST = 1.2;

// Base size multiplier. Nodes will be scaled from this base.
const BASE_NODE_RADIUS = 3.0;
const BASE_LABEL_SIZE = 1.5;
const BASE_LINE_WIDTH = 4.0;

// --- AXIOMATIC DATA (Remains the same) ---
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

// --- CAMERA CONTROLLER & SIZE STATE (Updated Camera Z logic) ---
function ResponsiveCamera({ setAspect }) {
  const { camera, size } = useThree();
  const tanHalfFOV = useMemo(() => Math.tan(THREE.MathUtils.degToRad(CAMERA_FOV / 2)), []);
  const controlsRef = useRef();

  useEffect(() => {
    const aspect = size.width / size.height;
    const objectWidth = MAX_GALAXY_RADIUS * 2; 

    const requiredZ = objectWidth / (2 * tanHalfFOV * aspect); 
    
    let finalZ = requiredZ * 1.05;
    finalZ = Math.min(Math.max(finalZ, 20), 200); 

    if (aspect > 1.2) {
      finalZ = LANDSCAPE_Z; // Landscape is close
    } else {
        finalZ = PORTRAIT_Z; // Portrait is far
    }


    camera.position.set(0, 2, finalZ); 
    camera.updateProjectionMatrix();
    
    if (controlsRef.current) {
      controlsRef.current.target.set(0, 0, 0);
      controlsRef.current.update();
    }
    
    // Pass the aspect ratio up to the parent App component
    setAspect(aspect);

  }, [size, camera, tanHalfFOV, setAspect]);

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
    
        // Inner Core & Outer Shell Logic (omitted for brevity, remains unchanged)
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

// --- AXIOMATIC NODE (Fixed scale based on orientation) ---
function GlyphNode({ id, position, color, name, onSelect, orientationScale }) {
  const meshRef = useRef();

  // Scale is calculated by multiplying the base size by the factor determined in App
  const nodeScale = BASE_NODE_RADIUS * orientationScale;
  const labelScale = BASE_LABEL_SIZE * orientationScale;

  // --- Animation and Click (remains the same) ---
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
      
      {/* 1. Wireframe Icosahedron */}
      <mesh ref={meshRef}>
        <icosahedronGeometry args={[nodeScale, 0]} /> 
        <meshBasicMaterial color={color} wireframe thickness={0.15 * orientationScale} />
      </mesh>
      
      {/* 2. Transparent Sphere (Click target) */}
      <mesh>
        <sphereGeometry args={[nodeScale * 1.1, 16, 16]} />
        <meshBasicMaterial color={color} transparent opacity={0.0} /> 
      </mesh>
      
      {/* 3. Text Label */}
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
  const [nodes] = useState(INITIAL_SYSTEM_STATE.nodes);
  const [constraints] = useState(INITIAL_SYSTEM_STATE.constraints);
  const [aspect, setAspect] = useState(1); 

  const handleNodeSelect = (id) => {
    console.log("Node Selected:", id);
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

  // FIX: Calculate the scale factor based on orientation.
  
  let orientationScale = 1.0; 
  
  if (aspect > 1.2) {
    // 1. LANDSCAPE (Aspect > 1.2): Camera is CLOSE (Z=25). 
    // To keep visual size constant, geometric size must be scaled DOWN by Z_RATIO.
    orientationScale = (1 / Z_RATIO) * SCALE_BOOST; 
  } else {
    // 2. PORTRAIT (Aspect < 1.2): Camera is FAR (Z=160).
    // To keep visual size constant, geometric size must be scaled UP by the Z_RATIO.
    // However, since we are using 1.0 as the base, we only need a small boost.
    orientationScale = 1.0 * SCALE_BOOST; 
  }

  const dynamicLineWidth = BASE_LINE_WIDTH * orientationScale;

  return (
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
      {/* HUD (omitted for brevity, remains unchanged) */}
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
        <ResponsiveCamera setAspect={setAspect} />
        
        <ParticlePlanet />

        {nodes.map(node => (
          <GlyphNode 
            key={node.id}
            {...node}
            onSelect={handleNodeSelect}
            orientationScale={orientationScale} // Pass orientation scale factor
          />
        ))}

        {/* Dynamic Line Width (Lattice Constraints) */}
        {linePoints.map((l, i) => (
          <Line 
            key={i} 
            points={[l.start, l.end]} 
            color={l.color} 
            lineWidth={dynamicLineWidth} // Use orientation scale
            transparent 
            opacity={0.5} 
          />
        ))}
      </Canvas>
    </div>
  )
}

// --- CONFIGURATION ---
// ... (The top of the file remains unchanged)

// Base camera distances used by ResponsiveCamera
const LANDSCAPE_Z = 25; 
const PORTRAIT_Z = 160; 
const Z_RATIO = PORTRAIT_Z / LANDSCAPE_Z; // ~6.4

// Scaling factor for visual pop in portrait mode (optional but good for visual feel)
// We will now use this to fine-tune the size instead of boosting it.
const TARGET_NODE_SCALE = 0.5; // New constant to define the desired small size.

// Base size multiplier. Nodes will be scaled from this base.
const BASE_NODE_RADIUS = 3.0;
const BASE_LABEL_SIZE = 1.5;
const BASE_LINE_WIDTH = 4.0;

// ... (The rest of the file down to the App component remains unchanged)


// --- MAIN APP ---
export default function App() {
  const [nodes] = useState(INITIAL_SYSTEM_STATE.nodes);
  const [constraints] = useState(INITIAL_SYSTEM_STATE.constraints);
  const [aspect, setAspect] = useState(1); 

  // ... (handleNodeSelect and linePoints remain unchanged)

  // FIX: Calculate the scale factor based on orientation.
  
  let orientationScale = 1.0; 
  
  if (aspect > 1.2) {
    // 1. LANDSCAPE (Aspect > 1.2): Camera is CLOSE (Z=25). 
    // We want the nodes to be small. We use the TARGET_NODE_SCALE.
    orientationScale = TARGET_NODE_SCALE;
  } else {
    // 2. PORTRAIT (Aspect < 1.2): Camera is FAR (Z=160).
    // To achieve the same small *visual* size as Landscape (Z=25, scale=0.5), 
    // we must multiply the Landscape scale (0.5) by the Z_RATIO (~6.4) to compensate
    // for the distance. 
    // However, since the camera is already adjusted to be far away, 
    // we only need to apply the TARGET_NODE_SCALE.
    orientationScale = TARGET_NODE_SCALE;
  }

  // The Landscape camera is closer, which means the nodes LOOK bigger by default.
  // The Portrait camera is farther, which means the nodes LOOK smaller by default.
  // BUT the ResponsiveCamera forces the Z distance based on aspect ratio.

  // The actual fix is to keep the geometric scale small and let the ResponsiveCamera
  // do the framing, which implicitly sets the visual size.

  if (aspect > 1.2) {
      // Landscape: Camera is Z=25. The nodes are 6.4x closer. Scale DOWN geometric size.
      orientationScale = 1 / Z_RATIO;
  } else {
      // Portrait: Camera is Z=160. Scale up to compensate for distance (if desired),
      // or keep a medium size. We want the nodes to be small. 
      // The ratio (1/Z_RATIO) worked well for the visual size in Landscape.
      // We will now use that same small base scale for Portrait.
      orientationScale = 1 / Z_RATIO;
  }
  
  // Final, simpler approach that should work:
  // Apply a small constant scale in both cases, which is what worked for Landscape.
  const FINAL_SMALL_SCALE = 1 / Z_RATIO; // This is the small factor that worked for Landscape
  orientationScale = FINAL_SMALL_SCALE;
  // If the nodes are too small now in Portrait, uncomment the Portrait override below:
  /*
  if (aspect < 1.2) {
      // If Portrait is too small, increase its scale to compensate for the far camera.
      // This is the source of our original problem, so we avoid it unless necessary.
      // Let's stick with the FINAL_SMALL_SCALE for both for now.
  }
  */

  const dynamicLineWidth = BASE_LINE_WIDTH * orientationScale;


  return (
    // ... (The return block remains unchanged) ...
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
      {/* HUD (omitted for brevity, remains unchanged) */}
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
        <ResponsiveCamera setAspect={setAspect} />
        
        <ParticlePlanet />

        {nodes.map(node => (
          <GlyphNode 
            key={node.id}
            {...node}
            onSelect={handleNodeSelect}
            orientationScale={orientationScale} // Use the FINAL_SMALL_SCALE for both
          />
        ))}

        {/* Dynamic Line Width (Lattice Constraints) */}
        {linePoints.map((l, i) => (
          <Line 
            key={i} 
            points={[l.start, l.end]} 
            color={l.color} 
            lineWidth={dynamicLineWidth} // Use orientation scale
            transparent 
            opacity={0.5} 
          />
        ))}
      </Canvas>
    </div>
  )
}
