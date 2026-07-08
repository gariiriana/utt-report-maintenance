import { useEffect, useRef } from 'react';
import { motion } from 'motion/react';

interface DataCenterBackgroundProps {
  showVideo?: boolean;
}

function ServerRacksCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    const colCount = 6;
    const rackUnitsPerCol = 22;
    const rackWidth = 140; 
    const unitHeight = 35; 
    
    const getRackX = (index: number) => {
      const step = width / (colCount + 1);
      return step * (index + 1) - rackWidth / 2;
    };

    interface LED {
      color: string;
      blinkSpeed: number;
      blinkOffset: number;
      alwaysOn?: boolean;
    }
    
    interface ServerUnit {
      leds: LED[];
      label: string;
    }

    const racks: ServerUnit[][] = [];
    for (let col = 0; col < colCount; col++) {
      const units: ServerUnit[] = [];
      for (let unit = 0; unit < rackUnitsPerCol; unit++) {
        const leds: LED[] = [
          { color: '#3b82f6', blinkSpeed: 0, blinkOffset: 0, alwaysOn: true },
          { color: '#10b981', blinkSpeed: 0.15 + Math.random() * 0.1, blinkOffset: Math.random() * 10 },
          { color: Math.random() > 0.3 ? '#10b981' : '#60a5fa', blinkSpeed: 0.2 + Math.random() * 0.15, blinkOffset: Math.random() * 10 },
          { color: '#10b981', blinkSpeed: 0.25 + Math.random() * 0.2, blinkOffset: Math.random() * 10 },
          { color: '#10b981', blinkSpeed: 0.25 + Math.random() * 0.2, blinkOffset: Math.random() * 10 },
          { color: '#10b981', blinkSpeed: 0.02, blinkOffset: Math.random() * 10 },
          { 
            color: '#f59e0b', 
            blinkSpeed: Math.random() > 0.95 ? 0.05 : 0, 
            blinkOffset: Math.random() * 10,
            alwaysOn: Math.random() > 0.95 ? undefined : false 
          }
        ];
        
        const ipLastOctet = Math.floor(Math.random() * 254) + 1;
        units.push({
          leds,
          label: `10.22.${col + 1}.${ipLastOctet}`
        });
      }
      racks.push(units);
    }

    const draw = (time: number) => {
      ctx.clearRect(0, 0, width, height);

      const glow = ctx.createRadialGradient(
        width / 2, height / 2, 100,
        width / 2, height / 2, Math.max(width, height)
      );
      glow.addColorStop(0, 'rgba(15, 23, 42, 0.45)');
      glow.addColorStop(0.5, 'rgba(15, 23, 42, 0.75)');
      glow.addColorStop(1, 'rgba(2, 6, 23, 0.96)');
      ctx.fillStyle = glow;
      ctx.fillRect(0, 0, width, height);

      racks.forEach((units, colIndex) => {
        const x = getRackX(colIndex);
        const rackHeight = rackUnitsPerCol * unitHeight;
        const yStart = (height - rackHeight) / 2;

        ctx.strokeStyle = 'rgba(51, 65, 85, 0.12)';
        ctx.lineWidth = 1.5;
        ctx.strokeRect(x, yStart, rackWidth, rackHeight);

        ctx.fillStyle = 'rgba(15, 23, 42, 0.35)';
        ctx.fillRect(x, yStart, rackWidth, rackHeight);

        units.forEach((unit, unitIndex) => {
          const y = yStart + unitIndex * unitHeight;

          ctx.strokeStyle = 'rgba(71, 85, 105, 0.06)';
          ctx.lineWidth = 1;
          ctx.strokeRect(x + 2, y + 2, rackWidth - 4, unitHeight - 4);
          
          ctx.fillStyle = 'rgba(30, 41, 59, 0.12)';
          ctx.fillRect(x + 6, y + 6, rackWidth - 12, unitHeight - 12);

          ctx.fillStyle = 'rgba(71, 85, 105, 0.18)';
          ctx.fillRect(x + 3, y + 6, 2, unitHeight - 12); 
          ctx.fillRect(x + rackWidth - 5, y + 6, 2, unitHeight - 12); 

          const ledStartX = x + 15;
          const ledY = y + unitHeight / 2;
          
          unit.leds.forEach((led, ledIndex) => {
            const ledX = ledStartX + ledIndex * 9;
            
            let isOn = true;
            if (led.alwaysOn === false) {
              isOn = false;
            } else if (led.alwaysOn !== true && led.blinkSpeed > 0) {
              isOn = Math.sin(time * led.blinkSpeed + led.blinkOffset) > -0.2;
            }

            if (isOn) {
              ctx.beginPath();
              ctx.arc(ledX, ledY, 1.8, 0, Math.PI * 2);
              ctx.fillStyle = led.color;
              ctx.fill();

              ctx.beginPath();
              ctx.arc(ledX, ledY, 3.5, 0, Math.PI * 2);
              const ledGlow = ctx.createRadialGradient(ledX, ledY, 0, ledX, ledY, 3.5);
              ledGlow.addColorStop(0, led.color);
              ledGlow.addColorStop(1, 'rgba(0,0,0,0)');
              ctx.fillStyle = ledGlow;
              ctx.fill();
            } else {
              ctx.beginPath();
              ctx.arc(ledX, ledY, 1.8, 0, Math.PI * 2);
              ctx.fillStyle = 'rgba(71, 85, 105, 0.2)';
              ctx.fill();
            }
          });

          ctx.fillStyle = 'rgba(148, 163, 184, 0.15)';
          ctx.font = '7px monospace';
          ctx.textAlign = 'right';
          ctx.fillText(unit.label, x + rackWidth - 15, y + unitHeight / 2 + 2.5);
        });
      });

      animationFrameId = requestAnimationFrame(draw);
    };

    const handleResize = () => {
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    };

    window.addEventListener('resize', handleResize);
    animationFrameId = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full pointer-events-none opacity-30"
    />
  );
}

export function DataCenterBackground({ showVideo = true }: DataCenterBackgroundProps) {
  return (
    <>
      {showVideo ? (
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
      ) : (
        <div className="fixed inset-0 z-0 overflow-hidden pointer-events-none bg-slate-950">
          <ServerRacksCanvas />
        </div>
      )}

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
