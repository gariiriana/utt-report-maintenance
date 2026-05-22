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
        <div className="absolute inset-0 blue-grid-bg" />
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
    if (!canvas || !('transferControlToOffscreen' in canvas)) {
      console.warn('OffscreenCanvas not supported');
      return;
    }

    const worker = new Worker(
      new URL('../utils/canvas.worker.ts', import.meta.url),
      { type: 'module' }
    );

    const offscreen = canvas.transferControlToOffscreen();
    const width = window.innerWidth;
    const height = window.innerHeight;

    worker.postMessage(
      {
        type: 'init',
        payload: {
          canvas: offscreen,
          width,
          height,
        }
      },
      [offscreen] 
    );

    const handleResize = () => {
      worker.postMessage({
        type: 'resize',
        payload: {
          width: window.innerWidth,
          height: window.innerHeight,
        }
      });
    };

    window.addEventListener('resize', handleResize);

    return () => {
      worker.terminate();
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 pointer-events-none opacity-40"
    />
  );
}

const LEFT_CLASSES = [
  'left-0',
  'left-[12.5%]',
  'left-[25%]',
  'left-[37.5%]',
  'left-[50%]',
  'left-[62.5%]',
  'left-[75%]',
  'left-[87.5%]',
];

function DataFlowParticles() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {[...Array(8)].map((_, i) => (
        <motion.div
          key={i}
          className={`absolute w-1 h-1 bg-blue-400 rounded-full shadow-lg shadow-blue-400/50 top-0 ${LEFT_CLASSES[i]}`}
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
