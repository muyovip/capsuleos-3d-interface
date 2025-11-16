import { Canvas, useThree, useFrame } from '@react-three/fiber'
import { OrbitControls, Line } from '@react-three/drei' // Line component re-introduced
import { useState, useRef, useEffect, useCallback, useMemo } from 'react'
import * as THREE from 'three'

// --- Axiomatic Data Initialization ---
// Node positions for the 5-node GΛLYPH
const INITIAL_AXIOMATIC_NODES = [
  { id: 'rag-orch', name: 'Multi-Agent RAG', color: 'cyan', position: [2.0, 1.0, 0] },
  { id: 'glyph-eng', name: 'GΛLYPH Engine', color: 'lime', position: [-2.0, 1.0, 0] },
  { id: 'vgm-anchor', name: 'VGM Anchor', color: 'cyan', position: [0, 2.5, -1.5] },
  { id: 'manifold', name: 'Manifold Constraint', color: 'lime', position: [0, -2.5, 1.5] },
  { id: 'hax', name: 'HIL Agent X', color: 'orange', position: [3, -0.5, -0.5] },
];

// Defined Lattice Constraints (Wires)
const INITIAL_AXIOMATIC_CONSTRAINTS = [
  ['rag-orch', 'glyph-eng', 'lime'], // Node 1 to Node 2
  ['rag-orch', 'vgm-anchor', 'cyan'], // Node 1 to Node 3
  ['glyph-eng', 'manifold', 'lime'], // Node 2 to Node 4
  ['vgm-anchor', 'hax', 'orange'], // Node 3 to Node 5
  ['manifold', 'hax', 'orange'], // Node 4 to Node 5
]; 

// 1. The GΛLYPH NODE Component (Still omitting Text)
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
      {/* Text component omitted - this is the final stability test target */}
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

  return (
    <mesh onClick={handleClick}>
      <planeGeometry args={[200, 200]} /> 
      <meshBasicMaterial visible={false} />
    </mesh>
  )
}

// 3. Main Application (The CapsuleOS Interface - Phase 5 Stability Test)
export default function App() {
  const [nodes, setNodes] = useState([])
  const [constraints, setConstraints] = useState([])

  // Utility to find node position by ID
  const nodeMap = useMemo(() => {
    return new Map(nodes.map(node => [node.id, node.position]));
  }, [nodes]);

  // Generate line points from node constraints
  const linePoints = useMemo(() => {
    const points = [];
    constraints.forEach(([startId, endId]) => {
      const startPos = nodeMap.get(startId);
      const endPos = nodeMap.get(endId);
      if (startPos && endPos) {
        // Line component expects THREE.Vector3 objects
        points.push([
            new THREE.Vector3(...startPos), 
            new THREE.Vector3(...endPos)
        ]);
      }
    });
    return points;
  }, [constraints, nodeMap]);


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
    // CRITICAL FIX: Use 'absolute inset-0' to guarantee full viewport coverage and proper touch area.
    <div className="absolute inset-0 bg-gray-950"> 
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
        CAPSULE OS | **DEX View** Operational (Phase 5 Test)
        <br/>Nodes (Glyphs): {nodes.length} | Constraints (Wires): {constraints.length}
        <br/>Status: Lattice Constraint Test
      </div>

      {/* DEX View: 3D Computational Graph */}
      <Canvas 
        className="w-full h-full"
        style={{ display: 'block' }} 
        camera={{ position: [0, 0, 10], near: 0.1, far: 100 }} 
      >
        {/* HIL Control: OrbitControls */}
        <OrbitControls 
          enableDamping 
          dampingFactor={0.05} 
          minDistance={5} // Increased minDistance slightly to aid clipping
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

        {/* Render all GΛLYPH Nodes (Axiomatic and Spawned) */}
        {nodes.map(node => (
          <GlyphNode 
            key={node.id} 
            position={node.position} 
            color={node.color} 
            onClick={() => console.log(`Node ${node.name} activated. HIL interaction log.`)}
          />
        ))}

        {/* Render Lattice Constraints (Wires) */}
        {linePoints.map((points, index) => (
          <Line
            key={index}
            points={points}
            color={constraints[index][2]} // Use the defined constraint color
            lineWidth={2}
            dashed={false}
          />
        ))}

        {/* HIL Input Spawner */}
        <BackgroundSpawner onSpawn={handleSpawn} />

      </Canvas>
    </div>
  )
}

