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
  const [capsules, setCapsules] = useState(1)

  useEffect(() => {
    fetch('/capsules/test-capsule.glyph')
      .then(r => r.text())
      .then(text => setCapsules(c => c + 1))
  }, [])

  return (
    <Canvas camera={{ position: [0, 0, 5] }}>
      <OrbitControls />
      <ambientLight intensity={0.5} />
      <Capsule />
      {capsules > 1 && <Capsule position={[3, 0, 0]} color="orange" />}
    </Canvas>
  )
}

export default App
