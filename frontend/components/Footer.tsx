import { Mail, Phone, MapPin, Globe, Linkedin, Instagram, Youtube, ChevronRight } from 'lucide-react';
import logoDwimitra from '@/assets/logo_dwimitra_v2.png';

export function Footer() {
  return (
    <footer className="mt-20 bg-slate-900 text-slate-300 border-t border-slate-800">
      <div className="max-w-7xl mx-auto px-6 py-12 lg:py-16">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-10">

          {/* Company Profile */}
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-white rounded-xl p-1.5 flex items-center justify-center shrink-0 shadow-sm">
                <img
                  src={logoDwimitra}
                  alt="PT Dwimitra Ekatama Mandiri"
                  className="w-full h-full object-contain"
                />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white tracking-tight">PT Dwimitra Ekatama Mandiri</h3>
                <p className="text-[11px] text-blue-400 font-semibold tracking-wide">Data Center & MEP Solution Provider</p>
              </div>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">
              Penyedia layanan MEP & Konsultan Data Center terkemuka di Indonesia dengan pengalaman 25+ tahun. Partner Uptime Institute Pertama di Indonesia.
            </p>
            <div className="flex items-center gap-2 pt-2">
              <a
                href="https://www.linkedin.com/company/pt-dme"
                target="_blank"
                rel="noopener noreferrer"
                className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-blue-600 text-slate-400 hover:text-white transition-all flex items-center justify-center border border-slate-700/60"
                title="LinkedIn"
              >
                <Linkedin className="w-4 h-4" />
              </a>
              <a
                href="https://www.instagram.com/dwimitra_id"
                target="_blank"
                rel="noopener noreferrer"
                className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-pink-600 text-slate-400 hover:text-white transition-all flex items-center justify-center border border-slate-700/60"
                title="Instagram"
              >
                <Instagram className="w-4 h-4" />
              </a>
              <a
                href="https://youtube.com/@dmedwimitra"
                target="_blank"
                rel="noopener noreferrer"
                className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-red-600 text-slate-400 hover:text-white transition-all flex items-center justify-center border border-slate-700/60"
                title="YouTube"
              >
                <Youtube className="w-4 h-4" />
              </a>
              <a
                href="https://dwimitra.co.id/"
                target="_blank"
                rel="noopener noreferrer"
                className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-all flex items-center justify-center border border-slate-700/60"
                title="Website Resmi"
              >
                <Globe className="w-4 h-4" />
              </a>
            </div>
          </div>

          {/* Office Address */}
          <div className="space-y-4">
            <h4 className="text-xs font-bold text-slate-200 uppercase tracking-widest border-b border-slate-800 pb-2.5">
              Lokasi Kantor
            </h4>
            <div className="flex items-start gap-3">
              <MapPin className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
              <div className="text-xs text-slate-400 leading-relaxed">
                <span className="font-semibold text-slate-200 block mb-1">Pantai Indah Barat</span>
                Komplek Toho Blok C No. 18-19<br />
                Kamal Muara - Penjaringan<br />
                Jakarta Utara - DKI Jakarta 14470
              </div>
            </div>
          </div>

          {/* Contact */}
          <div className="space-y-4">
            <h4 className="text-xs font-bold text-slate-200 uppercase tracking-widest border-b border-slate-800 pb-2.5">
              Kontak
            </h4>
            <div className="space-y-3">
              <a href="tel:+622155965301" className="flex items-start gap-3 group">
                <Phone className="w-4 h-4 text-blue-400 shrink-0 mt-0.5 group-hover:text-blue-300 transition-colors" />
                <div className="text-xs">
                  <p className="text-[10px] text-slate-500 font-semibold uppercase">Telepon Kantor</p>
                  <p className="font-semibold text-slate-300 group-hover:text-white transition-colors">+62 21 5596 5301</p>
                </div>
              </a>

              <a href="mailto:marketing@dwimitrasystem.com" className="flex items-start gap-3 group">
                <Mail className="w-4 h-4 text-blue-400 shrink-0 mt-0.5 group-hover:text-blue-300 transition-colors" />
                <div className="text-xs">
                  <p className="text-[10px] text-slate-500 font-semibold uppercase">Email Support</p>
                  <p className="font-semibold text-slate-300 group-hover:text-white transition-colors truncate max-w-[190px]">marketing@dwimitrasystem.com</p>
                </div>
              </a>
            </div>
          </div>

          {/* Official Links */}
          <div className="space-y-4">
            <h4 className="text-xs font-bold text-slate-200 uppercase tracking-widest border-b border-slate-800 pb-2.5">
              Tautan Resmi
            </h4>
            <ul className="space-y-2 text-xs text-slate-400">
              <li>
                <a
                  href="https://dwimitra.co.id/who-we-are/#Company-Profile"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-white transition-colors flex items-center gap-1.5 group"
                >
                  <ChevronRight className="w-3 h-3 text-slate-600 group-hover:text-blue-400 transition-colors" />
                  Company Profile DME
                </a>
              </li>
              <li>
                <a
                  href="https://dwimitra.co.id/what-we-do/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-white transition-colors flex items-center gap-1.5 group"
                >
                  <ChevronRight className="w-3 h-3 text-slate-600 group-hover:text-blue-400 transition-colors" />
                  Layanan & Solutions (MEP)
                </a>
              </li>
              <li>
                <a
                  href="https://dwimitra.co.id/careers/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-white transition-colors flex items-center gap-1.5 group"
                >
                  <ChevronRight className="w-3 h-3 text-slate-600 group-hover:text-blue-400 transition-colors" />
                  Karir & Opportunities
                </a>
              </li>
              <li>
                <a
                  href="https://dwimitra.co.id/who-we-are/#Leadership"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-white transition-colors flex items-center gap-1.5 group"
                >
                  <ChevronRight className="w-3 h-3 text-slate-600 group-hover:text-blue-400 transition-colors" />
                  Manajemen & Leadership
                </a>
              </li>
            </ul>
          </div>

        </div>

        {/* Bottom copyright */}
        <div className="mt-12 pt-6 border-t border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-xs text-slate-500 font-medium text-center sm:text-left">
            © {new Date().getFullYear()} PT Dwimitra Ekatama Mandiri. Hak cipta dilindungi undang-undang.
          </p>
          <div className="flex items-center gap-6 text-xs text-slate-400 font-medium">
            <span className="flex items-center gap-2">
              <span className="w-2 h-2 bg-emerald-500 rounded-full" />
              Sistem Pemeliharaan v2.0
            </span>
            <a href="https://dwimitra.co.id/" target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors">
              dwimitra.co.id
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
