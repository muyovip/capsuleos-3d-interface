import { Canvas } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import { useEffect, useState } from 'react'

function Capsule({ position = [0, 0, 0], color = 'lime' }) {
  return (
    <mesh position={position}>
      <sphereGeometry args={[1, 32, 32]} />
      <meshBasicMaterial color={color} wireframe />
    </mesh>
  )
}

function App() {
  const [capsules, setCapsules] = useState(0)

  useEffect(() => {
    fetch('/capsules/test-capsule.glyph')
      .then(r => r.text())
      .then(() => setCapsules(c => c + 1))
      .catch(() => console.log('No .glyph found'))
  }, [])

  return (
    <>
      <div style={{
        position: 'absolute',
        top: 10, left: 10,
        color: 'lime',
        fontFamily: 'monospace',
        pointerEvents: 'none'
      }}>
        CapsuleOS Graph | Loaded: {capsules} | Click to spawn
      </div>
      <Canvas camera={{ position: [0, 0, 5] }}>
        <OrbitControls />
        <ambientLight intensity={0.5} />
        <Capsule />
        {capsules > 0 && <Capsule position={[3, 0, 0]} color="orange" />}
      </Canvas>
    </>
  )
}

export default App
