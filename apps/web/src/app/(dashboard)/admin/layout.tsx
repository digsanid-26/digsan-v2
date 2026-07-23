'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { clsx } from 'clsx';
import {
  Shield,
  Users,
  TreePine,
  Briefcase,
  Trophy,
  Settings,
  Menu,
  X,
  ArrowLeft,
  Megaphone,
} from 'lucide-react';
import { useAuth } from '@/components/providers/auth-provider';

const adminNav = [
  { href: '/admin', label: 'Dashboard', icon: Shield },
  { href: '/admin/users', label: 'Manajemen User', icon: Users },
  { href: '/admin/trees', label: 'Family Trees', icon: TreePine },
  { href: '/admin/workers', label: 'Worker', icon: Briefcase },
  { href: '/admin/gamification', label: 'Gamification', icon: Trophy },
  { href: '/admin/advertising', label: 'Advertising', icon: Megaphone },
  { href: '/admin/settings', label: 'Pengaturan', icon: Settings },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { user } = useAuth();
  const [open, setOpen] = useState(false);

  const isAdmin = user?.roles?.includes('admin') || user?.roles?.includes('super_admin');

  if (!isAdmin) return null;

  return (
    <div className="flex flex-col lg:flex-row gap-0 -m-4 sm:-m-6 lg:-m-8 min-h-[calc(100vh-73px)]">
      {/* Mobile toggle */}
      <button
        onClick={() => setOpen(!open)}
        className="lg:hidden fixed bottom-4 right-4 z-50 p-3 bg-blue-600 text-white rounded-full shadow-lg"
      >
        {open ? <X size={20} /> : <Menu size={20} />}
      </button>

      {/* Overlay */}
      {open && (
        <div
          className="lg:hidden fixed inset-0 bg-black/50 z-40"
          onClick={() => setOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={clsx(
          'fixed lg:static inset-y-0 left-0 z-40 w-60 flex flex-col transition-transform duration-200 shrink-0',
          'bg-white dark:bg-white/[0.03] border-r border-slate-200 dark:border-white/[0.06]',
          open ? 'translate-x-0' : '-translate-x-full lg:translate-x-0',
        )}
      >
        {/* Header */}
        <div className="p-5 border-b border-slate-100 dark:border-white/[0.06]">
          <Link href="/dashboard" className="flex items-center gap-2 text-sm text-slate-500 dark:text-white/40 hover:text-slate-700 dark:hover:text-white/70 transition-colors">
            <ArrowLeft size={16} />
            Kembali ke App
          </Link>
          <div className="flex items-center gap-2 mt-3">
            <Shield size={20} className="text-blue-600 dark:text-blue-400" />
            <span className="font-bold text-slate-900 dark:text-white">Admin Panel</span>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {adminNav.map((item) => {
            const active = item.href === '/admin'
              ? pathname === '/admin'
              : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                className={clsx(
                  'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                  active
                    ? 'bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400'
                    : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900 dark:text-white/60 dark:hover:bg-white/5 dark:hover:text-white',
                )}
              >
                <item.icon size={18} />
                {item.label}
              </Link>
            );
          })}
        </nav>
      </aside>

      {/* Content */}
      <div className="flex-1 p-4 sm:p-6 lg:p-8 overflow-auto bg-slate-50 dark:bg-transparent">
        {children}
      </div>
    </div>
  );
}
