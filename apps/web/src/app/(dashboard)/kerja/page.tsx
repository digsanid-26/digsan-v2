'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { jobApi, JobCategory } from '@/lib/job';
import { useAuth } from '@/components/providers/auth-provider';
import { getTokens } from '@/lib/auth';
import {
  Search,
  Briefcase,
  Home,
  Wrench,
  Monitor,
  Scissors,
  Utensils,
  Truck,
  Leaf,
  BookOpen,
  Star,
  TrendingUp,
  ChevronRight,
  HardHat,
  Loader2,
} from 'lucide-react';

const ICON_MAP: Record<string, any> = {
  home: Home,
  wrench: Wrench,
  monitor: Monitor,
  scissors: Scissors,
  utensils: Utensils,
  truck: Truck,
  leaf: Leaf,
  'book-open': BookOpen,
};

export default function KerjaHomePage() {
  const router = useRouter();
  const { user } = useAuth();
  const [categories, setCategories] = useState<JobCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [workerStatus, setWorkerStatus] = useState<'none' | 'pending' | 'approved' | 'rejected' | 'suspended' | 'loading'>('loading');

  useEffect(() => {
    jobApi
      .getCategories()
      .then((data) => setCategories(data))
      .catch(() => setCategories([]))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!user) { setWorkerStatus('none'); return; }
    const tokens = getTokens();
    if (!tokens) { setWorkerStatus('none'); return; }
    setWorkerStatus('loading');
    jobApi
      .getMyWorkerProfile(tokens.accessToken)
      .then((profile) => setWorkerStatus(profile.providerStatus?.toLowerCase() as any || 'pending'))
      .catch(() => setWorkerStatus('none'));
  }, [user]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      router.push(`/kerja/search?q=${encodeURIComponent(searchQuery.trim())}`);
    }
  };

  return (
    <div className="max-w-[1400px] mx-auto space-y-6">
      {/* Hero header */}
      <div className="rounded-2xl border p-6 sm:p-8 transition-colors
        bg-gradient-to-br from-blue-600 to-indigo-700 border-blue-500/20 text-white"
      >
        <div className="flex items-center gap-3 mb-2">
          <Briefcase size={28} />
          <h1 className="text-2xl sm:text-3xl font-bold"
            style={{ fontFamily: 'var(--font-space-grotesk, Space Grotesk, sans-serif)' }}
          >
            Digsan Kerja
          </h1>
        </div>
        <p className="text-blue-100 text-sm sm:text-base mb-5">
          Marketplace jasa & pekerja terpercaya untuk kebutuhan rumah dan bisnis Anda.
        </p>

        {/* Search bar */}
        <form onSubmit={handleSearch} className="flex gap-2 max-w-xl">
          <div className="relative flex-1">
            <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari jasa: cuci AC, desain logo, les privat..."
              className="w-full pl-10 pr-4 py-3 rounded-xl text-sm text-slate-900 bg-white border-0 focus:ring-2 focus:ring-blue-300 outline-none"
            />
          </div>
          <button
            type="submit"
            className="px-5 py-3 rounded-xl text-sm font-semibold bg-white text-blue-700 hover:bg-blue-50 transition-colors"
          >
            Cari
          </button>
        </form>
      </div>

      {/* Quick links */}
      <div className="flex flex-wrap gap-3">
        <Link
          href="/kerja/workers"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors
            bg-white border border-slate-200 text-slate-700 hover:border-blue-300 hover:text-blue-600
            dark:bg-white/[0.03] dark:border-white/10 dark:text-white/70 dark:hover:text-white dark:hover:border-blue-500/50"
        >
          <Briefcase size={16} /> Cari Pekerja
        </Link>

        {/* Jadi Pekerja — only show if user has no worker profile */}
        {workerStatus === 'none' && user && (
          <Link
            href="/kerja/register"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all
              bg-amber-500 text-white border border-amber-500 hover:bg-amber-600 hover:border-amber-600
              shadow-sm hover:shadow-md"
          >
            <HardHat size={16} /> Jadi Pekerja
          </Link>
        )}

        {/* Worker status badge if already registered */}
        {workerStatus !== 'none' && workerStatus !== 'loading' && user && (
          <span className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium
            ${workerStatus === 'approved' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/20' :
              workerStatus === 'pending' ? 'bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-500/10 dark:text-amber-400 dark:border-amber-500/20' :
              workerStatus === 'rejected' ? 'bg-red-50 text-red-700 border border-red-200 dark:bg-red-500/10 dark:text-red-400 dark:border-red-500/20' :
              'bg-slate-50 text-slate-600 border border-slate-200 dark:bg-white/5 dark:text-white/50 dark:border-white/10'}`}
          >
            <HardHat size={16} />
            {workerStatus === 'approved' ? 'Pekerja Terverifikasi' :
             workerStatus === 'pending' ? 'Menunggu Verifikasi' :
             workerStatus === 'rejected' ? 'Pendaftaran Ditolak' :
             'Pekerja Suspended'}
          </span>
        )}

        {workerStatus === 'loading' && user && (
          <span className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-slate-50 text-slate-400 border border-slate-200 dark:bg-white/5 dark:text-white/30 dark:border-white/10">
            <Loader2 size={16} className="animate-spin" />
          </span>
        )}

        <Link
          href="/kerja/orders"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors
            bg-white border border-slate-200 text-slate-700 hover:border-blue-300 hover:text-blue-600
            dark:bg-white/[0.03] dark:border-white/10 dark:text-white/70 dark:hover:text-white dark:hover:border-blue-500/50"
        >
          <TrendingUp size={16} /> Riwayat Order
        </Link>
      </div>

      {/* Categories grid */}
      <div>
        <h2 className="text-sm font-bold uppercase tracking-wider text-slate-400 dark:text-white/40 mb-4"
          style={{ fontFamily: 'var(--font-space-grotesk, Space Grotesk, sans-serif)' }}
        >
          Kategori Jasa
        </h2>

        {loading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="rounded-xl border p-5 animate-pulse
                bg-white border-slate-200 dark:bg-white/[0.02] dark:border-white/10"
              >
                <div className="w-12 h-12 rounded-lg bg-slate-200 dark:bg-white/10 mb-3" />
                <div className="h-4 w-24 bg-slate-200 dark:bg-white/10 rounded mb-2" />
                <div className="h-3 w-16 bg-slate-100 dark:bg-white/5 rounded" />
              </div>
            ))}
          </div>
        ) : categories.length === 0 ? (
          <div className="rounded-xl border p-8 text-center
            bg-white border-slate-200 dark:bg-white/[0.02] dark:border-white/10"
          >
            <p className="text-sm text-slate-400 dark:text-white/40">
              Belum ada kategori jasa tersedia.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {categories.map((cat) => {
              const Icon = ICON_MAP[cat.icon || ''] || Briefcase;
              const subCount = cat.subCategories?.length ?? 0;
              const serviceCount = cat.subCategories?.reduce(
                (acc, sub) => acc + (sub.services?.length ?? 0),
                0,
              ) ?? 0;

              return (
                <Link
                  key={cat.id}
                  href={`/kerja/category/${cat.slug}`}
                  className="group rounded-xl border p-5 transition-all hover:shadow-md hover:border-blue-300
                    bg-white border-slate-200
                    dark:bg-white/[0.02] dark:border-white/10 dark:hover:border-blue-500/50"
                >
                  <div className="w-12 h-12 rounded-lg flex items-center justify-center mb-3 transition-colors
                    bg-blue-50 text-blue-600 group-hover:bg-blue-100
                    dark:bg-blue-500/10 dark:text-blue-400 dark:group-hover:bg-blue-500/20"
                  >
                    <Icon size={24} />
                  </div>
                  <h3 className="text-sm font-semibold text-slate-900 dark:text-white mb-1">
                    {cat.name}
                  </h3>
                  <p className="text-xs text-slate-400 dark:text-white/40">
                    {serviceCount > 0
                      ? `${serviceCount} layanan`
                      : subCount > 0
                        ? `${subCount} sub-kategori`
                        : 'Lihat detail'}
                  </p>
                </Link>
              );
            })}
          </div>
        )}
      </div>

      {/* Featured services */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-bold uppercase tracking-wider text-slate-400 dark:text-white/40"
            style={{ fontFamily: 'var(--font-space-grotesk, Space Grotesk, sans-serif)' }}
          >
            Layanan Populer
          </h2>
          <Link href="/kerja/search" className="text-xs text-blue-500 dark:text-blue-400 hover:underline inline-flex items-center gap-1">
            Lihat semua <ChevronRight size={14} />
          </Link>
        </div>
        <FeaturedServices />
      </div>
    </div>
  );
}

function FeaturedServices() {
  const [services, setServices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    jobApi
      .getServices({ limit: 8 })
      .then((data) => setServices(data.services))
      .catch(() => setServices([]))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-xl border p-4 animate-pulse
            bg-white border-slate-200 dark:bg-white/[0.02] dark:border-white/10"
          >
            <div className="h-3 w-20 bg-slate-200 dark:bg-white/10 rounded mb-2" />
            <div className="h-4 w-32 bg-slate-200 dark:bg-white/10 rounded mb-3" />
            <div className="h-3 w-16 bg-slate-100 dark:bg-white/5 rounded" />
          </div>
        ))}
      </div>
    );
  }

  if (services.length === 0) return null;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {services.map((svc) => (
        <Link
          key={svc.id}
          href={`/kerja/service/${svc.slug}`}
          className="group rounded-xl border p-4 transition-all hover:shadow-md hover:border-blue-300
            bg-white border-slate-200
            dark:bg-white/[0.02] dark:border-white/10 dark:hover:border-blue-500/50"
        >
          {svc.subCategory?.category?.name && (
            <p className="text-[10px] uppercase tracking-wider text-slate-400 dark:text-white/40 mb-1">
              {svc.subCategory.category.name}
            </p>
          )}
          <h3 className="text-sm font-semibold text-slate-900 dark:text-white mb-2 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
            {svc.name}
          </h3>
          <div className="flex items-center justify-between">
            <span className="text-sm font-bold text-blue-600 dark:text-blue-400">
              Rp {Number(svc.basePrice).toLocaleString('id-ID')}
            </span>
            <span className="text-xs text-slate-400 dark:text-white/40">{svc.priceUnit}</span>
          </div>
        </Link>
      ))}
    </div>
  );
}
