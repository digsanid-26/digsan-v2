'use client';

import Image from 'next/image';
import { useState, useEffect, useRef } from 'react';
import { LayoutDashboard, TreePine, LogOut, ChevronDown, User } from 'lucide-react';
import { getUser, clearAuth } from '@/lib/auth';

interface AuthUser {
  id: string;
  email: string;
  name: string;
  avatar: string | null;
}

function getInitials(name: string) {
  return name
    .split(' ')
    .slice(0, 2)
    .map((n) => n[0])
    .join('')
    .toUpperCase();
}

export default function HeaderNav() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setUser(getUser());
  }, []);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleLogout = () => {
    clearAuth();
    setUser(null);
    setOpen(false);
    window.location.reload();
  };

  if (!user) {
    return (
      <nav className="flex items-center gap-3">
        <a
          href="/login"
          className="px-4 py-2 text-sm text-white/60 hover:text-white transition-colors"
        >
          Masuk
        </a>
        <a
          href="/register"
          className="px-4 py-2 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-500 rounded-xl transition-colors"
        >
          Daftar Gratis
        </a>
      </nav>
    );
  }

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Avatar + Name button */}
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2.5 pl-1 pr-3 py-1 rounded-full border transition-all
          bg-slate-100 hover:bg-slate-200 border-slate-200 hover:border-slate-300
          dark:bg-white/5 dark:hover:bg-white/10 dark:border-white/10 dark:hover:border-white/20"
      >
        {/* Avatar */}
        <div className="w-8 h-8 rounded-full overflow-hidden shrink-0 bg-blue-600 flex items-center justify-center">
          {user.avatar ? (
            <Image
              src={user.avatar}
              alt={user.name}
              width={32}
              height={32}
              className="w-full h-full object-cover"
              referrerPolicy="no-referrer"
            />
          ) : (
            <span className="text-white text-xs font-bold">{getInitials(user.name)}</span>
          )}
        </div>
        {/* Name */}
        <span className="text-sm text-slate-700 dark:text-white/80 max-w-[120px] truncate">
          {user.name.split(' ')[0]}
        </span>
        <ChevronDown
          size={14}
          className={`text-slate-400 dark:text-white/40 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute right-0 mt-2 w-52 rounded-2xl overflow-hidden border shadow-2xl z-50 backdrop-blur-xl
          bg-white/95 border-slate-200
          dark:bg-slate-900/95 dark:border-white/10"
        >
          {/* User info */}
          <div className="px-4 py-3 border-b border-slate-200 dark:border-white/[0.08]">
            <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">{user.name}</p>
            <p className="text-xs text-slate-400 dark:text-white/40 truncate mt-0.5">{user.email}</p>
          </div>

          {/* Menu items */}
          <div className="py-1.5">
            <a
              href="/dashboard"
              onClick={() => setOpen(false)}
              className="flex items-center gap-3 px-4 py-2.5 text-sm transition-colors text-slate-600 hover:text-slate-900 hover:bg-slate-100 dark:text-white/70 dark:hover:text-white dark:hover:bg-white/5"
            >
              <LayoutDashboard size={15} className="text-blue-500 dark:text-blue-400" />
              Dashboard
            </a>
            <a
              href="/tree"
              onClick={() => setOpen(false)}
              className="flex items-center gap-3 px-4 py-2.5 text-sm transition-colors text-slate-600 hover:text-slate-900 hover:bg-slate-100 dark:text-white/70 dark:hover:text-white dark:hover:bg-white/5"
            >
              <TreePine size={15} className="text-emerald-500 dark:text-emerald-400" />
              Pohon Silsilah
            </a>
            <a
              href="/dashboard"
              onClick={() => setOpen(false)}
              className="flex items-center gap-3 px-4 py-2.5 text-sm transition-colors text-slate-600 hover:text-slate-900 hover:bg-slate-100 dark:text-white/70 dark:hover:text-white dark:hover:bg-white/5"
            >
              <User size={15} className="text-slate-400" />
              Profil Saya
            </a>
          </div>

          {/* Logout */}
          <div className="border-t border-slate-200 dark:border-white/[0.08] py-1.5">
            <button
              onClick={handleLogout}
              className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-red-400 hover:text-red-300 hover:bg-red-500/10 transition-colors"
            >
              <LogOut size={15} />
              Keluar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
