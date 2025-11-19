import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, Line, Text } from '@react-three/drei';
import * as THREE from 'three';

// --- CONFIGURATION ---
const NODE_COUNT = 3;
const NODE_DATA = [
  { id: 'node-1', name: 'Manifold Constraint', position: [4, 0, 0], color: 'cyan', memory: 'Constraint Layer 1: ACTIVE. State: Manifold geometry stable. Core function: Topology regularization. Status: OK.' },
  { id: 'node-2', name: 'Multi-Agent RAG', position: [-4, 0, 0], color: 'lime', memory: 'RAG Engine Status: ONLINE. Agents: 4. Index size: 7,892 vectors. Last successful sync: T+00:03:12. Core function: Semantic context retrieval. Status: WARNING (Low latency).' },
  { id: 'node-3', name: 'Glyph Engine', position: [0, 5, 0], color: 'magenta', memory: 'Glyph Engine Status: IDLE. Axiom Count: 5. Glyph storage: /artifacts/capsuleos/users/userId/glyphs. Next operation: Awaiting new document ingress. Core function: Axiomatic data generation. Status: OK.' },
];
const CONNECTION_COLOR = '#0f766e'; // Teal

// --- UTILITY COMPONENTS ---

// Function to generate the line points for visualization
const generateLinePoints = (nodes) => {
  const points = [];
  // Connect all nodes in a chain for simplicity
  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      points.push({
        points: [
          new THREE.Vector3(...nodes[i].position),
          new THREE.Vector3(...nodes[j].position),
        ],
        color: CONNECTION_COLOR,
      });
    }
  }
  return points;
};

// Component for the single, interactive Node
const GlyphNode = React.memo(({ id, position, color, name, isSelected, onSelect }) => {
  const meshRef = useRef();
  const [hovered, setHover] = useState(false);

  // Animate on hover/selection
  useFrame(({ clock }) => {
    if (meshRef.current) {
      const t = clock.getElapsedTime();
      
      // Gentle rotation
      meshRef.current.rotation.x = t * 0.1;
      meshRef.current.rotation.y = t * 0.2;

      // Pulse animation for selected/hovered nodes
      const pulseScale = isSelected || hovered ? 1.0 + Math.sin(t * 8) * 0.1 : 1.0;
      meshRef.current.scale.setScalar(pulseScale);
    }
  });

  const handleClick = useCallback((event) => {
    event.stopPropagation();
    onSelect(id, name);
  }, [id, name, onSelect]);

  return (
    <group position={position} onClick={handleClick}>
      <mesh
        ref={meshRef}
        onPointerOver={() => setHover(true)}
        onPointerOut={() => setHover(false)}
      >
        <sphereGeometry args={[1, 32, 32]} />
        {/* Main material: Wireframe with color */}
        <meshBasicMaterial
          color={color}
          wireframe={true}
          wireframeLinewidth={2}
          depthTest={true}
          transparent={true}
          opacity={0.8}
        />
      </mesh>
      
      {/* Glow Effect (using pointLight) */}
      <pointLight 
        position={[0, 0, 0]} 
        intensity={isSelected ? 10 : 3} 
        color={isSelected ? 'magenta' : color} 
        distance={isSelected ? 10 : 5}
      />
      
      {/* Label Text */}
      <Text
        position={[0, 1.5, 0]}
        fontSize={0.5}
        color={color}
        anchorX="center"
        anchorY="middle"
        font="https://fonts.gstatic.com/s/inter/v13/UcCO3FfSsPBPVq4zKXjBTA.woff"
      >
        {name}
      </Text>
    </group>
  );
});

// Component to handle background clicks for potential spawning (currently non-functional)
const BackgroundSpawner = ({ onSpawn }) => {
    const { gl } = useThree();
    
    // Disable the right-click context menu within the canvas
    useEffect(() => {
        const handleContextMenu = (e) => e.preventDefault();
        gl.domElement.addEventListener('contextmenu', handleContextMenu);
        return () => gl.domElement.removeEventListener('contextmenu', handleContextMenu);
    }, [gl]);

    // Current implementation is a NO-OP, as requested by the user, 
    // but the component placeholder remains.
    const handleClick = useCallback((event) => {
        // Stop propagation so controls don't trigger.
        event.stopPropagation(); 
        // We do not implement the spawning logic yet, but the handler is here.
        console.log("Background clicked. Spawning feature is currently disabled.");
    }, []);

    return (
        <mesh onClick={handleClick} position={[0, 0, 0]}>
            <planeGeometry args={[100, 100]} />
            <meshBasicMaterial transparent opacity={0} side={THREE.DoubleSide} />
        </mesh>
    );
};

