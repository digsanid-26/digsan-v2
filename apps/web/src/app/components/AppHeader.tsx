'use client';

import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import HeaderNav from './HeaderNav';
import ThemeToggle from './ThemeToggle';
import NotificationBell from './NotificationBell';
import { useTheme } from './ThemeProvider';

const NAV = [
  { label: 'Home', href: '/dashboard' },
  { label: 'About', href: '/about' },
  { label: 'Tree', href: '/tree' },
  { label: 'Aktivitas', href: '/activity' },
];

export default function AppHeader() {
  const pathname = usePathname();
  const { theme } = useTheme();
  const dark = theme === 'dark';

  return (
    <header className="flex items-center justify-between gap-4 px-6 py-4 border-b transition-colors
      bg-white border-slate-200
      dark:bg-transparent dark:border-white/[0.06]"
    >
      <div className="flex items-center gap-8">
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

        <nav className="hidden md:flex items-center gap-1">
          {NAV.map((item) => {
            const active = pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href));
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`px-3.5 py-2 rounded-lg text-sm font-medium transition-colors ${
                  active
                    ? 'text-blue-600 bg-blue-50 dark:text-white dark:bg-white/10'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100 dark:text-white/60 dark:hover:text-white dark:hover:bg-white/5'
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
      </div>

      <div className="flex items-center gap-3">
        <NotificationBell dark={dark} />
        <ThemeToggle />
        <HeaderNav />
      </div>
    </header>
  );
}
