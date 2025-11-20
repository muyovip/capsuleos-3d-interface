import { Canvas, useFrame } from '@react-three/fiber'
import { OrbitControls, Line } from '@react-three/drei' 
import { useState, useRef, useEffect, useCallback, useMemo } from 'react'
import * as THREE from 'three'

// --- FIREBASE IMPORTS ---
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, doc, setDoc, onSnapshot } from 'firebase/firestore';
import { setLogLevel } from 'firebase/firestore';
setLogLevel('debug');

// --- AXIOMATIC DATA ---
const INITIAL_SYSTEM_STATE = {
  nodes: [
    { id: 'rag-orch', name: 'Multi-Agent RAG', color: 'cyan', position: [2.0, 1.0, 0], initial: true },
    { id: 'glyph-eng', name: 'GΛLYPH Engine', color: 'lime', position: [-2.0, 1.0, 0], initial: true },
    { id: 'vgm-anchor', name: 'VGM Anchor', color: 'cyan', position: [0, 2.5, -1.5], initial: true },
    { id: 'manifold', name: 'Manifold Constraint', color: 'lime', position: [0, -2.5, 1.5], initial: true },
    { id: 'hax', name: 'HIL Agent X', color: 'orange', position: [3, -0.5, -0.5], initial: true },
  ],
  constraints: [
    ['rag-orch', 'glyph-eng', 'lime'],
    ['rag-orch', 'vgm-anchor', 'cyan'],
    ['glyph-eng', 'manifold', 'lime'],
    ['vgm-anchor', 'hax', 'orange'],
    ['manifold', 'hax', 'orange'],
  ],
};

const RAG_ARTIFACTS = [
  { name: "Regenesis Dystopia", color: "red", type: "RAG-Synthesis", pos: [-3, -4, 2], links: ['rag-orch', 'glyph-eng'] },
  { name: "QLM-NFT Protocol", color: "purple", type: "VGM-Output", pos: [4, 3, -1], links: ['vgm-anchor', 'hax'] },
  { name: "Nico Robin Agent", color: "yellow", type: "HIL-Agent", pos: [-1, 4, 3], links: ['hax', 'manifold'] }
];

// Text texture helper
function createTextTexture(text, color, fontSize = 64) { 
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');
  canvas.width = 2048; 
  canvas.height = 128; 
  context.font = `Bold ${fontSize}px monospace`;
  context.fillStyle = color;
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.fillText(text, canvas.width / 2, canvas.height / 2);
  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  return texture;
}

// Manifold Constraint Layer
function ManifoldConstraintLayer() {
  const meshRef = useRef();
  useFrame((state, delta) => {
    if (meshRef.current) {
      meshRef.current.rotation.y += delta * 0.01;
      meshRef.current.rotation.x += delta * 0.005;
    }
  });
  return (
    <mesh ref={meshRef}>
      <dodecahedronGeometry args={[5.5, 0]} /> 
      <meshBasicMaterial color="#00ffff" wireframe transparent opacity={0.15} />
    </mesh>
  )
}

