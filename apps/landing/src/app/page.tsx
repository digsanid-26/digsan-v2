import Image from 'next/image';
import { Trees, MessageCircle, Trophy, Briefcase, Shield, Users, ChevronRight, ArrowRight, Star } from 'lucide-react';
import FamilyTreeVisual from './components/FamilyTreeVisual';

const WEB_URL = process.env.NEXT_PUBLIC_WEB_URL || 'https://app.digsan.id';

const features = [
  {
    icon: Trees,
    title: 'Silsilah Digital',
    desc: 'Dokumentasi pohon keluarga dengan visualisasi interaktif. Simpan sejarah keluarga untuk generasi mendatang.',
    accent: 'text-emerald-400',
    glow: 'bg-emerald-500/10 border-emerald-500/20',
  },
  {
    icon: Briefcase,
    title: 'Digsan Kerja',
    desc: 'Marketplace jasa harian terpercaya. Temukan tukang, asisten rumah tangga, hingga guru les terverifikasi.',
    accent: 'text-blue-400',
    glow: 'bg-blue-500/10 border-blue-500/20',
  },
  {
    icon: MessageCircle,
    title: 'Chat Keluarga',
    desc: 'Obrolan real-time pribadi & grup. Tetap terhubung dengan keluarga besar di mana saja.',
    accent: 'text-violet-400',
    glow: 'bg-violet-500/10 border-violet-500/20',
  },
  {
    icon: Trophy,
    title: 'Gamifikasi',
    desc: 'Kumpulkan poin dan badge dari aktivitas keluarga. Naik peringkat di leaderboard komunitas.',
    accent: 'text-amber-400',
    glow: 'bg-amber-500/10 border-amber-500/20',
  },
  {
    icon: Shield,
    title: 'Privasi & Keamanan',
    desc: 'Data keluarga terenkripsi. Kontrol penuh siapa yang bisa melihat silsilah dan informasi Anda.',
    accent: 'text-rose-400',
    glow: 'bg-rose-500/10 border-rose-500/20',
  },
  {
    icon: Users,
    title: 'Multi-Platform',
    desc: 'Akses dari web browser maupun aplikasi mobile Android & iOS. Sinkronisasi otomatis.',
    accent: 'text-cyan-400',
    glow: 'bg-cyan-500/10 border-cyan-500/20',
  },
];

const steps = [
  { num: '01', title: 'Daftar Gratis', desc: 'Buat akun dalam 30 detik dengan email atau Google.' },
  { num: '02', title: 'Buat Silsilah', desc: 'Tambahkan anggota keluarga dan bangun pohon keluarga interaktif.' },
  { num: '03', title: 'Hubungkan Keluarga', desc: 'Undang saudara untuk bergabung, chat, dan berkolaborasi.' },
  { num: '04', title: 'Raih Pencapaian', desc: 'Kumpulkan poin dari aktivitas keluarga dan buka badge eksklusif.' },
];

const testimonials = [
  {
    name: 'Siti Rahma',
    role: 'Ibu Rumah Tangga, Jakarta',
    text: 'Akhirnya bisa mendokumentasi silsilah keluarga besar kami yang tersebar di berbagai kota. Sangat membantu!',
    rating: 5,
  },
  {
    name: 'Ahmad Fauzi',
    role: 'Pengusaha, Surabaya',
    text: 'Fitur Digsan Kerja memudahkan saya mencari tukang servis AC yang terpercaya. Proses cepat dan aman.',
    rating: 5,
  },
  {
    name: 'Dewi Anggraini',
    role: 'Guru, Bandung',
    text: 'Anak-anak saya sangat antusias mengumpulkan badge keluarga. Gamifikasi yang cerdas untuk menjaga kekompakan.',
    rating: 5,
  },
];

const stats = [
  { value: '10K+', label: 'Keluarga Terdaftar' },
  { value: '50K+', label: 'Anggota Terhubung' },
  { value: '5K+', label: 'Jasa Tersedia' },
  { value: '99.9%', label: 'Uptime' },
];

