'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { jobApi, JobOrder } from '@/lib/job';
import { getTokens } from '@/lib/auth';
import { ChevronRight, Loader2, Clock, CheckCircle, XCircle, MapPin, User, Calendar, DollarSign } from 'lucide-react';

const STATUS_LABELS: Record<string, string> = {
  PENDING: 'Menunggu',
  WAITING_WORKER: 'Menunggu Pekerja',
  CONFIRMED: 'Dikonfirmasi',
  IN_PROGRESS: 'Sedang Dikerjakan',
  COMPLETED: 'Selesai',
  CANCELLED: 'Dibatalkan',
};

export default function OrderDetailPage() {
  const params = useParams();
  const id = params.id as string;

  const [order, setOrder] = useState<JobOrder | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  const fetchOrder = async () => {
    const tokens = getTokens();
    if (!tokens) { setLoading(false); return; }
    try {
      const data = await jobApi.getOrder(tokens.accessToken, id);
      setOrder(data);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchOrder(); }, [id]);

  const handleAction = async (action: string, extra?: { notes?: string; reason?: string }) => {
    const tokens = getTokens();
    if (!tokens || !order) return;
    setActionLoading(true);
    try {
      await jobApi.updateOrderStatus(tokens.accessToken, order.id, { action, ...extra });
      await fetchOrder();
    } catch (e: any) {
      alert(e.message);
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-[800px] mx-auto flex items-center justify-center py-12">
        <Loader2 size={24} className="animate-spin text-slate-400" />
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="max-w-[800px] mx-auto">
        <div className="rounded-xl border p-8 text-center bg-white border-slate-200 dark:bg-white/[0.02] dark:border-white/10">
          <p className="text-sm text-slate-400 dark:text-white/40 mb-4">Order tidak ditemukan</p>
          <Link href="/kerja/orders" className="text-sm text-blue-500 hover:underline">Kembali ke riwayat order</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-[800px] mx-auto space-y-6">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-xs text-slate-400 dark:text-white/40">
        <Link href="/kerja" className="hover:text-blue-500">Kerja</Link>
        <ChevronRight size={14} />
        <Link href="/kerja/orders" className="hover:text-blue-500">Order</Link>
        <ChevronRight size={14} />
        <span className="text-slate-600 dark:text-white/60">{order.orderNumber}</span>
      </nav>

      {/* Order header */}
      <div className="rounded-2xl border p-6 transition-colors bg-white border-slate-200 dark:bg-white/[0.02] dark:border-white/10">
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-xs font-mono text-slate-400 dark:text-white/40">{order.orderNumber}</p>
            <h1 className="text-lg font-bold text-slate-900 dark:text-white mt-1">{order.serviceName}</h1>
          </div>
          <span className="px-3 py-1 rounded-lg text-xs font-medium bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-400">
            {STATUS_LABELS[order.status] || order.status}
          </span>
        </div>

        {/* Info grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4 border-t border-slate-100 dark:border-white/5">
          <InfoRow icon={Calendar} label="Tanggal" value={new Date(order.scheduledDate).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })} />
          <InfoRow icon={Clock} label="Waktu" value={`${order.scheduledTime} (${order.duration} jam)`} />
          <InfoRow icon={User} label="Pelanggan" value={order.customer?.name || '-'} />
          <InfoRow icon={User} label="Pekerja" value={order.provider?.name || 'Belum ditugaskan'} />
          {order.address && (
            <InfoRow icon={MapPin} label="Alamat" value={`${order.address.label}: ${order.address.fullAddress}`} />
          )}
          <InfoRow icon={DollarSign} label="Harga" value={`Rp ${Number(order.totalPrice).toLocaleString('id-ID')}`} />
        </div>

        {/* Price breakdown */}
        <div className="mt-4 pt-4 border-t border-slate-100 dark:border-white/5 space-y-1.5">
          <div className="flex justify-between text-sm">
            <span className="text-slate-500 dark:text-white/50">Harga dasar</span>
            <span className="text-slate-700 dark:text-white/70">Rp {Number(order.basePrice).toLocaleString('id-ID')}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-slate-500 dark:text-white/50">Biaya layanan (10%)</span>
            <span className="text-slate-700 dark:text-white/70">Rp {Number(order.serviceFee).toLocaleString('id-ID')}</span>
          </div>
          <div className="flex justify-between text-sm font-bold pt-1.5 border-t border-slate-100 dark:border-white/5">
            <span className="text-slate-900 dark:text-white">Total</span>
            <span className="text-blue-600 dark:text-blue-400">Rp {Number(order.totalPrice).toLocaleString('id-ID')}</span>
          </div>
        </div>

        {/* Description & notes */}
        {order.description && (
          <div className="mt-4 pt-4 border-t border-slate-100 dark:border-white/5">
            <p className="text-xs uppercase tracking-wider text-slate-400 dark:text-white/40 mb-1">Deskripsi</p>
            <p className="text-sm text-slate-600 dark:text-white/60">{order.description}</p>
          </div>
        )}
        {order.customerNotes && (
          <div className="mt-3">
            <p className="text-xs uppercase tracking-wider text-slate-400 dark:text-white/40 mb-1">Catatan Pelanggan</p>
            <p className="text-sm text-slate-600 dark:text-white/60">{order.customerNotes}</p>
          </div>
        )}
        {order.providerNotes && (
          <div className="mt-3">
            <p className="text-xs uppercase tracking-wider text-slate-400 dark:text-white/40 mb-1">Catatan Pekerja</p>
            <p className="text-sm text-slate-600 dark:text-white/60">{order.providerNotes}</p>
          </div>
        )}
      </div>

      {/* Payment info */}
      {order.payment && (
        <div className="rounded-xl border p-5 transition-colors bg-white border-slate-200 dark:bg-white/[0.02] dark:border-white/10">
          <h2 className="text-sm font-semibold text-slate-900 dark:text-white mb-3">Pembayaran</h2>
          <div className="flex items-center justify-between text-sm">
            <span className="text-slate-500 dark:text-white/50">Metode: {order.payment.method}</span>
            <span className="text-slate-700 dark:text-white/70">Status: {order.payment.status}</span>
          </div>
        </div>
      )}

      {/* Action buttons based on status & role */}
      <div className="flex flex-wrap gap-3">
        {order.status === 'WAITING_WORKER' && (
          <>
            <button
              onClick={() => handleAction('CONFIRM', { notes: 'Order dikonfirmasi' })}
              disabled={actionLoading}
              className="px-4 py-2 rounded-lg text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-700 transition-colors disabled:opacity-50"
            >
              Konfirmasi Order
            </button>
            <button
              onClick={() => handleAction('REJECT', { reason: 'Tidak bisa menerima order' })}
              disabled={actionLoading}
              className="px-4 py-2 rounded-lg text-sm font-semibold text-white bg-red-600 hover:bg-red-700 transition-colors disabled:opacity-50"
            >
              Tolak
            </button>
          </>
        )}
        {order.status === 'CONFIRMED' && (
          <button
            onClick={() => handleAction('START')}
            disabled={actionLoading}
            className="px-4 py-2 rounded-lg text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 transition-colors disabled:opacity-50"
          >
            Mulai Pekerjaan
          </button>
        )}
        {order.status === 'IN_PROGRESS' && (
          <button
            onClick={() => handleAction('COMPLETE')}
            disabled={actionLoading}
            className="px-4 py-2 rounded-lg text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-700 transition-colors disabled:opacity-50"
          >
            Selesaikan
          </button>
        )}
        {['PENDING', 'WAITING_WORKER', 'CONFIRMED'].includes(order.status) && (
          <button
            onClick={() => handleAction('CANCEL', { reason: 'Dibatalkan' })}
            disabled={actionLoading}
            className="px-4 py-2 rounded-lg text-sm font-semibold text-red-600 border border-red-200 hover:bg-red-50 transition-colors disabled:opacity-50 dark:text-red-400 dark:border-red-500/30 dark:hover:bg-red-500/10"
          >
            Batalkan
          </button>
        )}
      </div>
    </div>
  );
}

function InfoRow({ icon: Icon, label, value }: { icon: any; label: string; value: string }) {
  return (
    <div className="flex items-start gap-2">
      <Icon size={16} className="text-slate-400 dark:text-white/40 shrink-0 mt-0.5" />
      <div className="min-w-0">
        <p className="text-xs text-slate-400 dark:text-white/40">{label}</p>
        <p className="text-sm text-slate-700 dark:text-white/70">{value}</p>
      </div>
    </div>
  );
}
