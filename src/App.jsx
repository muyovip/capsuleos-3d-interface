import { Canvas, useFrame } from '@react-three/fiber'
import { OrbitControls, Text } from '@react-three/drei'
import { useState, useRef, useEffect } from 'react'

// The Universal Capsule Renderer
function Capsule({ data, onClick }) {
  const mesh = useRef()
  
  // Unique rotation based on "soul" (id)
  useFrame((state, delta) => {
    mesh.current.rotation.x += delta * 0.4
    mesh.current.rotation.y += delta * 0.7
  })

  // "Character" types pulse with energy
  const isCharacter = data.type === 'character'
  
  return (
    <group position={data.position} onClick={onClick}>
      <mesh ref={mesh} scale={data.visuals?.scale || 1}>
        {/* Characters get Dodecahedrons (more complex), Standard nodes get Spheres */}
        {isCharacter ? (
            <dodecahedronGeometry args={[1, 0]} />
        ) : (
            <sphereGeometry args={[1, 32, 32]} />
        )}
        
        <meshBasicMaterial 
            color={data.visuals?.color || "lime"} 
            wireframe={true} 
        />
      </mesh>
      
      {/* Floating Label */}
      <Text
        position={[0, 1.4, 0]}
        fontSize={0.3}
        color={data.visuals?.color || "lime"}
        anchorX="center"
        anchorY="middle"
      >
        {data.name}
      </Text>
    </group>
  )
}

export default function App() {
  const [entities, setEntities] = useState([])

  // Boot Sequence: Load the Graph
  useEffect(() => {
    // 1. Spawn Genesis Node (The System)
    const genesis = {
        id: 'sys-001',
        name: 'CapsuleOS Kernel',
        type: 'system',
        position: [0, 0, 0],
        visuals: { color: 'lime' },
        memory: 'System Ready.'
    }
    setEntities([genesis])

    // 2. Fetch Ichigo (The Content)
    fetch('/ichigo.json')
      .then(r => r.json())
      .then(ichigoData => {
        setEntities(prev => [...prev, ichigoData])
      })
      .catch(err => console.log("Scanning for Ichigo...", err))
  }, [])

  // Interaction Logic
  const handleInteract = (entity) => {
    // This is where we will eventually hook into vLLM
    alert(`[NEURAL LINK ESTABLISHED]\n\nIdentity: ${entity.name}\nMemory: ${entity.memory}`)
  }

  return (
    <>
      <div style={{
        position: 'absolute', top: 10, left: 10, color: 'lime', 
        fontFamily: 'monospace', pointerEvents: 'none', zIndex: 10 
      }}>
        CapsuleOS | Entities: {entities.length} | Status: SYNCED
      </div>
      
      <Canvas camera={{ position: [0, 2, 8], fov: 60 }}>
        <OrbitControls />
        <ambientLight intensity={0.5} />
        
        {entities.map((entity, i) => (
          <Capsule 
            key={i} 
            data={entity} 
            onClick={(e) => { e.stopPropagation(); handleInteract(entity) }} 
          />
        ))}
      </Canvas>
    </>
  )
}
