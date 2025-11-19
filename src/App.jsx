import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { OrbitControls, Line, Text } from '@react-three/drei'
import { useState, useRef, useEffect, useMemo, useCallback } from 'react'
import * as THREE from 'three'

// --- FIREBASE IMPORTS ---
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, doc, onSnapshot, collection, setDoc } from 'firebase/firestore';

// --- CONFIGURATION ---
const PARTICLE_COUNT_INNER = 15000;
const PARTICLE_COUNT_OUTER = 35000;
const MAX_GALAXY_RADIUS = 45; 
const CAMERA_FOV = 60;

// Base camera distances used by ResponsiveCamera
const LANDSCAPE_Z = 25; 
const PORTRAIT_Z = 160; 
const Z_RATIO = PORTRAIT_Z / LANDSCAPE_Z; 

// Geometric size constants. 
const BASE_NODE_RADIUS = 3.0;
const BASE_LABEL_SIZE = 1.5;
const BASE_LINE_WIDTH = 4.0;

// Scaling fix
const FINAL_SMALL_SCALE = 1 / Z_RATIO; 

// Firestore collection path for shared Axiomatic Nodes
const AXIOM_NODE_COLLECTION_NAME = 'axiom_nodes';


// --- AXIOMATIC DATA (Used as a fallback/initial structure) ---
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

// --- CAMERA CONTROLLER & SIZE STATE ---
function ResponsiveCamera({ setAspect, isTerminalOpen }) {
  const { camera, size } = useThree();
  const controlsRef = useRef();

  useEffect(() => {
    const aspect = size.width / size.height;
    
    let finalZ = PORTRAIT_Z;

    if (aspect > 1.2) {
      finalZ = LANDSCAPE_Z; 
    }
    
    camera.position.set(0, 2, finalZ); 
    camera.updateProjectionMatrix();
    
    if (controlsRef.current) {
      controlsRef.current.target.set(0, 0, 0);
      controlsRef.current.update();
    }
    
    setAspect(aspect);

  }, [size, camera, setAspect]);

  return (
    <OrbitControls 
      ref={controlsRef}
      enableDamping 
      dampingFactor={0.05} 
      minDistance={5} 
      maxDistance={200}
      enablePan={false}
      // Disable controls when the terminal is open
      enabled={!isTerminalOpen} 
    />
  );
}

// --- PARTICLE SHADER (Unchanged) ---
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

