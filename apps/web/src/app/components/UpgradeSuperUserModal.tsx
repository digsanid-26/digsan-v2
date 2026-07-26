'use client';

import { useState } from 'react';
import { X, Crown, Loader2, CheckCircle2 } from 'lucide-react';
import { useAuthApi } from '@/lib/hooks';

interface Props {
  open: boolean;
  onClose: () => void;
}

export default function UpgradeSuperUserModal({ open, onClose }: Props) {
  const { request } = useAuthApi();
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  const handleSubmit = async () => {
    if (reason.trim().length < 10) {
      setError('Jelaskan alasan Anda minimal 10 karakter');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await request('/users/me/request-super-user', {
        method: 'POST',
        body: JSON.stringify({ reason }),
      });
      setSuccess(true);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setReason('');
    setSuccess(false);
    setError(null);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={handleClose}>
      <div
        className="w-full max-w-md rounded-2xl border shadow-2xl bg-white border-slate-200 dark:bg-slate-900 dark:border-white/10"
        onClick={(e) => e.stopPropagation()}
      >
        {success ? (
          <div className="p-8 text-center">
            <CheckCircle2 size={48} className="mx-auto text-emerald-500 mb-4" />
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">Permintaan Terkirim!</h3>
            <p className="text-sm text-slate-500 dark:text-white/50 mb-6">
              Permintaan Anda telah dikirim ke super admin. Anda akan mendapatkan notifikasi ketika permintaan diproses.
            </p>
            <button
              onClick={handleClose}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium transition-colors"
            >
              Tutup
            </button>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between p-5 border-b border-slate-200 dark:border-white/10">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-100 dark:bg-amber-500/20 flex items-center justify-center">
                  <Crown size={20} className="text-amber-600 dark:text-amber-400" />
                </div>
                <div>
                  <h3 className="text-base font-semibold text-slate-900 dark:text-white">Upgrade ke Super User</h3>
                  <p className="text-xs text-slate-500 dark:text-white/50">Akses lebih luas untuk mengembangkan silsilah</p>
                </div>
              </div>
              <button onClick={handleClose} className="text-slate-400 hover:text-slate-600 dark:text-white/40 dark:hover:text-white/60 transition-colors">
                <X size={18} />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div className="bg-slate-50 dark:bg-white/5 rounded-xl p-3 text-xs text-slate-600 dark:text-white/60 space-y-1.5">
                <p className="font-medium text-slate-700 dark:text-white/80">Akses Super User:</p>
                <p>• Membuat node unlimited dari seluruh jaringan keluarga</p>
                <p>• Membuat early access (email + password) untuk anggota node</p>
                <p>• Akses daftar node yang dibuat dengan info lengkap</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-white/80 mb-1.5">
                  Alasan Permintaan
                </label>
                <textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  rows={4}
                  placeholder="Jelaskan mengapa Anda ingin menjadi super_user dan bagaimana Anda akan mengembangkan silsilah keluarga..."
                  className="w-full px-3 py-2 border border-slate-300 dark:border-white/10 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-white/5 text-slate-900 dark:text-white resize-none"
                />
              </div>

              {error && (
                <p className="text-xs text-red-500 dark:text-red-400">{error}</p>
              )}

              <button
                onClick={handleSubmit}
                disabled={loading}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-amber-600 text-white rounded-lg hover:bg-amber-700 disabled:opacity-50 text-sm font-medium transition-colors"
              >
                {loading ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    Mengirim...
                  </>
                ) : (
                  <>
                    <Crown size={16} />
                    Kirim Permintaan
                  </>
                )}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
