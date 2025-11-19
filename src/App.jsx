import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Canvas, useThree, useFrame, extend } from '@react-three/fiber';
import { OrbitControls, Line } from '@react-three/drei';
import * as THREE from 'three';

// Import Firebase components
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged } from 'firebase/auth';
import { 
  getFirestore, 
  doc, 
  onSnapshot, 
  collection, 
  query, 
  setDoc,
  getDocs
} from 'firebase/firestore';

// Extend LineGeometry and LineMaterial for Line component
// This is necessary because react-three-fiber's Line is a wrapper around a specific Three.js implementation.
extend({ OrbitControls });

// --- Global Variables (Provided by Canvas Environment) ---
const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
const firebaseConfig = typeof __firebase_config !== 'undefined' ? JSON.parse(__firebase_config) : {};
const initialAuthToken = typeof __initial_auth_token !== 'undefined' ? __initial_auth_token : null;

// --- Firebase Initialization and Context ---
let app;
let db;
let auth;

// State Structure for a GlyphNode
/**
 * @typedef {object} Node
 * @property {string} id - Unique ID (e.g., Firestore Document ID)
 * @property {number[]} position - [x, y, z] coordinates
 * @property {string} color - Hex color string
 * @property {string} name - Label for the node
 * @property {string} [data] - Optional data payload from RAG (serialized JSON)
 */

/**
 * @typedef {object} LineConnection
 * @property {THREE.Vector3[]} points - Array of two THREE.Vector3 objects
 * @property {string} color - Line color
 */


// --- 3D Components ---

// A single Glyph Node in the 3D space
const GlyphNode = ({ id, position, color, name, isSelected, onSelect }) => {
  const meshRef = useRef();
  const [hovered, setHovered] = useState(false);
  const scale = isSelected ? 1.5 : (hovered ? 1.2 : 1.0);

  // Animate the scale slightly when selected or hovered
  useFrame(() => {
    if (meshRef.current) {
      meshRef.current.scale.lerp(new THREE.Vector3(scale, scale, scale), 0.1);
    }
  });

  return (
    <mesh
      ref={meshRef}
      position={new THREE.Vector3(...position)}
      onClick={(e) => {
        e.stopPropagation();
        onSelect(id);
      }}
      onPointerOver={() => setHovered(true)}
      onPointerOut={() => setHovered(false)}
    >
      <sphereGeometry args={[0.2, 32, 32]} />
      <meshStandardMaterial 
        color={isSelected ? '#FFFF00' : color} // Yellow when selected
        emissive={color}
        emissiveIntensity={hovered ? 0.6 : 0.2}
        transparent
        opacity={0.9}
      />
      {/* Optional: Add a text label */}
      <Text
        position={[0, 0.4, 0]}
        fontSize={0.2}
        color="white"
        anchorX="center"
        anchorY="middle"
      >
        {name}
      </Text>
    </mesh>
  );
};

// Simple Text component (needs to be extended if we don't use Drei's Text)
// Since we are using React Three Drei's Line, let's assume Text is also available or define a simple placeholder
// For simplicity in a single file, we will assume a simple Mesh-based text if we can't fully import Text component.
// Instead of importing Text, we'll use a standard mesh for the label for robustness.
const Text = ({ position, fontSize, color, children }) => (
    <mesh position={position}>
        <sphereGeometry args={[0.01, 8, 8]} /> {/* Minimal visual presence */}
    </mesh>
);


// Component to handle background click for spawning HIL nodes (if needed)
const BackgroundSpawner = ({ onSpawn }) => {
  const { viewport } = useThree();

  return (
    <mesh onClick={(e) => {
      // Convert canvas click to world coordinates
      const vector = new THREE.Vector3(e.point.x, e.point.y, e.point.z);
      // Spawn slightly off the plane to avoid immediate overlap
      onSpawn([vector.x, vector.y, vector.z + 0.5]); 
    }}>
      <planeGeometry args={[viewport.width * 2, viewport.height * 2]} />
      <meshBasicMaterial visible={false} />
    </mesh>
  );
};

