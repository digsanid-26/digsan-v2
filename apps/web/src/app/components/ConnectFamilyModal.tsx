'use client';

import { useState, useRef, useCallback } from 'react';
import { treeApi } from '@/lib/tree';
import { useTheme } from './ThemeProvider';
import { Search, ArrowRight, ArrowLeft, Check, UserPlus, X } from 'lucide-react';

interface SearchUser {
  id: string;
  name: string;
  username: string | null;
  avatar: string | null;
  email: string;
  type: 'user';
}

interface SearchFamily {
  id: string;
  name: string;
  slug: string | null;
  userId: string;
  user: { id: string; name: string; avatar: string | null };
  type: 'family';
}

type Step = 'search' | 'confirm' | 'success';

export default function ConnectFamilyModal({ onClose }: { onClose: () => void }) {
  const { theme } = useTheme();
  const dark = theme === 'dark';

  const [step, setStep] = useState<Step>('search');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<{ users: SearchUser[]; families: SearchFamily[] }>({ users: [], families: [] });
  const [searching, setSearching] = useState(false);
  const [selectedUser, setSelectedUser] = useState<SearchUser | null>(null);
  const [relationship, setRelationship] = useState('');
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(null);

  const onSearchChange = useCallback((q: string) => {
    setSearchQuery(q);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (q.trim().length < 3) {
      setSearchResults({ users: [], families: [] });
      return;
    }
    setSearching(true);
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await treeApi.search(q);
        setSearchResults(res);
      } catch {
        setSearchResults({ users: [], families: [] });
      } finally {
        setSearching(false);
      }
    }, 400);
  }, []);

  const handleConfirmConnection = async () => {
    if (!selectedUser || !relationship) return;
    setConnecting(true);
    setError('');
    try {
      const res = await treeApi.requestFamilyConnection(selectedUser.id, relationship);
      setSuccessMsg(res.message || 'Permintaan koneksi berhasil dikirim.');
      setStep('success');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Gagal mengirim permintaan koneksi';
      setError(msg);
    } finally {
      setConnecting(false);
    }
  };

  // ─── Styling ────────────────────────────────────────────────
  const overlay = 'fixed inset-0 z-[60] flex items-center justify-center p-4';
  const panelCls = `relative w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl shadow-2xl ${
    dark ? 'bg-[#0f1629] border border-white/10' : 'bg-white border border-slate-200'
  }`;
  const inputCls = `w-full px-3 py-2.5 rounded-lg text-sm outline-none border ${
    dark ? 'bg-white/5 border-white/15 text-white placeholder:text-white/30' : 'bg-white border-slate-200 text-slate-900 placeholder:text-slate-400'
  } focus:border-blue-400`;
  const btnPrimary = 'w-full py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-sm font-semibold transition-colors flex items-center justify-center gap-2';
  const btnSecondary = `w-full py-3 rounded-xl text-sm font-semibold transition-colors flex items-center justify-center gap-2 ${
    dark ? 'bg-white/10 hover:bg-white/15 text-white' : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
  }`;
  const textMain = dark ? 'text-white' : 'text-slate-900';
  const textMuted = dark ? 'text-white/50' : 'text-slate-500';
  const cardCls = `flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-all ${
    dark ? 'bg-white/5 hover:bg-white/10 border border-white/10' : 'bg-slate-50 hover:bg-slate-100 border border-slate-100'
  }`;

  const Avatar = ({ src, name, size = 40 }: { src?: string | null; name: string; size?: number }) => {
    if (src) {
      return <img src={src} alt={name} style={{ width: size, height: size }} className="rounded-full object-cover" referrerPolicy="no-referrer" />;
    }
    return (
      <div
        style={{ width: size, height: size }}
        className={`rounded-full flex items-center justify-center font-semibold text-sm ${dark ? 'bg-blue-600 text-white' : 'bg-blue-500 text-white'}`}
      >
        {name.charAt(0).toUpperCase()}
      </div>
    );
  };

  // ─── Success step ───────────────────────────────────────────
  if (step === 'success') {
    return (
      <div className={overlay} style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}>
        <div className={panelCls}>
          <div className="p-6 text-center">
            <div className={`inline-flex items-center justify-center w-16 h-16 rounded-2xl mb-4 ${dark ? 'bg-emerald-600/20' : 'bg-emerald-50'}`}>
              <Check size={28} className={dark ? 'text-emerald-400' : 'text-emerald-600'} />
            </div>
            <h2 className={`text-xl font-bold ${textMain} mb-2`}>Permintaan Terkirim!</h2>
            <p className={`text-sm ${textMuted} mb-6`}>{successMsg}</p>
            <p className={`text-xs ${textMuted} mb-6`}>
              Anda dapat melanjutkan aktivitas sambil menunggu konfirmasi. Notifikasi akan muncul saat koneksi diterima.
            </p>
            <button onClick={onClose} className={btnPrimary}>
              Selesai
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ─── Confirm step ───────────────────────────────────────────
  if (step === 'confirm' && selectedUser) {
    return (
      <div className={overlay} style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}>
        <div className={panelCls}>
          <div className="p-6">
            <div className="flex items-center gap-3 mb-4">
              <button
                onClick={() => { setStep('search'); setError(''); }}
                className={`w-8 h-8 flex items-center justify-center rounded-full ${dark ? 'hover:bg-white/10 text-white/60' : 'hover:bg-slate-100 text-slate-400'}`}
              >
                <ArrowLeft size={18} />
              </button>
              <h2 className={`text-lg font-bold ${textMain}`}>Konfirmasi Hubungan</h2>
              <button onClick={onClose} className={`ml-auto w-8 h-8 flex items-center justify-center rounded-full ${dark ? 'hover:bg-white/10 text-white/60' : 'hover:bg-slate-100 text-slate-400'}`}>
                <X size={18} />
              </button>
            </div>

            <div className={`flex items-center gap-4 p-4 rounded-xl mb-4 ${dark ? 'bg-white/5' : 'bg-slate-50'}`}>
              <Avatar src={selectedUser.avatar} name={selectedUser.name} size={56} />
              <div>
                <p className={`font-semibold ${textMain}`}>{selectedUser.name}</p>
                {selectedUser.username && <p className={`text-sm ${textMuted}`}>@{selectedUser.username}</p>}
              </div>
            </div>

            <label className={`block text-xs ${textMuted} mb-1`}>Anda adalah apa bagi {selectedUser.name}?</label>
            <select
              value={relationship}
              onChange={(e) => setRelationship(e.target.value)}
              className={`${inputCls} mb-4`}
            >
              <option value="">Pilih hubungan...</option>
              <option value="anak">Anak</option>
              <option value="pasangan">Pasangan (Suami/Istri)</option>
              <option value="orangtua">Orang Tua</option>
              <option value="saudara">Saudara (Kakak/Adik)</option>
              <option value="kakek-nenek">Kakek/Nenek</option>
              <option value="cucu">Cucu</option>
              <option value="paman-bibi">Paman/Bibi</option>
              <option value="keponakan">Keponakan</option>
            </select>

            {error && <p className="text-sm text-red-500 mb-3">{error}</p>}

            <div className={`p-4 rounded-lg mb-4 text-sm ${dark ? 'bg-blue-900/20 text-blue-300' : 'bg-blue-50 text-blue-700'}`}>
              Pastikan orang tersebut benar adalah {selectedUser.name}. Konfirmasi akan dikirim kepada yang bersangkutan.
            </div>
            <button
              onClick={handleConfirmConnection}
              disabled={!relationship || connecting}
              className={`${btnPrimary} ${(!relationship || connecting) ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              {connecting ? 'Mengirim...' : (<><Check size={16} /> Kirim Permintaan Koneksi</>)}
            </button>
            <p className={`text-xs ${textMuted} text-center mt-3`}>
              Koneksi akan terverifikasi setelah permintaan diterima.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // ─── Search step (default) ──────────────────────────────────
  return (
    <div className={overlay} style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}>
      <div className={panelCls}>
        <div className="p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className={`flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center ${dark ? 'bg-blue-600/20' : 'bg-blue-50'}`}>
              <UserPlus size={20} className={dark ? 'text-blue-400' : 'text-blue-600'} />
            </div>
            <div className="flex-1">
              <h2 className={`text-lg font-bold ${textMain}`}>Cari & Hubungkan Keluarga</h2>
              <p className={`text-xs ${textMuted}`}>Cari anggota keluarga yang sudah terdaftar di Digsan</p>
            </div>
            <button onClick={onClose} className={`w-8 h-8 flex items-center justify-center rounded-full ${dark ? 'hover:bg-white/10 text-white/60' : 'hover:bg-slate-100 text-slate-400'}`}>
              <X size={18} />
            </button>
          </div>

          <div className="relative mb-4">
            <Search size={18} className={`absolute left-3 top-1/2 -translate-y-1/2 ${textMuted}`} />
            <input
              autoFocus
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Ketik minimal 3 huruf nama..."
              className={`${inputCls} pl-10`}
            />
            {searching && (
              <div className={`absolute right-3 top-1/2 -translate-y-1/2 text-xs ${textMuted}`}>Mencari...</div>
            )}
          </div>

          {searchQuery.trim().length >= 3 && (
            <div>
              <p className={`text-xs font-semibold mb-2 ${textMuted}`}>Hasil Pencarian</p>
              {searchResults.users.length === 0 && !searching && (
                <p className={`text-sm ${textMuted} text-center py-4`}>Tidak ada hasil ditemukan</p>
              )}
              <div className="space-y-2">
                {searchResults.users.map((u) => (
                  <div
                    key={u.id}
                    onClick={() => { setSelectedUser(u); setStep('confirm'); setError(''); setRelationship(''); }}
                    className={`${cardCls} group`}
                  >
                    <Avatar src={u.avatar} name={u.name} />
                    <div className="flex-1 min-w-0">
                      <p className={`font-semibold text-sm ${textMain}`}>{u.name}</p>
                      {u.username && <p className={`text-xs ${textMuted}`}>@{u.username}</p>}
                    </div>
                    <ArrowRight size={16} className={textMuted} />
                  </div>
                ))}
              </div>

              {searchResults.families.length > 0 && (
                <>
                  <p className={`text-xs font-semibold mb-2 mt-4 ${textMuted}`}>Family Node</p>
                  <div className="space-y-2">
                    {searchResults.families.map((f) => (
                      <div key={f.id} className={`${cardCls} opacity-60`}>
                        <Avatar src={f.user.avatar} name={f.user.name} />
                        <div className="flex-1 min-w-0">
                          <p className={`font-semibold text-sm ${textMain}`}>{f.name}</p>
                          <p className={`text-xs ${textMuted}`}>Keluarga {f.user.name}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}

          {searchQuery.trim().length < 3 && (
            <div className={`text-center py-8 ${textMuted}`}>
              <Search size={32} className="mx-auto mb-2 opacity-40" />
              <p className="text-sm">Ketik nama untuk mencari anggota keluarga</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
