import Image from 'next/image';
import { Trees, MessageCircle, Trophy, Briefcase, Shield, Users, ChevronRight, Star, ArrowRight } from 'lucide-react';

const WEB_URL = process.env.NEXT_PUBLIC_WEB_URL || 'https://app.digsan.id';

const features = [
  {
    icon: Trees,
    title: 'Silsilah Digital',
    desc: 'Dokumentasi pohon keluarga dengan visualisasi interaktif. Simpan sejarah keluarga untuk generasi mendatang.',
    color: 'text-emerald-600',
    bg: 'bg-emerald-50',
  },
  {
    icon: Briefcase,
    title: 'Digsan Kerja',
    desc: 'Marketplace jasa harian terpercaya. Temukan tukang, asisten rumah tangga, hingga guru les terverifikasi.',
    color: 'text-blue-600',
    bg: 'bg-blue-50',
  },
  {
    icon: MessageCircle,
    title: 'Chat Keluarga',
    desc: 'Obrolan real-time pribadi & grup. Tetap terhubung dengan keluarga besar di mana saja.',
    color: 'text-violet-600',
    bg: 'bg-violet-50',
  },
  {
    icon: Trophy,
    title: 'Gamifikasi',
    desc: 'Kumpulkan poin dan badge dari aktivitas keluarga. Naik peringkat di leaderboard komunitas.',
    color: 'text-amber-600',
    bg: 'bg-amber-50',
  },
  {
    icon: Shield,
    title: 'Privasi & Keamanan',
    desc: 'Data keluarga terenkripsi. Kontrol penuh siapa yang bisa melihat silsilah dan informasi Anda.',
    color: 'text-rose-600',
    bg: 'bg-rose-50',
  },
  {
    icon: Users,
    title: 'Multi-Platform',
    desc: 'Akses dari web browser maupun aplikasi mobile Android & iOS. Sinkronisasi otomatis.',
    color: 'text-cyan-600',
    bg: 'bg-cyan-50',
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
    <div className="min-h-screen bg-white">
      {/* ─── Navbar ─── */}
      <nav className="sticky top-0 z-50 bg-white/80 backdrop-blur-lg border-b border-gray-100">
        <div className="flex items-center justify-between px-6 md:px-8 py-4 max-w-7xl mx-auto">
          <a href="/" className="flex items-center gap-2">
            <Image src="/logo-full.svg" alt="Digsan" width={120} height={36} priority className="h-9 w-auto" />
          </a>
          <div className="hidden md:flex items-center gap-8 text-sm text-gray-600">
            <a href="#fitur" className="hover:text-blue-600 transition-colors">Fitur</a>
            <a href="#cara-kerja" className="hover:text-blue-600 transition-colors">Cara Kerja</a>
            <a href="#testimoni" className="hover:text-blue-600 transition-colors">Testimoni</a>
          </div>
          <div className="flex items-center gap-3">
            <a href={`${WEB_URL}/login`} className="px-4 py-2 text-sm font-medium text-gray-700 hover:text-blue-600 transition-colors">
              Masuk
            </a>
            <a href={`${WEB_URL}/register`} className="px-5 py-2.5 text-sm font-medium bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors shadow-sm shadow-blue-200">
              Daftar Gratis
            </a>
          </div>
        </div>
      </nav>

      {/* ─── Hero ─── */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-blue-50 via-white to-emerald-50" />
        <div className="absolute top-20 left-10 w-72 h-72 bg-blue-200/30 rounded-full blur-3xl" />
        <div className="absolute bottom-10 right-10 w-96 h-96 bg-emerald-200/20 rounded-full blur-3xl" />

        <div className="relative max-w-7xl mx-auto px-6 md:px-8 pt-20 pb-28 md:pt-28 md:pb-36 text-center">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-blue-50 border border-blue-100 rounded-full text-sm text-blue-700 font-medium mb-8">
            <Star className="w-4 h-4 fill-blue-500 text-blue-500" />
            Platform Keluarga #1 di Indonesia
          </div>

          <h1 className="text-4xl md:text-6xl lg:text-7xl font-extrabold text-gray-900 leading-[1.1] tracking-tight">
            Jaga Koneksi Keluarga,
            <br />
            <span className="bg-gradient-to-r from-blue-600 to-emerald-500 bg-clip-text text-transparent">
              Lintas Generasi
            </span>
          </h1>

          <p className="mt-6 text-lg md:text-xl text-gray-600 max-w-2xl mx-auto leading-relaxed">
            Bangun silsilah digital, temukan jasa profesional terpercaya, dan raih pencapaian bersama keluarga besar Anda.
          </p>

          <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
            <a
              href={`${WEB_URL}/register`}
              className="inline-flex items-center gap-2 px-8 py-4 bg-blue-600 text-white font-semibold rounded-2xl hover:bg-blue-700 transition-all shadow-lg shadow-blue-200 hover:shadow-xl hover:shadow-blue-200 hover:-translate-y-0.5"
            >
              Mulai Gratis <ArrowRight className="w-5 h-5" />
            </a>
            <a
              href="#fitur"
              className="inline-flex items-center gap-2 px-8 py-4 text-gray-700 font-semibold rounded-2xl border border-gray-200 hover:border-gray-300 hover:bg-gray-50 transition-all"
            >
              Pelajari Lebih Lanjut
            </a>
          </div>

          {/* Stats */}
          <div className="mt-20 grid grid-cols-2 md:grid-cols-4 gap-6 max-w-3xl mx-auto">
            {stats.map((s) => (
              <div key={s.label} className="text-center">
                <div className="text-3xl md:text-4xl font-extrabold text-gray-900">{s.value}</div>
                <div className="mt-1 text-sm text-gray-500">{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Features ─── */}
      <section id="fitur" className="py-24 md:py-32 bg-gray-50/50">
        <div className="max-w-7xl mx-auto px-6 md:px-8">
          <div className="text-center mb-16">
            <p className="text-sm font-semibold text-blue-600 uppercase tracking-wider">Fitur Unggulan</p>
            <h2 className="mt-3 text-3xl md:text-4xl font-bold text-gray-900">
              Semua yang Keluarga Anda Butuhkan
            </h2>
            <p className="mt-4 text-lg text-gray-500 max-w-xl mx-auto">
              Satu platform untuk silsilah, komunikasi, jasa profesional, dan gamifikasi keluarga.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((f) => (
              <div key={f.title} className="group p-8 bg-white rounded-2xl border border-gray-100 hover:border-blue-100 hover:shadow-lg hover:shadow-blue-50/50 transition-all duration-300">
                <div className={`inline-flex items-center justify-center w-12 h-12 ${f.bg} rounded-xl mb-5`}>
                  <f.icon className={`w-6 h-6 ${f.color}`} />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 group-hover:text-blue-600 transition-colors">{f.title}</h3>
                <p className="mt-3 text-gray-500 text-sm leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── How It Works ─── */}
      <section id="cara-kerja" className="py-24 md:py-32">
        <div className="max-w-7xl mx-auto px-6 md:px-8">
          <div className="text-center mb-16">
            <p className="text-sm font-semibold text-blue-600 uppercase tracking-wider">Cara Kerja</p>
            <h2 className="mt-3 text-3xl md:text-4xl font-bold text-gray-900">
              Mulai dalam 4 Langkah Mudah
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {steps.map((s, i) => (
              <div key={s.num} className="relative">
                {i < steps.length - 1 && (
                  <div className="hidden lg:block absolute top-8 left-[calc(50%+2rem)] w-[calc(100%-4rem)] border-t-2 border-dashed border-blue-200" />
                )}
                <div className="relative flex flex-col items-center text-center">
                  <div className="w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center text-white font-bold text-lg shadow-lg shadow-blue-200 mb-5">
                    {s.num}
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900">{s.title}</h3>
                  <p className="mt-2 text-sm text-gray-500 max-w-[200px]">{s.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Testimonials ─── */}
      <section id="testimoni" className="py-24 md:py-32 bg-gray-50/50">
        <div className="max-w-7xl mx-auto px-6 md:px-8">
          <div className="text-center mb-16">
            <p className="text-sm font-semibold text-blue-600 uppercase tracking-wider">Testimoni</p>
            <h2 className="mt-3 text-3xl md:text-4xl font-bold text-gray-900">
              Dipercaya Keluarga Indonesia
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {testimonials.map((t) => (
              <div key={t.name} className="p-8 bg-white rounded-2xl border border-gray-100 shadow-sm">
                <div className="flex gap-1 mb-4">
                  {Array.from({ length: t.rating }).map((_, i) => (
                    <Star key={i} className="w-5 h-5 fill-amber-400 text-amber-400" />
                  ))}
                </div>
                <p className="text-gray-600 leading-relaxed">&ldquo;{t.text}&rdquo;</p>
                <div className="mt-6 pt-6 border-t border-gray-100">
                  <p className="font-semibold text-gray-900">{t.name}</p>
                  <p className="text-sm text-gray-500">{t.role}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── CTA ─── */}
      <section className="py-24 md:py-32">
        <div className="max-w-4xl mx-auto px-6 md:px-8">
          <div className="relative overflow-hidden p-12 md:p-16 bg-gradient-to-br from-blue-600 to-blue-700 rounded-3xl text-center">
            <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full -translate-y-1/3 translate-x-1/3" />
            <div className="absolute bottom-0 left-0 w-48 h-48 bg-white/10 rounded-full translate-y-1/3 -translate-x-1/3" />
            <div className="relative">
              <h2 className="text-3xl md:text-4xl font-bold text-white">
                Siap Membangun Silsilah
                <br />Keluarga Anda?
              </h2>
              <p className="mt-4 text-lg text-blue-100 max-w-lg mx-auto">
                Bergabung dengan ribuan keluarga Indonesia yang sudah menggunakan Digsan.
              </p>
              <a
                href={`${WEB_URL}/register`}
                className="inline-flex items-center gap-2 mt-8 px-8 py-4 bg-white text-blue-600 font-semibold rounded-2xl hover:bg-blue-50 transition-all shadow-lg hover:-translate-y-0.5"
              >
                Daftar Sekarang — Gratis <ChevronRight className="w-5 h-5" />
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* ─── Footer ─── */}
      <footer className="border-t border-gray-100 py-12">
        <div className="max-w-7xl mx-auto px-6 md:px-8">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-10">
            <div className="md:col-span-1">
              <a href="/" className="flex items-center gap-2">
                <Image src="/logo-full.svg" alt="Digsan" width={100} height={32} className="h-8 w-auto" />
              </a>
              <p className="mt-4 text-sm text-gray-500 leading-relaxed">
                Platform keluarga Indonesia untuk silsilah digital, jasa profesional, dan gamifikasi.
              </p>
            </div>
            <div>
              <h4 className="font-semibold text-gray-900 mb-4">Platform</h4>
              <ul className="space-y-3 text-sm text-gray-500">
                <li><a href="#fitur" className="hover:text-blue-600 transition-colors">Fitur</a></li>
                <li><a href="#cara-kerja" className="hover:text-blue-600 transition-colors">Cara Kerja</a></li>
                <li><a href="#testimoni" className="hover:text-blue-600 transition-colors">Testimoni</a></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-gray-900 mb-4">Perusahaan</h4>
              <ul className="space-y-3 text-sm text-gray-500">
                <li><a href="#" className="hover:text-blue-600 transition-colors">Tentang Kami</a></li>
                <li><a href="#" className="hover:text-blue-600 transition-colors">Karir</a></li>
                <li><a href="#" className="hover:text-blue-600 transition-colors">Blog</a></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-gray-900 mb-4">Legal</h4>
              <ul className="space-y-3 text-sm text-gray-500">
                <li><a href="#" className="hover:text-blue-600 transition-colors">Kebijakan Privasi</a></li>
                <li><a href="#" className="hover:text-blue-600 transition-colors">Syarat & Ketentuan</a></li>
                <li><a href="#" className="hover:text-blue-600 transition-colors">Kontak</a></li>
              </ul>
            </div>
          </div>
          <div className="mt-12 pt-8 border-t border-gray-100 flex flex-col md:flex-row items-center justify-between gap-4">
            <p className="text-sm text-gray-400">&copy; {new Date().getFullYear()} Digsan. Hak cipta dilindungi.</p>
            <div className="flex items-center gap-6 text-sm text-gray-400">
              <a href="#" className="hover:text-blue-600 transition-colors">Twitter</a>
              <a href="#" className="hover:text-blue-600 transition-colors">Instagram</a>
              <a href="#" className="hover:text-blue-600 transition-colors">LinkedIn</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
