import { useEffect, useRef } from 'react';
import { motion } from 'motion/react';

export function DataCenterBackground() {
  return (
    <>
      {}
      <div
        id="bg-video-container"
        className="fixed inset-0 z-0 overflow-hidden pointer-events-none bg-slate-950"
      >
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[177.77vh] min-w-full h-[56.25vw] min-h-full">
          <iframe
            src="https://www.youtube.com/embed/wBZGPQ-FQRI?autoplay=1&mute=1&loop=1&playlist=wBZGPQ-FQRI&controls=0&rel=0&playsinline=1"
            className="w-full h-full pointer-events-none opacity-100"
            allow="autoplay; encrypted-media"
            title="Professional Data Center Background"
          />
        </div>

        <div className="absolute inset-0 bg-gradient-to-b from-slate-950/20 via-transparent to-slate-950/40" />
      </div>

      <div className="absolute inset-0 z-10 opacity-20 pointer-events-none">
        <div className="absolute inset-0" style={{
          backgroundImage: `
            linear-gradient(rgba(59, 130, 246, 0.15) 1px, transparent 1px),
            linear-gradient(90deg, rgba(59, 130, 246, 0.15) 1px, transparent 1px)
          `,
          backgroundSize: '80px 80px',
        }} />
      </div>

      <div className="relative z-20 pointer-events-none">
        <NetworkTopology />
        <DataFlowParticles />
      </div>
    </>
  );
}

function NetworkTopology() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d', { alpha: true });
    if (!ctx) return;

    // === Batch DOM reads at setup (avoid layout thrashing) ===
    let canvasWidth = window.innerWidth;
    let canvasHeight = window.innerHeight;
    canvas.width = canvasWidth;
    canvas.height = canvasHeight;

    // === Reduced node count: 25 → 15 (cuts O(n²) work significantly) ===
    const nodeCount = 15;
    const nodes: { x: number; y: number; vx: number; vy: number; pulse: number }[] = [];

    for (let i = 0; i < nodeCount; i++) {
      nodes.push({
        x: Math.random() * canvasWidth,
        y: Math.random() * canvasHeight,
        vx: (Math.random() - 0.5) * 0.3,
        vy: (Math.random() - 0.5) * 0.3,
        pulse: Math.random() * Math.PI * 2,
      });
    }

    // === Pre-cache strokeStyle strings (eliminates 230ms of template literal creation) ===
    const CONNECTION_DISTANCE = 200;
    const OPACITY_STEPS = 20;
    const cachedStrokeStyles: string[] = [];
    for (let i = 0; i <= OPACITY_STEPS; i++) {
      const opacity = (i / OPACITY_STEPS) * 0.3;
      cachedStrokeStyles.push(`rgba(59, 130, 246, ${opacity.toFixed(3)})`);
    }

    // Pre-cache static fill styles
    const NODE_FILL_STYLE = 'rgba(96, 165, 250, 0.9)';

    // === Throttle to ~30fps (from 60fps) — halves CPU usage ===
    const TARGET_FPS = 30;
    const FRAME_INTERVAL = 1000 / TARGET_FPS;
    let lastFrameTime = 0;
    let animationId: number;
    let isVisible = true;

    function animate(currentTime: number) {
      animationId = requestAnimationFrame(animate);

      // Skip frame if tab is hidden or not enough time elapsed
      if (!isVisible) return;
      const elapsed = currentTime - lastFrameTime;
      if (elapsed < FRAME_INTERVAL) return;
      lastFrameTime = currentTime - (elapsed % FRAME_INTERVAL);

      if (!ctx || !canvas) return;

      ctx.clearRect(0, 0, canvasWidth, canvasHeight);

      // === Update positions (batched computation, no DOM access) ===
      for (let i = 0; i < nodeCount; i++) {
        const node = nodes[i];
        node.x += node.vx;
        node.y += node.vy;

        if (node.x < 0 || node.x > canvasWidth) node.vx *= -1;
        if (node.y < 0 || node.y > canvasHeight) node.vy *= -1;

        node.pulse += 0.02;
      }

      // === Draw connections with cached styles ===
      ctx.lineWidth = 1;
      for (let i = 0; i < nodeCount; i++) {
        const node = nodes[i];
        for (let j = i + 1; j < nodeCount; j++) {
          const otherNode = nodes[j];
          const dx = node.x - otherNode.x;
          const dy = node.y - otherNode.y;
          const distSq = dx * dx + dy * dy;

          // Use squared distance to avoid expensive sqrt
          if (distSq < CONNECTION_DISTANCE * CONNECTION_DISTANCE) {
            const distance = Math.sqrt(distSq);
            const opacityIndex = Math.round((1 - distance / CONNECTION_DISTANCE) * OPACITY_STEPS);
            ctx.beginPath();
            ctx.strokeStyle = cachedStrokeStyles[opacityIndex];
            ctx.moveTo(node.x, node.y);
            ctx.lineTo(otherNode.x, otherNode.y);
            ctx.stroke();
          }
        }
      }

      // === Draw nodes (single pass, simplified gradients) ===
      for (let i = 0; i < nodeCount; i++) {
        const node = nodes[i];
        const pulseSize = 2 + Math.sin(node.pulse) * 0.5;
        const radius = pulseSize * 2;

        // Glow effect
        const gradient = ctx.createRadialGradient(node.x, node.y, 0, node.x, node.y, radius);
        gradient.addColorStop(0, 'rgba(59, 130, 246, 0.8)');
        gradient.addColorStop(0.5, 'rgba(59, 130, 246, 0.4)');
        gradient.addColorStop(1, 'rgba(59, 130, 246, 0)');

        ctx.beginPath();
        ctx.fillStyle = gradient;
        ctx.arc(node.x, node.y, radius, 0, Math.PI * 2);
        ctx.fill();

        // Core dot
        ctx.beginPath();
        ctx.fillStyle = NODE_FILL_STYLE;
        ctx.arc(node.x, node.y, pulseSize, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    animationId = requestAnimationFrame(animate);

    // === Visibility API: pause animation when tab is hidden ===
    const handleVisibility = () => {
      isVisible = !document.hidden;
    };
    document.addEventListener('visibilitychange', handleVisibility);

    // === Batch resize handler (read layout once, then write) ===
    const handleResize = () => {
      canvasWidth = window.innerWidth;
      canvasHeight = window.innerHeight;
      canvas.width = canvasWidth;
      canvas.height = canvasHeight;
    };
    window.addEventListener('resize', handleResize);

    return () => {
      cancelAnimationFrame(animationId);
      window.removeEventListener('resize', handleResize);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 pointer-events-none opacity-40"
    />
  );
}

function DataFlowParticles() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {[...Array(8)].map((_, i) => (
        <motion.div
          key={i}
          className="absolute w-1 h-1 bg-blue-400 rounded-full shadow-lg shadow-blue-400/50"
          style={{
            left: `${(i * 12.5)}%`,
            top: 0,
          }}
          animate={{
            y: ['0vh', '100vh'],
            opacity: [0, 1, 1, 0],
            scale: [0, 1, 1, 0],
          }}
          transition={{
            duration: 3 + Math.random() * 2,
            repeat: Infinity,
            delay: i * 0.4,
            ease: 'linear',
          }}
        />
      ))}
    </div>
  );
}