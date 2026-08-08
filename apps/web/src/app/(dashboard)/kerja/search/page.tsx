'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { jobApi, JobService, JobWorkerProfile } from '@/lib/job';
import { Search, Briefcase, ChevronRight, Star, MapPin, Loader2 } from 'lucide-react';

type Tab = 'services' | 'workers';

export default function SearchPage() {
  const searchParams = useSearchParams();
  const initialQuery = searchParams.get('q') || '';

  const [query, setQuery] = useState(initialQuery);
  const [tab, setTab] = useState<Tab>('services');
  const [services, setServices] = useState<JobService[]>([]);
  const [workers, setWorkers] = useState<JobWorkerProfile[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  const doSearch = useCallback(async (q: string) => {
    if (!q.trim()) return;
    setLoading(true);
    setSearched(true);
    try {
      if (tab === 'services') {
        const data = await jobApi.getServices({ search: q, limit: 30 });
        setServices(data.services);
      } else {
        const data = await jobApi.searchWorkers({ search: q, limit: 30 });
        setWorkers(data.workers);
      }
    } catch {
      if (tab === 'services') setServices([]);
      else setWorkers([]);
    } finally {
      setLoading(false);
    }
  }, [tab]);

  useEffect(() => {
    if (initialQuery) doSearch(initialQuery);
  }, [initialQuery, doSearch]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    doSearch(query);
  };

  return (
    <div className="max-w-[1200px] mx-auto space-y-6">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-xs text-slate-400 dark:text-white/40">
        <Link href="/kerja" className="hover:text-blue-500">Kerja</Link>
        <ChevronRight size={14} />
        <span className="text-slate-600 dark:text-white/60">Pencarian</span>
      </nav>

      {/* Search bar */}
      <form onSubmit={handleSubmit} className="flex gap-2">
        <div className="relative flex-1">
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Cari jasa atau pekerja..."
            className="w-full pl-10 pr-4 py-3 rounded-xl text-sm bg-white border border-slate-200 focus:ring-2 focus:ring-blue-300 outline-none dark:bg-white/[0.03] dark:border-white/10 dark:text-white"
          />
        </div>
        <button
          type="submit"
          disabled={loading}
          className="px-5 py-3 rounded-xl text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 transition-colors disabled:opacity-50"
        >
          {loading ? <Loader2 size={16} className="animate-spin" /> : 'Cari'}
        </button>
      </form>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-slate-200 dark:border-white/10">
        <button
          onClick={() => { setTab('services'); if (searched) doSearch(query); }}
          className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
            tab === 'services'
              ? 'border-blue-600 text-blue-600 dark:text-blue-400 dark:border-blue-400'
              : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-white/50 dark:hover:text-white/70'
          }`}
        >
          Layanan
        </button>
        <button
          onClick={() => { setTab('workers'); if (searched) doSearch(query); }}
          className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
            tab === 'workers'
              ? 'border-blue-600 text-blue-600 dark:text-blue-400 dark:border-blue-400'
              : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-white/50 dark:hover:text-white/70'
          }`}
        >
          Pekerja
        </button>
      </div>

      {/* Results */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 size={24} className="animate-spin text-slate-400" />
        </div>
      ) : !searched ? (
        <div className="rounded-xl border p-8 text-center bg-white border-slate-200 dark:bg-white/[0.02] dark:border-white/10">
          <Search size={32} className="mx-auto text-slate-300 dark:text-white/20 mb-3" />
          <p className="text-sm text-slate-400 dark:text-white/40">Masukkan kata kunci untuk mencari jasa atau pekerja</p>
        </div>
      ) : tab === 'services' ? (
        services.length === 0 ? (
          <EmptyResults query={query} />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {services.map((svc) => (
              <Link
                key={svc.id}
                href={`/kerja/service/${svc.slug}`}
                className="group rounded-xl border p-4 transition-all hover:shadow-md hover:border-blue-300
                  bg-white border-slate-200 dark:bg-white/[0.02] dark:border-white/10 dark:hover:border-blue-500/50"
              >
                {svc.subCategory?.category?.name && (
                  <p className="text-[10px] uppercase tracking-wider text-slate-400 dark:text-white/40 mb-1">
                    {svc.subCategory.category.name} › {svc.subCategory.name}
                  </p>
                )}
                <h3 className="text-sm font-semibold text-slate-900 dark:text-white mb-2 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
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
          </div>
        )
      ) : workers.length === 0 ? (
        <EmptyResults query={query} />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {workers.map((w) => (
            <Link
              key={w.id}
              href={`/kerja/workers/${w.id}`}
              className="group rounded-xl border p-4 transition-all hover:shadow-md hover:border-blue-300
                bg-white border-slate-200 dark:bg-white/[0.02] dark:border-white/10 dark:hover:border-blue-500/50"
            >
              <div className="flex items-start gap-3">
                <div className="w-12 h-12 rounded-full flex items-center justify-center shrink-0 bg-slate-200 dark:bg-white/10 overflow-hidden">
                  {w.profilePhoto ? (
                    <img src={w.profilePhoto} alt={w.user?.name} className="w-full h-full object-cover" />
                  ) : (
                    <Briefcase size={20} className="text-slate-400" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="text-sm font-semibold text-slate-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                    {w.user?.name || 'Pekerja'}
                  </h3>
                  {w.bio && <p className="text-xs text-slate-500 dark:text-white/40 line-clamp-2 mt-1">{w.bio}</p>}
                  <div className="flex items-center gap-3 mt-2">
                    {w.rating && (
                      <span className="flex items-center gap-1 text-xs text-amber-500">
                        <Star size={12} fill="currentColor" /> {Number(w.rating).toFixed(1)}
                      </span>
                    )}
                    {w.location && (
                      <span className="flex items-center gap-1 text-xs text-slate-400 dark:text-white/40">
                        <MapPin size={12} /> {w.location}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

function EmptyResults({ query }: { query: string }) {
  return (
    <div className="rounded-xl border p-8 text-center bg-white border-slate-200 dark:bg-white/[0.02] dark:border-white/10">
      <Search size={32} className="mx-auto text-slate-300 dark:text-white/20 mb-3" />
      <p className="text-sm text-slate-400 dark:text-white/40">
        Tidak ada hasil untuk &ldquo;{query}&rdquo;
      </p>
    </div>
  );
}
