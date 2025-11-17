import { Canvas, useFrame } from '@react-three/fiber'
import { OrbitControls, Line } from '@react-three/drei' 
import { useState, useRef, useEffect, useCallback, useMemo } from 'react'
import * as THREE from 'three'

// --- FIREBASE IMPORTS ---
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, doc, setDoc, onSnapshot } from 'firebase/firestore';
import { setLogLevel } from 'firebase/firestore';

// Enable Firestore debug logging
setLogLevel('debug');

// --- AXIOMATIC DATA ---
const INITIAL_SYSTEM_STATE = {
  nodes: [
    { id: 'rag-orch', name: 'Multi-Agent RAG', color: 'cyan', position: [2.0, 1.0, 0] },
    { id: 'glyph-eng', name: 'GΛLYPH Engine', color: 'lime', position: [-2.0, 1.0, 0] },
    { id: 'vgm-anchor', name: 'VGM Anchor', color: 'cyan', position: [0, 2.5, -1.5] },
    { id: 'manifold', name: 'Manifold Constraint', color: 'lime', position: [0, -2.5, 1.5] },
    { id: 'hax', name: 'HIL Agent X', color: 'orange', position: [3, -0.5, -0.5] },
  ],
  constraints: [
    ['rag-orch', 'glyph-eng', 'lime'],
    ['rag-orch', 'vgm-anchor', 'cyan'],
    ['glyph-eng', 'manifold', 'lime'],
    ['vgm-anchor', 'hax', 'orange'],
    ['manifold', 'hax', 'orange'],
  ],
};

// --- RAG INGESTION ARTIFACTS ---
const RAG_ARTIFACTS = [
    { name: "Regenesis Dystopia", color: "red", type: "RAG-Synthesis", pos: [-3, -4, 2], links: ['rag-orch', 'glyph-eng'] },
    { name: "QLM-NFT Protocol", color: "purple", type: "VGM-Output", pos: [4, 3, -1], links: ['vgm-anchor', 'hax'] },
    { name: "Nico Robin Agent", color: "yellow", type: "HIL-Agent", pos: [-1, 4, 3], links: ['hax', 'manifold'] }
];

// Helper function to create a texture with text on it (Absolute Fidelity)
function createTextTexture(text, color, fontSize = 64) { 
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');
  
  canvas.width = 2048; 
  canvas.height = 128; 

  context.font = `Bold ${fontSize}px monospace`;
  context.fillStyle = color;
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.fillText(text, canvas.width / 2, canvas.height / 2);

  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  return texture;
}

// Manifold Constraint Layer (The topological boundary)
function ManifoldConstraintLayer() {
  const meshRef = useRef();

  useFrame((state, delta) => {
    if (meshRef.current) {
      // Slow rotation for visual fidelity
      meshRef.current.rotation.y += delta * 0.01;
      meshRef.current.rotation.x += delta * 0.005;
    }
  });

  return (
    <mesh ref={meshRef} position={[0, 0, 0]}>
      <dodecahedronGeometry args={[5.5, 0]} /> 
      <meshBasicMaterial 
        color="#00ffff"
        wireframe={true} 
        transparent={true}
        opacity={0.15}
      />
    </mesh>
  );
}

