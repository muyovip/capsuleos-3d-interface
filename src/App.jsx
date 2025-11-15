// pages/Home.jsx
import PlanetBackground from '../components/PlanetBackground';
import HeroText from '../components/HeroText'; // Your custom component

export default function Home() {
  return (
    <main>
      <PlanetBackground />
      <section className="relative z-10 flex items-center justify-center min-h-screen">
        <HeroText> {/* Your component, e.g., with h1, p, button */}
          <h1 style={{ backdropFilter: `blur(var(--hero-blur))`, background: 'rgba(0,0,0,0.5)' }}>
            Welcome to the Future
          </h1>
          <p>Your immersive UI starts here.</p>
        </HeroText>
      </section>
    </main>
  );
}
