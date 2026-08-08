'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { jobApi, JobOrder } from '@/lib/job';
import { getTokens } from '@/lib/auth';
import { ChevronRight, Loader2, Package, Clock, CheckCircle, XCircle, AlertCircle } from 'lucide-react';

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: any }> = {
  PENDING: { label: 'Menunggu', color: 'text-amber-600 bg-amber-50 dark:bg-amber-500/10 dark:text-amber-400', icon: Clock },
  WAITING_WORKER: { label: 'Menunggu Pekerja', color: 'text-amber-600 bg-amber-50 dark:bg-amber-500/10 dark:text-amber-400', icon: Clock },
  CONFIRMED: { label: 'Dikonfirmasi', color: 'text-blue-600 bg-blue-50 dark:bg-blue-500/10 dark:text-blue-400', icon: CheckCircle },
  IN_PROGRESS: { label: 'Sedang Dikerjakan', color: 'text-indigo-600 bg-indigo-50 dark:bg-indigo-500/10 dark:text-indigo-400', icon: Clock },
  COMPLETED: { label: 'Selesai', color: 'text-emerald-600 bg-emerald-50 dark:bg-emerald-500/10 dark:text-emerald-400', icon: CheckCircle },
  CANCELLED: { label: 'Dibatalkan', color: 'text-red-600 bg-red-50 dark:bg-red-500/10 dark:text-red-400', icon: XCircle },
};

export default function OrdersPage() {
  const [orders, setOrders] = useState<JobOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [role, setRole] = useState<'customer' | 'provider'>('customer');
  const [status, setStatus] = useState<string>('');

  const fetchOrders = useCallback(async () => {
    const tokens = getTokens();
    if (!tokens) { setLoading(false); return; }
    setLoading(true);
    try {
      const data = await jobApi.getOrders(tokens.accessToken, {
        role,
        status: status || undefined,
        limit: 20,
      });
      setOrders(data.orders);
    } catch {
      setOrders([]);
    } finally {
      setLoading(false);
    }
  }, [role, status]);

  useEffect(() => { fetchOrders(); }, [fetchOrders]);

  return (
    <div className="max-w-[1000px] mx-auto space-y-6">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-xs text-slate-400 dark:text-white/40">
        <Link href="/kerja" className="hover:text-blue-500">Kerja</Link>
        <ChevronRight size={14} />
        <span className="text-slate-600 dark:text-white/60">Riwayat Order</span>
      </nav>

      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-slate-900 dark:text-white"
          style={{ fontFamily: 'var(--font-space-grotesk, Space Grotesk, sans-serif)' }}
        >
          Riwayat Order
        </h1>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex gap-1 border-b border-slate-200 dark:border-white/10">
          {(['customer', 'provider'] as const).map((r) => (
            <button
              key={r}
              onClick={() => setRole(r)}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                role === r
                  ? 'border-blue-600 text-blue-600 dark:text-blue-400 dark:border-blue-400'
                  : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-white/50'
              }`}
            >
              {r === 'customer' ? 'Sebagai Pelanggan' : 'Sebagai Pekerja'}
            </button>
          ))}
        </div>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="px-4 py-2 rounded-lg text-sm bg-white border border-slate-200 focus:ring-2 focus:ring-blue-300 outline-none dark:bg-white/[0.03] dark:border-white/10 dark:text-white"
        >
          <option value="">Semua Status</option>
          <option value="PENDING">Menunggu</option>
          <option value="WAITING_WORKER">Menunggu Pekerja</option>
          <option value="CONFIRMED">Dikonfirmasi</option>
          <option value="IN_PROGRESS">Sedang Dikerjakan</option>
          <option value="COMPLETED">Selesai</option>
          <option value="CANCELLED">Dibatalkan</option>
        </select>
      </div>

      {/* Orders list */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 size={24} className="animate-spin text-slate-400" />
        </div>
      ) : orders.length === 0 ? (
        <div className="rounded-xl border p-8 text-center bg-white border-slate-200 dark:bg-white/[0.02] dark:border-white/10">
          <Package size={32} className="mx-auto text-slate-300 dark:text-white/20 mb-3" />
          <p className="text-sm text-slate-400 dark:text-white/40">Belum ada order.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {orders.map((order) => {
            const st = STATUS_CONFIG[order.status] || STATUS_CONFIG.PENDING;
            const StatusIcon = st.icon;
            return (
              <Link
                key={order.id}
                href={`/kerja/orders/${order.id}`}
                className="group block rounded-xl border p-4 transition-all hover:shadow-md hover:border-blue-300
                  bg-white border-slate-200 dark:bg-white/[0.02] dark:border-white/10 dark:hover:border-blue-500/50"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-mono text-slate-400 dark:text-white/40">{order.orderNumber}</span>
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium ${st.color}`}>
                        <StatusIcon size={10} /> {st.label}
                      </span>
                    </div>
                    <h3 className="text-sm font-semibold text-slate-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                      {order.serviceName}
                    </h3>
                    <div className="flex items-center gap-3 mt-2 text-xs text-slate-400 dark:text-white/40">
                      <span>{new Date(order.scheduledDate).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                      <span>{order.scheduledTime}</span>
                      {role === 'customer' && order.provider?.name && (
                        <span>Pekerja: {order.provider.name}</span>
                      )}
                      {role === 'provider' && order.customer?.name && (
                        <span>Pelanggan: {order.customer.name}</span>
                      )}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-bold text-blue-600 dark:text-blue-400">
                      Rp {Number(order.totalPrice).toLocaleString('id-ID')}
                    </p>
                    {order.payment && (
                      <p className="text-xs text-slate-400 dark:text-white/40 mt-1">
                        {order.payment.method} — {order.payment.status}
                      </p>
                    )}
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