// --- HIL INTERVENTION PANEL ---
const HILInterventionPanel = ({ content, onClose }) => {
  const panelRef = useRef();
  
  // Use a different color for the terminal-style output
  const terminalColor = '#38bdf8'; // Sky Blue
  
  if (!content) return null;

  return (
    <div 
      ref={panelRef}
      className="fixed bottom-4 right-4 z-10 w-80 md:w-96 p-4 bg-gray-900/90 backdrop-blur-sm border-2 border-magenta-500/50 rounded-lg shadow-2xl transition-all duration-300"
    >
      <div className="flex justify-between items-center pb-2 border-b border-magenta-500/50 mb-3">
        <h3 className="text-lg font-mono text-magenta-400">
          <span className="text-lime-400">CapsuleOS</span> &gt; HIL_Panel
        </h3>
        <button 
          onClick={onClose}
          className="text-white text-xl hover:text-red-500 transition-colors p-1 leading-none"
          aria-label="Close Intervention Panel"
        >
          &times;
        </button>
      </div>

      <pre 
        className={`text-sm font-mono text-[${terminalColor}] whitespace-pre-wrap h-40 overflow-y-auto bg-black/50 p-2 rounded`}
        style={{ color: terminalColor }} // Tailwind colors are hard to use dynamically, force style
      >
        {content}
      </pre>
      
      {/* Simple Input/Command Simulation (Future Terminal) */}
      <div className="mt-3 flex items-center border border-gray-700 rounded p-1">
        <span className="text-sm font-mono text-lime-400 pr-2">cmd &gt;</span>
        <input 
          type="text" 
          placeholder="Enter command (e.g., /status, /query '...' )" 
          className="flex-grow bg-transparent text-white text-sm font-mono focus:outline-none"
          onKeyDown={(e) => { 
            if (e.key === 'Enter') { 
              // Simulate command execution for now
              const command = e.target.value;
              console.log(`Executing command: ${command}`);
              // In the future, this would send a request to the backend
              // For now, we clear the input and log.
              e.target.value = '';
            }
          }}
        />
      </div>
    </div>
  );
};


// --- MAIN APPLICATION ---
export default function App() {
  const [selectedNodeId, setSelectedNodeId] = useState(null);
  const [hilPanelContent, setHilPanelContent] = useState(null);
  const allNodes = useMemo(() => NODE_DATA, []);
  const linePoints = useMemo(() => generateLinePoints(allNodes), [allNodes]);

  // --- LOGIC HOOK: QUERY NODE MEMORY ---
  const queryNodeMemory = useCallback((nodeId, nodeName) => {
    // 1. Find the specific node data
    const node = allNodes.find(n => n.id === nodeId);

    // 2. Build the terminal-style response
    let content = `\n// CapsuleOS Terminal Interface (v1.0)\n`;
    content += `// Connected to Node: ${nodeName}\n`;
    content += `// ID: ${nodeId}\n`;
    content += `-------------------------------------------\n`;

    if (node) {
        content += `> EXECUTE: /read_memory\n\n`;
        // Format the memory for terminal readability
        content += node.memory.split('. ').map(line => `\u25b8 ${line.trim()}`).join('\n');
    } else {
        content += `> ERROR: Node memory not found.\n`;
    }
    content += `\n\n> READY for HIL Intervention.\n`;
    
    return content;
  }, [allNodes]);

  // --- EVENT HANDLERS ---
  
  const handleNodeSelect = useCallback((id, name) => {
    // If clicking the currently selected node, deselect it.
    if (selectedNodeId === id) {
      setSelectedNodeId(null);
      setHilPanelContent(null);
    } else {
      // Select the new node
      setSelectedNodeId(id);
      
      // Call the logic hook to populate the HIL Panel content
      const content = queryNodeMemory(id, name);
      setHilPanelContent(content);
    }
  }, [selectedNodeId, queryNodeMemory]);

  const handlePanelClose = useCallback(() => {
    setSelectedNodeId(null);
    setHilPanelContent(null);
  }, []);

  // Handler for background clicks (to deselect everything)
  const handleCanvasClick = useCallback(() => {
    if (selectedNodeId) {
      setSelectedNodeId(null);
      setHilPanelContent(null);
    }
  }, [selectedNodeId]);

  return (
    <div className="w-full h-screen bg-black antialiased">
      <div className="absolute inset-0 z-0">
        <Canvas 
            camera={{ position: [0, 0, 15], fov: 75 }} 
            onClick={handleCanvasClick}
            gl={{ alpha: true }} // Transparent background
        >
          {/* Holographic Lighting */}
          <ambientLight intensity={0.5} color="cyan" />
          <pointLight position={[10, 10, 10]} intensity={1} color="lime" />
          <pointLight position={[-10, -10, -10]} intensity={0.5} color="orange" />

          {/* Controls: Allow user to rotate and zoom */}
          <OrbitControls 
            enableDamping 
            dampingFactor={0.05} 
            screenSpacePanning={false}
            touches={{
              ONE: THREE.TOUCH.ROTATE,
              TWO: THREE.TOUCH.DOLLY,
              THREE: THREE.TOUCH.PAN,
            }}
          />

          {/* Render all GΛLYPH Nodes (Axiomatic and RAG-Derived) */}
          {allNodes.map(node => (
            <GlyphNode
              key={node.id}
              id={node.id}
              position={node.position}
              color={node.color}
              name={node.name}
              isSelected={selectedNodeId === node.id}
              onSelect={handleNodeSelect}
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

          {/* Background Spawner (Handles background clicks) */}
          <BackgroundSpawner />
        </Canvas>
      </div>
      
      {/* HIL Intervention Panel (Overlay UI) */}
      <HILInterventionPanel 
        content={hilPanelContent} 
        onClose={handlePanelClose} 
      />
      
      {/* Top Banner for context and aesthetics */}
      <div className="absolute top-0 left-0 right-0 p-4 text-center z-10">
        <h1 className="text-xl md:text-3xl font-mono text-cyan-400 uppercase tracking-widest">
          CapsuleOS: Immersive Glyph Engine
        </h1>
        <p className="text-sm font-mono text-gray-400 mt-1">
          Visualizing the Axiomatic Kernel (HIL Active)
        </p>
      </div>
    </div>
  );
}

