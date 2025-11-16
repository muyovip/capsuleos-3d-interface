import { Canvas, useThree } from '@react-three/fiber'
import { useState, useRef, useEffect } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

// --- 1. Minimal Test Component (Standard Rotating Cube) ---
function TestCube() {
  const meshRef = useRef()
  // Basic rotation via useFrame
  useFrame((state, delta) => {
    if (meshRef.current) {
      meshRef.current.rotation.x += delta
      meshRef.current.rotation.y += delta * 0.5
    }
  })

  return (
    <mesh ref={meshRef} position={[0, 0, 0]}>
      {/* Basic geometry and material */}
      <boxGeometry args={[1, 1, 1]} />
      <meshStandardMaterial color="cyan" wireframe />
    </mesh>
  )
}

// --- 2. Background Spawner (Simplified - Still removed logic) ---
// Note: Keeping the spawner component structure but removing the complexity 
// to ensure no errors related to the useThree hook are causing the crash.
function BackgroundSpawner() {
  return (
    <mesh>
      <planeGeometry args={[100, 100]} />
      <meshBasicMaterial visible={false} />
    </mesh>
  )
}

// --- 3. Main Application (The CapsuleOS Interface - Test Mode) ---
export default function App() {
  // Using fixed, hardcoded values for the overlay display for this test
  const nodeCount = 1
  const constraintCount = 0

  return (
    // Set a dark, full-screen background for the holographic effect
    <div className="w-full h-screen bg-gray-950"> 
      {/* CEX View: 2D Control Surface Overlay (Axiomatic Metrics Display) */}
      <div 
        style={{
          position: 'absolute',
          top: '20px', left: '20px',
          color: 'lime',
          fontFamily: 'monospace',
          zIndex: 10,
          background: 'rgba(0, 0, 0, 0.5)',
          padding: '8px 12px',
          borderRadius: '8px',
          fontSize: '14px',
          boxShadow: '0 0 10px rgba(50, 255, 50, 0.5)'
        }}
      >
        CAPSULE OS | **DEX View** Operational (TEST MODE)
        <br/>Nodes (Glyphs): {nodeCount} | Constraints (Wires): {constraintCount}
        <br/>Status: Structural Integrity Test In Progress
      </div>

      {/* DEX View: 3D Computational Graph - MVC Test */}
      <Canvas 
        style={{ width: '100%', height: '100%' }}
        camera={{ position: [0, 0, 5] }}
      >
        {/* Holographic Lighting */}
        <ambientLight intensity={0.5} color="cyan" />
        <pointLight position={[10, 10, 10]} intensity={1} color="lime" />

        {/* --- Render Test Cube --- */}
        <TestCube />

        {/* Background Spawner retained for context, but non-interactive in test mode */}
        <BackgroundSpawner />

      </Canvas>
    </div>
  )
}

