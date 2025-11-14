import React from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.jsx'
import { Canvas } from '@react-three/fiber'

const root = createRoot(document.getElementById('root') || document.body)
root.render(<App />)
