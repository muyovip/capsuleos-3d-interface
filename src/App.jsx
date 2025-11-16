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

const INITIAL_AXIOMATIC_CONSTRAINTS = []; 

// 1. The GΛLYPH NODE Component
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
      <planeGeometry args={[200, 200]} /> 
      <meshBasicMaterial visible={false} />
    </mesh>
  )
}

// 3. Main Application (The CapsuleOS Interface - Phase 4 Mobile Fix)
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
    // CRITICAL: Ensure the container is guaranteed to fill the viewport
    <div className="w-screen h-screen bg-gray-950"> 
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
        CAPSULE OS | **DEX View** Operational (Phase 4 Test)
        <br/>Nodes (Glyphs): {nodes.length} | Constraints (Wires): {constraints.length}
        <br/>Status: Mobile Fidelity Locked
      </div>

      {/* DEX View: 3D Computational Graph */}
      <Canvas 
        // CRITICAL: Ensure the canvas itself fills the container
        className="w-full h-full"
        style={{ display: 'block' }} 
        // Explicitly set clipping planes to stabilize zoom
        camera={{ position: [0, 0, 10], near: 0.1, far: 100 }} 
      >
        {/* HIL Control: OrbitControls */}
        <OrbitControls 
          enableDamping 
          dampingFactor={0.05} 
          minDistance={3} // Prevents zooming too close to nodes
          maxDistance={30} // Prevents zooming too far away
          // Ensure touch controls are properly configured for mobile
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

