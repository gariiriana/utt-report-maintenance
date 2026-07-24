import { Mail, Phone, MapPin, Globe, Linkedin, Instagram, Youtube } from 'lucide-react';
import logoDwimitra from '@/assets/logo_dwimitra_v2.png';

export function Footer() {
  return (
    <footer className="relative mt-20 bg-white/80 backdrop-blur-md border-t border-sky-100/80 overflow-hidden">
      <div className="h-[2px] bg-gradient-to-r from-blue-600 via-cyan-500 to-teal-500" />

      <div className="max-w-7xl mx-auto px-6 py-12 lg:py-16">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-10">

          {/* Company Profile */}
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <img
                src={logoDwimitra}
                alt="PT Dwimitra Ekatama Mandiri"
                className="w-14 h-14 object-contain"
              />
              <div>
                <h3 className="text-base font-bold text-slate-900 tracking-tight">PT Dwimitra Ekatama Mandiri</h3>
                <p className="text-xs text-sky-600 font-bold tracking-wide">Data Center & MEP Solution Provider</p>
              </div>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed font-medium">
              Penyedia layanan MEP & Konsultan Data Center terkemuka di Indonesia dengan pengalaman 25+ tahun. Partner Uptime Institute Pertama di Indonesia.
            </p>
            <div className="flex items-center gap-3 pt-2">
              <a
                href="https://www.linkedin.com/company/pt-dme"
                target="_blank"
                rel="noopener noreferrer"
                className="p-2 bg-sky-50 border border-sky-100 rounded-xl text-blue-600 hover:bg-blue-600 hover:text-white transition-all shadow-sm"
                title="LinkedIn"
              >
                <Linkedin className="w-4 h-4" />
              </a>
              <a
                href="https://www.instagram.com/dwimitra_id"
                target="_blank"
                rel="noopener noreferrer"
                className="p-2 bg-sky-50 border border-sky-100 rounded-xl text-pink-600 hover:bg-pink-600 hover:text-white transition-all shadow-sm"
                title="Instagram"
              >
                <Instagram className="w-4 h-4" />
              </a>
              <a
                href="https://youtube.com/@dmedwimitra"
                target="_blank"
                rel="noopener noreferrer"
                className="p-2 bg-sky-50 border border-sky-100 rounded-xl text-red-600 hover:bg-red-600 hover:text-white transition-all shadow-sm"
                title="YouTube"
              >
                <Youtube className="w-4 h-4" />
              </a>
              <a
                href="https://dwimitra.co.id/"
                target="_blank"
                rel="noopener noreferrer"
                className="p-2 bg-sky-50 border border-sky-100 rounded-xl text-slate-600 hover:bg-slate-800 hover:text-white transition-all shadow-sm"
                title="Website Resmi"
              >
                <Globe className="w-4 h-4" />
              </a>
            </div>
          </div>

          {/* Office Address */}
          <div className="space-y-4">
            <h4 className="text-xs font-bold text-slate-900 uppercase tracking-widest border-b border-sky-100 pb-2">Lokasi Kantor</h4>
            <div className="flex items-start gap-3 group">
              <div className="p-2 bg-sky-50 border border-sky-100 rounded-xl flex-shrink-0 mt-0.5">
                <MapPin className="w-4 h-4 text-sky-600" />
              </div>
              <div className="text-xs text-slate-600 leading-relaxed group-hover:text-slate-900 transition-colors">
                <span className="font-bold text-slate-800 block mb-0.5">Pantai Indah Barat</span>
                Komplek Toho Blok C No. 18-19<br />
                Kamal Muara - Penjaringan<br />
                Jakarta Utara - DKI Jakarta 14470
              </div>
            </div>
          </div>

          {/* Contact */}
          <div className="space-y-4">
            <h4 className="text-xs font-bold text-slate-900 uppercase tracking-widest border-b border-sky-100 pb-2">Kontak</h4>
            <div className="space-y-3">
              <a href="tel:+622155965301" className="flex items-center gap-3 group">
                <div className="p-2 bg-sky-50 border border-sky-100 rounded-xl flex-shrink-0 group-hover:border-blue-400 transition-all">
                  <Phone className="w-4 h-4 text-blue-600" />
                </div>
                <div className="text-xs text-slate-600 group-hover:text-slate-900 transition-colors">
                  <p className="text-[10px] text-slate-400 font-bold uppercase">Telepon Kantor</p>
                  <p className="font-semibold text-slate-800">+62 21 5596 5301</p>
                </div>
              </a>

              <a href="mailto:marketing@dwimitrasystem.com" className="flex items-center gap-3 group">
                <div className="p-2 bg-sky-50 border border-sky-100 rounded-xl flex-shrink-0 group-hover:border-cyan-400 transition-all">
                  <Mail className="w-4 h-4 text-cyan-600" />
                </div>
                <div className="text-xs text-slate-600 group-hover:text-slate-900 transition-colors">
                  <p className="text-[10px] text-slate-400 font-bold uppercase">Email Support</p>
                  <p className="font-semibold text-slate-800 truncate max-w-[170px]">marketing@dwimitrasystem.com</p>
                </div>
              </a>
            </div>
          </div>

          {/* Official Website Links */}
          <div className="space-y-4">
            <h4 className="text-xs font-bold text-slate-900 uppercase tracking-widest border-b border-sky-100 pb-2">Tautan Resmi</h4>
            <ul className="space-y-2 text-xs font-medium text-slate-600">
              <li>
                <a
                  href="https://dwimitra.co.id/who-we-are/#Company-Profile"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-blue-600 transition-colors flex items-center gap-1.5"
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                  Company Profile DME
                </a>
              </li>
              <li>
                <a
                  href="https://dwimitra.co.id/what-we-do/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-blue-600 transition-colors flex items-center gap-1.5"
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-cyan-500" />
                  Layanan & Solutions (MEP)
                </a>
              </li>
              <li>
                <a
                  href="https://dwimitra.co.id/careers/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-blue-600 transition-colors flex items-center gap-1.5"
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-teal-500" />
                  Karir & Opportunities
                </a>
              </li>
              <li>
                <a
                  href="https://dwimitra.co.id/who-we-are/#Leadership"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-blue-600 transition-colors flex items-center gap-1.5"
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-purple-500" />
                  Manajemen & Leadership
                </a>
              </li>
            </ul>
          </div>

        </div>

        {/* Bottom copyright */}
        <div className="mt-12 pt-6 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-xs text-slate-500 font-medium text-center sm:text-left">
            © {new Date().getFullYear()} PT Dwimitra Ekatama Mandiri. Hak cipta dilindungi undang-undang.
          </p>
          <div className="flex items-center gap-6 text-xs font-medium text-slate-500">
            <span className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
              Sistem Pemeliharaan v2.0
            </span>
            <div className="flex gap-4">
              <a href="https://dwimitra.co.id/" target="_blank" rel="noopener noreferrer" className="hover:text-slate-800 transition-colors">dwimitra.co.id</a>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
