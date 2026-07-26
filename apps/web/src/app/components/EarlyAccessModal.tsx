'use client';

import { useState } from 'react';
import { X, KeyRound, Loader2, CheckCircle2, Mail, Lock, Phone } from 'lucide-react';
import { useAuthApi } from '@/lib/hooks';

interface Props {
  open: boolean;
  onClose: () => void;
  treeId: string;
  memberId: string;
  memberName: string;
  onSuccess?: () => void;
}

export default function EarlyAccessModal({ open, onClose, treeId, memberId, memberName, onSuccess }: Props) {
  const { request } = useAuthApi();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  const handleSubmit = async () => {
    if (!email || !password) {
      setError('Email dan password wajib diisi');
      return;
    }
    if (password.length < 6) {
      setError('Password minimal 6 karakter');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await request(`/trees/${treeId}/members/${memberId}/early-access`, {
        method: 'POST',
        body: JSON.stringify({ email, password, phone: phone || undefined }),
      });
      setSuccess(true);
      if (onSuccess) setTimeout(onSuccess, 1500);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setEmail('');
    setPassword('');
    setPhone('');
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
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">Early Access Berhasil!</h3>
            <p className="text-sm text-slate-500 dark:text-white/50 mb-2">
              Akun telah dibuat untuk <span className="font-medium text-slate-700 dark:text-white/80">{memberName}</span>.
            </p>
            <p className="text-xs text-slate-400 dark:text-white/40">
              Email: {email} — Akun sudah aktif dan dapat langsung digunakan untuk login.
            </p>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between p-5 border-b border-slate-200 dark:border-white/10">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-100 dark:bg-blue-500/20 flex items-center justify-center">
                  <KeyRound size={20} className="text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                  <h3 className="text-base font-semibold text-slate-900 dark:text-white">Buat Early Access</h3>
                  <p className="text-xs text-slate-500 dark:text-white/50">Untuk: {memberName}</p>
                </div>
              </div>
              <button onClick={handleClose} className="text-slate-400 hover:text-slate-600 dark:text-white/40 dark:hover:text-white/60 transition-colors">
                <X size={18} />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-white/80 mb-1.5">Email</label>
                <div className="relative">
                  <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="nama@email.com"
                    className="w-full pl-10 pr-3 py-2 border border-slate-300 dark:border-white/10 rounded-lg text-sm bg-white dark:bg-white/5 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-white/80 mb-1.5">Password</label>
                <div className="relative">
                  <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Minimal 6 karakter"
                    className="w-full pl-10 pr-3 py-2 border border-slate-300 dark:border-white/10 rounded-lg text-sm bg-white dark:bg-white/5 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-white/80 mb-1.5">Nomor HP (opsional)</label>
                <div className="relative">
                  <Phone size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="08xxxxxxxxxx"
                    className="w-full pl-10 pr-3 py-2 border border-slate-300 dark:border-white/10 rounded-lg text-sm bg-white dark:bg-white/5 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              </div>

              {error && (
                <p className="text-xs text-red-500 dark:text-red-400">{error}</p>
              )}

              <div className="bg-blue-50 dark:bg-blue-500/10 rounded-lg p-3 text-xs text-blue-600 dark:text-blue-400">
                Akun akan dibuat dengan status aktif dan langsung terhubung ke node ini.
              </div>

              <button
                onClick={handleSubmit}
                disabled={loading}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 text-sm font-medium transition-colors"
              >
                {loading ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    Membuat...
                  </>
                ) : (
                  <>
                    <KeyRound size={16} />
                    Buat Early Access
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
