import { Canvas, useThree, useFrame } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import { useState, useRef, useEffect, useCallback } from 'react'
import * as THREE from 'three'

// --- Axiomatic Data Initialization ---
// Slightly adjusted positions to bring the cluster closer to the center of the frame
const INITIAL_AXIOMATIC_NODES = [
  { id: 'rag-orch', name: 'Multi-Agent RAG', color: 'cyan', position: [2.0, 1.0, 0] },
  { id: 'glyph-eng', name: 'GΛLYPH Engine', color: 'lime', position: [-2.0, 1.0, 0] },
  { id: 'vgm-anchor', name: 'VGM Anchor', color: 'cyan', position: [0, 2.5, -1.5] },
  { id: 'manifold', name: 'Manifold Constraint', color: 'lime', position: [0, -2.5, 1.5] },
  { id: 'hax', name: 'HIL Agent X', color: 'orange', position: [3, -0.5, -0.5] },
];

// Constraints array remains empty for this phase
const INITIAL_AXIOMATIC_CONSTRAINTS = []; 


// 1. The GΛLYPH NODE Component (Still omitting Text for stability)
function GlyphNode({ position, color, onClick }) {
  const meshRef = useRef()
  
  useFrame((state, delta) => {
    if (meshRef.current) {
      meshRef.current.rotation.x += delta * 0.2
      meshRef.current.rotation.y += delta * 0.1
    }
  })

  return (
    <group position={position} onClick={onClick}>
      <mesh ref={meshRef}>
        <icosahedronGeometry args={[0.4, 0]} /> 
        <meshBasicMaterial color={color} wireframe />
      </mesh>
      {/* Text component omitted for stability test */}
    </group>
  )
}

// 2. Background Click Handler for Spawning (HIL Input)
function BackgroundSpawner({ onSpawn }) {
  const handleClick = useCallback((e) => {
    e.stopPropagation() 
    if (e.point) {
      onSpawn(e.point.toArray())
    }
  }, [onSpawn])

  // A large, transparent mesh that covers the background to capture clicks
  return (
    <mesh onClick={handleClick}>
      {/* Use a much larger plane to ensure it covers the entire view regardless of zoom/aspect ratio */}
      <planeGeometry args={[200, 200]} /> 
      <meshBasicMaterial visible={false} />
    </mesh>
  )
}

// 3. Main Application (The CapsuleOS Interface - Phase 3 Fix)
export default function App() {
  const [nodes, setNodes] = useState([])
  const [constraints, setConstraints] = useState([])

  // Load initial data on mount
  useEffect(() => {
    setNodes(INITIAL_AXIOMATIC_NODES);
    setConstraints(INITIAL_AXIOMATIC_CONSTRAINTS);
  }, []);


  const handleSpawn = useCallback((pos) => {
    const newId = `spawn-${Date.now()}`
    const newNode = { 
      id: newId, 
      name: 'Spawned Glyph', 
      color: 'orange', 
      position: pos 
    }
    
    // Add the new node
    setNodes(c => [...c, newNode])
    // No constraint added in this phase
  }, [])

  return (
    // Ensure the container fills the screen
    <div className="w-full h-screen bg-gray-950"> 
      {/* CEX View: 2D Control Surface Overlay (Axiomatic Metrics Display) */}
      <div 
        style={{
          position: 'absolute',
          top: '20px', left: '20px',
          color: 'lime',
          fontFamily: 'monospace',
          zIndex: 10,
          background: 'rgba(0, 0, 0, 0.5)',
          padding: '8px 12px',
          borderRadius: '8px',
          fontSize: '14px',
          boxShadow: '0 0 10px rgba(50, 255, 50, 0.5)'
        }}
      >
        CAPSULE OS | **DEX View** Operational (Phase 3 Test)
        <br/>Nodes (Glyphs): {nodes.length} | Constraints (Wires): {constraints.length}
        <br/>Status: Display Fidelity Locked
      </div>

      {/* DEX View: 3D Computational Graph */}
      <Canvas 
        // Explicitly force the canvas to fill the parent container
        style={{ width: '100%', height: '100%', display: 'block' }} 
        camera={{ position: [0, 0, 10] }} // Moved camera closer for better view of nodes
      >
        {/* HIL Control: OrbitControls */}
        <OrbitControls enableDamping dampingFactor={0.05} />
        
        {/* Holographic Lighting */}
        <ambientLight intensity={0.5} color="cyan" />
        <pointLight position={[10, 10, 10]} intensity={1} color="lime" />
        <pointLight position={[-10, -10, -10]} intensity={0.5} color="orange" />

        {/* Render all GΛLYPH Nodes (Axiomatic and Spawned) */}
        {nodes.map(node => (
          <GlyphNode 
            key={node.id} 
            position={node.position} 
            color={node.color} 
            onClick={() => console.log(`Node ${node.name} activated. HIL interaction log.`)}
          />
        ))}

        {/* HIL Input Spawner */}
        <BackgroundSpawner onSpawn={handleSpawn} />

      </Canvas>
    </div>
  )
}