export default function Landing() {
  return (
    <div className="min-h-screen bg-[#05050f] text-white overflow-x-hidden">

      {/* ─── Ambient Background ─── */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-[-20%] left-[-10%] w-[600px] h-[600px] bg-blue-600/8 rounded-full blur-[120px]" />
        <div className="absolute top-[30%] right-[-15%] w-[500px] h-[500px] bg-indigo-600/6 rounded-full blur-[120px]" />
        <div className="absolute bottom-[-10%] left-[20%] w-[700px] h-[400px] bg-emerald-600/5 rounded-full blur-[120px]" />
      </div>

      {/* ─── Navbar ─── */}
      <nav className="glass border-b border-white/10 sticky top-0 z-50">
        <div className="max-w-screen-xl mx-auto px-6 md:px-8 h-16 flex items-center justify-between">
          <a href="/" className="flex items-center gap-x-3">
            <Image src="/logo-white.svg" alt="Digsan" width={110} height={34} priority className="h-8 w-auto" />
          </a>

          <div className="hidden md:flex items-center gap-x-1 text-sm">
            <a href="#fitur" className="px-4 py-2 text-white/60 hover:text-white hover:bg-white/5 rounded-2xl transition-colors">
              Fitur
            </a>
            <a href="#cara-kerja" className="px-4 py-2 text-white/60 hover:text-white hover:bg-white/5 rounded-2xl transition-colors">
              Cara Kerja
            </a>
            <a href="#testimoni" className="px-4 py-2 text-white/60 hover:text-white hover:bg-white/5 rounded-2xl transition-colors">
              Testimoni
            </a>
          </div>

          <div className="flex items-center gap-x-2 text-sm">
            <a
              href={`${WEB_URL}/login`}
              className="px-4 py-2 text-white/70 hover:text-white hover:bg-white/5 rounded-2xl transition-colors"
            >
              Masuk
            </a>
            <a
              href={`${WEB_URL}/register`}
              className="px-5 py-2 bg-white text-[#05050f] hover:bg-white/90 font-semibold rounded-2xl flex items-center gap-x-2 transition-all active:scale-[0.985]"
            >
              Daftar Gratis
            </a>
          </div>
        </div>
      </nav>

      {/* ─── Hero ─── */}
      <section className="relative max-w-screen-xl mx-auto px-6 md:px-8 pt-16 pb-8">
        <div className="text-center mb-10">
          <div className="inline-flex items-center gap-x-2 px-4 py-1.5 rounded-3xl bg-white/5 border border-white/10 mb-5">
            <div className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />
            <span className="text-emerald-400 text-sm font-medium">Silsilah Keluarga Digital</span>
          </div>

          <h1 className="font-display text-5xl md:text-6xl lg:text-7xl font-semibold tracking-tighter">
            Pohon Keluarga Anda,
            <br />
            <span className="bg-gradient-to-r from-blue-400 to-emerald-400 bg-clip-text text-transparent">
              Lintas Generasi
            </span>
          </h1>
          <p className="mt-4 text-lg md:text-xl text-white/60 max-w-xl mx-auto leading-relaxed">
            Jelajahi, bangun, dan rawat hubungan keluarga dalam satu tempat yang indah. Dokumentasikan sejarah keluarga untuk anak cucu.
          </p>

          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
            <a
              href={`${WEB_URL}/register`}
              className="inline-flex items-center gap-2 px-7 py-3.5 bg-white text-[#05050f] font-semibold rounded-2xl hover:bg-white/90 transition-all active:scale-[0.985] shadow-lg"
            >
              Mulai Gratis <ArrowRight className="w-4 h-4" />
            </a>
            <a
              href="#fitur"
              className="inline-flex items-center gap-2 px-7 py-3.5 text-white/70 hover:text-white font-medium rounded-2xl border border-white/15 hover:border-white/30 hover:bg-white/5 transition-all"
            >
              Pelajari Lebih Lanjut
            </a>
          </div>
        </div>

        {/* Interactive Tree Visual */}
        <div className="flex justify-center overflow-hidden">
          <div className="scale-[0.55] sm:scale-[0.75] md:scale-[0.85] lg:scale-100 origin-top transition-transform">
            <FamilyTreeVisual />
          </div>
        </div>
      </section>

      {/* ─── Stats ─── */}
      <section className="relative max-w-screen-xl mx-auto px-6 md:px-8 py-16">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
          {stats.map((s) => (
            <div key={s.label} className="glass rounded-2xl p-6 text-center border border-white/10">
              <div className="font-display text-3xl md:text-4xl font-semibold text-white">{s.value}</div>
              <div className="mt-1.5 text-sm text-white/50">{s.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ─── Features ─── */}
      <section id="fitur" className="relative max-w-screen-xl mx-auto px-6 md:px-8 py-20 md:py-28">
        <div className="text-center mb-14">
          <p className="text-sm font-semibold text-blue-400 uppercase tracking-wider">Fitur Unggulan</p>
          <h2 className="font-display mt-3 text-3xl md:text-4xl font-semibold tracking-tight">
            Semua yang Keluarga Anda Butuhkan
          </h2>
          <p className="mt-4 text-white/50 max-w-xl mx-auto">
            Satu platform untuk silsilah, komunikasi, jasa profesional, dan gamifikasi keluarga.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {features.map((f) => (
            <div
              key={f.title}
              className="group p-7 glass rounded-2xl border border-white/10 hover:border-white/20 transition-all duration-300 hover:-translate-y-1"
            >
              <div className={`inline-flex items-center justify-center w-11 h-11 ${f.glow} rounded-xl border mb-5`}>
                <f.icon className={`w-5 h-5 ${f.accent}`} />
              </div>
              <h3 className={`text-base font-semibold group-hover:${f.accent} transition-colors`}>{f.title}</h3>
              <p className="mt-2.5 text-white/50 text-sm leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ─── How It Works ─── */}
      <section id="cara-kerja" className="relative max-w-screen-xl mx-auto px-6 md:px-8 py-20 md:py-28">
        <div className="text-center mb-14">
          <p className="text-sm font-semibold text-blue-400 uppercase tracking-wider">Cara Kerja</p>
          <h2 className="font-display mt-3 text-3xl md:text-4xl font-semibold tracking-tight">
            Mulai dalam 4 Langkah Mudah
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {steps.map((s, i) => (
            <div key={s.num} className="relative">
              {i < steps.length - 1 && (
                <div className="hidden lg:block absolute top-8 left-[calc(50%+2.5rem)] w-[calc(100%-5rem)] border-t border-dashed border-white/15" />
              )}
              <div className="flex flex-col items-center text-center">
                <div className="w-16 h-16 glass border border-white/20 rounded-2xl flex items-center justify-center font-display font-semibold text-lg text-white mb-5">
                  {s.num}
                </div>
                <h3 className="font-semibold text-white">{s.title}</h3>
                <p className="mt-2 text-sm text-white/50 max-w-[200px]">{s.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ─── Testimonials ─── */}
      <section id="testimoni" className="relative max-w-screen-xl mx-auto px-6 md:px-8 py-20 md:py-28">
        <div className="text-center mb-14">
          <p className="text-sm font-semibold text-blue-400 uppercase tracking-wider">Testimoni</p>
          <h2 className="font-display mt-3 text-3xl md:text-4xl font-semibold tracking-tight">
            Dipercaya Keluarga Indonesia
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {testimonials.map((t) => (
            <div key={t.name} className="p-7 glass rounded-2xl border border-white/10">
              <div className="flex gap-1 mb-4">
                {Array.from({ length: t.rating }).map((_, i) => (
                  <Star key={i} className="w-4 h-4 fill-amber-400 text-amber-400" />
                ))}
              </div>
              <p className="text-white/70 leading-relaxed text-sm">&ldquo;{t.text}&rdquo;</p>
              <div className="mt-6 pt-5 border-t border-white/10">
                <p className="font-semibold text-white">{t.name}</p>
                <p className="text-xs text-white/40 mt-0.5">{t.role}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ─── CTA ─── */}
      <section className="relative max-w-screen-xl mx-auto px-6 md:px-8 py-20 md:py-28">
        <div className="relative overflow-hidden p-12 md:p-16 rounded-3xl text-center border border-white/10"
          style={{ background: 'linear-gradient(135deg, rgba(37,99,235,0.25) 0%, rgba(16,185,129,0.15) 100%)' }}>
          <div className="absolute top-0 right-0 w-72 h-72 bg-blue-500/10 rounded-full -translate-y-1/2 translate-x-1/2 blur-3xl" />
          <div className="absolute bottom-0 left-0 w-56 h-56 bg-emerald-500/10 rounded-full translate-y-1/2 -translate-x-1/2 blur-3xl" />
          <div className="relative">
            <h2 className="font-display text-3xl md:text-4xl font-semibold tracking-tight">
              Siap Membangun Silsilah
              <br />Keluarga Anda?
            </h2>
            <p className="mt-4 text-white/60 max-w-lg mx-auto">
              Bergabung dengan ribuan keluarga Indonesia yang sudah menggunakan Digsan.
            </p>
            <a
              href={`${WEB_URL}/register`}
              className="inline-flex items-center gap-2 mt-8 px-8 py-4 bg-white text-[#05050f] font-semibold rounded-2xl hover:bg-white/90 transition-all active:scale-[0.985] shadow-lg"
            >
              Daftar Sekarang — Gratis <ChevronRight className="w-5 h-5" />
            </a>
          </div>
        </div>
      </section>

      {/* ─── Footer ─── */}
      <footer className="border-t border-white/10 py-12">
        <div className="max-w-screen-xl mx-auto px-6 md:px-8">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-10">
            <div className="md:col-span-1">
              <a href="/" className="flex items-center gap-2">
                <Image src="/logo-white.svg" alt="Digsan" width={90} height={28} className="h-7 w-auto opacity-80" />
              </a>
              <p className="mt-4 text-sm text-white/40 leading-relaxed">
                Platform keluarga Indonesia untuk silsilah digital, jasa profesional, dan gamifikasi.
              </p>
            </div>
            <div>
              <h4 className="font-semibold text-white/80 mb-4 text-sm">Platform</h4>
              <ul className="space-y-3 text-sm text-white/40">
                <li><a href="#fitur" className="hover:text-white transition-colors">Fitur</a></li>
                <li><a href="#cara-kerja" className="hover:text-white transition-colors">Cara Kerja</a></li>
                <li><a href="#testimoni" className="hover:text-white transition-colors">Testimoni</a></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-white/80 mb-4 text-sm">Perusahaan</h4>
              <ul className="space-y-3 text-sm text-white/40">
                <li><a href="#" className="hover:text-white transition-colors">Tentang Kami</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Karir</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Blog</a></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-white/80 mb-4 text-sm">Legal</h4>
              <ul className="space-y-3 text-sm text-white/40">
                <li><a href="#" className="hover:text-white transition-colors">Kebijakan Privasi</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Syarat & Ketentuan</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Kontak</a></li>
              </ul>
            </div>
          </div>
          <div className="mt-12 pt-8 border-t border-white/10 flex flex-col md:flex-row items-center justify-between gap-4">
            <p className="text-sm text-white/30">&copy; {new Date().getFullYear()} Digsan. Hak cipta dilindungi.</p>
            <div className="flex items-center gap-6 text-sm text-white/30">
              <a href="#" className="hover:text-white transition-colors">Twitter</a>
              <a href="#" className="hover:text-white transition-colors">Instagram</a>
              <a href="#" className="hover:text-white transition-colors">LinkedIn</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
