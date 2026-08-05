'use client';

import { useState } from 'react';
import { X, Send, CheckCircle2, Loader2 } from 'lucide-react';
import { authRequest } from '@/lib/tree';

const CATEGORIES = [
  { value: 'saran', label: 'Saran/Masukan' },
  { value: 'bug', label: 'Bug/Error' },
  { value: 'pertanyaan', label: 'Pertanyaan' },
];

export default function BetaFeedbackModal({ onClose }: { onClose: () => void }) {
  const [category, setCategory] = useState('saran');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim()) {
      setError('Pesan tidak boleh kosong');
      return;
    }
    setLoading(true);
    setError('');
    try {
      await authRequest('/users/feedback', {
        method: 'POST',
        body: JSON.stringify({ category, message: message.trim() }),
      });
      setSuccess(true);
      setTimeout(() => onClose(), 2500);
    } catch (err: any) {
      setError(err.message || 'Gagal mengirim pesan');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md mx-4 rounded-2xl border p-6 transition-colors
          bg-white border-slate-200 shadow-xl
          dark:bg-[#0b0b1a] dark:border-white/10"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 rounded-md text-xs font-bold text-white bg-orange-600">
              BETA
            </span>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white"
              style={{ fontFamily: 'var(--font-space-grotesk, Space Grotesk, sans-serif)' }}
            >
              App Version: Beta
            </h2>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 dark:text-white/40 dark:hover:text-white/60 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {success ? (
          <div className="flex flex-col items-center py-8 gap-3">
            <CheckCircle2 size={48} className="text-emerald-500" />
            <p className="text-center text-sm text-slate-600 dark:text-white/70">
              Terima kasih! Pesan Anda telah dikirim ke tim kami.
            </p>
          </div>
        ) : (
          <>
            <p className="text-sm text-slate-500 dark:text-white/50 mb-4 leading-relaxed">
              Aplikasi ini masih dalam tahap beta dan dalam proses penyempurnaan fitur utama Tree.
              Ada saran atau menemukan bug/error, silahkan isikan di form berikut ini:
            </p>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs text-slate-500 dark:text-white/50 mb-1.5">
                  Kategori
                </label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl text-sm outline-none border bg-white border-slate-200 text-slate-900 focus:border-blue-400 dark:bg-white/5 dark:border-white/15 dark:text-white dark:[color-scheme:dark] cursor-pointer"
                >
                  {CATEGORIES.map((c) => (
                    <option key={c.value} value={c.value}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs text-slate-500 dark:text-white/50 mb-1.5">
                  Pesan
                </label>
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  rows={4}
                  placeholder="Tulis saran, laporan bug, atau pertanyaan Anda..."
                  className="w-full px-4 py-2.5 rounded-xl text-sm outline-none border bg-white border-slate-200 text-slate-900 focus:border-blue-400 resize-none dark:bg-white/5 dark:border-white/15 dark:text-white"
                />
              </div>
              {error && (
                <p className="text-xs text-red-500 dark:text-red-400">{error}</p>
              )}
              <button
                type="submit"
                disabled={loading}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium text-white bg-orange-600 hover:bg-orange-700 disabled:opacity-50 transition-colors"
              >
                {loading ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <Send size={16} />
                )}
                Kirim
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
