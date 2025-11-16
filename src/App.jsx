import { Canvas, useFrame } from '@react-three/fiber'
import { OrbitControls, Line } from '@react-three/drei' 
import { useState, useRef, useEffect, useCallback, useMemo } from 'react'
import * as THREE from 'three'

// --- FIREBASE IMPORTS (MANDATORY FOR PERSISTENCE) ---
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, doc, setDoc, onSnapshot } from 'firebase/firestore';

// --- AXIOMATIC DATA ---
// Initial state for the system. This will be written to Firestore if the DB is empty.
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
      meshRef.current.rotation.x += delta * 0.2
      meshRef.current.rotation.y += delta * 0.1
    }
  })

  return (
    <group position={position} onClick={onClick}>
      {/* Icosahedron Mesh */}
      <mesh ref={meshRef}>
        <icosahedronGeometry args={[0.4, 0]} /> 
        <meshBasicMaterial color={color} wireframe />
      </mesh>
      
      {/* Text Mesh using Canvas Texture */}
      <mesh position={[0, 0.8, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[5.0, 0.8]} /> 
        <meshBasicMaterial map={texture} transparent />
      </mesh>
    </group>
  )
}

// 2. Main Application (The CapsuleOS Interface - Phase 11 Persistent Grid)
export default function App() {
  const [nodes, setNodes] = useState([])
  const [constraints, setConstraints] = useState([])
  const [loading, setLoading] = useState(true);
  const [authReady, setAuthReady] = useState(false);
  const [db, setDb] = useState(null);
  const [userId, setUserId] = useState(null);
  const [ragIndex, setRagIndex] = useState(0);

  // --- 1. FIREBASE INITIALIZATION AND AUTH ---
  useEffect(() => {
    try {
      const firebaseConfig = JSON.parse(typeof __firebase_config !== 'undefined' ? __firebase_config : '{}');
      if (Object.keys(firebaseConfig).length === 0) {
        console.error("Firebase config is missing.");
        setLoading(false);
        return;
      }
      
      const app = initializeApp(firebaseConfig);
      const firestore = getFirestore(app);
      const auth = getAuth(app);

      setDb(firestore);

      // Sign in or use the provided custom token
      const token = typeof __initial_auth_token !== 'undefined' ? __initial_auth_token : null;
      
      const authHandler = onAuthStateChanged(auth, async (user) => {
        if (user) {
          setUserId(user.uid);
        } else {
          // Fallback to anonymous sign-in if token is missing/expired
          const anonUser = await signInAnonymously(auth);
          setUserId(anonUser.user.uid);
        }
        setAuthReady(true);
        // We set loading false only after auth and initial data fetch is done in the next useEffect
      });

      if (token) {
        signInWithCustomToken(auth, token).catch(e => {
          console.error("Custom token sign-in failed. Falling back to anonymous.", e);
        });
      }

      return () => authHandler();
    } catch (e) {
      console.error("Firebase setup failed:", e);
      setLoading(false);
    }
  }, []);

  // --- 2. FIRESTORE DATA LISTENER ---
  useEffect(() => {
    if (!db || !authReady) return;

    const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
    const docPath = `artifacts/${appId}/public/data/system_state/axiomatic_state`;
    const docRef = doc(db, docPath);

    // Set up initial state if the document doesn't exist
    const initializeState = async () => {
        try {
            await setDoc(docRef, INITIAL_SYSTEM_STATE, { merge: true });
            console.log("Initialized Axiomatic State.");
        } catch (e) {
            console.error("Error setting initial state:", e);
        }
    };

    const unsubscribe = onSnapshot(docRef, (docSnapshot) => {
      if (docSnapshot.exists()) {
        const data = docSnapshot.data();
        setNodes(data.nodes || []);
        setConstraints(data.constraints || []);
      } else {
        // Document doesn't exist, initialize it
        initializeState();
      }
      setLoading(false);
    }, (error) => {
      console.error("Firestore snapshot failed:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [db, authReady]);
  
  
  // --- RAG INGESTION HANDLER ---
  const handleRAGIngestion = useCallback(async () => {
    if (!db || !userId || loading) return;

    const artifact = RAG_ARTIFACTS[ragIndex % RAG_ARTIFACTS.length];
    
    // Create new node object
    const newNode = {
      id: artifact.name.replace(/\s/g, '-').toLowerCase(),
      name: artifact.name,
      color: artifact.color,
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

      // Atomically update the arrays
      await setDoc(docRef, {
        nodes: [...nodes.filter(n => n.id !== newNode.id), newNode], // Use filter to prevent duplicates
        constraints: [...constraints, ...newConstraints]
      }, { merge: true });

      setRagIndex(i => i + 1);
      console.log(`Ingested new RAG artifact: ${newNode.name}`);
    } catch (e) {
      console.error("Error injecting RAG artifact:", e);
    }
  }, [db, userId, nodes, constraints, loading, ragIndex]);


  // Utility to find node position by ID
  const nodeMap = useMemo(() => {
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
        <br/>Status: Persistent Grid Locked.
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
          className="px-4 py-2 bg-indigo-700 hover:bg-indigo-600 transition duration-150 rounded-full text-white font-bold text-lg shadow-xl"
          style={{ 
            boxShadow: '0 0 10px rgba(120, 100, 255, 0.8), inset 0 0 5px rgba(255, 255, 255, 0.5)',
            border: '2px solid #a5b4fc',
          }}
        >
          Inject Next RAG Artifact
        </button>
        <p className="text-xs mt-2 text-gray-400">Artifact #{ragIndex + 1}: {RAG_ARTIFACTS[ragIndex % RAG_ARTIFACTS.length].name}</p>
      </div>


      {/* DEX View: 3D Computational Graph */}
      <Canvas 
        className="w-full h-full"
        style={{ display: 'block' }} 
        camera={{ position: [0, 0, 10], near: 0.1, far: 100 }} 
      >
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

        {/* --- Manifold Constraint Layer --- */}
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
      </Canvas>
    </div>
  )
}