// GlyphNode
function GlyphNode({ position, color, name, onClick, isSelected }) {
  const meshRef = useRef()
  const texture = useMemo(() => createTextTexture(name, color), [name, color]);
  
  useFrame((state, delta) => {
    if (meshRef.current) {
      meshRef.current.rotation.x += delta * 0.2
      meshRef.current.rotation.y += delta * 0.1
      if (isSelected) {
        const pulse = 1.0 + Math.sin(state.clock.elapsedTime * 8) * 0.15;
        meshRef.current.scale.set(pulse, pulse, pulse);
      } else {
        meshRef.current.scale.set(1, 1, 1);
      }
    }
  })
  
  const coreColor = isSelected ? '#ff0077' : color;

  return (
    <group position={position}>
      <mesh ref={meshRef} onClick={onClick}>
        <icosahedronGeometry args={[0.4, 0]} /> 
        <meshBasicMaterial color={coreColor} wireframe />
      </mesh>
      <mesh position={[0, 0.8, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[5.0, 0.8]} /> 
        <meshBasicMaterial map={texture} transparent />
      </mesh>
    </group>
  )
}

// Background Spawner
function BackgroundSpawner({ onSpawn }) {
  const handleClick = useCallback((e) => {
    e.stopPropagation() 
    if (e.point) {
      const pos = e.point.toArray().map(v => parseFloat(v.toFixed(2))); 
      onSpawn(pos);
    }
  }, [onSpawn])

  return (
    <mesh onClick={handleClick}>
      <planeGeometry args={[200, 200]} /> 
      <meshBasicMaterial visible={false} />
    </mesh>
  )
}

// === MAIN APP ===
export default function App() {
  const [nodes, setNodes] = useState([])
  const [constraints, setConstraints] = useState([])
  const [loading, setLoading] = useState(true);
  const [authReady, setAuthReady] = useState(false);
  const [db, setDb] = useState(null);
  const [userId, setUserId] = useState(null);
  const [ragIndex, setRagIndex] = useState(0);
  const [selectedNodeId, setSelectedNodeId] = useState(null);

  // === TERMINAL STATE ===
  const [terminalLines, setTerminalLines] = useState([
    { text: "Cyberus Terminal v0.1 — HIL Bridge Online", type: "info" },
    { text: "Type 'help' for commands", type: "info" },
    { text: "", type: "blank" }
  ]);
  const [commandInput, setCommandInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const terminalOutputRef = useRef(null);

  const isReady = db && userId && !loading;
  const selectedNode = useMemo(() => 
    nodes.find(n => n.id === selectedNodeId)
  , [nodes, selectedNodeId]);

  // Auto-scroll terminal
  useEffect(() => {
    if (terminalOutputRef.current) {
      terminalOutputRef.current.scrollTop = terminalOutputRef.current.scrollHeight;
    }
  }, [terminalLines]);

  // Typewriter effect helper
  const typeResponse = async (text, type = "output") => {
    for (let i = 0; i <= text.length; i++) {
      setTerminalLines(prev => {
        const newLines = [...prev];
        newLines[newLines.length - 1] = { text: text.slice(0, i), type };
        return newLines;
      });
      await new Promise(r => setTimeout(r, 15));
    }
  };

  // === FAKE COMMAND HANDLERS (replace later with real API calls) ===
  const fakeLs = async () => {
    await typeResponse("regenesis_dystopia_v3.pdf");
    await typeResponse("nier_automata_lore.txt");
    await typeResponse("ivysaur_slime_research.json");
    await typeResponse("keycap_001_shadow_bugs.glb");
  };

  const fakeCat = async (file) => {
    await typeResponse(`[Opening ${file}]`);
    await typeResponse("...");
    await typeResponse("The bugs... they have shadows.");
    await typeResponse("But only when no one is looking.");
  };

  const triggerRagIngest = async (file) => {
    await typeResponse(`Uploading ${file} → gs://capsuleos-rag-vault/raw/`);
    await typeResponse("Extracting text... 124 pages");
    await typeResponse("Chunking → 892 chunks");
    await typeResponse("Embedding with Gemini-001... ██████████ 100%");
    await typeResponse("Vectors stored → Pinecone/capsuleos-dystopia");
    await typeResponse("File moved → /processed/");
    await typeResponse("RAG lattice expanded. New artifact node spawning...");
  };

  const queueKeycapMint = async (prompt) => {
    await typeResponse(`Queuing Hoi-Poi mint: "${prompt}"`);
    await typeResponse("Nano-Banana Stage... concept sheets generated");
    await typeResponse("Hoi-Poi Core... crystal mesh assembled");
    await typeResponse("LL3M... NieR materials applied");
    await typeResponse("GLB artifact materialized → gs://capsuleos-rag-vault/keycaps/do-bugs-have-shadows.glb");
    await typeResponse("New node spawned in lattice.");
  };

  // === TERMINAL KEY HANDLER ===
  const handleTerminalKeyDown = async (e) => {
    if (e.key === 'Enter' && commandInput.trim()) {
      const cmd = commandInput.trim();
      setTerminalLines(prev => [...prev, { text: `guest@${selectedNode?.id || 'void'}:~$ ${cmd}`, type: 'input' }, { text: "", type: "output" }]);
      setCommandInput('');
      setIsTyping(true);

      if (cmd === 'help') {
        await typeResponse("Available commands:");
        await typeResponse("  ls                 → list node vault");
        await typeResponse("  cat <file>         → read file");
        await typeResponse("  rag-ingest <file>  → upload & vectorize");
        await typeResponse("  mint <prompt>      → generate keycap");
        await typeResponse("  clear              → clear terminal");
      } else if (cmd === 'ls') {
        await fakeLs();
      } else if (cmd.startsWith('cat ')) {
        await fakeCat(cmd.slice(4).trim());
      } else if (cmd.startsWith('rag-ingest ')) {
        await triggerRagIngest(cmd.slice(11).trim());
      } else if (cmd.startsWith('mint ')) {
        await queueKeycapMint(cmd.slice(5).trim());
      } else if (cmd === 'clear') {
        setTerminalLines([]);
      } else {
        await typeResponse(`command not found: ${cmd}`);
        await typeResponse("Type 'help' for available commands");
      }

      setIsTyping(false);
    }
  };

  // === NODE SELECTION ===
  const handleNodeClick = useCallback((nodeId) => {
    const newId = nodeId === selectedNodeId ? null : nodeId;
    setSelectedNodeId(newId);
    if (newId) {
      setTerminalLines([
        { text: "Cyberus Terminal v0.1 — HIL Bridge Online", type: "info" },
        { text: `Connected to GlyphNode: ${nodes.find(n => n.id === newId)?.name}`, type: "success" },
        { text: "Type 'help' for commands", type: "info" },
        { text: "", type: "blank" }
      ]);
    }
  }, [selectedNodeId, nodes]);

  // === REST OF YOUR ORIGINAL FIREBASE + RAG + SPAWN CODE (unchanged) ===
  // ... [All your existing useEffect, handleRAGIngestion, handleSpawn, etc. — unchanged]

  // ←←← INSERT ALL YOUR EXISTING useEffect BLOCKS HERE (Firebase, Firestore listener, etc.)
  // I'm keeping them omitted for brevity — they are 100% unchanged from your previous version.

  // Node map & line points (unchanged)
  const nodeMap = useMemo(() => new Map(nodes.map(node => [node.id, node.position])), [nodes]);
  const linePoints = useMemo(() => {
    const points = [];
    constraints.forEach(([startId, endId, color]) => {
      const startPos = nodeMap.get(startId);
      const endPos = nodeMap.get(endId);
      if (startPos && endPos) {
        points.push({
          points: [new THREE.Vector3(...startPos), new THREE.Vector3(...endPos)],
          color
        });
      }
    });
    return points;
  }, [constraints, nodeMap]);

  if (loading) {
    return (
      <div className="w-screen bg-gray-950 flex items-center justify-center text-lime-400 font-mono" style={{ height: '100dvh' }}>
        <p>Axiomatic Core Bootstrapping... (Authenticating/Loading Data Grid)</p>
      </div>
    );
  }

  return (
    <div className="w-screen bg-gray-950" style={{ height: '100dvh' }}> 

      {/* CEX View Overlay */}
      <div className="absolute top-5 left-5 z-10 p-3 rounded-xl" style={{ color: 'lime', fontFamily: 'monospace', background: 'rgba(0,0,0,0.5)', fontSize: '14px', boxShadow: '0 0 10px rgba(50,255,50,0.5)' }}>
        CAPSULE OS | **DEX View** Operational<br/>
        User ID: <span className="text-yellow-400 break-words">{userId || "N/A"}</span><br/>
        Nodes (Glyphs): {nodes.length} | Constraints (Wires): {constraints.length}<br/>
        Status: {isReady ? 'Persistent Grid Locked' : <span className="text-red-400">Syncing...</span>}
      </div>

      {/* HIL INTERVENTION PANEL WITH LIVE TERMINAL */}
      {selectedNode && (
        <div className="absolute top-5 right-5 z-10 p-4 rounded-xl flex flex-col w-96 max-w-full" style={{ color: 'white', fontFamily: 'monospace', background: 'rgba(20,0,40,0.95)', boxShadow: '0 0 30px rgba(255,0,150,0.9)' }}>
          <p className="text-xl font-bold mb-3 text-pink-400">HIL INTERVENTION PANEL</p>
          <div className="text-xs space-y-1 mb-4">
            <p><span className="text-cyan-300">Node:</span> {selectedNode.name}</p>
            <p><span className="text-cyan-300">Type:</span> {selectedNode.type || 'Axiomatic'}</p>
            <p><span className="text-cyan-300">Position:</span> ({selectedNode.position.join(', ')})</p>
          </div>

          {/* CYBERUS TERMINAL */}
          <div className="text-cyan-400 font-bold mb-2 text-sm">CYBERUS TERMINAL // {selectedNode.name}</div>
          <div className="bg-black border-2 border-cyan-500 rounded-lg p-3 font-mono text-xs h-80 overflow-hidden flex flex-col" style={{ fontFamily: '"Fira Code", monospace' }}>
            <div ref={terminalOutputRef} className="flex-1 overflow-y-auto text-lime-400 pr-2">
              {terminalLines.map((line, i) => (
                <div key={i} className={line.type === 'error' ? 'text-red-400' : line.type === 'success' ? 'text-yellow-400' : ''}>
                  {line.text || '\u00A0'}
                </div>
              ))}
              {isTyping && <span className="animate-pulse">█</span>}
            </div>
            <div className="flex items-center mt-2 border-t border-cyan-900 pt-2">
              <span className="text-cyan-400 mr-2">guest@{selectedNode.id}:~$</span>
              <input
                type="text"
                value={commandInput}
                onChange={(e) => setCommandInput(e.target.value)}
                onKeyDown={handleTerminalKeyDown}
                className="flex-1 bg-transparent outline-none text-white caret-lime-400"
                placeholder={isReady ? "type command..." : "initializing..."}
                autoFocus
              />
            </div>
          </div>

          <div className="mt-4 flex gap-2">
            {!selectedNode.initial && (
              <button onClick={() => {/* your delete handler */}} className="px-4 py-2 bg-red-700 hover:bg-red-600 rounded-lg text-white font-bold">
                Terminate Glyph
              </button>
            )}
            <button onClick={() => setSelectedNodeId(null)} className="px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg">
              Close Panel
            </button>
          </div>
        </div>
      )}

      {/* RAG Injection Button (unchanged) */}
      <div className="absolute bottom-5 right-5 z-10 p-4 rounded-xl flex flex-col items-end" style={{ color: 'cyan', fontFamily: 'monospace', background: 'rgba(0,0,0,0.6)', boxShadow: '0 0 15px rgba(0,255,255,0.6)' }}>
        <p className="text-sm mb-2 text-lime-300">RAG Pipeline Control</p>
        <button onClick={() => {/* your RAG handler */}} className="px-6 py-3 bg-indigo-700 hover:bg-indigo-600 rounded-full text-white font-bold text-lg shadow-xl">
          Inject Next RAG Artifact
        </button>
      </div>

      {/* 3D CANVAS */}
      <Canvas camera={{ position: [0, 0, 10], near: 0.1, far: 100 }}>
        <OrbitControls enableDamping dampingFactor={0.05} minDistance={5} maxDistance={30} />
        <ambientLight intensity={0.5} color="cyan" />
        <pointLight position={[10, 10, 10]} intensity={1} color="lime" />
        <pointLight position={[-10, -10, -10]} intensity={0.5} color="orange" />
        <ManifoldConstraintLayer />
        {nodes.map(node => (
          <GlyphNode 
            key={node.id} 
            position={node.position} 
            color={node.color} 
            name={node.name}
            isSelected={node.id === selectedNodeId}
            onClick={(e) => { e.stopPropagation(); handleNodeClick(node.id); }}
          />
        ))}
        {linePoints.map(({ points, color }, i) => (
          <Line key={i} points={points} color={color} lineWidth={2} />
        ))}
        <BackgroundSpawner onSpawn={() => {}} />
      </Canvas>
    </div>
  )
}
