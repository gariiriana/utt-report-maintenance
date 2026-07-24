import { motion } from 'motion/react';

interface DataCenterBackgroundProps {
  showVideo?: boolean;
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
          className={`absolute w-1.5 h-1.5 bg-blue-500/60 rounded-full shadow-md shadow-blue-400/50 top-0 ${LEFT_CLASSES[i]}`}
          animate={{
            y: ['0vh', '100vh'],
            opacity: [0, 0.8, 0.8, 0],
            scale: [0, 1.2, 1.2, 0],
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

export function DataCenterBackground(_props?: DataCenterBackgroundProps) {
  return (
    <div className="fixed inset-0 z-0 overflow-hidden pointer-events-none bg-gradient-to-br from-white via-sky-50 to-blue-100">
      {/* Ambient Glowing Light Orbs */}
      <div className="absolute -top-32 -left-32 w-[600px] h-[600px] bg-sky-200/60 rounded-full blur-3xl pointer-events-none animate-pulse" />
      <div className="absolute top-1/3 -right-32 w-[700px] h-[700px] bg-blue-200/50 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-32 left-1/4 w-[500px] h-[500px] bg-cyan-100/70 rounded-full blur-3xl pointer-events-none" />

      {/* Tech Grid Overlay */}
      <div className="absolute inset-0 opacity-15 blue-grid-bg pointer-events-none" />

      {/* Dynamic Data Particles */}
      <DataFlowParticles />
    </div>
  );
}
