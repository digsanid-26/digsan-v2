'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { jobApi, JobService, JobWorkerProfile } from '@/lib/job';
import { ChevronRight, Briefcase, Star, MapPin, Loader2, Users } from 'lucide-react';

export default function ServiceDetailPage() {
  const params = useParams();
  const slug = params.slug as string;

  const [service, setService] = useState<JobService | null>(null);
  const [workers, setWorkers] = useState<JobWorkerProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      jobApi.getServiceBySlug(slug).catch((e) => { setError(e.message); return null; }),
      jobApi.searchWorkers({ subCategoryId: undefined, limit: 10 }).catch(() => ({ workers: [] })),
    ]).then(([svc, wkr]) => {
      setService(svc);
      if (wkr && 'workers' in wkr) setWorkers(wkr.workers);
    }).finally(() => setLoading(false));
  }, [slug]);

  if (loading) {
    return (
      <div className="max-w-[1000px] mx-auto flex items-center justify-center py-12">
        <Loader2 size={24} className="animate-spin text-slate-400" />
      </div>
    );
  }

  if (error || !service) {
    return (
      <div className="max-w-[1000px] mx-auto">
        <div className="rounded-xl border p-8 text-center bg-white border-slate-200 dark:bg-white/[0.02] dark:border-white/10">
          <p className="text-sm text-slate-400 dark:text-white/40 mb-4">Layanan tidak ditemukan</p>
          <Link href="/kerja" className="text-sm text-blue-500 hover:underline">Kembali ke Digsan Kerja</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-[1000px] mx-auto space-y-6">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-xs text-slate-400 dark:text-white/40 flex-wrap">
        <Link href="/kerja" className="hover:text-blue-500">Kerja</Link>
        <ChevronRight size={14} />
        {service.subCategory?.category?.slug && (
          <>
            <Link href={`/kerja/category/${service.subCategory.category.slug}`} className="hover:text-blue-500">
              {service.subCategory.category.name}
            </Link>
            <ChevronRight size={14} />
          </>
        )}
        <span className="text-slate-600 dark:text-white/60">{service.name}</span>
      </nav>

      {/* Service detail */}
      <div className="rounded-2xl border p-6 transition-colors bg-white border-slate-200 dark:bg-white/[0.02] dark:border-white/10">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <h1 className="text-xl font-bold text-slate-900 dark:text-white mb-2"
              style={{ fontFamily: 'var(--font-space-grotesk, Space Grotesk, sans-serif)' }}
            >
              {service.name}
            </h1>
            {service.description && (
              <p className="text-sm text-slate-600 dark:text-white/60 leading-relaxed">{service.description}</p>
            )}
          </div>
          <div className="text-right shrink-0">
            <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
              Rp {Number(service.basePrice).toLocaleString('id-ID')}
            </p>
            <p className="text-xs text-slate-400 dark:text-white/40 mt-1">{service.priceUnit}</p>
          </div>
        </div>

        <div className="flex items-center gap-4 mt-4 pt-4 border-t border-slate-100 dark:border-white/5">
          {service.duration && (
            <span className="text-xs text-slate-500 dark:text-white/50">
              Estimasi: {service.duration} jam
            </span>
          )}
          <span className="text-xs text-slate-500 dark:text-white/50">
            {service.orderCount} order selesai
          </span>
          <span className="text-xs text-slate-500 dark:text-white/50">
            {service.viewCount} dilihat
          </span>
        </div>
      </div>

      {/* Available workers */}
      <div>
        <h2 className="text-sm font-bold uppercase tracking-wider text-slate-400 dark:text-white/40 mb-4"
          style={{ fontFamily: 'var(--font-space-grotesk, Space Grotesk, sans-serif)' }}
        >
          Pekerja Tersedia
        </h2>
        {workers.length === 0 ? (
          <div className="rounded-xl border p-6 text-center bg-white border-slate-200 dark:bg-white/[0.02] dark:border-white/10">
            <Users size={28} className="mx-auto text-slate-300 dark:text-white/20 mb-2" />
            <p className="text-sm text-slate-400 dark:text-white/40">Belum ada pekerja terdaftar untuk layanan ini.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
    </div>
  );
}
