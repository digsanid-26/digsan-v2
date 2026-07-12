'use client';

import Image from 'next/image';
import Link from 'next/link';
import HeaderNav from './HeaderNav';
import ThemeToggle from './ThemeToggle';

export default function AppHeader() {
  return (
    <header className="flex items-center justify-between px-6 py-4 border-b transition-colors
      bg-white border-slate-200
      dark:bg-transparent dark:border-white/[0.06]"
    >
      <Link href="/dashboard" className="flex items-center">
        {/* Light mode logo */}
        <Image
          src="/logo-dark.svg"
          alt="Digsan"
          width={110}
          height={28}
          priority
          className="h-7 w-auto block dark:hidden"
        />
        {/* Dark mode logo */}
        <Image
          src="/logo-white.svg"
          alt="Digsan"
          width={110}
          height={28}
          priority
          className="h-7 w-auto hidden dark:block"
        />
      </Link>

      <div className="flex items-center gap-3">
        <ThemeToggle />
        <HeaderNav />
      </div>
    </header>
  );
}
