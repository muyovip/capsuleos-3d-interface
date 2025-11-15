import { Canvas } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import { useState, useRef } from 'react'
import { useFrame } from '@react-three/fiber'

function Capsule({ position, color = 'lime', label, onClick }) {
  const mesh = useRef()
  useFrame((state, delta) => {
    mesh.current.rotation.x += delta * 0.5
    mesh.current.rotation.y += delta * 0.3
  })

  return (
    <group position={position} onClick={onClick}>
      <mesh ref={mesh}>
        <sphereGeometry args={[1, 32, 32]} />
        <meshBasicMaterial color={color} wireframe />
      </mesh>
      {label && (
        <mesh position={[0, 1.5, 0]}>
          <textGeometry args={[label, { font: 'helvetiker', size: 0.3, height: 0.01 }]} />
          <meshBasicMaterial color="white" />
        </mesh>
      )}
    </group>
  )
}

export default function App() {
  const [capsules, setCapsules] = useState([])

  const spawnHello = () => {
    alert("Hello World! This capsule is alive.")
  }

  const handleClick = (e) => {
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
        CapsuleOS Graph | Loaded: {capsules.length} | Click to spawn
      </div>
      <Canvas
        camera={{ position: [0, 0, 10], fov: 60 }}
        onPointerDown={handleClick}
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
        />
        {/* Spawned Capsules */}
        {capsules.map((c, i) => (
          <Capsule key={i} position={c.pos} color={c.color} />
        ))}
      </Canvas>
    </>
  )
}
