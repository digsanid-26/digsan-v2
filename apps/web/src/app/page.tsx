import Image from 'next/image';
import FamilyTreeVisual from './components/FamilyTreeVisual';
import HeaderNav from './components/HeaderNav';

export default function Home() {
  return (
    <div
      className="min-h-screen flex flex-col"
      style={{ background: '#05050f' }}
    >
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-4 border-b border-white/[0.06]">
        <Image src="/logo-white.svg" alt="Digsan" width={110} height={28} priority className="h-7 w-auto" />
        <HeaderNav />
      </header>

      {/* Hero */}
      <main className="flex-1 flex flex-col items-center justify-center px-4 py-8">
        <div className="text-center mb-6 max-w-lg">
          <h1
            className="text-3xl sm:text-4xl font-bold text-white mb-3 tracking-tight"
            style={{ fontFamily: 'var(--font-space-grotesk, Space Grotesk, sans-serif)' }}
          >
            Silsilah Keluarga{' '}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-blue-200">
              Indonesia
            </span>
          </h1>
          <p className="text-white/50 text-sm sm:text-base leading-relaxed">
            Petakan hubungan keluarga, simpan kenangan, dan jaga ikatan lintas generasi.
          </p>
        </div>

        <FamilyTreeVisual />
      </main>

      {/* Footer */}
      <footer className="text-center pb-5 text-white/25 text-xs">
        © {new Date().getFullYear()} Digsan — Platform Keluarga Indonesia
      </footer>
    </div>
  );
}
