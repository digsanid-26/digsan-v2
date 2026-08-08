'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { jobApi, JobWorkerProfile } from '@/lib/job';
import { Search, Briefcase, Star, MapPin, Loader2, ChevronRight } from 'lucide-react';

export default function WorkersPage() {
  const [workers, setWorkers] = useState<JobWorkerProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [location, setLocation] = useState('');
  const [sortBy, setSortBy] = useState('rating');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  const fetchWorkers = useCallback(async () => {
    setLoading(true);
    try {
      const data = await jobApi.searchWorkers({
        search: search || undefined,
        location: location || undefined,
        sortBy,
        page,
        limit: 12,
      });
      setWorkers(data.workers);
      setTotalPages(data.totalPages);
      setTotal(data.total);
    } catch {
      setWorkers([]);
    } finally {
      setLoading(false);
    }
  }, [search, location, sortBy, page]);

  useEffect(() => {
    const t = setTimeout(fetchWorkers, 300);
    return () => clearTimeout(t);
  }, [fetchWorkers]);

  return (
    <div className="max-w-[1200px] mx-auto space-y-6">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-xs text-slate-400 dark:text-white/40">
        <Link href="/kerja" className="hover:text-blue-500">Kerja</Link>
        <ChevronRight size={14} />
        <span className="text-slate-600 dark:text-white/60">Cari Pekerja</span>
      </nav>

      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-slate-900 dark:text-white"
          style={{ fontFamily: 'var(--font-space-grotesk, Space Grotesk, sans-serif)' }}
        >
          Cari Pekerja
        </h1>
        <p className="text-sm text-slate-500 dark:text-white/50 mt-1">
          Temukan pekerja terverifikasi untuk kebutuhan Anda.
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            placeholder="Cari nama atau keahlian..."
            className="w-full pl-10 pr-4 py-2.5 rounded-lg text-sm bg-white border border-slate-200 focus:ring-2 focus:ring-blue-300 outline-none dark:bg-white/[0.03] dark:border-white/10 dark:text-white"
          />
        </div>
        <div className="relative sm:w-48">
          <MapPin size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={location}
            onChange={(e) => { setLocation(e.target.value); setPage(1); }}
            placeholder="Lokasi..."
            className="w-full pl-10 pr-4 py-2.5 rounded-lg text-sm bg-white border border-slate-200 focus:ring-2 focus:ring-blue-300 outline-none dark:bg-white/[0.03] dark:border-white/10 dark:text-white"
          />
        </div>
        <select
          value={sortBy}
          onChange={(e) => { setSortBy(e.target.value); setPage(1); }}
          className="px-4 py-2.5 rounded-lg text-sm bg-white border border-slate-200 focus:ring-2 focus:ring-blue-300 outline-none dark:bg-white/[0.03] dark:border-white/10 dark:text-white"
        >
          <option value="rating">Rating Tertinggi</option>
          <option value="totalJobs">Paling Berpengalaman</option>
          <option value="createdAt">Terbaru</option>
        </select>
      </div>

      {/* Results count */}
      <p className="text-xs text-slate-400 dark:text-white/40">{total} pekerja ditemukan</p>

      {/* Workers grid */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 size={24} className="animate-spin text-slate-400" />
        </div>
      ) : workers.length === 0 ? (
        <div className="rounded-xl border p-8 text-center bg-white border-slate-200 dark:bg-white/[0.02] dark:border-white/10">
          <Briefcase size={32} className="mx-auto text-slate-300 dark:text-white/20 mb-3" />
          <p className="text-sm text-slate-400 dark:text-white/40">Belum ada pekerja terdaftar.</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {workers.map((w) => (
              <Link
                key={w.id}
                href={`/kerja/workers/${w.id}`}
                className="group rounded-xl border p-4 transition-all hover:shadow-md hover:border-blue-300
                  bg-white border-slate-200 dark:bg-white/[0.02] dark:border-white/10 dark:hover:border-blue-500/50"
              >
                <div className="flex items-start gap-3 mb-3">
                  <div className="w-14 h-14 rounded-full flex items-center justify-center shrink-0 bg-slate-200 dark:bg-white/10 overflow-hidden">
                    {w.profilePhoto ? (
                      <img src={w.profilePhoto} alt={w.user?.name} className="w-full h-full object-cover" />
                    ) : (
                      <Briefcase size={24} className="text-slate-400" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="text-sm font-semibold text-slate-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                      {w.user?.name || 'Pekerja'}
                    </h3>
                    {w.intro && <p className="text-xs text-slate-500 dark:text-white/40 line-clamp-2 mt-0.5">{w.intro}</p>}
                  </div>
                </div>
                <div className="flex items-center gap-3 flex-wrap">
                  {w.rating && (
                    <span className="flex items-center gap-1 text-xs text-amber-500">
                      <Star size={12} fill="currentColor" /> {Number(w.rating).toFixed(1)}
                      <span className="text-slate-400 dark:text-white/40">({w.totalReviews})</span>
                    </span>
                  )}
                  <span className="text-xs text-slate-400 dark:text-white/40">{w.totalJobs} pekerjaan</span>
                  {w.location && (
                    <span className="flex items-center gap-1 text-xs text-slate-400 dark:text-white/40">
                      <MapPin size={12} /> {w.location}
                    </span>
                  )}
                </div>
                {w.skills && w.skills.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-3 pt-3 border-t border-slate-100 dark:border-white/5">
                    {w.skills.slice(0, 3).map((s) => (
                      <span key={s.id} className="px-2 py-0.5 rounded text-[10px] font-medium bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-400">
                        {s.subCategory?.name || 'Skill'}
                      </span>
                    ))}
                    {w.skills.length > 3 && (
                      <span className="px-2 py-0.5 rounded text-[10px] text-slate-400 dark:text-white/40">
                        +{w.skills.length - 3} lainnya
                      </span>
                    )}
                  </div>
                )}
              </Link>
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 pt-4">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-3 py-1.5 rounded-lg text-sm border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-50 dark:border-white/10 dark:text-white/60 dark:hover:bg-white/5"
              >
                Sebelumnya
              </button>
              <span className="text-sm text-slate-500 dark:text-white/50">
                Hal {page} / {totalPages}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="px-3 py-1.5 rounded-lg text-sm border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-50 dark:border-white/10 dark:text-white/60 dark:hover:bg-white/5"
              >
                Berikutnya
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
