import { Canvas, useFrame } from '@react-three/fiber'
import { OrbitControls, Line } from '@react-three/drei' 
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

// Helper function to create a texture with text on it
function createTextTexture(text, color, fontSize = 64) { // Increased font size slightly to match larger plane
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');
  
  // FIX: Increased canvas width to 1024 for better horizontal padding
  canvas.width = 1024; 
  canvas.height = 128; // Height remains sufficient

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
    // Subtle, slow rotation for the boundary cage
    if (meshRef.current) {
      meshRef.current.rotation.y += delta * 0.01;
      meshRef.current.rotation.x += delta * 0.005;
    }
  });

  return (
    <mesh ref={meshRef} position={[0, 0, 0]}>
      {/* Using a Dodecahedron to suggest a higher-dimensional boundary structure */}
      <dodecahedronGeometry args={[5.5, 0]} /> 
      <meshBasicMaterial 
        color="#00ffff" // Cyan/light blue for boundary
        wireframe={true} 
        transparent={true}
        opacity={0.15} // Very subtle boundary
      />
    </mesh>
  );
}

// 1. The GΛLYPH NODE Component (Uses Canvas Text Mesh)
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
      
      {/* Text Mesh using Canvas Texture (Fixed dimensions for longer text) */}
      <mesh position={[0, 0.8, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        {/* FIX: Increased plane width to 4.5 for more room */}
        <planeGeometry args={[4.5, 0.8]} /> 
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

// 3. Main Application (The CapsuleOS Interface - Phase 9 Full Text Fidelity)
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


  // Load initial data on mount
  useEffect(() => {
    setNodes(INITIAL_AXIOMATIC_NODES);
    setConstraints(INITIAL_AXIOMATIC_CONSTRAINTS);
  }, []);


  const handleSpawn = useCallback((pos) => {
    const newId = `spawn-${Date.now()}`
    const newNode = { 
      id: newId, 
      name: `Spawned ${nodes.length + 1}`,
      color: 'white', 
      position: pos 
    }
    
    const existingNode = nodes[Math.floor(Math.random() * nodes.length)];
    const newConstraint = [newId, existingNode.id, 'white']; 

    setNodes(c => [...c, newNode])
    setConstraints(c => [...c, newConstraint])
  }, [nodes])

  return (
    // FINAL CSS FIX: Use 100vw and dvh for full mobile compatibility
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
        <br/>Nodes (Glyphs): {nodes.length} | Constraints (Wires): {constraints.length}
        <br/>Status: Text Fidelity Locked.
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
        />
        
        {/* Holographic Lighting */}
        <ambientLight intensity={0.5} color="cyan" />
        <pointLight position={[10, 10, 10]} intensity={1} color="lime" />
        <pointLight position={[-10, -10, -10]} intensity={0.5} color="orange" />

        {/* --- Manifold Constraint Layer --- */}
        <ManifoldConstraintLayer />

        {/* Render all GΛLYPH Nodes (Axiomatic and Spawned) */}
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

        {/* HIL Input Spawner */}
        <BackgroundSpawner onSpawn={handleSpawn} />

      </Canvas>
    </div>
  )
}

