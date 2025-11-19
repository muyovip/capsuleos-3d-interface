import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Canvas, useThree, useFrame, extend } from '@react-three/fiber';
import { OrbitControls, Line } from '@react-three/drei';
import * as THREE from 'three';

// --- Firebase Imports ---
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged } from 'firebase/auth';
import { 
  getFirestore, 
  doc, 
  onSnapshot, 
  collection, 
  query, 
  setDoc
} from 'firebase/firestore';

// Extend LineGeometry and LineMaterial for Line component
extend({ OrbitControls });

// --- Global Variables (Provided by Canvas Environment) ---
const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
const firebaseConfig = typeof __firebase_config !== 'undefined' ? JSON.parse(__firebase_config) : {};
const initialAuthToken = typeof __initial_auth_token !== 'undefined' ? __initial_auth_token : null;

// --- Firebase Initialization and Context ---
let app;
let db;
let auth;

// --- 3D Components ---

// Simplified Glyph Node (replaces original Capsule function)
const GlyphNode = ({ id, position, color, name, isSelected, onSelect }) => {
  const meshRef = useRef();
  const [hovered, setHovered] = useState(false);
  const scale = isSelected ? 1.5 : (hovered ? 1.2 : 1.0);

  // Animation to maintain the "alive" feeling and responsiveness
  useFrame((state) => {
    const time = state.clock.getElapsedTime();
    if (meshRef.current) {
      // Gentle bobbing motion
      meshRef.current.position.y = position[1] + Math.sin(time + id) * 0.1;
      
      // Scale lerp
      meshRef.current.scale.lerp(new THREE.Vector3(scale, scale, scale), 0.1);
      
      // Slow, independent rotation
      meshRef.current.rotation.x += 0.005;
      meshRef.current.rotation.y += 0.008;
    }
  });

  return (
    <mesh
      ref={meshRef}
      position={[position[0], position[1], position[2]]} // Set initial position
      onClick={(e) => {
        e.stopPropagation();
        onSelect(id);
      }}
      onPointerOver={() => setHovered(true)}
      onPointerOut={() => setHovered(false)}
    >
      <sphereGeometry args={[0.2, 16, 16]} />
      <meshStandardMaterial 
        color={isSelected ? '#FFFF00' : color} // Highlight color
        wireframe={true}
        emissive={isSelected ? '#FFFF00' : color}
        emissiveIntensity={hovered ? 0.8 : 0.4}
      />
    </mesh>
  );
};

// Manifold (Grid) for spatial context
const ManifoldConstraintLayer = () => {
  return (
    <group>
      <gridHelper args={[20, 20, '#11FF11', '#004400']} position={[0, -0.01, 0]} />
      <axesHelper args={[5]} />
    </group>
  );
};


// --- HIL Panel (Minimalist, Monospace Styling) ---
const HILPanel = ({ nodes, selectedNodeIds, onSpawnNode, sendRAGQuery, ragState, setRagUrl, ragUrl, setPrompt, prompt }) => {
  const numSelected = selectedNodeIds.size;
  
  const handleIngestionClick = () => {
    if (prompt.trim()) {
      sendRAGQuery(prompt.trim());
    }
  };

  const statusColor = ragState.error ? '#FF0000' : (ragState.loading ? '#FFFF00' : '#11FF11');
  const statusText = ragState.message || 'IDLE';

  return (
    <div style={{
      position: 'absolute',
      top: '10px',
      right: '10px',
      padding: '15px',
      backgroundColor: 'rgba(0, 0, 0, 0.7)',
      border: '1px solid #11FF11',
      color: '#11FF11',
      fontFamily: 'monospace',
      fontSize: '12px',
      maxWidth: '300px',
      zIndex: 100,
      boxShadow: '0 0 10px #11FF11'
    }}>
      <h2 style={{ fontSize: '16px', marginBottom: '10px', borderBottom: '1px solid #004400', paddingBottom: '5px' }}>
        // HIL COMMAND INTERFACE
      </h2>

      {/* RAG URL Input */}
      <div style={{ marginBottom: '10px' }}>
        <label style={{ display: 'block', color: '#88FF88', marginBottom: '4px' }}>RAG Backend URL:</label>
        <input
          type="text"
          style={{ width: '100%', padding: '5px', backgroundColor: '#0A0A0A', border: '1px solid #11FF11', color: '#11FF11' }}
          value={ragUrl}
          onChange={(e) => setRagUrl(e.target.value)}
          placeholder="https://vllm-endpoint/query"
        />
      </div>

      {/* Command/Prompt Input */}
      <div style={{ marginBottom: '10px' }}>
        <label style={{ display: 'block', color: '#88FF88', marginBottom: '4px' }}>INGEST / QUERY:</label>
        <textarea
          style={{ width: '100%', padding: '5px', backgroundColor: '#0A0A0A', border: '1px solid #11FF11', color: '#11FF11', resize: 'none' }}
          rows="3"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="Ingest GCS path: gs://my-bucket/docs/..."
        ></textarea>
      </div>
      
      {/* Execute Button */}
      <button
        onClick={handleIngestionClick}
        disabled={ragState.loading || !ragUrl || !prompt.trim()}
        style={{
          width: '100%',
          padding: '8px',
          backgroundColor: ragState.loading ? '#333' : '#11FF11',
          color: '#000000',
          border: 'none',
          cursor: ragState.loading ? 'wait' : 'pointer',
          fontWeight: 'bold',
          marginBottom: '10px',
          transition: 'background-color 0.2s',
        }}
      >
        {ragState.loading ? 'PROCESSING...' : 'EXECUTE COMMAND'}
      </button>

      {/* HIL Node Spawner */}
      <button
        onClick={() => onSpawnNode([Math.random() * 8 - 4, Math.random() * 3 + 1, Math.random() * 8 - 4])}
        style={{
          width: '100%',
          padding: '8px',
          backgroundColor: '#008080',
          color: '#11FF11',
          border: '1px solid #11FF11',
          cursor: 'pointer',
          marginBottom: '10px',
          transition: 'background-color 0.2s',
        }}
      >
        + SPAWN HIL NODE
      </button>

      {/* Status Message */}
      <div style={{ padding: '5px', border: `1px dashed ${statusColor}`, color: statusColor, wordWrap: 'break-word' }}>
        STATUS: {statusText}
      </div>
      <p style={{ marginTop: '5px', color: '#55AA55' }}>
        Glyphs Loaded: {nodes.length} | Selected: {numSelected}
      </p>
      {ragState.userId && <p style={{ color: '#004400', marginTop: '5px', wordBreak: 'break-all' }}>USER: {ragState.userId}</p>}
    </div>
  );
};


