import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Line, Text } from '@react-three/drei';
import * as THREE from 'three';

// --- FIREBASE IMPORTS ---
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, doc, setDoc, onSnapshot, collection, query } from 'firebase/firestore';

// --- CONFIGURATION ---
// Using the simple, self-illuminating style you liked
const CAPSULE_COLOR = "lime";
const SELECTED_COLOR = "magenta";
const WIREFRAME_THICKNESS = 0.02; // For visual weight

// --- AXIOMATIC DATA (Fallback) ---
const INITIAL_SYSTEM_STATE = {
  nodes: [
    { id: 'rag-orch', name: 'Multi-Agent RAG', position: [2.0, 1.0, 0] },
    { id: 'glyph-eng', name: 'GΛLYPH Engine', position: [-2.0, 1.0, 0] },
    { id: 'vgm-anchor', name: 'VGM Anchor', position: [0, 2.5, -1.5] },
    { id: 'manifold', name: 'Manifold Constraint', position: [0, -2.5, 1.5] },
    { id: 'hax', name: 'HIL Agent X', position: [3, -0.5, -0.5] },
  ],
  constraints: [
    ['rag-orch', 'glyph-eng'],
    ['rag-orch', 'vgm-anchor'],
    ['glyph-eng', 'manifold'],
    ['vgm-anchor', 'hax'],
    ['manifold', 'hax'],
  ],
};

// --- COMPONENTS ---

// 1. The Capsule Node (Restored to your preferred style)
const Capsule = ({ position, name, isSelected, onClick }) => {
  const mesh = useRef();
  
  useFrame((state, delta) => {
    if (mesh.current) {
      // The signature rotation you liked
      mesh.current.rotation.x += delta * 0.5;
      mesh.current.rotation.y += delta * 0.3;
    }
  });

  return (
    <group position={position} onClick={(e) => { e.stopPropagation(); onClick(); }}>
      <mesh ref={mesh}>
        {/* The classic Sphere geometry */}
        <sphereGeometry args={[0.8, 32, 32]} />
        {/* MeshBasicMaterial is self-illuminating. It CANNOT be black. */}
        <meshBasicMaterial 
          color={isSelected ? SELECTED_COLOR : CAPSULE_COLOR} 
          wireframe={true} 
        />
      </mesh>
      
      {/* Simple, always-visible text label */}
      <Text
        position={[0, 1.2, 0]}
        fontSize={0.4}
        color={isSelected ? SELECTED_COLOR : CAPSULE_COLOR}
        anchorX="center"
        anchorY="middle"
        billboard // Always faces camera
      >
        {name}
      </Text>
    </group>
  );
};

// 2. HIL Intervention Panel (The Control Surface)
const HILPanel = ({ selectedNodeId, onClose, onIngest }) => {
  if (!selectedNodeId) return null;

  return (
    <div style={{
      position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
      backgroundColor: 'rgba(0, 0, 0, 0.9)', border: '2px solid lime', padding: '20px',
      zIndex: 20, color: 'lime', fontFamily: 'monospace', minWidth: '300px'
    }}>
      <h3 style={{ margin: '0 0 10px 0', borderBottom: '1px solid lime' }}>
        // NODE INTERFACE: {selectedNodeId}
      </h3>
      <div style={{ marginBottom: '15px' }}>
        Status: ACTIVE<br/>
        Type: AXIOMATIC_CORE<br/>
        Protocol: GΛLYPH_V1
      </div>
      <div style={{ display: 'flex', gap: '10px' }}>
        <button 
          onClick={onIngest}
          style={{ 
            background: 'lime', color: 'black', border: 'none', padding: '8px 16px', 
            cursor: 'pointer', fontWeight: 'bold' 
          }}
        >
          INJECT RAG DATA
        </button>
        <button 
          onClick={onClose}
          style={{ 
            background: 'transparent', color: 'lime', border: '1px solid lime', padding: '8px 16px', 
            cursor: 'pointer' 
          }}
        >
          CLOSE
        </button>
      </div>
    </div>
  );
};

// 3. Main Application
export default function App() {
  const [nodes, setNodes] = useState(INITIAL_SYSTEM_STATE.nodes);
  const [constraints] = useState(INITIAL_SYSTEM_STATE.constraints);
  const [selectedId, setSelectedId] = useState(null);
  
  // --- FIREBASE SETUP (Ideally logic stays here, but simplified for visual stability) ---
  const [db, setDb] = useState(null);

  useEffect(() => {
    try {
        const config = JSON.parse(typeof __firebase_config !== 'undefined' ? __firebase_config : '{}');
        if (config.projectId) {
            const app = initializeApp(config);
            const auth = getAuth(app);
            const firestore = getFirestore(app);
            setDb(firestore);
            
            signInAnonymously(auth).catch(err => console.error("Auth failed", err));

            // Listen for new nodes (Your RAG connection)
            const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
            const unsubscribe = onSnapshot(collection(firestore, `artifacts/${appId}/public/data/axiom_nodes`), (snap) => {
                const newNodes = [];
                snap.forEach(doc => newNodes.push({ id: doc.id, ...doc.data() }));
                if (newNodes.length > 0) setNodes(newNodes);
            });
            return () => unsubscribe();
        }
    } catch (e) {
        console.log("Running in offline/fallback mode");
    }
  }, []);

  // Handle RAG Injection Simulation
  const handleIngest = () => {
    console.log("Triggering RAG Ingestion for:", selectedId);
    // If DB connected, write to Firestore here
    alert(`RAG Signal Sent to ${selectedId}`);
  };

  // Generate Lines
  const lines = useMemo(() => {
    const map = new Map(nodes.map(n => [n.id, n.position]));
    return constraints.map(([start, end]) => ({
      start: map.get(start),
      end: map.get(end)
    })).filter(l => l.start && l.end);
  }, [nodes, constraints]);

  return (
    <div style={{ width: '100vw', height: '100vh', background: 'black' }}>
      {/* HUD */}
      <div style={{
        position: 'absolute', top: 10, left: 10, color: 'lime', fontFamily: 'monospace', zIndex: 10
      }}>
        CapsuleOS | Nodes: {nodes.length} | {db ? 'ONLINE' : 'OFFLINE MODE'}
      </div>

      <Canvas camera={{ position: [0, 0, 10] }}>
        <OrbitControls />
        
        {/* We don't strictly need lights for BasicMaterial, but adding ambient just in case */}
        <ambientLight intensity={0.5} />

        {/* Render Nodes */}
        {nodes.map(node => (
          <Capsule 
            key={node.id} 
            {...node} 
            isSelected={selectedId === node.id}
            onClick={() => setSelectedId(node.id)}
          />
        ))}

        {/* Render Connections */}
        {lines.map((l, i) => (
          <Line 
            key={i} 
            points={[l.start, l.end]} 
            color="lime" 
            lineWidth={1} 
            transparent 
            opacity={0.3} 
          />
        ))}
      </Canvas>

      {/* HIL Panel Overlay */}
      <HILPanel 
        selectedNodeId={selectedId} 
        onClose={() => setSelectedId(null)} 
        onIngest={handleIngest} 
      />
    </div>
  );
}


