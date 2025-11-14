import { Canvas } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import { useState } from 'react'

function Capsule() {
  return (
    <mesh>
      <sphereGeometry args={[1, 32, 32]} />
      <meshBasicMaterial color="lime" wireframe />
    </mesh>
  )
}

export default function App() {
  const [count, setCount] = useState(0)

  return (
    <>
      <div style={{
        position: 'absolute',
        top: 10, left: 10,
        color: 'lime',
        fontFamily: 'monospace',
        pointerEvents: 'none'
      }}>
        CapsuleOS Graph | Loaded: {count} | Click to spawn
      </div>
      <Canvas camera={{ position: [0, 0, 5] }}>
        <OrbitControls />
        <ambientLight intensity={0.5} />
        <Capsule />
      </Canvas>
    </>
  )
}
