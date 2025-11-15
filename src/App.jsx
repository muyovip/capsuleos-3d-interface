import { Canvas } from '@react-three/fiber'
import { OrbitControls, Text } from '@react-three/drei'
import { useState, useRef } from 'react'
import { useFrame } from '@react-three/fiber'

function Capsule({ position, color = 'lime', label, onClick }) {
  const mesh = useRef()
  useFrame((state, delta) => {
    mesh.current.rotation.x += delta * 0.5
    mesh.current.rotation.y += delta * 0.3
  })

  return (
    <group position={position} onClick={onClick} onPointerDown={onClick}>
      <mesh ref={mesh}>
        <sphereGeometry args={[1, 32, 32]} />
        <meshBasicMaterial color={color} wireframe />
      </mesh>
      {label && (
        <Text
          position={[0, 1.8, 0]}
          fontSize={0.4}
          color="white"
          anchorX="center"
          anchorY="middle"
        >
          {label}
        </Text>
      )}
    </group>
  )
}

export default function App() {
  const [capsules, setCapsules] = useState([])

  const spawnHello = () => {
    alert("Hello World! This capsule is alive.")
  }

  const handleSpawn = (e) => {
    e.stopPropagation()
    const { x, y, z } = e.point
    setCapsules(c => [...c, { pos: [x, y, z], color: 'orange' }])
  }

  return (
    <>
      <div style={{
        position: 'absolute',
        top: 10, left: 10,
        color: 'lime',
        fontFamily: 'monospace',
        pointerEvents: 'none',
        fontSize: '14px'
      }}>
        CapsuleOS Graph | Loaded: {capsules.length} | Tap to spawn
      </div>
      <Canvas
        camera={{ position: [0, 0, 10], fov: 60 }}
        onPointerDown={handleSpawn}
        onTouchStart={handleSpawn}
      >
        <OrbitControls enablePan={false} />
        <ambientLight intensity={0.6} />
        {/* Default Capsule */}
        <Capsule position={[0, 0, 0]} />
        {/* Hello World Capsule */}
        <Capsule 
          position={[3, 0, 0]} 
          color="cyan" 
          label="Hello World"
          onClick={spawnHello}
          onPointerDown={spawnHello}
        />
        {/* Spawned Capsules */}
        {capsules.map((c, i) => (
          <Capsule key={i} position={c.pos} color={c.color} />
        ))}
      </Canvas>
    </>
  )
}