// --- FUSION PARTICLE PLANET (Unchanged) ---
function ParticlePlanet() {
    const mesh = useRef();
  
    const { positions, sizes, shifts } = useMemo(() => {
        const particles = PARTICLE_COUNT_INNER + PARTICLE_COUNT_OUTER;
        const positions = new Float32Array(particles * 3);
        const sizes = new Float32Array(particles);
        const shifts = new Float32Array(particles * 4);
    
        let ptr = 0;
    
        // Inner Core Particles (Spherical distribution)
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
    
        // Outer Shell Particles (Disc distribution)
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

// --- AXIOMATIC NODE ---
function GlyphNode({ id, position, color, name, onSelect, orientationScale }) {
  const meshRef = useRef();

  const nodeScale = BASE_NODE_RADIUS * orientationScale;
  const labelScale = BASE_LABEL_SIZE * orientationScale;

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
  
  // Text will be rendered slightly forward (small Z offset) and with high renderOrder
  const textPosition = [0, nodeScale + 0.3, 0.1 * orientationScale]; 

  return (
    <group 
      position={position} 
      onClick={handleClick}
      onPointerOver={(e) => { e.stopPropagation(); document.body.style.cursor = 'pointer'; }}
      onPointerOut={(e) => { e.stopPropagation(); document.body.style.cursor = 'default'; }}
    >
      
      {/* 1. Transparent Sphere (Click target) - Rendered FIRST (order 0) so lines/mesh are on top */}
      <mesh renderOrder={0}>
        <sphereGeometry args={[nodeScale * 5, 16, 16]} /> 
        <meshBasicMaterial color={color} transparent opacity={0.0} /> 
      </mesh>
      
      {/* 2. Wireframe Icosahedron - Rendered SECOND (order 1) */}
      <mesh ref={meshRef} renderOrder={1}>
        <icosahedronGeometry args={[nodeScale, 0]} /> 
        <meshBasicMaterial color={color} wireframe thickness={0.15 * orientationScale} />
      </mesh>
      
      {/* 3. Text Label - Rendered LAST (order 2) for maximum visibility */}
      <group position={textPosition} renderOrder={2}>
         <Text
            fontSize={labelScale}
            color="white"
            anchorX="center"
            anchorY="middle"
            outlineWidth={0.03}
            outlineColor="black"
            // depthTest=false helps keep the text visible
            depthTest={false} 
          >
            {name}
          </Text>
      </group>
    </group>
  )
}

// --- TERMINAL OVERLAY UI ---
function TerminalOverlay({ selectedNodeId, closeTerminal, nodes }) {
  if (!selectedNodeId) return null;

  const node = nodes.find(n => n.id === selectedNodeId);
  const title = node ? node.name : "System Interface";
  const color = node ? node.color : "cyan";

  return (
    // Click on the background to close the terminal and unfreeze the camera
    <div 
      className="fixed inset-0 bg-black bg-opacity-70 backdrop-blur-sm flex items-center justify-center p-4 z-50 transition-opacity duration-300"
      onClick={closeTerminal} 
    >
      <div 
        className="w-full max-w-2xl h-full max-h-[80vh] bg-gray-900 border-2 shadow-2xl rounded-xl flex flex-col"
        style={{ borderColor: color, boxShadow: `0 0 20px ${color}` }}
        onClick={(e) => e.stopPropagation()} // Prevent closing when clicking inside the window
      >
        {/* Header */}
        <div className="p-3 border-b" style={{ borderColor: color }}>
          <div className="flex justify-between items-center">
            <h2 className="text-lg font-mono text-white" style={{ color }}>
              {`[ ${title} ] :: AX-INTERFACE >_`}
            </h2>
            <button 
              onClick={closeTerminal} // This button now correctly calls closeTerminal
              className="text-white hover:text-red-500 transition-colors p-1 rounded"
            >
              {/* Corrected SVG for close button */}
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
            </button>
          </div>
        </div>

        {/* Console/Chat Area */}
        <div className="flex-grow p-4 overflow-y-auto font-mono text-sm text-lime-400">
          <p className="pb-4 text-cyan-400">
            --- Initiating RAG Context for **{title}** ---
          </p>
          {
            // Placeholder for data from CapsuleOS / Hoi-Poi
            // This is where the actual RAG-derived content would load.
            node ? (
              <p className="text-gray-400">
                > **AX-ID:** {node.id} <br/>
                > **Status:** Synced. Awaiting command for content retrieval. <br/>
                > **Memory:** This node currently holds meta-data about the core `{title}` system component.
              </p>
            ) : (
              <p className="text-red-400">> ERROR: Node data not found.</p>
            )
          }
          <p>
            > Access granted. Welcome, Agent.
          </p>
        </div>

        {/* Input Area */}
        <div className="p-3 border-t" style={{ borderColor: color }}>
          <input 
            type="text" 
            placeholder="Type command or query..." 
            className="w-full bg-gray-800 text-white p-2 rounded focus:outline-none focus:ring-1"
            style={{ 
              borderColor: color, 
              caretColor: color,
              boxShadow: `0 0 5px ${color}` 
            }}
            // Focus here to allow immediate typing
            autoFocus 
          />
        </div>
      </div>
    </div>
  );
}

// --- MAIN APP ---
export default function App() {
  // Firebase State
  const [db, setDb] = useState(null);
  const [auth, setAuth] = useState(null);
  const [userId, setUserId] = useState(null);

  // App State
  const [aspect, setAspect] = useState(1); 
  const [nodes, setNodes] = useState(INITIAL_SYSTEM_STATE.nodes);
  const [constraints] = useState(INITIAL_SYSTEM_STATE.constraints);
  const [selectedNodeId, setSelectedNodeId] = useState(null); // State for terminal UI

  // 1. FIREBASE INITIALIZATION AND AUTHENTICATION
  useEffect(() => {
    try {
      const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
      const firebaseConfig = JSON.parse(typeof __firebase_config !== 'undefined' ? __firebase_config : '{}');

      if (Object.keys(firebaseConfig).length === 0) {
        console.error("Firebase config is missing. Cannot initialize Firestore.");
        return;
      }

      const app = initializeApp(firebaseConfig);
      const firestore = getFirestore(app);
      const authentication = getAuth(app);
      
      setDb(firestore);
      setAuth(authentication);

      const token = typeof __initial_auth_token !== 'undefined' ? __initial_auth_token : null;
      
      onAuthStateChanged(authentication, (user) => {
        if (user) {
          setUserId(user.uid);
          console.log(`Authenticated as User ID: ${user.uid}`);
        } else if (!token) {
          signInAnonymously(authentication)
            .then(anonUser => {
              setUserId(anonUser.user.uid);
              console.log(`Signed in anonymously with ID: ${anonUser.user.uid}`);
            })
            .catch(error => console.error("Anonymous sign-in failed:", error));
        }
      });
      
      if (token) {
        signInWithCustomToken(authentication, token)
          .catch(error => console.error("Custom token sign-in failed:", error));
      }

    } catch (e) {
      console.error("Failed to initialize Firebase:", e);
    }
  }, []);

  // 2. REAL-TIME NODE DATA LISTENER (FIRESTORE)
  useEffect(() => {
    if (!db || !userId) return;

    // MANDATORY PUBLIC PATH: /artifacts/{appId}/public/data/axiom_nodes
    const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
    const collectionPath = `artifacts/${appId}/public/data/${AXIOM_NODE_COLLECTION_NAME}`;
    const nodesRef = collection(db, collectionPath);
    
    console.log(`Listening to public collection: ${collectionPath}`);

    const unsubscribe = onSnapshot(nodesRef, (snapshot) => {
      const newNodes = [];
      snapshot.forEach(doc => {
        const data = doc.data();
        if (data.position && Array.isArray(data.position) && data.position.length === 3) {
          newNodes.push({
            id: doc.id,
            ...data
          });
        }
      });

      // If Firestore is empty, we fall back to the initial local state AND seed the database
      if (newNodes.length > 0) {
        setNodes(newNodes);
      } else {
        INITIAL_SYSTEM_STATE.nodes.forEach(node => {
          // Use a simple, non-async setDoc for seeding, assuming the Firestore instance is ready.
          setDoc(doc(db, collectionPath, node.id), node).catch(e => console.error("Error seeding node:", e));
        });
        setNodes(INITIAL_SYSTEM_STATE.nodes);
      }
    }, (error) => {
      console.error("Firestore onSnapshot failed:", error);
      setNodes(INITIAL_SYSTEM_STATE.nodes);
    });

    return () => unsubscribe();
  }, [db, userId]); 

  // Click Handler for Nodes (opens terminal)
  const handleNodeSelect = useCallback((id) => {
    setSelectedNodeId(id); 
    // Remove pointer cursor when terminal opens
    document.body.style.cursor = 'default';
  }, []);

  // Closes terminal and restores camera movement
  const closeTerminal = useCallback(() => {
    setSelectedNodeId(null);
  }, []);


  // Pre-calculate line points for the constraints lattice
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


  const orientationScale = FINAL_SMALL_SCALE;
  const dynamicLineWidth = BASE_LINE_WIDTH * orientationScale;
  
  // Determine if the canvas should receive pointer events (i.e., if controls should work)
  const canvasPointerEvents = selectedNodeId ? 'none' : 'auto';

  return (
    <div 
      style={{ 
        position: 'fixed', 
        inset: 0, 
        width: '100vw', 
        height: '100vh',
        height: '100lvh', 
        height: '100svh', 
        cursor: selectedNodeId ? 'default' : 'auto'
      }} 
      className="bg-black overflow-hidden touch-none"
    >
      {/* Heads-Up Display (HUD) */}
      <div style={{
        position: 'absolute', top: 20, left: 20, zIndex: 10,
        color: 'cyan', fontFamily: 'monospace', pointerEvents: 'none',
        textShadow: '0 0 10px cyan'
      }} className="hidden sm:block">
        CAPSULE OS | **DEX View** <br/>
        Status: {db ? 'Axiomatic Sync' : 'Initializing...'} <br/>
        User ID: {userId ? userId.substring(0, 10) + '...' + userId.substring(userId.length - 4) : 'Loading...'} <br/>
        Total Nodes: {nodes.length}
      </div>
      
      {/* 3D Canvas */}
      <Canvas 
        dpr={[1, 2]} 
        camera={{ fov: CAMERA_FOV }}
        // Control pointer events to ensure the overlay doesn't interfere with the canvas
        style={{ pointerEvents: canvasPointerEvents }} 
      >
        <ResponsiveCamera setAspect={setAspect} isTerminalOpen={!!selectedNodeId} />
        
        <ParticlePlanet />

        {/* Lines must be rendered *before* the nodes (renderOrder 1) */}
        {linePoints.map((l, i) => (
          <Line 
            key={i} 
            points={[l.start, l.end]} 
            color={l.color} 
            lineWidth={dynamicLineWidth} 
            transparent 
            opacity={0.5} 
            renderOrder={1}
          />
        ))}

        {/* Nodes must be rendered after lines, ensuring their click targets don't cover the lines */}
        {nodes.map(node => (
          <GlyphNode 
            key={node.id}
            {...node}
            onSelect={handleNodeSelect}
            orientationScale={orientationScale} 
          />
        ))}
        
      </Canvas>
      
      {/* Terminal Interface Overlay */}
      <TerminalOverlay 
        selectedNodeId={selectedNodeId} 
        closeTerminal={closeTerminal}
        nodes={nodes}
      />
    </div>
  )
}

