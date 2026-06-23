'use client';

import Image from 'next/image';
import { Eye, EyeOff } from 'lucide-react';
import { useState, useEffect, useRef } from 'react';

export default function FamilyTreeVisual() {
  const containerRef = useRef<HTMLDivElement>(null);
  const mainCircleRef = useRef<HTMLDivElement>(null);

  const [showModal, setShowModal] = useState(false);
  const [activeTab, setActiveTab] = useState<'login' | 'register'>('login');
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [name, setName] = useState('');

  const appUrl = process.env.NEXT_PUBLIC_WEB_URL || 'https://app.digsan.id';

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    window.location.href = `${appUrl}/login`;
  };

  const handleRegister = (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    window.location.href = `${appUrl}/register`;
  };

  useEffect(() => {
    const container = containerRef.current;
    const mainCircle = mainCircleRef.current;
    if (!container || !mainCircle) return;

    const logoContainer = container.querySelector('#logo-container') as HTMLElement;
    const spinRing = container.querySelector('#spin-ring') as HTMLElement;
    const lines = [
      container.querySelector('#line-top') as HTMLElement,
      container.querySelector('#line-bottom') as HTMLElement,
      container.querySelector('#line-left') as HTMLElement,
      container.querySelector('#line-right') as HTMLElement,
    ];
    const peripheralCircles = [
      container.querySelector('#ot-circle') as HTMLElement,
      container.querySelector('#kk-circle') as HTMLElement,
      container.querySelector('#ad-circle') as HTMLElement,
      container.querySelector('#an-circle') as HTMLElement,
    ];

    const handleMainEnter = () => {
      lines.forEach(line => {
        if (line) line.style.opacity = '1';
      });
      peripheralCircles.forEach(circle => {
        if (circle && !circle.classList.contains('expanded')) {
          circle.style.opacity = '1';
        }
      });
      if (spinRing) spinRing.style.opacity = '1';
      if (logoContainer) {
        logoContainer.style.filter = 'blur(5px) brightness(0.15)';
        logoContainer.style.transform = 'scale(0.85)';
      }
    };

    const handleMainLeave = () => {
      lines.forEach(line => {
        if (line) line.style.opacity = '0.15';
      });
      peripheralCircles.forEach(circle => {
        if (circle && !circle.classList.contains('expanded')) {
          circle.style.opacity = '0.7';
        }
      });
      if (spinRing) spinRing.style.opacity = '0';
      if (logoContainer) {
        logoContainer.style.filter = 'blur(1.5px) brightness(0.85)';
        logoContainer.style.transform = 'scale(1)';
      }
    };

    mainCircle.addEventListener('mouseenter', handleMainEnter);
    mainCircle.addEventListener('mouseleave', handleMainLeave);

    const ot = container.querySelector('#ot-circle') as HTMLElement;
    const kk = container.querySelector('#kk-circle') as HTMLElement;
    const ad = container.querySelector('#ad-circle') as HTMLElement;
    const an = container.querySelector('#an-circle') as HTMLElement;

    type HoverEntry = { el: HTMLElement; hoverHtml: string; abbr: string };
    const hoverEntries: HoverEntry[] = [
      { el: ot, hoverHtml: `<span class="text-[9px] font-bold leading-[11px] text-center">ORANG<br>TUA</span>`, abbr: 'OT' },
      { el: kk, hoverHtml: `<span class="text-[10px] font-bold tracking-wider">KAKAK</span>`, abbr: 'KK' },
      { el: ad, hoverHtml: `<span class="text-[10px] font-bold tracking-wider">ADIK</span>`, abbr: 'AD' },
      { el: an, hoverHtml: `<span class="text-[10px] font-bold tracking-wider">ANAK</span>`, abbr: 'AN' },
    ];

    const hoverHandlers: Array<{ enter: () => void; leave: () => void }> = [];
    hoverEntries.forEach(({ el, hoverHtml, abbr }) => {
      if (!el) return;
      const enter = () => { el.innerHTML = hoverHtml; };
      const leave = () => { el.innerHTML = `<span class="font-bold text-sm tracking-wider">${abbr}</span>`; };
      el.addEventListener('mouseenter', enter);
      el.addEventListener('mouseleave', leave);
      hoverHandlers.push({ enter, leave });
    });

    const createFamilyNode = (x: number, y: number, label: string, size = 52, bgColor = 'rgba(255,255,255,0.06)', borderColor = 'rgba(255,255,255,0.3)') => {
      const node = document.createElement('div');
      node.className = 'family-node absolute flex items-center justify-center text-white text-xs font-semibold rounded-full border cursor-pointer z-40';
      node.style.background = bgColor;
      node.style.borderColor = borderColor;
      node.style.width = `${size}px`;
      node.style.height = `${size}px`;
      node.style.left = `${x - size / 2}px`;
      node.style.top = `${y - size / 2}px`;
      node.innerHTML = `<span class="px-1 text-center leading-tight">${label}</span>`;
      container.appendChild(node);
      return node;
    };

    const showMemberDetail = (name: string) => {
      let relation = 'Anggota Keluarga';
      if (name.includes('Ayah') || name.includes('Ibu')) relation = 'Orang Tua';
      else if (name.includes('Kakak')) relation = 'Saudara Tua';
      else if (name.includes('Adik')) relation = 'Saudara Muda';
      else if (name.includes('Anak')) relation = 'Keturunan';

      const modal = document.createElement('div');
      modal.className = 'fixed inset-0 bg-black/80 flex items-center justify-center z-[100]';
      modal.innerHTML = `
        <div class="absolute inset-0 modal-backdrop"></div>
        <div class="glass border border-white/20 rounded-3xl p-8 max-w-md w-full mx-4 relative z-10 text-white">
          <div class="flex justify-between items-start mb-6">
            <div>
              <h3 class="text-3xl font-semibold">${name}</h3>
              <p class="text-emerald-400 text-sm mt-1">${relation}</p>
            </div>
            <button class="close-btn text-white/40 hover:text-white text-3xl leading-none w-8 h-8 flex items-center justify-center">×</button>
          </div>
          <div class="space-y-5 text-sm">
            <div class="flex justify-between border-b border-white/10 pb-4">
              <span class="text-white/60">Tanggal Lahir</span>
              <span class="font-medium">15 Maret 1985</span>
            </div>
            <div class="flex justify-between border-b border-white/10 pb-4">
              <span class="text-white/60">Tempat Tinggal</span>
              <span class="font-medium">Jakarta, Indonesia</span>
            </div>
            <div class="flex justify-between border-b border-white/10 pb-4">
              <span class="text-white/60">Hubungan</span>
              <span class="font-medium">${relation}</span>
            </div>
            <div class="pt-2">
              <div class="text-white/60 text-xs mb-1.5">CATATAN</div>
              <p class="text-white/80 italic">"Anggota keluarga yang selalu memberikan dukungan dan kasih sayang."</p>
            </div>
          </div>
          <div class="flex gap-3 mt-8">
            <button class="close-btn flex-1 py-3 bg-white/10 hover:bg-white/15 rounded-2xl text-sm font-medium transition-colors">Tutup</button>
            <button class="close-btn flex-1 py-3 bg-blue-600 hover:bg-blue-500 rounded-2xl text-sm font-semibold transition-colors">Lihat Riwayat Lengkap</button>
          </div>
        </div>
      `;
      modal.querySelector('.modal-backdrop')?.addEventListener('click', () => modal.remove());
      modal.querySelectorAll('.close-btn').forEach(btn => btn.addEventListener('click', () => modal.remove()));
      document.body.appendChild(modal);
    };

    const expandToHorizontalRow = (originalEl: HTMLElement, labels: string[], baseX: number, baseY: number, bgColor = 'rgba(255,255,255,0.06)', borderColor = 'rgba(255,255,255,0.3)') => {
      if (originalEl.classList.contains('expanded')) return;
      originalEl.classList.add('expanded');
      originalEl.style.transition = 'all 0.4s cubic-bezier(0.23,1,0.32,1)';
      originalEl.style.opacity = '0';
      originalEl.style.transform = 'scale(0.5)';

      setTimeout(() => {
        originalEl.style.display = 'none';
        const spacing = 62;
        const totalWidth = (labels.length - 1) * spacing;
        const startX = baseX - totalWidth / 2;
        labels.forEach((label, i) => {
          const node = createFamilyNode(startX + i * spacing, baseY, label, 50, bgColor, borderColor);
          node.addEventListener('click', () => showMemberDetail(label));
          node.style.opacity = '0';
          node.style.transform = 'scale(0.6)';
          setTimeout(() => {
            node.style.transition = 'all 0.55s cubic-bezier(0.34, 1.56, 0.64, 1)';
            node.style.opacity = '1';
            node.style.transform = 'scale(1)';
          }, 70 * i);
        });
      }, 420);
    };

    const collapseAllExpansions = () => {
      const expandedNodes = container.querySelectorAll('.family-node');
      if (expandedNodes.length === 0) return;

      expandedNodes.forEach(node => {
        const el = node as HTMLElement;
        el.style.transition = 'all 0.35s cubic-bezier(0.23, 1, 0.32, 1)';
        el.style.opacity = '0';
        el.style.transform = 'scale(0.6)';
        setTimeout(() => { if (el.parentNode) el.parentNode.removeChild(el); }, 380);
      });

      const circleData = [
        { el: ot, label: 'OT' },
        { el: kk, label: 'KK' },
        { el: ad, label: 'AD' },
        { el: an, label: 'AN' },
      ];
      circleData.forEach(({ el, label }) => {
        if (el && el.classList.contains('expanded')) {
          el.style.transition = 'all 0.4s cubic-bezier(0.23, 1, 0.32, 1)';
          el.style.opacity = '0.7';
          el.style.transform = 'scale(1)';
          el.style.display = 'flex';
          el.classList.remove('expanded');
          el.innerHTML = `<span class="font-bold text-sm tracking-wider">${label}</span>`;
        }
      });
    };

    const CENTER_VAL = 350;
    const PERIPH_DIST = 280;

    mainCircle.addEventListener('click', collapseAllExpansions);

    const otClick = () => expandToHorizontalRow(ot, ['Ayah', 'Ibu'], CENTER_VAL, CENTER_VAL - PERIPH_DIST, 'rgb(29,78,216)', 'rgba(96,165,250,0.7)');
    const kkClick = () => expandToHorizontalRow(kk, ['KK1', 'KK2'], CENTER_VAL - PERIPH_DIST, CENTER_VAL, 'rgb(194,65,12)', 'rgba(251,146,60,0.7)');
    const adClick = () => expandToHorizontalRow(ad, ['AD1', 'AD2', 'AD3'], CENTER_VAL + PERIPH_DIST, CENTER_VAL, 'rgb(4,120,87)', 'rgba(52,211,153,0.7)');
    const anClick = () => expandToHorizontalRow(an, ['AN1', 'AN2', 'AN3', 'AN4'], CENTER_VAL, CENTER_VAL + PERIPH_DIST, 'rgb(180,83,9)', 'rgba(251,191,36,0.7)');

    ot.addEventListener('click', otClick);
    kk.addEventListener('click', kkClick);
    ad.addEventListener('click', adClick);
    an.addEventListener('click', anClick);

    return () => {
      mainCircle.removeEventListener('mouseenter', handleMainEnter);
      mainCircle.removeEventListener('mouseleave', handleMainLeave);
      mainCircle.removeEventListener('click', collapseAllExpansions);
      ot.removeEventListener('click', otClick);
      kk.removeEventListener('click', kkClick);
      ad.removeEventListener('click', adClick);
      an.removeEventListener('click', anClick);
      hoverEntries.forEach(({ el }, i) => {
        if (!el) return;
        el.removeEventListener('mouseenter', hoverHandlers[i].enter);
        el.removeEventListener('mouseleave', hoverHandlers[i].leave);
      });
    };
  }, []);

  return (
    <div className="flex flex-col items-center">
      <div
        ref={containerRef}
        id="tree-container"
        className="relative w-[700px] h-[700px] tree-container"
      >
        {/* Spin glow ring — sibling behind main circle (z-19) */}
        <div
          id="spin-ring"
          className="spin-ring absolute rounded-full z-[19]"
          style={{
            left: '256px',
            top: '256px',
            width: '188px',
            height: '188px',
            opacity: 0,
            transition: 'opacity 0.45s ease',
          }}
        />

        {/* Main Circle */}
        <div
          ref={mainCircleRef}
          id="main-circle"
          className="main-circle absolute left-[260px] top-[260px] w-[180px] h-[180px] rounded-full flex items-center justify-center cursor-pointer z-20 border border-blue-400/30"
          style={{ background: '#254474', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)' }}
        >
          <div
            id="logo-container"
            className="w-[120px] h-[120px] flex items-center justify-center transition-all duration-500"
            style={{ filter: 'blur(1.5px) brightness(0.85)' }}
          >
            <Image
              src="/logo-icon.svg"
              alt="Digsan"
              width={88}
              height={88}
              style={{ filter: 'brightness(0) invert(1)' }}
            />
          </div>

          {/* Connect Now overlay — shown via CSS on hover */}
          <div
            className="connect-btn absolute inset-0 flex flex-col items-center justify-center rounded-full cursor-pointer"
            style={{ opacity: 0, transition: 'opacity 0.3s ease', pointerEvents: 'none', zIndex: 5 }}
            onClick={(e) => { e.stopPropagation(); setShowModal(true); }}
          >
            <div className="text-center px-3">
              <div className="text-[9px] text-blue-200 font-medium tracking-widest uppercase mb-1">Mulai</div>
              <div className="text-[13px] font-bold text-white leading-tight">Masuk Sekarang</div>
              <div className="mt-2 mx-auto w-5 h-px bg-white/40" />
            </div>
          </div>
        </div>

        {/* Lines — hidden in static state, appear on main circle hover */}
        <div
          id="line-top"
          className="tree-line absolute left-[349px] top-[80px] w-[2px] h-[180px] bg-white/50 rounded-full z-10"
          style={{ opacity: 0.15, transition: 'opacity 0.35s ease', boxShadow: '0 0 6px rgba(255,255,255,0.1)' }}
        />
        <div
          id="line-bottom"
          className="tree-line absolute left-[349px] top-[440px] w-[2px] h-[180px] bg-white/50 rounded-full z-10"
          style={{ opacity: 0.15, transition: 'opacity 0.35s ease', boxShadow: '0 0 6px rgba(255,255,255,0.1)' }}
        />
        <div
          id="line-left"
          className="tree-line absolute left-[80px] top-[349px] h-[2px] w-[180px] bg-white/50 rounded-full z-10"
          style={{ opacity: 0.15, transition: 'opacity 0.35s ease', boxShadow: '0 0 6px rgba(255,255,255,0.1)' }}
        />
        <div
          id="line-right"
          className="tree-line absolute left-[440px] top-[349px] h-[2px] w-[180px] bg-white/50 rounded-full z-10"
          style={{ opacity: 0.15, transition: 'opacity 0.35s ease', boxShadow: '0 0 6px rgba(255,255,255,0.1)' }}
        />

        {/* Peripheral Circles */}
        {/* OT - Orang Tua: Biru */}
        <div
          id="ot-circle"
          className="peripheral-circle absolute left-[320px] top-[55px] w-[60px] h-[60px] rounded-full flex items-center justify-center cursor-pointer z-30 border"
          style={{ opacity: 0.7, background: 'rgb(29,78,216)', borderColor: 'rgba(96,165,250,0.6)', boxShadow: '0 0 16px rgba(59,130,246,0.4)' }}
        >
          <span className="font-bold text-sm tracking-wider text-white">OT</span>
        </div>
        {/* KK - Kakak: Oranye */}
        <div
          id="kk-circle"
          className="peripheral-circle absolute left-[55px] top-[320px] w-[60px] h-[60px] rounded-full flex items-center justify-center cursor-pointer z-30 border"
          style={{ opacity: 0.7, background: 'rgb(194,65,12)', borderColor: 'rgba(251,146,60,0.6)', boxShadow: '0 0 16px rgba(249,115,22,0.4)' }}
        >
          <span className="font-bold text-sm tracking-wider text-white">KK</span>
        </div>
        {/* AD - Adik: Hijau */}
        <div
          id="ad-circle"
          className="peripheral-circle absolute left-[585px] top-[320px] w-[60px] h-[60px] rounded-full flex items-center justify-center cursor-pointer z-30 border"
          style={{ opacity: 0.7, background: 'rgb(4,120,87)', borderColor: 'rgba(52,211,153,0.6)', boxShadow: '0 0 16px rgba(16,185,129,0.4)' }}
        >
          <span className="font-bold text-sm tracking-wider text-white">AD</span>
        </div>
        {/* AN - Anak: Kuning/Amber */}
        <div
          id="an-circle"
          className="peripheral-circle absolute left-[320px] top-[585px] w-[60px] h-[60px] rounded-full flex items-center justify-center cursor-pointer z-30 border"
          style={{ opacity: 0.7, background: 'rgb(180,83,9)', borderColor: 'rgba(251,191,36,0.6)', boxShadow: '0 0 16px rgba(245,158,11,0.4)' }}
        >
          <span className="font-bold text-sm tracking-wider text-white">AN</span>
        </div>
      </div>

      <p className="text-white/50 text-xs sm:text-sm mt-2 text-center px-4">
        Hover lingkaran utama untuk terhubung •{' '}
        Klik lingkaran kecil untuk memperluas •{' '}
        <span className="text-white/70">Klik tengah untuk menutup</span>
      </p>

      {/* ─── Login / Register Modal ─── */}
      {showModal && (
        <div
          className="fixed inset-0 bg-black/75 backdrop-blur-sm flex items-center justify-center z-[200] p-4"
          onClick={() => { if (!loading) setShowModal(false); }}
        >
          <div className="relative w-full max-w-sm" onClick={(e) => e.stopPropagation()}>
            {/* Close button */}
            <button
              className="absolute -top-3 -right-3 w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 border border-white/15 text-white/60 hover:text-white flex items-center justify-center text-xl leading-none transition-all z-10"
              onClick={() => setShowModal(false)}
            >×</button>

            {/* Card */}
            <div className="glass border border-white/15 rounded-3xl overflow-hidden shadow-2xl">
              {/* Header */}
              <div className="px-8 pt-7 pb-5 border-b border-white/8">
                <div className="flex justify-center mb-5">
                  <Image src="/logo-white.svg" alt="Digsan" width={108} height={24} />
                </div>
                <div className="flex bg-white/5 rounded-xl p-1">
                  <button
                    className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-all ${
                      activeTab === 'login' ? 'bg-white/10 text-white' : 'text-white/40 hover:text-white/60'
                    }`}
                    onClick={() => { setActiveTab('login'); setLoading(false); }}
                  >Masuk</button>
                  <button
                    className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-all ${
                      activeTab === 'register' ? 'bg-white/10 text-white' : 'text-white/40 hover:text-white/60'
                    }`}
                    onClick={() => { setActiveTab('register'); setLoading(false); }}
                  >Daftar</button>
                </div>
              </div>

              {/* Body */}
              <div className="px-8 py-6">
                {activeTab === 'login' ? (
                  <form onSubmit={handleLogin} className="space-y-4">
                    <div>
                      <label className="block text-[11px] font-medium text-white/50 mb-1.5 tracking-wider uppercase">Email</label>
                      <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="nama@email.com"
                        className="w-full bg-white/5 border border-white/10 focus:border-blue-400/50 rounded-xl px-4 py-2.5 text-white placeholder-white/25 text-sm outline-none transition-all"
                        required
                      />
                    </div>
                    <div>
                      <div className="flex justify-between items-center mb-1.5">
                        <label className="text-[11px] font-medium text-white/50 tracking-wider uppercase">Kata Sandi</label>
                        <a href={`${appUrl}/forgot-password`} target="_blank" rel="noopener noreferrer" className="text-[11px] text-blue-400/80 hover:text-blue-300 transition-colors">Lupa kata sandi?</a>
                      </div>
                      <div className="relative">
                        <input
                          type={showPassword ? 'text' : 'password'}
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          placeholder="••••••••"
                          className="w-full bg-white/5 border border-white/10 focus:border-blue-400/50 rounded-xl px-4 py-2.5 text-white placeholder-white/25 text-sm outline-none transition-all pr-10"
                          required
                        />
                        <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60 transition-colors">
                          {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                        </button>
                      </div>
                    </div>
                    <button
                      type="submit"
                      disabled={loading}
                      className="w-full py-2.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-60 disabled:cursor-not-allowed text-white font-semibold rounded-xl text-sm transition-all flex items-center justify-center gap-2 mt-1"
                    >
                      {loading ? (<><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Memproses...</>) : 'Masuk'}
                    </button>
                  </form>
                ) : (
                  <form onSubmit={handleRegister} className="space-y-3">
                    <div>
                      <label className="block text-[11px] font-medium text-white/50 mb-1.5 tracking-wider uppercase">Nama Lengkap</label>
                      <input
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="Nama Anda"
                        className="w-full bg-white/5 border border-white/10 focus:border-blue-400/50 rounded-xl px-4 py-2.5 text-white placeholder-white/25 text-sm outline-none transition-all"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-medium text-white/50 mb-1.5 tracking-wider uppercase">Email</label>
                      <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="nama@email.com"
                        className="w-full bg-white/5 border border-white/10 focus:border-blue-400/50 rounded-xl px-4 py-2.5 text-white placeholder-white/25 text-sm outline-none transition-all"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-medium text-white/50 mb-1.5 tracking-wider uppercase">Kata Sandi</label>
                      <div className="relative">
                        <input
                          type={showPassword ? 'text' : 'password'}
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          placeholder="Min. 8 karakter"
                          className="w-full bg-white/5 border border-white/10 focus:border-blue-400/50 rounded-xl px-4 py-2.5 text-white placeholder-white/25 text-sm outline-none transition-all pr-10"
                          required
                        />
                        <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60 transition-colors">
                          {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                        </button>
                      </div>
                    </div>
                    <button
                      type="submit"
                      disabled={loading}
                      className="w-full py-2.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-60 disabled:cursor-not-allowed text-white font-semibold rounded-xl text-sm transition-all flex items-center justify-center gap-2 mt-1"
                    >
                      {loading ? (<><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Memproses...</>) : 'Buat Akun'}
                    </button>
                  </form>
                )}

                {/* Divider */}
                <div className="flex items-center gap-3 my-5">
                  <div className="flex-1 h-px bg-white/8" />
                  <span className="text-white/25 text-xs">atau lanjutkan dengan</span>
                  <div className="flex-1 h-px bg-white/8" />
                </div>

                {/* Google */}
                <button
                  type="button"
                  onClick={() => { window.location.href = `${appUrl}/login?method=google`; }}
                  className="w-full py-2.5 bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 text-white/80 font-medium rounded-xl text-sm transition-all flex items-center justify-center gap-3"
                >
                  <svg width="16" height="16" viewBox="0 0 18 18" fill="none">
                    <path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.259h2.908C16.658 14.383 17.64 12.075 17.64 9.2z"/>
                    <path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z"/>
                    <path fill="#FBBC05" d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z"/>
                    <path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z"/>
                  </svg>
                  Google
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
