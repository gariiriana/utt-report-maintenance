import { Mail, Phone, MapPin } from 'lucide-react';
import logoUTT from '@/assets/logo_utt.png';

export function Footer() {
  return (
    <footer className="relative mt-20 bg-slate-950 border-t border-slate-900 overflow-hidden">
      <div className="h-[2px] bg-slate-800" />

      <div className="max-w-7xl mx-auto px-6 py-12 lg:py-16">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-12">

          <div className="space-y-6">
            <div className="flex items-center gap-4">
              <img
                src={logoUTT}
                alt="PT United Transworld Trading"
                className="w-16 h-16 object-contain grayscale opacity-80"
              />
              <div>
                <h3 className="text-lg font-bold text-slate-200 tracking-tight">PT United Transworld Trading</h3>
                <p className="text-sm text-slate-500 font-medium tracking-wide italic">Solusi Data Center</p>
              </div>
            </div>
            <p className="text-sm text-slate-500 max-w-xs leading-relaxed">
              solusi andal dan berkualitas tinggi untuk kebutuhan infrastruktur data center Anda.
            </p>
          </div>

          <div className="space-y-6">
            <h4 className="text-sm font-semibold text-slate-400 uppercase tracking-[0.2em] mb-4">Lokasi</h4>
            <div className="flex items-start gap-4 group">
              <div className="p-2.5 bg-slate-900 border border-slate-800 rounded-xl flex-shrink-0">
                <MapPin className="w-5 h-5 text-slate-500" />
              </div>
              <div className="text-sm text-slate-500 leading-relaxed group-hover:text-slate-400 transition-colors">
                <span className="font-semibold text-slate-300 block mb-1">Kantor Pusat</span>
                Thamrin Residence Blok RTE 16-17<br />
                Jl Kebon Kacang Raya, Waduk Melati<br />
                Jakarta Pusat – 10230, Indonesia
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <h4 className="text-sm font-semibold text-slate-400 uppercase tracking-[0.2em] mb-4">Kontak</h4>
            <div className="space-y-4">
              <a href="tel:+622129496230" className="flex items-center gap-4 group">
                <div className="p-2.5 bg-slate-900 border border-slate-800 rounded-xl flex-shrink-0 group-hover:border-blue-500/30 transition-all">
                  <Phone className="w-5 h-5 text-slate-500 group-hover:text-blue-400" />
                </div>
                <div className="text-sm text-slate-500 group-hover:text-slate-300 transition-colors">
                  <p className="text-xs text-slate-600 mb-0.5 font-medium">Telepon</p>
                  <p className="font-medium">+62-21-29496230</p>
                </div>
              </a>

              <a href="mailto:marketing@utt.co.id" className="flex items-center gap-4 group">
                <div className="p-2.5 bg-slate-900 border border-slate-800 rounded-xl flex-shrink-0 group-hover:border-indigo-500/30 transition-all">
                  <Mail className="w-5 h-5 text-slate-500 group-hover:text-indigo-400" />
                </div>
                <div className="text-sm text-slate-500 group-hover:text-slate-300 transition-colors">
                  <p className="text-xs text-slate-600 mb-0.5 font-medium">Email</p>
                  <p className="font-medium">marketing@utt.co.id</p>
                </div>
              </a>
            </div>
          </div>

        </div>

        <div className="mt-16 pt-8 border-t border-slate-900 flex flex-col sm:flex-row items-center justify-between gap-6">
          <p className="text-xs text-slate-600 font-medium">
            © {new Date().getFullYear()} PT United Transworld Trading. Hak cipta dilindungi undang-undang.
          </p>
          <div className="flex items-center gap-6 text-xs font-medium text-slate-600">
            <span className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 bg-emerald-500/50 rounded-full animate-pulse" />
              Sistem v2.0
            </span>
            <div className="flex gap-4">
              <a href="#" className="hover:text-slate-400 transition-colors">Privasi</a>
              <a href="#" className="hover:text-slate-400 transition-colors">Ketentuan</a>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
