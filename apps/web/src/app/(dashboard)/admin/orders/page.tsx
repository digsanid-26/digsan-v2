'use client';

import { useState, useEffect } from 'react';
import { useApi, useAuthApi } from '@/lib/hooks';
import { useAuth } from '@/components/providers/auth-provider';
import { useRouter } from 'next/navigation';
import {
  Search, Loader2, Package, ChevronRight, X, User, Calendar,
  DollarSign, Clock, MapPin, CheckCircle, XCircle, AlertCircle,
} from 'lucide-react';

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  PENDING: { label: 'Menunggu', color: 'bg-amber-100 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400' },
  WAITING_WORKER: { label: 'Menunggu Pekerja', color: 'bg-amber-100 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400' },
  CONFIRMED: { label: 'Dikonfirmasi', color: 'bg-blue-100 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400' },
  IN_PROGRESS: { label: 'Sedang Dikerjakan', color: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-400' },
  COMPLETED: { label: 'Selesai', color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400' },
  CANCELLED: { label: 'Dibatalkan', color: 'bg-red-100 text-red-700 dark:bg-red-500/10 dark:text-red-400' },
};

export default function AdminOrdersPage() {
  const { user } = useAuth();
  const router = useRouter();
  const isAdmin = user?.roles?.includes('admin') || user?.roles?.includes('super_admin');

  useEffect(() => {
    if (user && !isAdmin) router.replace('/dashboard');
  }, [user, isAdmin, router]);

  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState('');
  const [search, setSearch] = useState('');
  const [selectedOrder, setSelectedOrder] = useState<string | null>(null);
  const { request } = useAuthApi();

  if (!isAdmin) return null;

  const queryString = `/admin/orders?page=${page}&limit=20${statusFilter ? `&status=${statusFilter}` : ''}${search ? `&search=${encodeURIComponent(search)}` : ''}`;
  const { data, loading, refetch } = useApi<any>(queryString);

  const orders = data?.orders ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.ceil(total / 20);

  return (
    <div className="max-w-[1200px] mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Manajemen Order</h1>
        <p className="text-slate-500 dark:text-white/40 mt-1">Kelola semua order Digsan Kerja</p>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            placeholder="Cari nomor order..."
            className="w-full pl-10 pr-4 py-2.5 rounded-lg text-sm bg-white border border-slate-200 focus:ring-2 focus:ring-blue-300 outline-none dark:bg-white/[0.03] dark:border-white/10 dark:text-white"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
          className="px-4 py-2.5 rounded-lg text-sm bg-white border border-slate-200 focus:ring-2 focus:ring-blue-300 outline-none dark:bg-white/[0.03] dark:border-white/10 dark:text-white"
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

      <p className="text-xs text-slate-400 dark:text-white/40">{total} order</p>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 size={24} className="animate-spin text-slate-400" /></div>
      ) : orders.length === 0 ? (
        <div className="rounded-xl border p-12 text-center bg-white border-slate-200 dark:bg-white/[0.02] dark:border-white/10">
          <Package size={40} className="mx-auto text-slate-300 dark:text-white/20 mb-3" />
          <p className="text-sm text-slate-400 dark:text-white/40">Belum ada order</p>
        </div>
      ) : (
        <>
          <div className="rounded-xl border overflow-hidden bg-white border-slate-200 dark:bg-white/[0.02] dark:border-white/10">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 dark:bg-white/[0.03] border-b border-slate-200 dark:border-white/10">
                  <tr>
                    <th className="text-left px-4 py-3 font-medium text-slate-600 dark:text-white/60">Order</th>
                    <th className="text-left px-4 py-3 font-medium text-slate-600 dark:text-white/60">Layanan</th>
                    <th className="text-left px-4 py-3 font-medium text-slate-600 dark:text-white/60">Pelanggan</th>
                    <th className="text-left px-4 py-3 font-medium text-slate-600 dark:text-white/60">Pekerja</th>
                    <th className="text-left px-4 py-3 font-medium text-slate-600 dark:text-white/60">Status</th>
                    <th className="text-right px-4 py-3 font-medium text-slate-600 dark:text-white/60">Total</th>
                    <th className="text-right px-4 py-3 font-medium text-slate-600 dark:text-white/60"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                  {orders.map((order: any) => {
                    const st = STATUS_CONFIG[order.status] || STATUS_CONFIG.PENDING;
                    return (
                      <tr key={order.id} className="hover:bg-slate-50 dark:hover:bg-white/[0.02] cursor-pointer" onClick={() => setSelectedOrder(order.id)}>
                        <td className="px-4 py-3">
                          <p className="font-mono text-xs text-slate-900 dark:text-white">{order.orderNumber}</p>
                          <p className="text-xs text-slate-400 dark:text-white/40">{new Date(order.createdAt).toLocaleDateString('id-ID')}</p>
                        </td>
                        <td className="px-4 py-3 text-slate-700 dark:text-white/70">{order.service?.name || '—'}</td>
                        <td className="px-4 py-3 text-slate-700 dark:text-white/70">{order.customer?.name || '—'}</td>
                        <td className="px-4 py-3 text-slate-700 dark:text-white/70">{order.provider?.name || <span className="text-slate-400">Belum ditugaskan</span>}</td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex px-2 py-0.5 text-xs font-medium rounded-full ${st.color}`}>{st.label}</span>
                        </td>
                        <td className="px-4 py-3 text-right font-semibold text-blue-600 dark:text-blue-400">
                          Rp {Number(order.totalPrice).toLocaleString('id-ID')}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <ChevronRight size={16} className="text-slate-400" />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-3 py-1.5 rounded-lg text-sm border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-50 dark:border-white/10 dark:text-white/60 dark:hover:bg-white/5"
              >
                Sebelumnya
              </button>
              <span className="text-sm text-slate-500 dark:text-white/50">Hal {page} / {totalPages}</span>
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

      {selectedOrder && (
        <OrderDetailModal
          orderId={selectedOrder}
          request={request}
          onClose={() => setSelectedOrder(null)}
          onUpdated={refetch}
        />
      )}
    </div>
  );
}

function OrderDetailModal({ orderId, request, onClose, onUpdated }: any) {
  const { data: order, loading } = useApi<any>(`/admin/orders/${orderId}`);
  const [actionLoading, setActionLoading] = useState(false);
  const [providerId, setProviderId] = useState('');

  const handleAssignProvider = async () => {
    if (!providerId.trim()) { alert('Masukkan User ID pekerja'); return; }
    setActionLoading(true);
    try {
      await request(`/admin/jobs/orders/${orderId}/assign-provider`, {
        method: 'PUT',
        body: JSON.stringify({ providerId }),
      });
      onUpdated();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleStatusChange = async (status: string) => {
    setActionLoading(true);
    try {
      await request(`/admin/jobs/orders/${orderId}/status`, {
        method: 'PUT',
        body: JSON.stringify({ status }),
      });
      onUpdated();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={onClose}>
        <div onClick={(e) => e.stopPropagation()} className="rounded-2xl border p-8 bg-white dark:bg-[#1a1a1a] dark:border-white/10">
          <Loader2 size={24} className="animate-spin text-slate-400" />
        </div>
      </div>
    );
  }

  if (!order) return null;

  const st = STATUS_CONFIG[order.status] || STATUS_CONFIG.PENDING;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={onClose}>
      <div
        className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl border p-6 bg-white border-slate-200 dark:bg-[#1a1a1a] dark:border-white/10"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-xs font-mono text-slate-400 dark:text-white/40">{order.orderNumber}</p>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">{order.service?.name || order.serviceName}</h2>
          </div>
          <div className="flex items-center gap-3">
            <span className={`inline-flex px-2.5 py-1 text-xs font-medium rounded-full ${st.color}`}>{st.label}</span>
            <button onClick={onClose} className="p-1 rounded text-slate-400 hover:bg-slate-100 dark:hover:bg-white/10">
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Info grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
          <InfoRow icon={User} label="Pelanggan" value={order.customer?.name || '—'} sub={order.customer?.email} />
          <InfoRow icon={User} label="Pekerja" value={order.provider?.name || 'Belum ditugaskan'} sub={order.provider?.email} />
          <InfoRow icon={Calendar} label="Tanggal" value={new Date(order.scheduledDate).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })} />
          <InfoRow icon={Clock} label="Waktu" value={`${order.scheduledTime} (${order.duration} jam)`} />
          {order.address && (
            <InfoRow icon={MapPin} label="Alamat" value={`${order.address.label}: ${order.address.fullAddress}`} />
          )}
          <InfoRow icon={DollarSign} label="Total" value={`Rp ${Number(order.totalPrice).toLocaleString('id-ID')}`} />
        </div>

        {/* Price breakdown */}
        <div className="rounded-lg border p-4 mb-4 space-y-1.5 bg-slate-50 border-slate-100 dark:bg-white/[0.02] dark:border-white/5">
          <div className="flex justify-between text-sm">
            <span className="text-slate-500 dark:text-white/50">Harga dasar</span>
            <span className="text-slate-700 dark:text-white/70">Rp {Number(order.basePrice).toLocaleString('id-ID')}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-slate-500 dark:text-white/50">Biaya layanan</span>
            <span className="text-slate-700 dark:text-white/70">Rp {Number(order.serviceFee).toLocaleString('id-ID')}</span>
          </div>
          <div className="flex justify-between text-sm font-bold pt-1.5 border-t border-slate-200 dark:border-white/5">
            <span className="text-slate-900 dark:text-white">Total</span>
            <span className="text-blue-600 dark:text-blue-400">Rp {Number(order.totalPrice).toLocaleString('id-ID')}</span>
          </div>
        </div>

        {/* Payment info */}
        {order.payment && (
          <div className="rounded-lg border p-4 mb-4 bg-slate-50 border-slate-100 dark:bg-white/[0.02] dark:border-white/5">
            <p className="text-xs uppercase tracking-wider text-slate-400 dark:text-white/40 mb-2">Pembayaran</p>
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-600 dark:text-white/60">Metode: {order.payment.method}</span>
              <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${
                order.payment.status === 'PAID' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400' :
                order.payment.status === 'PENDING' ? 'bg-amber-100 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400' :
                'bg-slate-100 text-slate-600 dark:bg-white/10 dark:text-white/50'
              }`}>{order.payment.status}</span>
            </div>
          </div>
        )}

        {/* Description */}
        {order.description && (
          <div className="mb-4">
            <p className="text-xs uppercase tracking-wider text-slate-400 dark:text-white/40 mb-1">Deskripsi</p>
            <p className="text-sm text-slate-600 dark:text-white/60">{order.description}</p>
          </div>
        )}

        {/* Admin actions */}
        <div className="border-t border-slate-100 dark:border-white/5 pt-4 space-y-3">
          <p className="text-xs uppercase tracking-wider text-slate-400 dark:text-white/40">Aksi Admin</p>

          {/* Assign provider */}
          {!order.providerId && (
            <div className="flex gap-2">
              <input
                type="text"
                value={providerId}
                onChange={(e) => setProviderId(e.target.value)}
                placeholder="User ID pekerja..."
                className="flex-1 px-3 py-2 rounded-lg text-sm bg-white border border-slate-200 focus:ring-2 focus:ring-blue-300 outline-none dark:bg-white/[0.03] dark:border-white/10 dark:text-white"
              />
              <button
                onClick={handleAssignProvider}
                disabled={actionLoading}
                className="px-4 py-2 rounded-lg text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 transition-colors disabled:opacity-50"
              >
                {actionLoading ? <Loader2 size={16} className="animate-spin" /> : 'Tugaskan'}
              </button>
            </div>
          )}

          {/* Status override */}
          <div className="flex flex-wrap gap-2">
            {order.status !== 'CONFIRMED' && order.status !== 'IN_PROGRESS' && order.status !== 'COMPLETED' && (
              <button onClick={() => handleStatusChange('CONFIRMED')} disabled={actionLoading}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50">
                <CheckCircle size={14} /> Konfirmasi
              </button>
            )}
            {order.status === 'CONFIRMED' && (
              <button onClick={() => handleStatusChange('IN_PROGRESS')} disabled={actionLoading}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50">
                <Clock size={14} /> Mulai
              </button>
            )}
            {order.status === 'IN_PROGRESS' && (
              <button onClick={() => handleStatusChange('COMPLETED')} disabled={actionLoading}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50">
                <CheckCircle size={14} /> Selesai
              </button>
            )}
            {order.status !== 'CANCELLED' && order.status !== 'COMPLETED' && (
              <button onClick={() => handleStatusChange('CANCELLED')} disabled={actionLoading}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-red-600 border border-red-200 hover:bg-red-50 disabled:opacity-50 dark:text-red-400 dark:border-red-500/30 dark:hover:bg-red-500/10">
                <XCircle size={14} /> Batalkan
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function InfoRow({ icon: Icon, label, value, sub }: any) {
  return (
    <div className="flex items-start gap-2">
      <Icon size={16} className="text-slate-400 dark:text-white/40 shrink-0 mt-0.5" />
      <div className="min-w-0">
        <p className="text-xs text-slate-400 dark:text-white/40">{label}</p>
        <p className="text-sm text-slate-700 dark:text-white/70">{value}</p>
        {sub && <p className="text-xs text-slate-400 dark:text-white/40">{sub}</p>}
      </div>
    </div>
  );
}
