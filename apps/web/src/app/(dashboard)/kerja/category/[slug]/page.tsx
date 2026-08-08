'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { jobApi, JobCategory } from '@/lib/job';
import { ChevronRight, Briefcase, Home, Wrench, Monitor, Scissors, Utensils, Truck, Leaf, BookOpen } from 'lucide-react';

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

export default function CategoryPage() {
  const params = useParams();
  const slug = params.slug as string;

  const [category, setCategory] = useState<JobCategory | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    jobApi
      .getCategoryBySlug(slug)
      .then((data) => setCategory(data))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [slug]);

  if (loading) {
    return (
      <div className="max-w-[1200px] mx-auto space-y-4">
        <div className="h-8 w-64 bg-slate-200 dark:bg-white/10 rounded animate-pulse" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="rounded-xl border p-5 animate-pulse bg-white border-slate-200 dark:bg-white/[0.02] dark:border-white/10">
              <div className="h-5 w-32 bg-slate-200 dark:bg-white/10 rounded mb-3" />
              <div className="h-3 w-48 bg-slate-100 dark:bg-white/5 rounded" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error || !category) {
    return (
      <div className="max-w-[1200px] mx-auto">
        <div className="rounded-xl border p-8 text-center bg-white border-slate-200 dark:bg-white/[0.02] dark:border-white/10">
          <p className="text-sm text-slate-400 dark:text-white/40 mb-4">Kategori tidak ditemukan</p>
          <Link href="/kerja" className="text-sm text-blue-500 hover:underline">Kembali ke Digsan Kerja</Link>
        </div>
      </div>
    );
  }

  const Icon = ICON_MAP[category.icon || ''] || Briefcase;

  return (
    <div className="max-w-[1200px] mx-auto space-y-6">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-xs text-slate-400 dark:text-white/40">
        <Link href="/kerja" className="hover:text-blue-500">Kerja</Link>
        <ChevronRight size={14} />
        <span className="text-slate-600 dark:text-white/60">{category.name}</span>
      </nav>

      {/* Category header */}
      <div className="rounded-2xl border p-6 transition-colors bg-white border-slate-200 dark:bg-white/[0.02] dark:border-white/10">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-xl flex items-center justify-center bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-400">
            <Icon size={28} />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900 dark:text-white"
              style={{ fontFamily: 'var(--font-space-grotesk, Space Grotesk, sans-serif)' }}
            >
              {category.name}
            </h1>
            {category.description && (
              <p className="text-sm text-slate-500 dark:text-white/50 mt-1">{category.description}</p>
            )}
          </div>
        </div>
      </div>

      {/* Sub-categories with services */}
      <div className="space-y-6">
        {category.subCategories?.map((sub) => (
          <div key={sub.id}>
            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-400 dark:text-white/40 mb-3"
              style={{ fontFamily: 'var(--font-space-grotesk, Space Grotesk, sans-serif)' }}
            >
              {sub.name}
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {sub.services?.map((svc) => (
                <Link
                  key={svc.id}
                  href={`/kerja/service/${svc.slug}`}
                  className="group rounded-xl border p-4 transition-all hover:shadow-md hover:border-blue-300
                    bg-white border-slate-200
                    dark:bg-white/[0.02] dark:border-white/10 dark:hover:border-blue-500/50"
                >
                  <h3 className="text-sm font-semibold text-slate-900 dark:text-white mb-1 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                    {svc.name}
                  </h3>
                  {svc.description && (
                    <p className="text-xs text-slate-500 dark:text-white/40 mb-3 line-clamp-2">{svc.description}</p>
                  )}
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-bold text-blue-600 dark:text-blue-400">
                      Rp {Number(svc.basePrice).toLocaleString('id-ID')}
                    </span>
                    <span className="text-xs text-slate-400 dark:text-white/40">{svc.priceUnit}</span>
                  </div>
                </Link>
              ))}
              {(!sub.services || sub.services.length === 0) && (
                <p className="text-xs text-slate-400 dark:text-white/40 py-2">Belum ada layanan</p>
              )}
            </div>
          </div>
        ))}
        {(!category.subCategories || category.subCategories.length === 0) && (
          <div className="rounded-xl border p-8 text-center bg-white border-slate-200 dark:bg-white/[0.02] dark:border-white/10">
            <p className="text-sm text-slate-400 dark:text-white/40">Belum ada sub-kategori untuk kategori ini.</p>
          </div>
        )}
      </div>
    </div>
  );
}