// 1. The GΛLYPH NODE Component
function GlyphNode({ position, color, name, onClick }) {
  const meshRef = useRef()
  const texture = useMemo(() => createTextTexture(name, color), [name, color]);
  
  useFrame((state, delta) => {
    if (meshRef.current) {
      // Faster, pulsing rotation
      meshRef.current.rotation.x += delta * 0.2
      meshRef.current.rotation.y += delta * 0.1
    }
  })

  return (
    <group position={position} onClick={onClick}>
      {/* Icosahedron Mesh - The Glyptic Core */}
      <mesh ref={meshRef}>
        <icosahedronGeometry args={[0.4, 0]} /> 
        <meshBasicMaterial color={color} wireframe />
      </mesh>
      
      {/* Text Mesh using Canvas Texture - The Identity Layer */}
      <mesh position={[0, 0.8, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[5.0, 0.8]} /> 
        <meshBasicMaterial map={texture} transparent />
      </mesh>
    </group>
  )
}

// 2. Background Click Handler for Spawning (HIL Input)
function BackgroundSpawner({ onSpawn }) {
  const handleClick = useCallback((e) => {
    e.stopPropagation() 
    if (e.point) {
      // Round the coordinates for cleaner Firestore data
      const pos = e.point.toArray().map(v => parseFloat(v.toFixed(2))); 
      onSpawn(pos);
    }
  }, [onSpawn])

  return (
    // Invisible plane spanning the view to capture clicks
    <mesh onClick={handleClick}>
      <planeGeometry args={[200, 200]} /> 
      <meshBasicMaterial visible={false} />
    </mesh>
  )
}

// 3. Main Application 
export default function App() {
  const [nodes, setNodes] = useState([])
  const [constraints, setConstraints] = useState([])
  const [loading, setLoading] = useState(true);
  const [authReady, setAuthReady] = useState(false);
  const [db, setDb] = useState(null);
  const [userId, setUserId] = useState(null);
  const [ragIndex, setRagIndex] = useState(0);

  // Derive readiness state for the button
  const isReady = db && userId && !loading;

  // --- 1. FIREBASE INITIALIZATION AND AUTH ---
  useEffect(() => {
    let authListener;
    try {
      const firebaseConfig = JSON.parse(typeof __firebase_config !== 'undefined' ? __firebase_config : '{}');
      if (Object.keys(firebaseConfig).length === 0) {
        console.error("Firebase config is missing. Displaying initial state, persistence disabled.");
        setLoading(false);
        setNodes(INITIAL_SYSTEM_STATE.nodes);
        setConstraints(INITIAL_SYSTEM_STATE.constraints);
        return;
      }
      
      const app = initializeApp(firebaseConfig);
      const firestore = getFirestore(app);
      const auth = getAuth(app);

      setDb(firestore);

      const token = typeof __initial_auth_token !== 'undefined' ? __initial_auth_token : null;
      
      // Handle authentication state change
      const handleAuth = (user) => {
        if (user) {
          setUserId(user.uid);
          console.log("Authenticated with UID:", user.uid);
        } else {
          // If no user is signed in, sign in anonymously
          signInAnonymously(auth).then(anonUser => {
            setUserId(anonUser.user.uid);
            console.log("Signed in anonymously with UID:", anonUser.user.uid);
          }).catch(e => {
            console.error("Anonymous sign-in failed:", e);
          });
        }
        setAuthReady(true);
      };

      authListener = onAuthStateChanged(auth, handleAuth);

      // Attempt custom token sign-in first if token exists
      if (token) {
        signInWithCustomToken(auth, token).catch(e => {
          // If custom token fails, onAuthStateChanged fallback will handle it
          console.error("Custom token sign-in failed. Falling back to onAuthStateChanged.", e);
        });
      }

    } catch (e) {
      console.error("Firebase setup failed:", e);
      setLoading(false);
    }
    
    // Cleanup the auth listener on unmount
    return () => {
      if (authListener) authListener();
    };
  }, []);

  // --- 2. FIRESTORE DATA LISTENER AND INITIALIZER ---
  useEffect(() => {
    // Only proceed if DB object is initialized and Auth state has been checked
    if (!db || !authReady) return;

    const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
    // Use the PUBLIC data path
    const docPath = `artifacts/${appId}/public/data/system_state/axiomatic_state`;
    const docRef = doc(db, docPath);

    // Function to set initial state if document doesn't exist
    const initializeState = async () => {
        try {
            await setDoc(docRef, INITIAL_SYSTEM_STATE, { merge: false });
            console.log("Initialized Axiomatic State in Firestore.");
        } catch (e) {
            console.error("Error setting initial state:", e);
        }
    };

    const unsubscribe = onSnapshot(docRef, (docSnapshot) => {
      if (docSnapshot.exists()) {
        const data = docSnapshot.data();
        setNodes(data.nodes || []);
        setConstraints(data.constraints || []);
        console.log(`Snapshot received. Nodes: ${data.nodes?.length}, Constraints: ${data.constraints?.length}`);
      } else {
        // Document doesn't exist, initialize it:
        // 1. Set local state immediately for visual feedback (THE FIX)
        setNodes(INITIAL_SYSTEM_STATE.nodes);
        setConstraints(INITIAL_SYSTEM_STATE.constraints);
        
        // 2. Initialize the document in Firestore
        initializeState(); 
        
        console.log("Document missing. Initializing local state and writing to Firestore.");
      }
      // Data is either successfully retrieved or initialization is triggered, so stop loading
      setLoading(false); 
    }, (error) => {
      console.error("Firestore snapshot failed:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [db, authReady]);
  
  
  // --- RAG INGESTION HANDLER (Adds next artifact from the predefined list) ---
  const handleRAGIngestion = useCallback(async () => {
    // Guard clause to prevent execution before setup is complete
    if (!isReady) {
        console.warn("System not ready for RAG ingestion. Waiting for DB/Auth lock.");
        return; 
    }

    const artifact = RAG_ARTIFACTS[ragIndex % RAG_ARTIFACTS.length];
    
    // Create new node object
    const newNode = {
      id: artifact.name.replace(/\s/g, '-').toLowerCase(),
      name: artifact.name,
      color: artifact.color,
      // Use the predefined position from the RAG_ARTIFACTS list
      position: artifact.pos, 
      type: artifact.type,
      timestamp: Date.now()
    };

    // Create new constraint objects linking to the Axiomatic foundations
    const newConstraints = artifact.links.map(linkId => ([
      newNode.id, linkId, newNode.color 
    ]));

    // Update Firestore
    try {
      const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
      const docPath = `artifacts/${appId}/public/data/system_state/axiomatic_state`;
      const docRef = doc(db, docPath);

      // Ensure no duplicate nodes are added (by ID), then append the new node.
      const uniqueNodes = [...nodes.filter(n => n.id !== newNode.id), newNode];
      // Append new constraints
      const allConstraints = [...constraints, ...newConstraints];

      await setDoc(docRef, {
        nodes: uniqueNodes,
        constraints: allConstraints
      }, { merge: false }); // Overwrite the arrays completely with the new set

      setRagIndex(i => i + 1);
      console.log(`Ingested new RAG artifact: ${newNode.name}`);
    } catch (e) {
      console.error("Error injecting RAG artifact:", e);
    }
  }, [db, userId, nodes, constraints, isReady, ragIndex]);


  // HIL Input Handler (Spawning new nodes via user click)
  const handleSpawn = useCallback(async (pos) => {
    if (!isReady) return;
    
    const newId = `hil-input-${Date.now()}`
    const newNode = { 
      id: newId, 
      name: `HIL Input ${nodes.length + 1}`,
      color: 'white', 
      position: pos,
      type: 'HIL-Input',
      timestamp: Date.now()
    }
    
    // Link new node to a random existing axiomatic node (rag-orch, glyph-eng, vgm-anchor, manifold, hax)
    const axiomaticIds = INITIAL_SYSTEM_STATE.nodes.map(n => n.id);
    const existingNodeId = axiomaticIds[Math.floor(Math.random() * axiomaticIds.length)];
    const newConstraint = [newId, existingNodeId, 'white']; 

    // Update Firestore via setDoc to trigger snapshot listener
    try {
        const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
        const docPath = `artifacts/${appId}/public/data/system_state/axiomatic_state`;
        const docRef = doc(db, docPath);

        const uniqueNodes = [...nodes.filter(n => n.id !== newNode.id), newNode];

        await setDoc(docRef, {
            nodes: uniqueNodes,
            constraints: [...constraints, newConstraint]
        }, { merge: false });

        console.log(`Spawned new HIL Input node: ${newNode.name}`);

    } catch (e) {
        console.error("Error spawning node:", e);
    }
  }, [db, userId, nodes, constraints, isReady]);


  // Utility to find node position by ID
  const nodeMap = useMemo(() => {
    // Map node ID to its position vector [x, y, z]
    return new Map(nodes.map(node => [node.id, node.position]));
  }, [nodes]);

  // Generate line points from node constraints
  const linePoints = useMemo(() => {
    const points = [];
    constraints.forEach(([startId, endId, color]) => {
      const startPos = nodeMap.get(startId);
      const endPos = nodeMap.get(endId);
      if (startPos && endPos) {
        points.push({
          points: [new THREE.Vector3(...startPos), new THREE.Vector3(...endPos)],
          color: color
        });
      }
    });
    return points;
  }, [constraints, nodeMap]);

  if (loading) {
    return (
      <div 
        className="w-screen bg-gray-950 flex items-center justify-center text-lime-400 font-mono" 
        style={{ height: '100dvh' }}
      >
        <p>Axiomatic Core Bootstrapping... (Authenticating/Loading Data Grid)</p>
      </div>
    );
  }

  return (
    <div 
      className="w-screen bg-gray-950" 
      style={{ height: '100dvh' }} 
    > 
      {/* CEX View: 2D Control Surface Overlay (Axiomatic Metrics Display) */}
      <div 
        className="absolute top-5 left-5 z-10 p-3 rounded-xl"
        style={{
          color: 'lime',
          fontFamily: 'monospace',
          background: 'rgba(0, 0, 0, 0.5)',
          fontSize: '14px',
          boxShadow: '0 0 10px rgba(50, 255, 50, 0.5)'
        }}
      >
        CAPSULE OS | **DEX View** Operational
        <br/>User ID: <span className="text-yellow-400 break-words">{userId || "N/A"}</span>
        <br/>Nodes (Glyphs): {nodes.length} | Constraints (Wires): {constraints.length}
        <br/>Status: {isReady ? 'Persistent Grid Locked' : <span className="text-red-400">Syncing...</span>}
      </div>

      {/* RAG Injection Control Panel (Bottom Right) */}
      <div 
        className="absolute bottom-5 right-5 z-10 p-4 rounded-xl flex flex-col items-end"
        style={{
          color: 'cyan',
          fontFamily: 'monospace',
          background: 'rgba(0, 0, 0, 0.6)',
          boxShadow: '0 0 15px rgba(0, 255, 255, 0.6)'
        }}
      >
        <p className="text-sm mb-2 text-lime-300">RAG Pipeline Control (Simulate Ingestion)</p>
        <button 
          onClick={handleRAGIngestion}
          disabled={!isReady} // Disable button until ready
          className={`px-4 py-2 transition duration-150 rounded-full text-white font-bold text-lg shadow-xl ${
            isReady 
              ? 'bg-indigo-700 hover:bg-indigo-600' 
              : 'bg-gray-500 cursor-not-allowed'
          }`}
          style={{ 
            boxShadow: isReady 
              ? '0 0 10px rgba(120, 100, 255, 0.8), inset 0 0 5px rgba(255, 255, 255, 0.5)'
              : 'none',
            border: isReady ? '2px solid #a5b4fc' : 'none',
          }}
        >
          {isReady ? 'Inject Next RAG Artifact' : 'Connecting...'}
        </button>
        <p className="text-xs mt-2 text-gray-400">
          {ragIndex < RAG_ARTIFACTS.length ? `Artifact #${ragIndex + 1}: ${RAG_ARTIFACTS[ragIndex % RAG_ARTIFACTS.length].name}` : 'All initial RAG artifacts injected.'}
        </p>
      </div>


      {/* DEX View: 3D Computational Graph */}
      <Canvas 
        className="w-full h-full"
        style={{ display: 'block' }} 
        camera={{ position: [0, 0, 10], near: 0.1, far: 100 }} 
      >
        {/* Allows user to pan and rotate the view */}
        <OrbitControls 
          enableDamping 
          dampingFactor={0.05} 
          minDistance={5} 
          maxDistance={30} 
          touches={{
            ONE: THREE.TOUCH.ROTATE,
            TWO: THREE.TOUCH.DOLLY,
            THREE: THREE.TOUCH.PAN,
          }}
        />
        
        {/* Holographic Lighting */}
        <ambientLight intensity={0.5} color="cyan" />
        <pointLight position={[10, 10, 10]} intensity={1} color="lime" />
        <pointLight position={[-10, -10, -10]} intensity={0.5} color="orange" />

        {/* --- Manifold Constraint Layer (Boundary) --- */}
        <ManifoldConstraintLayer />

        {/* Render all GΛLYPH Nodes (Axiomatic and RAG-Derived) */}
        {nodes.map(node => (
          <GlyphNode 
            key={node.id} 
            position={node.position} 
            color={node.color} 
            name={node.name}
            onClick={() => console.log(`Node ${node.name} activated. HIL interaction log.`)}
          />
        ))}

        {/* Render Lattice Constraints (Wires) */}
        {linePoints.map(({ points, color }, index) => (
          <Line
            key={index}
            points={points}
            color={color} 
            lineWidth={2}
            dashed={false}
          />
        ))}
        
        {/* HIL Input Spawner (Click on background to spawn a new HIL node) */}
        <BackgroundSpawner onSpawn={handleSpawn} />

      </Canvas>
    </div>
  )
}
