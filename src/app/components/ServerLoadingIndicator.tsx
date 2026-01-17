import { motion } from 'motion/react';
import { DataCenterBackground } from './DataCenterBackground';
import logoUTT from '@/assets/232afb9a46e8d280b1d1b9dca62e90c6882e64e6.png';

export function ServerLoadingIndicator() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-950 relative overflow-hidden">
      <DataCenterBackground />
      
      <div className="relative z-10 text-center">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5 }}
          className="mb-8"
        >
          <img 
            src={logoUTT} 
            alt="PT United Transworld Trading" 
            className="w-32 h-32 sm:w-40 sm:h-40 mx-auto object-contain" 
          />
        </motion.div>
        
        <div className="flex items-center justify-center gap-2 mb-4">
          {[...Array(3)].map((_, i) => (
            <motion.div
              key={i}
              className="w-3 h-3 bg-blue-500 rounded-full"
              animate={{
                opacity: [0.3, 1, 0.3],
                scale: [1, 1.3, 1],
              }}
              transition={{
                duration: 1.5,
                repeat: Infinity,
                delay: i * 0.2,
              }}
            />
          ))}
        </div>
        
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="text-slate-400 text-sm"
        >
          Loading...
        </motion.p>
      </div>
    </div>
  );
}