// Manifold Constraint Layer (The bounding box/grid)
const ManifoldConstraintLayer = () => {
  return (
    <group>
      {/* Grid Helper for context */}
      <gridHelper args={[20, 20, '#555555', '#333333']} position={[0, -0.01, 0]} />
      {/* Axis Helper */}
      <axesHelper args={[5]} />
    </group>
  );
};

// --- HIL Panel UI Component ---
const HILPanel = ({ nodes, selectedNodeIds, onClearSelection, onSpawnNode, sendRAGQuery, ragState, setRagUrl, ragUrl, setPrompt, prompt }) => {
  const numSelected = selectedNodeIds.size;
  const isSelected = numSelected > 0;
  
  const handleIngestionClick = () => {
    if (prompt.trim()) {
      sendRAGQuery(prompt.trim());
    }
  };

  return (
    <div className="absolute top-4 right-4 bg-gray-900/90 backdrop-blur-sm p-4 rounded-lg shadow-2xl text-white w-full max-w-sm border border-cyan-500/50">
      <h2 className="text-xl font-bold text-cyan-400 mb-4 border-b border-cyan-500/30 pb-2">
        HIL Panel ({nodes.length} Glyphs)
      </h2>

      {/* RAG Ingestion/Query Command Input */}
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-lime-400 mb-2">RAG/vLLM Interface</h3>
        
        {/* RAG URL Input */}
        <div className="mb-3">
          <label className="block text-xs font-medium text-gray-400 mb-1">RAG Backend URL (Cloud Run)</label>
          <input
            type="text"
            className="w-full p-2 bg-gray-800 border border-gray-700 rounded-md text-sm focus:ring-lime-500 focus:border-lime-500 transition"
            value={ragUrl}
            onChange={(e) => setRagUrl(e.target.value)}
            placeholder="e.g., https://vllm-backend-123.a.run.app/api/query"
          />
        </div>

        {/* Command/Prompt Input */}
        <div className="mb-3">
          <label className="block text-xs font-medium text-gray-400 mb-1">Prompt / Ingestion Command</label>
          <textarea
            className="w-full p-2 bg-gray-800 border border-gray-700 rounded-md text-sm focus:ring-cyan-500 focus:border-cyan-500 transition resize-none"
            rows="3"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="e.g., Ingest the latest grant proposal documents for Glyphlight Studios."
          ></textarea>
        </div>
        
        {/* Trigger Button */}
        <button
          onClick={handleIngestionClick}
          disabled={ragState.loading || !ragUrl || !prompt.trim()}
          className="w-full py-2 px-4 rounded-md font-semibold transition-all duration-200 
                     text-gray-900 bg-lime-400 hover:bg-lime-300 disabled:bg-gray-600 disabled:cursor-not-allowed
                     shadow-lg hover:shadow-lime-500/50"
        >
          {ragState.loading ? 'Executing Command...' : 'Execute RAG Command (Trigger Ingestion/Query)'}
        </button>
        
        {/* Status Message */}
        {ragState.message && (
          <p className={`mt-2 p-2 text-xs rounded ${ragState.error ? 'bg-red-900/50 text-red-300' : 'bg-green-900/50 text-green-300'}`}>
            Status: {ragState.message}
          </p>
        )}
      </div>


      {/* Selected Node Details */}
      <h3 className="text-lg font-semibold text-cyan-400 mb-2 mt-6 border-t border-cyan-500/30 pt-4">
        Glyph Selection
      </h3>
      
      <p className="text-sm text-gray-300 mb-3">
        {numSelected} Node{numSelected !== 1 ? 's' : ''} Selected
      </p>

      {isSelected && (
        <button
          onClick={onClearSelection}
          className="w-full py-2 px-4 mb-3 rounded-md font-semibold text-gray-900 bg-red-400 hover:bg-red-500 transition-all duration-200"
        >
          Clear Selection
        </button>
      )}

      {/* Manual Spawn for HIL Testing */}
      <button
        onClick={onSpawnNode}
        className="w-full py-2 px-4 rounded-md font-semibold text-gray-900 bg-blue-400 hover:bg-blue-500 transition-all duration-200"
      >
        + Spawn HIL Node
      </button>

      {/* Debug Info */}
      <div className="mt-4 pt-4 border-t border-gray-700">
        <p className="text-xs text-gray-500">App ID: {appId}</p>
        {ragState.userId && <p className="text-xs text-gray-500 break-all">User ID: {ragState.userId}</p>}
      </div>

    </div>
  );
};


