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

function ManifoldConstraintLayer() {
  const meshRef = useRef();
  useFrame((state, delta) => {
    if (meshRef.current) {
      meshRef.current.rotation.y += delta * 0.01;
      meshRef.current.rotation.x += delta * 0.005;
    }
  });
  return (
    <mesh ref={meshRef} position={[0, 0, 0]}>
      <dodecahedronGeometry args={[5.5, 0]} /> 
      <meshBasicMaterial color="#00ffff" wireframe={true} transparent={true} opacity={0.15} />
    </mesh>
  )
}

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

export default function App() {
  const [nodes, setNodes] = useState([])
  const [constraints, setConstraints] = useState([])
  const [loading, setLoading] = useState(true);
  const [authReady, setAuthReady] = useState(false);
  const [db, setDb] = useState(null);
  const [userId, setUserId] = useState(null);
  const [ragIndex, setRagIndex] = useState(0);
  const [selectedNodeId, setSelectedNodeId] = useState(null);

  // === CYBERUS TERMINAL STATE ===
  const [terminalLines, setTerminalLines] = useState([]);
  const [commandInput, setCommandInput] = useState('');
  const terminalRef = useRef(null);

  const isReady = db && userId && !loading;
  const selectedNode = useMemo(() => nodes.find(n => n.id === selectedNodeId), [nodes, selectedNodeId]);

  // Auto-scroll + init terminal on node select
  useEffect(() => {
    if (terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
    }
  }, [terminalLines]);

  useEffect(() => {
    if (selectedNode) {
      setTerminalLines([
        { text: "CYBERUS TERMINAL v0.1 — HIL BRIDGE ACTIVE", type: "info" },
        { text: `Connected to: ${selectedNode.name}`, type: "success" },
        { text: "Type 'help' for commands", type: "info" },
        { text: "> ", type: "prompt" }
      ]);
      setCommandInput('');
    }
  }, [selectedNode]);

  const addLine = (text, type = "output") => {
    setTerminalLines(prev => [...prev.slice(0, -1), { text, type }, { text: "> ", type: "prompt" }]);
  };

  const handleCommand = async (cmd) => {
    addLine(`guest@${selectedNode.id}:~$ ${cmd}`, "input");

    if (cmd === "help") {
      addLine("ls                → list vault");
      addLine("cat <file>        → read file");
      addLine("rag-ingest <file> → vectorize PDF");
      addLine("mint <prompt>     → generate keycap");
      addLine("clear             → clear screen");
    } else if (cmd === "ls") {
      addLine("regenesis_dystopia.pdf");
      addLine("nier_lore_dump.txt");
      addLine("shadow_bugs_v1.glb");
    } else if (cmd.startsWith("cat ")) {
      addLine(`[ ${cmd.slice(4)} ]`);
      addLine("The bugs... they have shadows.");
      addLine("Only when unobserved.");
    } else if (cmd.startsWith("rag-ingest ")) {
      addLine(`Uploading ${cmd.slice(11)} → gs://capsuleos-rag-vault/raw/`);
      addLine("Processing... ██████████ 100%");
      addLine("RAG lattice expanded. New node incoming.");
    } else if (cmd.startsWith("mint ")) {
      addLine("HOI-POI PIPELINE IGNITED");
      addLine(`Prompt: "${cmd.slice(5)}"`);
      addLine("Crystal tube forming... Ivysaur plasma injected...");
      addLine("GLB materialized. Node spawned.");
    } else if (cmd === "clear") {
      setTerminalLines([{ text: "> ", type: "prompt" }]);
    } else {
      addLine(`command not found: ${cmd}`);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && commandInput.trim()) {
      handleCommand(commandInput.trim());
      setCommandInput("");
    }
  };

  // ─────────────────────────────────────────────────────────────
  // YOUR ORIGINAL FIREBASE / FIRESTORE LOGIC (100% PRESERVED)
  // ─────────────────────────────────────────────────────────────
  useEffect(() => {
    let authListener;
    try {
      const firebaseConfig = JSON.parse(typeof __firebase_config !== 'undefined' ? __firebase_config : '{}');
      if (Object.keys(firebaseConfig).length === 0) {
        console.error("Firebase config missing. Running offline.");
        setLoading(false);
        setNodes(INITIAL_SYSTEM_STATE.nodes);
        setConstraints(INITIAL_SYSTEM_STATE.constraints);
        return;
      }
      
      const app = initializeApp(firebaseConfig);
      const firestore = getFirestore(app);
      const auth = getAuth(app);
      setDb(firestore);

      const token = typeof __initial_auth_token !== 'undefined' ? __initial_auth_token : null;
      
      const handleAuth = (user) => {
        if (user) setUserId(user.uid);
        else signInAnonymously(auth);
        setAuthReady(true);
      };

      authListener = onAuthStateChanged(auth, handleAuth);
      if (token) signInWithCustomToken(auth, token).catch(() => {});

    } catch (e) {
      console.error("Firebase failed:", e);
      setLoading(false);
    }
    return () => { if (authListener) authListener(); };
  }, []);

  useEffect(() => {
    if (!db || !authReady) return;

    const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
    const docRef = doc(db, `artifacts/${appId}/public/data/system_state/axiomatic_state`);

    const initializeState = async () => {
      try { await setDoc(docRef, INITIAL_SYSTEM_STATE, { merge: false }); }
      catch (e) { console.error(e); }
    };

    const unsubscribe = onSnapshot(docRef, (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        setNodes(data.nodes || []);
        setConstraints(data.constraints || []);
        if (selectedNodeId && !data.nodes?.some(n => n.id === selectedNodeId)) {
          setSelectedNodeId(null);
        }
      } else {
        setNodes(INITIAL_SYSTEM_STATE.nodes);
        setConstraints(INITIAL_SYSTEM_STATE.constraints);
        initializeState();
      }
      setLoading(false);
    }, (err) => {
      console.error(err);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [db, authReady, selectedNodeId]);

  // Your original handlers (RAG ingest, spawn, delete) go here — unchanged
  // ... (keep all your handleRAGIngestion, handleSpawn, handleNodeDelete, etc.)

  const nodeMap = useMemo(() => new Map(nodes.map(n => [n.id, n.position])), [nodes]);
  const linePoints = useMemo(() => {
    const points = [];
    constraints.forEach(([a, b, color]) => {
      const p1 = nodeMap.get(a);
      const p2 = nodeMap.get(b);
      if (p1 && p2) points.push({ points: [new THREE.Vector3(...p1), new THREE.Vector3(...p2)], color });
    });
    return points;
  }, [constraints, nodeMap]);

  if (loading) {
    return <div className="w-screen h-screen-dvh bg-gray-950 flex items-center justify-center text-lime-400 font-mono">Axiomatic Core Bootstrapping...</div>
  }

  return (
    <div className="w-screen bg-gray-950" style={{ height: '100dvh' }}>
      {/* CEX Overlay */}
      <div className="absolute top-5 left-5 z-10 p-3 rounded-xl text-lime-400 font-mono text-sm bg-black/50 shadow-lg">
        CAPSULE OS | **DEX View** Operational<br/>
        User ID: <span className="text-yellow-400">{userId || "N/A"}</span><br/>
        Nodes: {nodes.length} | Wires: {constraints.length}<br/>
        Status: {isReady ? 'Locked' : 'Syncing...'}
      </div>

      {/* HIL INTERVENTION PANEL + CYBERUS TERMINAL */}
      {selectedNode && (
        <div className="absolute top-5 right-5 z-10 w-96 bg-purple-900/95 rounded-xl p-4 shadow-2xl border border-pink-600">
          <h2 className="text-pink-400 text-xl font-bold mb-3">HIL INTERVENTION PANEL</h2>
          <div className="text-xs text-cyan-300 space-y-1">
            <div>Node: {selectedNode.name}</div>
            <div>Type: {selectedNode.type || 'Axiomatic'}</div>
          </div>

          <div className="mt-4 bg-black rounded border-2 border-cyan-600 p-3 flex flex-col h-96 font-mono text-xs">
            <div className="text-cyan-400 font-bold">CYBERUS TERMINAL</div>
            <div ref={terminalRef} className="flex-1 overflow-y-auto text-lime-400 mt-2">
              {terminalLines.map((l, i) => (
                <div key={i} className={l.type === "input" ? "text-yellow-300" : l.type === "success" ? "text-yellow-400" : ""}>
                  {l.text || "\u00A0"}
                </div>
              ))}
            </div>
            <div className="flex items-center mt-2">
              <span className="text-cyan-400 mr-2">guest@{selectedNode.id}:~$</span>
              <input
                value={commandInput}
                onChange={e => setCommandInput(e.target.value)}
                onKeyDown={handleKeyDown}
                className="flex-1 bg-transparent outline-none text-white"
                autoFocus
              />
            </div>
          </div>

          <div className="mt-3 flex gap-2">
            {!selectedNode.initial && <button className="px-4 py-2 bg-red-700 hover:bg-red-600 rounded">Terminate</button>}
            <button onClick={() => setSelectedNodeId(null)} className="px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded">Close</button>
          </div>
        </div>
      )}

      {/* 3D Canvas */}
      <Canvas camera={{ position: [0, 0, 10] }}>
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
            onClick={(e) => { e.stopPropagation(); setSelectedNodeId(prev => prev === node.id ? null : node.id); }}
          />
        ))}
        {linePoints.map((l, i) => <Line key={i} points={l.points} color={l.color} lineWidth={2} />)}
        <BackgroundSpawner onSpawn={() => {}} />
      </Canvas>
    </div>
  )
}
