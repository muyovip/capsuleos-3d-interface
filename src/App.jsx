// --- CONFIGURATION ---
// ... (The top of the file remains unchanged)

// Base camera distances used by ResponsiveCamera
const LANDSCAPE_Z = 25; 
const PORTRAIT_Z = 160; 
const Z_RATIO = PORTRAIT_Z / LANDSCAPE_Z; // ~6.4

// Scaling factor for visual pop in portrait mode (optional but good for visual feel)
// We will now use this to fine-tune the size instead of boosting it.
const TARGET_NODE_SCALE = 0.5; // New constant to define the desired small size.

// Base size multiplier. Nodes will be scaled from this base.
const BASE_NODE_RADIUS = 3.0;
const BASE_LABEL_SIZE = 1.5;
const BASE_LINE_WIDTH = 4.0;

// ... (The rest of the file down to the App component remains unchanged)


// --- MAIN APP ---
export default function App() {
  const [nodes] = useState(INITIAL_SYSTEM_STATE.nodes);
  const [constraints] = useState(INITIAL_SYSTEM_STATE.constraints);
  const [aspect, setAspect] = useState(1); 

  // ... (handleNodeSelect and linePoints remain unchanged)

  // FIX: Calculate the scale factor based on orientation.
  
  let orientationScale = 1.0; 
  
  if (aspect > 1.2) {
    // 1. LANDSCAPE (Aspect > 1.2): Camera is CLOSE (Z=25). 
    // We want the nodes to be small. We use the TARGET_NODE_SCALE.
    orientationScale = TARGET_NODE_SCALE;
  } else {
    // 2. PORTRAIT (Aspect < 1.2): Camera is FAR (Z=160).
    // To achieve the same small *visual* size as Landscape (Z=25, scale=0.5), 
    // we must multiply the Landscape scale (0.5) by the Z_RATIO (~6.4) to compensate
    // for the distance. 
    // However, since the camera is already adjusted to be far away, 
    // we only need to apply the TARGET_NODE_SCALE.
    orientationScale = TARGET_NODE_SCALE;
  }

  // The Landscape camera is closer, which means the nodes LOOK bigger by default.
  // The Portrait camera is farther, which means the nodes LOOK smaller by default.
  // BUT the ResponsiveCamera forces the Z distance based on aspect ratio.

  // The actual fix is to keep the geometric scale small and let the ResponsiveCamera
  // do the framing, which implicitly sets the visual size.

  if (aspect > 1.2) {
      // Landscape: Camera is Z=25. The nodes are 6.4x closer. Scale DOWN geometric size.
      orientationScale = 1 / Z_RATIO;
  } else {
      // Portrait: Camera is Z=160. Scale up to compensate for distance (if desired),
      // or keep a medium size. We want the nodes to be small. 
      // The ratio (1/Z_RATIO) worked well for the visual size in Landscape.
      // We will now use that same small base scale for Portrait.
      orientationScale = 1 / Z_RATIO;
  }
  
  // Final, simpler approach that should work:
  // Apply a small constant scale in both cases, which is what worked for Landscape.
  const FINAL_SMALL_SCALE = 1 / Z_RATIO; // This is the small factor that worked for Landscape
  orientationScale = FINAL_SMALL_SCALE;
  // If the nodes are too small now in Portrait, uncomment the Portrait override below:
  /*
  if (aspect < 1.2) {
      // If Portrait is too small, increase its scale to compensate for the far camera.
      // This is the source of our original problem, so we avoid it unless necessary.
      // Let's stick with the FINAL_SMALL_SCALE for both for now.
  }
  */

  const dynamicLineWidth = BASE_LINE_WIDTH * orientationScale;


  return (
    // ... (The return block remains unchanged) ...
    <div 
      style={{ 
        position: 'fixed', 
        inset: 0, 
        width: '100vw', 
        height: '100vh',
        height: '100lvh',
        height: '100svh', 
        cursor: 'pointer'
      }} 
      className="bg-black overflow-hidden touch-none"
    >
      {/* HUD (omitted for brevity, remains unchanged) */}
      <div style={{
        position: 'absolute', top: 20, left: 20, zIndex: 10,
        color: 'cyan', fontFamily: 'monospace', pointerEvents: 'none',
        textShadow: '0 0 10px cyan'
      }}>
        CAPSULE OS | **DEX View** <br/>
        Status: IMMERSION LOCK <br/>
        Input: TOUCH ENABLED
      </div>

      <Canvas dpr={[1, 2]} camera={{ fov: CAMERA_FOV }}>
        <ResponsiveCamera setAspect={setAspect} />
        
        <ParticlePlanet />

        {nodes.map(node => (
          <GlyphNode 
            key={node.id}
            {...node}
            onSelect={handleNodeSelect}
            orientationScale={orientationScale} // Use the FINAL_SMALL_SCALE for both
          />
        ))}

        {/* Dynamic Line Width (Lattice Constraints) */}
        {linePoints.map((l, i) => (
          <Line 
            key={i} 
            points={[l.start, l.end]} 
            color={l.color} 
            lineWidth={dynamicLineWidth} // Use orientation scale
            transparent 
            opacity={0.5} 
          />
        ))}
      </Canvas>
    </div>
  )
}