// --- Main Application Component ---
const App = () => {
  const [dbInstance, setDbInstance] = useState(null);
  const [authState, setAuthState] = useState({ user: null, isReady: false });
  const [nodes, setNodes] = useState([]);
  const [linePoints, setLinePoints] = useState([]);
  const [selectedNodeIds, setSelectedNodeIds] = useState(new Set());
  const [nextId, setNextId] = useState(0);

  // RAG State Management
  const [ragUrl, setRagUrl] = useState('https://vllm-backend-example.a.run.app/api/query');
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

      // Attempt to sign in
      const signIn = async () => {
        try {
          if (initialAuthToken) {
            await signInWithCustomToken(auth, initialAuthToken);
          } else {
            await signInAnonymously(auth);
          }
        } catch (e) {
          console.error("Firebase Auth Error:", e);
          // Fallback to anonymous sign-in if custom token fails
          await signInAnonymously(auth);
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
        // Basic data validation and mapping
        if (data.position && data.color && data.name) {
          newNodes.push({
            id: nodeId,
            position: data.position,
            color: data.color,
            name: data.name,
            data: data.data || null // Include RAG data payload
          });

          // Check for highest numeric ID to continue HIL node spawning
          if (!isNaN(parseInt(nodeId))) {
            maxId = Math.max(maxId, parseInt(nodeId));
          }
        }
      });

      setNodes(newNodes);
      setNextId(maxId + 1);
      
      // Update lines based on new nodes (simple connections for now)
      updateLineConnections(newNodes);

    }, (error) => {
      console.error("Firestore snapshot error:", error);
      // Optional: Display error to user
    });

    return () => unsubscribe();
  }, [dbInstance, authState.isReady]);


  // Simple logic to draw lines between all nodes (can be updated for specific connections later)
  const updateLineConnections = (currentNodes) => {
    if (currentNodes.length < 2) {
      setLinePoints([]);
      return;
    }
    
    // For every node, connect it to its two immediate neighbors in the array (creating a simple loop/chain)
    const connections = [];
    for (let i = 0; i < currentNodes.length; i++) {
        const nodeA = currentNodes[i];
        const nodeB = currentNodes[(i + 1) % currentNodes.length]; // Wrap around for a loop
        
        connections.push({
            points: [
                new THREE.Vector3(...nodeA.position), 
                new THREE.Vector3(...nodeB.position)
            ],
            color: '#808080' // Gray connecting lines
        });
    }

    setLinePoints(connections);
  };


  // --- Node Interaction Handlers ---

  const handleNodeSelect = useCallback((id) => {
    setSelectedNodeIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const handleClearSelection = useCallback(() => {
    setSelectedNodeIds(new Set());
  }, []);
  
  // HIL Node Spawner
  const handleSpawnNode = useCallback(async (position = [Math.random() * 10 - 5, Math.random() * 5, Math.random() * 10 - 5]) => {
    if (!dbInstance || !authState.user) {
      alert("System not ready or not authenticated. Please wait.");
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
      // Use the 'nextId' as the document ID for simple, sequential HIL nodes
      const docRef = doc(dbInstance, `/artifacts/${appId}/public/data/glyphs`, nextId.toString());
      await setDoc(docRef, newNode);
      console.log("HIL Node spawned and saved with ID:", nextId);
    } catch (e) {
      console.error("Error adding document: ", e);
    }
  }, [dbInstance, authState.user, nextId]);


  // --- RAG/Ingestion Logic ---

  // Exponential backoff utility for robust API calls
  const exponentialBackoffFetch = async (url, options, retries = 3, delay = 1000) => {
    for (let i = 0; i < retries; i++) {
        try {
            const response = await fetch(url, options);
            if (!response.ok) {
                // If it's a 4xx or 5xx error, throw it to trigger retry
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            return response;
        } catch (error) {
            if (i === retries - 1) throw error; // Re-throw the error on the last attempt
            await new Promise(resolve => setTimeout(resolve, delay * Math.pow(2, i)));
        }
    }
  };
  
  const sendRAGQuery = async (queryPrompt) => {
    if (!ragUrl || ragState.loading) return;

    setRagState({ loading: true, message: 'Sending command to RAG backend...', error: false, userId: ragState.userId });
    
    try {
        // Construct the payload for the RAG service
        const payload = {
            prompt: queryPrompt,
            // Include user context if needed by the backend
            user_id: authState.user?.uid || 'anonymous', 
            app_id: appId,
            // You can add data source info here for GCS ingestion:
            // command: queryPrompt.includes("Ingest") ? "ingest" : "query"
        };
        
        // This simulates a call to your Cloud Run vLLM/RAG backend
        const response = await exponentialBackoffFetch(ragUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                // Add any necessary authorization headers here if your backend requires them
            },
            body: JSON.stringify(payload),
        });

        const result = await response.json();

        // Assuming the RAG service successfully processes the request.
        // If ingestion or node creation is successful, the Firestore listener will auto-update the graph.
        setRagState({ 
          loading: false, 
          message: `Command success! Response: ${result.message || 'Processing initiated.'}. Expect graph updates shortly.`, 
          error: false, 
          userId: ragState.userId 
        });
        
    } catch (e) {
        console.error("RAG Query Error:", e);
        setRagState({ 
          loading: false, 
          message: `RAG API Error: ${e.message}. Check URL and backend status.`, 
          error: true, 
          userId: ragState.userId 
        });
    }
  };


  return (
    <div className="w-full h-screen bg-gray-900 font-sans relative">
      <Canvas 
        className="w-full h-full"
        camera={{ position: [0, 5, 15], fov: 60 }}
        shadows
      >
        {/* Holographic Lighting */}
        <ambientLight intensity={0.5} color="cyan" />
        <pointLight position={[10, 10, 10]} intensity={1} color="lime" />
        <pointLight position={[-10, -10, -10]} intensity={0.5} color="orange" />
        
        {/* Orbit Controls to allow rotation and zooming */}
        <OrbitControls enableDamping dampingFactor={0.05} />

        {/* --- Manifold Constraint Layer (Boundary) --- */}
        <ManifoldConstraintLayer />
        
        {/* Render all GΛLYPH Nodes (Axiomatic and RAG-Derived) */}
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
        {linePoints.map((connection, index) => (
          <Line
            key={index}
            points={connection.points}
            color={connection.color}
            lineWidth={2}
            dashed={false}
          />
        ))}
        
        {/* Background Click Spawner (Optional: If clicking background spawns HIL nodes) */}
        {/* <BackgroundSpawner onSpawn={handleSpawnNode} /> */}
        
      </Canvas>
      
      {/* HIL Control Panel */}
      <HILPanel
        nodes={nodes}
        selectedNodeIds={selectedNodeIds}
        onClearSelection={handleClearSelection}
        onSpawnNode={() => handleSpawnNode([0, 2, 0])} // Spawn at a visible center point
        sendRAGQuery={sendRAGQuery}
        ragState={ragState}
        setRagUrl={setRagUrl}
        ragUrl={ragUrl}
        setPrompt={setPrompt}
        prompt={prompt}
      />

    </div>
  );
};

export default App;

