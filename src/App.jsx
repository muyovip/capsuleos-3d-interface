import { Canvas, useThree, useFrame } from '@react-three/fiber'
// Reintroducing Text
import { OrbitControls, Line, Text } from '@react-three/drei' 
import { useState, useRef, useEffect, useCallback, useMemo } from 'react'
import * as THREE from 'three'

// --- Axiomatic Data Initialization ---
const INITIAL_AXIOMATIC_NODES = [
  { id: 'rag-orch', name: 'Multi-Agent RAG', color: 'cyan', position: [2.0, 1.0, 0] },
  { id: 'glyph-eng', name: 'GΛLYPH Engine', color: 'lime', position: [-2.0, 1.0, 0] },
  { id: 'vgm-anchor', name: 'VGM Anchor', color: 'cyan', position: [0, 2.5, -1.5] },
  { id: 'manifold', name: 'Manifold Constraint', color: 'lime', position: [0, -2.5, 1.5] },
  { id: 'hax', name: 'HIL Agent X', color: 'orange', position: [3, -0.5, -0.5] },
];

const INITIAL_AXIOMATIC_CONSTRAINTS = [
  ['rag-orch', 'glyph-eng', 'lime'],
  ['rag-orch', 'vgm-anchor', 'cyan'],
  ['glyph-eng', 'manifold', 'lime'],
  ['vgm-anchor', 'hax', 'orange'],
  ['manifold', 'hax', 'orange'],
]; 

// 1. The GΛLYPH NODE Component (Includes Text)
function GlyphNode({ position, color, name, onClick }) {
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
      
      {/* Reintroducing Text: Safest configuration */}
      <Text 
        position={[0, 0.7, 0]} // Offset above the node
        fontSize={0.4} 
        color={color} 
        font="/fonts/Inter-Bold.woff" // Placeholder font path
        anchorX="center" 
        anchorY="middle"
      >
        {name}
      </Text>
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

// 3. Main Application (The CapsuleOS Interface - Phase 6 Final Fidelity)
export default function App() {
  const [nodes, setNodes] = useState([])
  const [constraints, setConstraints] = useState([])
  
  // State for dynamic height fix
  const [viewportHeight, setViewportHeight] = useState('100vh');

  // CRITICAL FIX: Dynamic viewport height calculation for mobile
  useEffect(() => {
    const handleResize = () => {
      setViewportHeight(`${window.innerHeight}px`);
    };

    // Set initial height
    handleResize();

    // Attach resize listener to handle dynamic address bars
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);


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
        // Line component expects THREE.Vector3 objects
        points.push({
          points: [new THREE.Vector3(...startPos), new THREE.Vector3(...endPos)],
          color: color
        });
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
      color: 'white', 
      position: pos 
    }
    
    // Simple logic to link new node to a random existing node
    const existingNode = nodes[Math.floor(Math.random() * nodes.length)];
    const newConstraint = [newId, existingNode.id, 'white']; 

    setNodes(c => [...c, newNode])
    setConstraints(c => [...c, newConstraint])
  }, [nodes])

  return (
    // CRITICAL FIX: Apply dynamic height to the container
    <div className="absolute inset-0 bg-gray-950" style={{ height: viewportHeight }}> 
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
        <br/>Nodes (Glyphs): {nodes.length} | Constraints (Wires): {constraints.length}
        <br/>Status: Final Fidelity Lock
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
          minDistance={5} 
          maxDistance={30} 
          touches={{
            ONE: THREE.TOUCH.ROTATE,
            TWO: THREE.TOUCH.DOLLY,
            THREE: THREE.TOUCH.PAN,
          }}
          // Ensures the control area uses the entire canvas element
          domElement={document.querySelector('canvas') || undefined}
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
            name={node.name} // Pass name for text rendering
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

        {/* HIL Input Spawner */}
        <BackgroundSpawner onSpawn={handleSpawn} />

      </Canvas>
    </div>
  )
}

