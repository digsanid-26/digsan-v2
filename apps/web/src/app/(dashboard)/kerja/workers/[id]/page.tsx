'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { jobApi, JobWorkerProfile } from '@/lib/job';
import { ChevronRight, Briefcase, Star, MapPin, Loader2, Clock, CheckCircle, Calendar } from 'lucide-react';

export default function WorkerDetailPage() {
  const params = useParams();
  const id = params.id as string;

  const [worker, setWorker] = useState<JobWorkerProfile | null>(null);
  const [reviews, setReviews] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      jobApi.getWorkerProfile(id).catch((e) => { setError(e.message); return null; }),
      jobApi.getProviderReviews(id, 1, 10).catch(() => ({ reviews: [] })),
    ]).then(([w, r]) => {
      setWorker(w);
      if (r && 'reviews' in r) setReviews(r.reviews || r);
    }).finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <div className="max-w-[1000px] mx-auto flex items-center justify-center py-12">
        <Loader2 size={24} className="animate-spin text-slate-400" />
      </div>
    );
  }

  if (error || !worker) {
    return (
      <div className="max-w-[1000px] mx-auto">
        <div className="rounded-xl border p-8 text-center bg-white border-slate-200 dark:bg-white/[0.02] dark:border-white/10">
          <p className="text-sm text-slate-400 dark:text-white/40 mb-4">Profil pekerja tidak ditemukan</p>
          <Link href="/kerja/workers" className="text-sm text-blue-500 hover:underline">Kembali ke daftar pekerja</Link>
        </div>
      </div>
    );
  }

  const dayNames: Record<string, string> = {
    MONDAY: 'Senin', TUESDAY: 'Selasa', WEDNESDAY: 'Rabu', THURSDAY: 'Kamis',
    FRIDAY: 'Jumat', SATURDAY: 'Sabtu', SUNDAY: 'Minggu',
  };

  return (
    <div className="max-w-[1000px] mx-auto space-y-6">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-xs text-slate-400 dark:text-white/40">
        <Link href="/kerja" className="hover:text-blue-500">Kerja</Link>
        <ChevronRight size={14} />
        <Link href="/kerja/workers" className="hover:text-blue-500">Pekerja</Link>
        <ChevronRight size={14} />
        <span className="text-slate-600 dark:text-white/60">{worker.user?.name}</span>
      </nav>

      {/* Profile header */}
      <div className="rounded-2xl border p-6 transition-colors bg-white border-slate-200 dark:bg-white/[0.02] dark:border-white/10">
        <div className="flex items-start gap-4">
          <div className="w-20 h-20 rounded-full flex items-center justify-center shrink-0 bg-slate-200 dark:bg-white/10 overflow-hidden">
            {worker.profilePhoto ? (
              <img src={worker.profilePhoto} alt={worker.user?.name} className="w-full h-full object-cover" />
            ) : (
              <Briefcase size={32} className="text-slate-400" />
            )}
          </div>
          <div className="flex-1">
            <h1 className="text-xl font-bold text-slate-900 dark:text-white"
              style={{ fontFamily: 'var(--font-space-grotesk, Space Grotesk, sans-serif)' }}
            >
              {worker.user?.name || 'Pekerja'}
            </h1>
            {worker.bio && <p className="text-sm text-slate-600 dark:text-white/60 mt-1">{worker.bio}</p>}
            <div className="flex items-center gap-4 mt-3">
              {worker.rating && (
                <span className="flex items-center gap-1 text-sm text-amber-500">
                  <Star size={16} fill="currentColor" /> {Number(worker.rating).toFixed(1)}
                  <span className="text-slate-400 dark:text-white/40 text-xs">({worker.totalReviews} ulasan)</span>
                </span>
              )}
              <span className="flex items-center gap-1 text-sm text-slate-500 dark:text-white/50">
                <CheckCircle size={16} className="text-emerald-500" /> {worker.totalJobs} pekerjaan selesai
              </span>
              {worker.location && (
                <span className="flex items-center gap-1 text-sm text-slate-500 dark:text-white/50">
                  <MapPin size={16} /> {worker.location}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Intro */}
      {worker.intro && (
        <div className="rounded-xl border p-5 transition-colors bg-white border-slate-200 dark:bg-white/[0.02] dark:border-white/10">
          <h2 className="text-sm font-semibold text-slate-900 dark:text-white mb-2">Tentang</h2>
          <p className="text-sm text-slate-600 dark:text-white/60 leading-relaxed">{worker.intro}</p>
        </div>
      )}

      {/* Skills */}
      {worker.skills && worker.skills.length > 0 && (
        <div className="rounded-xl border p-5 transition-colors bg-white border-slate-200 dark:bg-white/[0.02] dark:border-white/10">
          <h2 className="text-sm font-semibold text-slate-900 dark:text-white mb-3">Keahlian & Tarif</h2>
          <div className="space-y-3">
            {worker.skills.map((s) => (
              <div key={s.id} className="flex items-center justify-between py-2 border-b border-slate-100 dark:border-white/5 last:border-0">
                <div>
                  <span className="text-sm font-medium text-slate-700 dark:text-white/80">
                    {s.subCategory?.name || 'Skill'}
                  </span>
                  {s.subCategory?.category?.name && (
                    <span className="text-xs text-slate-400 dark:text-white/40 ml-2">
                      {s.subCategory.category.name}
                    </span>
                  )}
                </div>
                <div className="text-right">
                  <span className="text-sm font-bold text-blue-600 dark:text-blue-400">
                    Rp {Number(s.rate).toLocaleString('id-ID')}
                  </span>
                  <span className="text-xs text-slate-400 dark:text-white/40 ml-1">
                    {s.pricingType === 'PER_JAM' ? '/jam' : s.pricingType === 'PER_PROJECT' ? '/project' : '/unit'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Work schedule */}
      {worker.workSchedules && worker.workSchedules.length > 0 && (
        <div className="rounded-xl border p-5 transition-colors bg-white border-slate-200 dark:bg-white/[0.02] dark:border-white/10">
          <h2 className="text-sm font-semibold text-slate-900 dark:text-white mb-3">Jadwal Kerja</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {worker.workSchedules.map((ws) => (
              <div key={ws.id} className="flex items-center gap-2 text-sm">
                <Calendar size={14} className="text-slate-400" />
                <span className="text-slate-600 dark:text-white/60">{dayNames[ws.dayOfWeek] || ws.dayOfWeek}</span>
                <span className="text-slate-400 dark:text-white/40 text-xs">
                  {ws.startTime} - {ws.endTime}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Service areas */}
      {worker.serviceAreas && worker.serviceAreas.length > 0 && (
        <div className="rounded-xl border p-5 transition-colors bg-white border-slate-200 dark:bg-white/[0.02] dark:border-white/10">
          <h2 className="text-sm font-semibold text-slate-900 dark:text-white mb-3">Area Layanan</h2>
          <div className="flex flex-wrap gap-2">
            {worker.serviceAreas.map((sa) => (
              <span key={sa.id} className="px-3 py-1 rounded-lg text-xs font-medium bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-400">
                {sa.areaName}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Reviews */}
      <div>
        <h2 className="text-sm font-bold uppercase tracking-wider text-slate-400 dark:text-white/40 mb-4"
          style={{ fontFamily: 'var(--font-space-grotesk, Space Grotesk, sans-serif)' }}
        >
          Ulasan
        </h2>
        {reviews.length === 0 ? (
          <div className="rounded-xl border p-6 text-center bg-white border-slate-200 dark:bg-white/[0.02] dark:border-white/10">
            <p className="text-sm text-slate-400 dark:text-white/40">Belum ada ulasan.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {reviews.map((r) => (
              <div key={r.id} className="rounded-xl border p-4 bg-white border-slate-200 dark:bg-white/[0.02] dark:border-white/10">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-slate-700 dark:text-white/80">
                    {r.customer?.name || 'Pelanggan'}
                  </span>
                  <span className="flex items-center gap-0.5">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Star
                        key={i}
                        size={12}
                        className={i < r.rating ? 'text-amber-500' : 'text-slate-200 dark:text-white/10'}
                        fill={i < r.rating ? 'currentColor' : 'none'}
                      />
                    ))}
                  </span>
                </div>
                {r.comment && <p className="text-sm text-slate-600 dark:text-white/60">{r.comment}</p>}
                <p className="text-xs text-slate-400 dark:text-white/40 mt-2">
                  {new Date(r.createdAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
