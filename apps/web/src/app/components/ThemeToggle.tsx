'use client';

import { Sun, Moon } from 'lucide-react';
import { useTheme } from './ThemeProvider';

export default function ThemeToggle() {
  const { theme, toggle } = useTheme();

  return (
    <button
      onClick={toggle}
      aria-label={theme === 'dark' ? 'Aktifkan mode terang' : 'Aktifkan mode gelap'}
      title={theme === 'dark' ? 'Mode Terang' : 'Mode Gelap'}
      className="w-9 h-9 flex items-center justify-center rounded-full border transition-all
        bg-slate-100 hover:bg-slate-200 border-slate-200 text-slate-600
        dark:bg-white/5 dark:hover:bg-white/10 dark:border-white/10 dark:text-white/70"
    >
      {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
    </button>
  );
}
