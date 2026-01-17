import { motion } from 'motion/react';
import { Mail, Phone, MapPin, Facebook, Twitter, Linkedin, Instagram, Youtube, ExternalLink, Shield, Award, Zap } from 'lucide-react';
import logoUTT from '@/assets/232afb9a46e8d280b1d1b9dca62e90c6882e64e6.png';

export function Footer() {
  return (
    <footer className="relative mt-12 sm:mt-20 bg-slate-950 border-t border-slate-800/50 overflow-hidden">
      {/* Gradient Accent Bar */}
      <div className="h-1 bg-gradient-to-r from-blue-600 via-indigo-500 to-purple-600" />
      
      {/* Animated Background Elements */}
      <div className="absolute inset-0 overflow-hidden">
        {/* Grid Pattern */}
        <div className="absolute inset-0 opacity-10">
          <div className="absolute inset-0" style={{
            backgroundImage: `
              linear-gradient(rgba(59, 130, 246, 0.3) 1px, transparent 1px),
              linear-gradient(90deg, rgba(59, 130, 246, 0.3) 1px, transparent 1px)
            `,
            backgroundSize: '50px 50px',
          }} />
        </div>

        {/* Floating Orbs */}
        <motion.div
          className="absolute top-20 left-10 w-32 h-32 bg-blue-500/10 rounded-full blur-2xl"
          animate={{
            y: [0, -20, 0],
            x: [0, 10, 0],
            scale: [1, 1.1, 1],
          }}
          transition={{
            duration: 8,
            repeat: Infinity,
            ease: "easeInOut"
          }}
        />
        <motion.div
          className="absolute bottom-20 right-20 w-40 h-40 bg-indigo-500/10 rounded-full blur-2xl"
          animate={{
            y: [0, 20, 0],
            x: [0, -15, 0],
            scale: [1, 1.2, 1],
          }}
          transition={{
            duration: 10,
            repeat: Infinity,
            ease: "easeInOut"
          }}
        />
        <motion.div
          className="absolute top-1/2 left-1/2 w-24 h-24 bg-purple-500/10 rounded-full blur-2xl"
          animate={{
            y: [0, -15, 0],
            x: [0, 15, 0],
            scale: [1, 1.15, 1],
          }}
          transition={{
            duration: 7,
            repeat: Infinity,
            ease: "easeInOut"
          }}
        />

        {/* Animated Lines */}
        <svg className="absolute inset-0 w-full h-full opacity-5">
          <motion.line
            x1="0%" y1="30%" x2="100%" y2="30%"
            stroke="rgb(59, 130, 246)"
            strokeWidth="1"
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
          />
          <motion.line
            x1="0%" y1="70%" x2="100%" y2="70%"
            stroke="rgb(99, 102, 241)"
            strokeWidth="1"
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: 4, repeat: Infinity, ease: "linear", delay: 1 }}
          />
        </svg>
      </div>

      {/* Content */}
      <div className="relative">
        <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-12 xl:px-16 py-8 sm:py-12 lg:py-16">
          {/* Main Content Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 sm:gap-8 lg:gap-8">
            {/* Column 1 - Logo & Company Name (Spanning 4 columns) */}
            <div className="lg:col-span-4 flex flex-col items-center lg:items-start">
              {/* Logo + Company Name - Vertical on Mobile, Horizontal on Desktop */}
              <div className="flex flex-col sm:flex-row items-center sm:items-center lg:items-center gap-3 sm:gap-4 mb-4 w-full">
                {/* Logo with Glow Effect */}
                <motion.div 
                  className="relative flex-shrink-0"
                  whileHover={{ scale: 1.05 }}
                  transition={{ duration: 0.3 }}
                >
                  <div className="absolute inset-0 bg-blue-500/20 blur-xl rounded-full scale-110" />
                  <img 
                    src={logoUTT} 
                    alt="PT United Transworld Trading" 
                    className="relative w-16 h-16 sm:w-18 sm:h-18 lg:w-20 lg:h-20 object-contain"
                  />
                </motion.div>
                
                {/* Company Name */}
                <div className="flex-1 text-center sm:text-left">
                  <h3 className="text-base sm:text-lg lg:text-xl font-bold text-white mb-1 leading-tight">
                    PT United Transworld Trading
                  </h3>
                  <p className="text-xs sm:text-sm text-indigo-400 font-medium">
                    Data Center Solutions
                  </p>
                </div>
              </div>

              {/* Badges */}
              <div className="flex flex-wrap justify-center lg:justify-start gap-2 mb-3 sm:mb-4 w-full">
                <div className="flex items-center gap-1.5 px-2 py-1 sm:px-2.5 sm:py-1.5 bg-emerald-500/10 border border-emerald-500/20 rounded-lg">
                  <Shield className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-emerald-400" />
                  <span className="text-xs text-emerald-400 font-medium">ISO Certified</span>
                </div>
                <div className="flex items-center gap-1.5 px-2 py-1 sm:px-2.5 sm:py-1.5 bg-blue-500/10 border border-blue-500/20 rounded-lg">
                  <Award className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-blue-400" />
                  <span className="text-xs text-blue-400 font-medium">Trusted Partner</span>
                </div>
                <div className="flex items-center gap-1.5 px-2 py-1 sm:px-2.5 sm:py-1.5 bg-purple-500/10 border border-purple-500/20 rounded-lg">
                  <Zap className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-purple-400" />
                  <span className="text-xs text-purple-400 font-medium">24/7 Support</span>
                </div>
              </div>

              {/* Social Media */}
              <div className="flex justify-center lg:justify-start gap-2 w-full">
                <motion.a
                  href="#"
                  whileHover={{ scale: 1.1, y: -2 }}
                  whileTap={{ scale: 0.95 }}
                  className="p-2 bg-slate-800/50 hover:bg-blue-500/20 border border-slate-700/50 hover:border-blue-500/50 rounded-lg transition group"
                >
                  <Facebook className="w-4 h-4 text-slate-400 group-hover:text-blue-400 transition" />
                </motion.a>
                <motion.a
                  href="#"
                  whileHover={{ scale: 1.1, y: -2 }}
                  whileTap={{ scale: 0.95 }}
                  className="p-2 bg-slate-800/50 hover:bg-sky-500/20 border border-slate-700/50 hover:border-sky-500/50 rounded-lg transition group"
                >
                  <Twitter className="w-4 h-4 text-slate-400 group-hover:text-sky-400 transition" />
                </motion.a>
                <motion.a
                  href="#"
                  whileHover={{ scale: 1.1, y: -2 }}
                  whileTap={{ scale: 0.95 }}
                  className="p-2 bg-slate-800/50 hover:bg-blue-600/20 border border-slate-700/50 hover:border-blue-600/50 rounded-lg transition group"
                >
                  <Linkedin className="w-4 h-4 text-slate-400 group-hover:text-blue-500 transition" />
                </motion.a>
                <motion.a
                  href="#"
                  whileHover={{ scale: 1.1, y: -2 }}
                  whileTap={{ scale: 0.95 }}
                  className="p-2 bg-slate-800/50 hover:bg-pink-500/20 border border-slate-700/50 hover:border-pink-500/50 rounded-lg transition group"
                >
                  <Instagram className="w-4 h-4 text-slate-400 group-hover:text-pink-400 transition" />
                </motion.a>
                <motion.a
                  href="#"
                  whileHover={{ scale: 1.1, y: -2 }}
                  whileTap={{ scale: 0.95 }}
                  className="p-2 bg-slate-800/50 hover:bg-red-500/20 border border-slate-700/50 hover:border-red-500/50 rounded-lg transition group"
                >
                  <Youtube className="w-4 h-4 text-slate-400 group-hover:text-red-400 transition" />
                </motion.a>
              </div>
            </div>

            {/* Column 2 - Quick Links & System Status (Spanning 3 columns) */}
            <div className="lg:col-span-3 flex flex-col items-center lg:items-start">
              <h4 className="text-sm font-semibold text-white mb-3 sm:mb-4 flex items-center gap-2">
                <div className="w-1 h-4 bg-gradient-to-b from-blue-500 to-indigo-500 rounded-full" />
                Quick Links
              </h4>
              <ul className="space-y-2.5 sm:space-y-3 text-center lg:text-left w-full">
                <li>
                  <motion.a 
                    href="#"
                    whileHover={{ x: 5 }}
                    className="text-sm text-slate-400 hover:text-blue-400 transition flex items-center justify-center lg:justify-start gap-2 group"
                  >
                    <span className="w-1 h-1 bg-slate-600 rounded-full group-hover:bg-blue-400 transition" />
                    About Us
                  </motion.a>
                </li>
                <li>
                  <motion.a 
                    href="#"
                    whileHover={{ x: 5 }}
                    className="text-sm text-slate-400 hover:text-blue-400 transition flex items-center justify-center lg:justify-start gap-2 group"
                  >
                    <span className="w-1 h-1 bg-slate-600 rounded-full group-hover:bg-blue-400 transition" />
                    Our Services
                  </motion.a>
                </li>
                <li>
                  <motion.a 
                    href="#"
                    whileHover={{ x: 5 }}
                    className="text-sm text-slate-400 hover:text-blue-400 transition flex items-center justify-center lg:justify-start gap-2 group"
                  >
                    <span className="w-1 h-1 bg-slate-600 rounded-full group-hover:bg-blue-400 transition" />
                    Case Studies
                  </motion.a>
                </li>
                <li>
                  <motion.a 
                    href="#"
                    whileHover={{ x: 5 }}
                    className="text-sm text-slate-400 hover:text-blue-400 transition flex items-center justify-center lg:justify-start gap-2 group"
                  >
                    <span className="w-1 h-1 bg-slate-600 rounded-full group-hover:bg-blue-400 transition" />
                    Careers
                  </motion.a>
                </li>
                <li>
                  <motion.a 
                    href="#"
                    whileHover={{ x: 5 }}
                    className="text-sm text-slate-400 hover:text-blue-400 transition flex items-center justify-center lg:justify-start gap-2 group"
                  >
                    <span className="w-1 h-1 bg-slate-600 rounded-full group-hover:bg-blue-400 transition" />
                    Contact
                  </motion.a>
                </li>
              </ul>

              {/* Server Status Indicators */}
              <div className="mt-5 sm:mt-6 p-3 sm:p-4 bg-slate-900/50 border border-slate-800/50 rounded-lg w-full">
                <h5 className="text-xs font-semibold text-slate-300 mb-2.5 sm:mb-3 text-center lg:text-left">System Status</h5>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-500">Main Server</span>
                    <div className="flex items-center gap-2">
                      <motion.div 
                        className="w-2 h-2 bg-emerald-400 rounded-full"
                        animate={{ opacity: [1, 0.5, 1] }}
                        transition={{ duration: 2, repeat: Infinity }}
                      />
                      <span className="text-xs text-emerald-400">Online</span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-500">Backup Server</span>
                    <div className="flex items-center gap-2">
                      <motion.div 
                        className="w-2 h-2 bg-emerald-400 rounded-full"
                        animate={{ opacity: [1, 0.5, 1] }}
                        transition={{ duration: 2, repeat: Infinity, delay: 0.5 }}
                      />
                      <span className="text-xs text-emerald-400">Online</span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-500">Database</span>
                    <div className="flex items-center gap-2">
                      <motion.div 
                        className="w-2 h-2 bg-emerald-400 rounded-full"
                        animate={{ opacity: [1, 0.5, 1] }}
                        transition={{ duration: 2, repeat: Infinity, delay: 1 }}
                      />
                      <span className="text-xs text-emerald-400">Online</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Column 3 - Office Address (Spanning 2 columns) */}
            <div className="lg:col-span-2 flex flex-col items-center lg:items-start">
              <h4 className="text-sm font-semibold text-white mb-3 sm:mb-4 flex items-center gap-2">
                <div className="w-1 h-4 bg-gradient-to-b from-indigo-500 to-purple-500 rounded-full" />
                Office Location
              </h4>
              <div className="space-y-4 w-full">
                <motion.div 
                  whileHover={{ scale: 1.02 }}
                  className="p-3 sm:p-4 bg-slate-900/50 border border-slate-800/50 hover:border-blue-500/30 rounded-lg transition group"
                >
                  <div className="flex flex-col sm:flex-row items-center sm:items-start gap-3">
                    <div className="p-2 sm:p-2.5 bg-blue-500/10 rounded-lg border border-blue-500/20 flex-shrink-0">
                      <MapPin className="w-4 h-4 text-blue-400" />
                    </div>
                    <div className="flex-1 text-center lg:text-left">
                      <h5 className="text-xs font-semibold text-slate-200 mb-1.5 sm:mb-2">Head Office</h5>
                      <p className="text-xs text-slate-400 leading-relaxed">
                        Thamrin Residence Blok RTE 16-17<br />
                        Jl Kebon Kacang Raya, Waduk Melati<br />
                        Jakarta Pusat – 10230, Indonesia
                      </p>
                      <motion.a
                        href="https://maps.google.com"
                        target="_blank"
                        whileHover={{ x: 2 }}
                        className="inline-flex items-center gap-1 mt-2 text-xs text-blue-400 hover:text-blue-300 transition"
                      >
                        View on Map
                        <ExternalLink className="w-3 h-3" />
                      </motion.a>
                    </div>
                  </div>
                </motion.div>
              </div>
            </div>

            {/* Column 4 - Contact Information (Spanning 3 columns) */}
            <div className="lg:col-span-3 flex flex-col items-center lg:items-start">
              <h4 className="text-sm font-semibold text-white mb-3 sm:mb-4 flex items-center gap-2">
                <div className="w-1 h-4 bg-gradient-to-b from-purple-500 to-pink-500 rounded-full" />
                Get In Touch
              </h4>
              <div className="space-y-2.5 sm:space-y-3 w-full">
                {/* Phone */}
                <motion.a 
                  href="tel:+622129496230"
                  whileHover={{ scale: 1.02, y: -2 }}
                  whileTap={{ scale: 0.98 }}
                  className="flex items-center gap-2.5 sm:gap-3 p-3 sm:p-4 bg-slate-900/50 rounded-lg border border-slate-700/50 hover:border-blue-500/50 hover:bg-slate-800/50 transition group"
                >
                  <div className="p-2 sm:p-2.5 bg-blue-500/10 rounded-lg border border-blue-500/20 group-hover:bg-blue-500/20 transition flex-shrink-0">
                    <Phone className="w-4 h-4 text-blue-400" />
                  </div>
                  <div className="text-left flex-1 min-w-0">
                    <p className="text-xs text-slate-500 mb-0.5">Telephone</p>
                    <p className="text-sm font-medium text-white group-hover:text-blue-400 transition truncate">+62-21-29496230</p>
                  </div>
                </motion.a>

                {/* Email */}
                <motion.a 
                  href="mailto:marketing@utt.co.id"
                  whileHover={{ scale: 1.02, y: -2 }}
                  whileTap={{ scale: 0.98 }}
                  className="flex items-center gap-2.5 sm:gap-3 p-3 sm:p-4 bg-slate-900/50 rounded-lg border border-slate-700/50 hover:border-indigo-500/50 hover:bg-slate-800/50 transition group"
                >
                  <div className="p-2 sm:p-2.5 bg-indigo-500/10 rounded-lg border border-indigo-500/20 group-hover:bg-indigo-500/20 transition flex-shrink-0">
                    <Mail className="w-4 h-4 text-indigo-400" />
                  </div>
                  <div className="text-left flex-1 min-w-0">
                    <p className="text-xs text-slate-500 mb-0.5">Email</p>
                    <p className="text-sm font-medium text-white group-hover:text-indigo-400 transition truncate">marketing@utt.co.id</p>
                  </div>
                </motion.a>

                {/* Support Badge */}
                <div className="p-3 sm:p-4 bg-gradient-to-br from-blue-500/10 to-purple-500/10 border border-blue-500/20 rounded-lg">
                  <div className="flex items-center gap-2.5 sm:gap-3">
                    <motion.div
                      animate={{ rotate: 360 }}
                      transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
                      className="p-1.5 sm:p-2 bg-blue-500/20 rounded-lg flex-shrink-0"
                    >
                      <Zap className="w-4 h-4 sm:w-5 sm:h-5 text-blue-400" />
                    </motion.div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-white">24/7 Support Available</p>
                      <p className="text-xs text-slate-400">We're here to help anytime</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Bottom Bar */}
          <div className="mt-6 sm:mt-8 lg:mt-12 pt-5 sm:pt-6 lg:pt-8 border-t border-slate-800/50">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 sm:gap-4">
              <p className="text-xs sm:text-sm text-slate-500 text-center sm:text-left">
                © {new Date().getFullYear()} PT United Transworld Trading. All rights reserved.
              </p>
              <div className="flex flex-col sm:flex-row items-center gap-3 sm:gap-4">
                <div className="flex items-center gap-2">
                  <motion.div 
                    className="w-2 h-2 bg-emerald-400 rounded-full"
                    animate={{ scale: [1, 1.2, 1], opacity: [1, 0.7, 1] }}
                    transition={{ duration: 2, repeat: Infinity }}
                  />
                  <span className="text-xs sm:text-sm text-slate-500">System v2.0</span>
                </div>
                <div className="hidden sm:block h-4 w-px bg-slate-700" />
                <div className="flex gap-3">
                  <a href="#" className="text-xs text-slate-500 hover:text-slate-300 transition">Privacy</a>
                  <a href="#" className="text-xs text-slate-500 hover:text-slate-300 transition">Terms</a>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}