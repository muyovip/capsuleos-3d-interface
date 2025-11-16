import { Canvas, useThree } from '@react-three/fiber'
import { OrbitControls, Text, Line } from '@react-three/drei'
import { useState, useRef, useMemo, useEffect, useCallback } from 'react'
import * as THREE from 'three'

// --- Axiomatic Data Initialization ---
const INITIAL_AXIOMATIC_NODES = [
  { id: 'rag-orch', name: 'Multi-Agent RAG', color: 'cyan', position: [2.5, 1.5, 0] },
  { id: 'glyph-eng', name: 'GΛLYPH Engine', color: 'lime', position: [-2.5, 1.5, 0] },
  { id: 'vgm-anchor', name: 'VGM Anchor', color: 'cyan', position: [0, 3, -2] },
  { id: 'manifold', name: 'Manifold Constraint', color: 'lime', position: [0, -3, 2] },
  { id: 'hax', name: 'HIL Agent X', color: 'orange', position: [4, -1, -1] },
];

const INITIAL_AXIOMATIC_CONSTRAINTS = [
  { startId: 'rag-orch', endId: 'glyph-eng', color: 'cyan' },
  { startId: 'glyph-eng', endId: 'vgm-anchor', color: 'lime' },
  { startId: 'vgm-anchor', endId: 'manifold', color: 'cyan' },
  { startId: 'manifold', endId: 'rag-orch', color: 'lime' },
  { startId: 'glyph-eng', endId: 'hax', color: 'orange' },
];

// 1. The GΛLYPH NODE Component
function GlyphNode({ position, color, label, onClick }) {
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
      {label && (
        <Text 
          position={[0, 0.6, 0]} 
          fontSize={0.25} 
          color={color} 
          anchorX="center" 
          anchorY="middle"
          // Removed material-depthTest={false} for stability
        >
          {label}
        </Text>
      )}
    </group>
  )
}


// 2. Lattice Constraint Renderer (The Wires)
function LatticeConstraintRenderer({ nodes, constraints }) {
  // Use a map for fast lookup of node positions
  const nodeMap = useMemo(() => {
    return nodes.reduce((map, node) => {
      map[node.id] = node.position
      return map
    }, {})
  }, [nodes])


  // Render the lines connecting the nodes
  return (
    <group>
      {constraints.map((constraint, index) => {
        const startPos = nodeMap[constraint.startId]
        const endPos = nodeMap[constraint.endId]
        
        // Explicitly check for both points to ensure a valid line geometry is built
        if (startPos && endPos) {
          return (
            <Line
              key={index}
              points={[startPos, endPos]} 
              color={constraint.color || 'white'}
              lineWidth={1.5}
              opacity={0.8}
            />
          )
        }
        return null
      })}
    </group>
  )
}

// 3. Background Click Handler for Spawning (HIL Input)
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
      <planeGeometry args={[100, 100]} />
      <meshBasicMaterial visible={false} />
    </mesh>
  )
}

// 4. Main Application (The CapsuleOS Interface)
export default function App() {
  const [nodes, setNodes] = useState([])
  const [constraints, setConstraints] = useState([])

  // Load initial data on mount (Ensures data is present after component initializes)
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
    
    // Axiomatic Rule: Automatically connect the new node to the Manifold Constraint
    setConstraints(c => [...c, { startId: 'manifold', endId: newId, color: 'orange' }])
  }, [])

  return (
    // Set a dark, full-screen background for the holographic effect (CEX View container)
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
        CAPSULE OS | **DEX View** Operational
        <br/>Nodes (Glyphs): {nodes.length} | Constraints (Wires): {constraints.length}
        <br/>Status: Structural Fidelity Locked
      </div>

      {/* DEX View: 3D Computational Graph */}
      <Canvas 
        style={{ width: '100%', height: '100%' }}
        camera={{ position: [0, 0, 15] }} // Adjusted camera position for stability
      >
        {/* HIL Control: OrbitControls allows for deterministic auditing of the graph */}
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
            label={node.name}
            onClick={() => console.log(`Node ${node.name} activated. Console output for HIL interaction.`)}
          />
        ))}

        {/* Render the Lattice Constraints (The Wires) */}
        <LatticeConstraintRenderer nodes={nodes} constraints={constraints} />

        {/* HIL Input Spawner */}
        <BackgroundSpawner onSpawn={handleSpawn} />

      </Canvas>
    </div>
  )
}