// --- Main Application Component ---
export default function App() {
  const [dbInstance, setDbInstance] = useState(null);
  const [authState, setAuthState] = useState({ user: null, isReady: false });
  const [nodes, setNodes] = useState([]);
  const [linePoints, setLinePoints] = useState([]);
  const [selectedNodeIds, setSelectedNodeIds] = useState(new Set());
  const [nextId, setNextId] = useState(0);

  // RAG State Management
  const [ragUrl, setRagUrl] = useState('https://capsuleos-vllm-backend.a.run.app/api/query');
  const [prompt, setPrompt] = useState('');
  const [ragState, setRagState] = useState({ 
    loading: false, 
    message: null, 
    error: false, 
    userId: null 
  });


  // 1. Firebase Initialization and Authentication
  useEffect(() => {
    if (Object.keys(firebaseConfig).length === 0) {
      console.error("Firebase config is missing. Cannot initialize Firestore.");
      setAuthState(prev => ({ ...prev, isReady: true }));
      return;
    }

    try {
      app = initializeApp(firebaseConfig);
      db = getFirestore(app);
      auth = getAuth(app);
      setDbInstance(db);
      // setLogLevel('Debug'); // Enable debug logging for Firebase

      const signIn = async () => {
        try {
          if (initialAuthToken) {
            await signInWithCustomToken(auth, initialAuthToken);
          } else {
            await signInAnonymously(auth);
          }
        } catch (e) {
          console.error("Firebase Auth Error:", e);
          await signInAnonymously(auth); // Fallback
        }
      };

      const unsubscribe = onAuthStateChanged(auth, (user) => {
        setAuthState({ user, isReady: true });
        setRagState(prev => ({ ...prev, userId: user?.uid || 'anonymous' }));
      });
      
      signIn();
      
      return () => unsubscribe();
    } catch (e) {
      console.error("Error during Firebase initialization:", e);
      setAuthState(prev => ({ ...prev, isReady: true }));
    }
  }, []);

  // 2. Data Fetching (Real-time Snapshot Listener)
  useEffect(() => {
    if (!dbInstance || !authState.isReady) return;

    // Use a fixed public collection path for shared graph data
    const nodesCollectionPath = `/artifacts/${appId}/public/data/glyphs`;
    const q = query(collection(dbInstance, nodesCollectionPath));

    console.log(`Setting up snapshot listener on: ${nodesCollectionPath}`);

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const newNodes = [];
      let maxId = 0;
      snapshot.forEach(doc => {
        const data = doc.data();
        const nodeId = doc.id;
        
        if (data.position && data.color && data.name) {
          newNodes.push({
            id: nodeId,
            position: data.position,
            color: data.color,
            name: data.name,
            data: data.data || null 
          });

          // Track max numeric ID for HIL node spawning
          if (!isNaN(parseInt(nodeId))) {
            maxId = Math.max(maxId, parseInt(nodeId));
          }
        }
      });

      setNodes(newNodes);
      setNextId(maxId + 1);
      updateLineConnections(newNodes);

    }, (error) => {
      console.error("Firestore snapshot error:", error);
    });

    return () => unsubscribe();
  }, [dbInstance, authState.isReady]);


  // Simple logic to draw lines between all nodes
  const updateLineConnections = (currentNodes) => {
    if (currentNodes.length < 2) {
      setLinePoints([]);
      return;
    }
    
    // Connect every node to its immediate neighbor in the array (creating a simple chain/loop)
    const connections = [];
    for (let i = 0; i < currentNodes.length; i++) {
        const nodeA = currentNodes[i];
        const nodeB = currentNodes[(i + 1) % currentNodes.length]; 
        
        connections.push({
            points: [
                new THREE.Vector3(...nodeA.position), 
                new THREE.Vector3(...nodeB.position)
            ],
            color: '#004400' // Dark green lines for subtle aesthetic
        });
    }
    setLinePoints(connections);
  };


  // --- Node Interaction Handlers ---

  const handleNodeSelect = useCallback((id) => {
    setSelectedNodeIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }, []);

  // HIL Node Spawner
  const handleSpawnNode = useCallback(async (position) => {
    if (!dbInstance || !authState.user) {
      console.error("System not ready or not authenticated.");
      setRagState(prev => ({ ...prev, message: 'Auth required to spawn HIL Node.', error: true }));
      return;
    }

    const newNode = {
      position: position,
      color: `#${Math.floor(Math.random()*16777215).toString(16).padStart(6, '0')}`,
      name: `HIL_Node_${nextId}`,
      createdAt: new Date().toISOString(),
      source: 'HIL'
    };

    try {
      // Write the new node to Firestore
      const docRef = doc(dbInstance, `/artifacts/${appId}/public/data/glyphs`, nextId.toString());
      await setDoc(docRef, newNode);
      console.log("HIL Node spawned and saved with ID:", nextId);
    } catch (e) {
      console.error("Error adding document: ", e);
      setRagState(prev => ({ ...prev, message: `DB Error: ${e.message}`, error: true }));
    }
  }, [dbInstance, authState.user, nextId]);


  // --- RAG/Ingestion Logic ---

  const exponentialBackoffFetch = async (url, options, retries = 3, delay = 1000) => {
    for (let i = 0; i < retries; i++) {
        try {
            const response = await fetch(url, options);
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            return response;
        } catch (error) {
            if (i === retries - 1) throw error;
            await new Promise(resolve => setTimeout(resolve, delay * Math.pow(2, i)));
        }
    }
  };
  
  const sendRAGQuery = async (queryPrompt) => {
    if (!ragUrl || ragState.loading) return;

    setRagState({ loading: true, message: 'SENDING COMMAND...', error: false, userId: ragState.userId });
    
    try {
        const payload = {
            prompt: queryPrompt,
            user_id: authState.user?.uid || 'anonymous', 
            app_id: appId,
        };
        
        const response = await exponentialBackoffFetch(ragUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        });

        const result = await response.json();

        // The backend should return a confirmation message. New nodes will appear via Firestore listener.
        setRagState({ 
          loading: false, 
          message: `COMMAND ACKNOWLEDGED: ${result.message || 'Processing initiated.'}.`, 
          error: false, 
          userId: ragState.userId 
        });
        
    } catch (e) {
        console.error("RAG Query Error:", e);
        setRagState({ 
          loading: false, 
          message: `RAG API ERROR: ${e.message}. CHECK URL.`, 
          error: true, 
          userId: ragState.userId 
        });
    }
  };


  return (
    <div style={{ width: '100vw', height: '100vh', backgroundColor: '#000000', position: 'relative' }}>
      
      {/* Top Left Title/Debug */}
      <div style={{
        position: 'absolute',
        top: 10, left: 10,
        color: 'lime',
        fontFamily: 'monospace',
        pointerEvents: 'none',
        zIndex: 100
      }}>
        CAPSULEOS GRAPHS | LIVE NODE COUNT: {nodes.length}
      </div>

      <Canvas 
        style={{ width: '100%', height: '100%' }}
        camera={{ position: [0, 5, 15], fov: 60 }}
      >
        <OrbitControls enableDamping dampingFactor={0.05} />
        
        {/* Holographic Lighting - Green/Cyan/Orange glow */}
        <ambientLight intensity={0.5} color="#11FF11" />
        <pointLight position={[10, 10, 10]} intensity={1} color="#11FF11" />
        <pointLight position={[-10, -10, -10]} intensity={0.5} color="#FF8800" />
        
        <ManifoldConstraintLayer />
        
        {/* Render all GΛLYPH Nodes from Firestore */}
        {nodes.map(node => (
          <GlyphNode
            key={node.id}
            id={node.id}
            position={node.position}
            color={node.color}
            name={node.name}
            isSelected={selectedNodeIds.has(node.id)}
            onSelect={handleNodeSelect}
          />
        ))}
        
        {/* Render Lattice Constraints (Wires) */}
        {linePoints.map(({ points, color }, index) => (
          <Line
            key={index}
            points={points}
            color={color}
            lineWidth={1}
            dashed={false}
          />
        ))}
        
      </Canvas>
      
      {/* HIL Control Panel */}
      <HILPanel
        nodes={nodes}
        selectedNodeIds={selectedNodeIds}
        onSpawnNode={handleSpawnNode}
        sendRAGQuery={sendRAGQuery}
        ragState={ragState}
        setRagUrl={setRagUrl}
        ragUrl={ragUrl}
        setPrompt={setPrompt}
        prompt={prompt}
      />

    </div>
  );
}

