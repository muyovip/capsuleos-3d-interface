import { Canvas } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import { useState, useRef } from 'react'
import { useFrame } from '@react-three/fiber'

function Capsule({ position }) {
  const mesh = useRef()
  useFrame((state, delta) => {
    mesh.current.rotation.x += delta * 0.5
    mesh.current.rotation.y += delta * 0.3
  })

  return (
    <mesh ref={mesh} position={position}>
      <sphereGeometry args={[1, 32, 32]} />
      <meshBasicMaterial color="lime" wireframe />
    </mesh>
  )
}

export default function App() {
  const [capsules, setCapsules] = useState([])

  const handleClick = (e) => {
    const { x, y, z } = e.point
    setCapsules(c => [...c, [x, y, z]])
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
        <Capsule position={[0, 0, 0]} />
        {capsules.map((pos, i) => (
          <Capsule key={i} position={pos} />
        ))}
      </Canvas>
    </>
  )
}
