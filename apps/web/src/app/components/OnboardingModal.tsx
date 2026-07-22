'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { treeApi } from '@/lib/tree';
import { getTokens } from '@/lib/auth';
import type { TreeConfig } from './treeTypes';
import { DEFAULT_CONFIG } from './treeTypes';
import { Minus, Plus, Search, UserPlus, ArrowRight, ArrowLeft, Check, Network } from 'lucide-react';

// ─── Types ──────────────────────────────────────────────────

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

interface PendingInvitation {
  id: string;
  token: string;
  message: string | null;
  createdAt: string;
  tree: { id: string; name: string; slug: string | null; user: { id: string; name: string; avatar: string | null } };
}

type Step = 'choice' | 'search' | 'confirm' | 'create-main' | 'create-ext' | 'create-simbah';

// ─── Component ──────────────────────────────────────────────

export default function OnboardingModal({
  dark,
  onComplete,
}: {
  dark: boolean;
  onComplete: (config: TreeConfig) => void;
}) {
  const [step, setStep] = useState<Step>('choice');
  const [config, setConfig] = useState<TreeConfig>({ ...DEFAULT_CONFIG });
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<{ users: SearchUser[]; families: SearchFamily[] }>({ users: [], families: [] });
  const [searching, setSearching] = useState(false);
  const [pendingInvites, setPendingInvites] = useState<PendingInvitation[]>([]);
  const [selectedItem, setSelectedItem] = useState<{ type: 'user' | 'family' | 'invitation'; data: SearchUser | SearchFamily | PendingInvitation } | null>(null);
  const [relationship, setRelationship] = useState('');
  const [accepting, setAccepting] = useState(false);
  const [error, setError] = useState('');
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(null);

  // Load pending invitations on mount
  useEffect(() => {
    const tokens = getTokens();
    if (!tokens?.accessToken) return;
    treeApi.pendingInvitations()
      .then((invites) => setPendingInvites(invites))
      .catch(() => {});
  }, []);

  // Debounced search
  const doSearch = useCallback((q: string) => {
    const query = q.trim();
    if (query.length < 3) {
      setSearchResults({ users: [], families: [] });
      return;
    }
    setSearching(true);
    treeApi.search(query)
      .then((res) => setSearchResults(res))
      .catch(() => setSearchResults({ users: [], families: [] }))
      .finally(() => setSearching(false));
  }, []);

  const onSearchChange = (val: string) => {
    setSearchQuery(val);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => doSearch(val), 300);
  };

  const selectItem = (type: 'user' | 'family' | 'invitation', data: SearchUser | SearchFamily | PendingInvitation) => {
    setSelectedItem({ type, data });
    setStep('confirm');
  };

  const handleAcceptInvitation = async (token: string) => {
    setAccepting(true);
    setError('');
    try {
      const result = await treeApi.acceptInvitation(token);
      // Sync family name with inviter's tree name
      const inviterTreeName = selectedItem?.type === 'invitation'
        ? (selectedItem.data as PendingInvitation).tree.name
        : '';
      setConfig((p) => ({
        ...p,
        mainFamilyName: inviterTreeName || p.mainFamilyName,
        configured: true,
      }));
      // Proceed to extended family form (user already has main family from invitation)
      setStep('create-ext');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Gagal menerima undangan';
      setError(msg);
    } finally {
      setAccepting(false);
    }
  };

  const handleSaveAndBuild = () => {
    onComplete({ ...config, configured: true });
  };

  // ─── Render helpers ────────────────────────────────────────

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

  // ─── Steps ─────────────────────────────────────────────────

  // Step 1: Choice
  if (step === 'choice') {
    return (
      <div className={overlay} style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}>
        <div className={panelCls}>
          <div className="p-6">
            <div className="text-center mb-6">
              <div className={`inline-flex items-center justify-center w-16 h-16 rounded-2xl mb-3 ${dark ? 'bg-blue-600/20' : 'bg-blue-50'}`}>
                <Network size={28} className={dark ? 'text-blue-400' : 'text-blue-600'} />
              </div>
              <h2 className={`text-xl font-bold ${textMain}`}>Mulai Membangun Silsilah</h2>
              <p className={`text-sm ${textMuted} mt-1`}>Bagaimana Anda memulai silsilah?</p>
            </div>

            <div className="space-y-3">
              <button onClick={() => setStep('search')} className={cardCls}>
                <div className={`flex-shrink-0 w-12 h-12 rounded-xl flex items-center justify-center ${dark ? 'bg-blue-600/20' : 'bg-blue-50'}`}>
                  <Search size={22} className={dark ? 'text-blue-400' : 'text-blue-600'} />
                </div>
                <div className="text-left flex-1">
                  <p className={`font-semibold ${textMain}`}>Mencari Keluarga</p>
                  <p className={`text-xs ${textMuted}`}>Cari keluarga atau orang yang sudah terdaftar di Digsan</p>
                </div>
                <ArrowRight size={18} className={textMuted} />
              </button>

              <button onClick={() => setStep('create-main')} className={cardCls}>
                <div className={`flex-shrink-0 w-12 h-12 rounded-xl flex items-center justify-center ${dark ? 'bg-emerald-600/20' : 'bg-emerald-50'}`}>
                  <UserPlus size={22} className={dark ? 'text-emerald-400' : 'text-emerald-600'} />
                </div>
                <div className="text-left flex-1">
                  <p className={`font-semibold ${textMain}`}>Mulai dari 0</p>
                  <p className={`text-xs ${textMuted}`}>Buat silsilah keluarga Anda sendiri dari awal</p>
                </div>
                <ArrowRight size={18} className={textMuted} />
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Step 2a: Search
  if (step === 'search') {
    return (
      <div className={overlay} style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}>
        <div className={panelCls}>
          <div className="p-6">
            <div className="flex items-center gap-3 mb-4">
              <button onClick={() => setStep('choice')} className={`w-8 h-8 flex items-center justify-center rounded-full ${dark ? 'hover:bg-white/10 text-white/60' : 'hover:bg-slate-100 text-slate-400'}`}>
                <ArrowLeft size={18} />
              </button>
              <h2 className={`text-lg font-bold ${textMain}`}>Cari Keluarga</h2>
            </div>

            <div className="relative mb-4">
              <Search size={18} className={`absolute left-3 top-1/2 -translate-y-1/2 ${textMuted}`} />
              <input
                autoFocus
                value={searchQuery}
                onChange={(e) => onSearchChange(e.target.value)}
                placeholder="Ketik minimal 3 huruf nama orang atau keluarga..."
                className={`${inputCls} pl-10`}
              />
              {searching && (
                <div className={`absolute right-3 top-1/2 -translate-y-1/2 text-xs ${textMuted}`}>Mencari...</div>
              )}
            </div>

            {/* Pending invitations */}
            {pendingInvites.length > 0 && (
              <div className="mb-4">
                <p className={`text-xs font-semibold mb-2 ${dark ? 'text-amber-400' : 'text-amber-600'}`}>
                  Undangan Menunggu
                </p>
                <p className={`text-xs ${textMuted} mb-2`}>Apakah nama pengundang adalah anggota keluarga Anda?</p>
                <div className="space-y-2">
                  {pendingInvites.map((inv) => (
                    <div
                      key={inv.id}
                      onClick={() => selectItem('invitation', inv)}
                      className={cardCls}
                    >
                      <Avatar src={inv.tree.user.avatar} name={inv.tree.user.name} />
                      <div className="flex-1 min-w-0">
                        <p className={`font-semibold text-sm ${textMain}`}>{inv.tree.user.name}</p>
                        <p className={`text-xs ${textMuted}`}>Keluarga {inv.tree.name}</p>
                      </div>
                      <ArrowRight size={16} className={textMuted} />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Search results */}
            {searchQuery.trim().length >= 3 && (
              <div>
                <p className={`text-xs font-semibold mb-2 ${textMuted}`}>Hasil Pencarian</p>
                {searchResults.users.length === 0 && searchResults.families.length === 0 && !searching && (
                  <p className={`text-sm ${textMuted} text-center py-4`}>Tidak ada hasil ditemukan</p>
                )}
                <div className="space-y-2">
                  {searchResults.users.map((u) => (
                    <div key={u.id} onClick={() => selectItem('user', u)} className={`${cardCls} group`}>
                      <Avatar src={u.avatar} name={u.name} />
                      <div className="flex-1 min-w-0">
                        <p className={`font-semibold text-sm ${textMain}`}>{u.name}</p>
                        <p className={`text-xs ${textMuted}`}>{u.username ? `@${u.username}` : u.email}</p>
                      </div>
                      <div className={`text-xs ${textMuted} italic opacity-0 group-hover:opacity-100 transition-opacity`}>Anggota keluarga Anda?</div>
                    </div>
                  ))}
                  {searchResults.families.map((f) => (
                    <div key={f.id} onClick={() => selectItem('family', f)} className={`${cardCls} group`}>
                      <Avatar src={f.user.avatar} name={f.user.name} />
                      <div className="flex-1 min-w-0">
                        <p className={`font-semibold text-sm ${textMain}`}>{f.name}</p>
                        <p className={`text-xs ${textMuted}`}>Pemilik: {f.user.name}</p>
                      </div>
                      <div className={`text-xs ${textMuted} italic opacity-0 group-hover:opacity-100 transition-opacity`}>Keluarga Anda?</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Step 3: Confirm relationship
  if (step === 'confirm' && selectedItem) {
    const isInvitation = selectedItem.type === 'invitation';
    const inv = isInvitation ? selectedItem.data as PendingInvitation : null;
    const user = selectedItem.type === 'user' ? selectedItem.data as SearchUser : null;
    const family = selectedItem.type === 'family' ? selectedItem.data as SearchFamily : null;
    const displayName = inv?.tree.user.name || user?.name || family?.user.name || '';
    const displayAvatar = inv?.tree.user.avatar || user?.avatar || family?.user.avatar || null;
    const treeName = inv?.tree.name || family?.name || '';

    return (
      <div className={overlay} style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}>
        <div className={panelCls}>
          <div className="p-6">
            <div className="flex items-center gap-3 mb-4">
              <button onClick={() => setStep('search')} className={`w-8 h-8 flex items-center justify-center rounded-full ${dark ? 'hover:bg-white/10 text-white/60' : 'hover:bg-slate-100 text-slate-400'}`}>
                <ArrowLeft size={18} />
              </button>
              <h2 className={`text-lg font-bold ${textMain}`}>Konfirmasi Hubungan Anda</h2>
            </div>

            <div className={`flex items-center gap-4 p-4 rounded-xl mb-4 ${dark ? 'bg-white/5' : 'bg-slate-50'}`}>
              <Avatar src={displayAvatar} name={displayName} size={56} />
              <div>
                <p className={`font-semibold ${textMain}`}>{displayName}</p>
                {treeName && <p className={`text-sm ${textMuted}`}>Keluarga {treeName}</p>}
              </div>
            </div>

            <label className={`block text-xs ${textMuted} mb-1`}>Peran Anda sebagai apa {displayName}?</label>
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

            {isInvitation ? (
              <button
                onClick={() => handleAcceptInvitation(inv!.token)}
                disabled={accepting || !relationship}
                className={`${btnPrimary} ${(!relationship || accepting) ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                {accepting ? 'Memproses...' : (<><Check size={16} />Simpan dan Sesuaikan</>)}
              </button>
            ) : (
              <div className={`p-3 rounded-lg mb-4 text-sm ${dark ? 'bg-amber-900/20 text-amber-300' : 'bg-amber-50 text-amber-700'}`}>
                Untuk bergabung dengan keluarga {displayName}, Anda perlu diundang terlebih dahulu. Minta {displayName} mengirim undangan ke email Anda.
              </div>
            )}

            {!isInvitation && (
              <button onClick={() => setStep('search')} className={btnSecondary}>
                Kembali
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Steps for "Mulai dari 0" ──────────────────────────────────

  // Step: Create Main Family
  if (step === 'create-main') {
    return (
      <div className={overlay} style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}>
        <div className={panelCls}>
          <div className="p-6">
            <ProgressBar current={1} total={3} dark={dark} />

            <div className="flex items-center gap-3 mb-4 mt-4">
              <button onClick={() => setStep('choice')} className={`w-8 h-8 flex items-center justify-center rounded-full ${dark ? 'hover:bg-white/10 text-white/60' : 'hover:bg-slate-100 text-slate-400'}`}>
                <ArrowLeft size={18} />
              </button>
              <h2 className={`text-lg font-bold ${textMain}`}>Buat Keluarga Utamamu</h2>
            </div>

            <div className="space-y-4">
              <div>
                <label className={`block text-xs ${textMuted} mb-1`}>Nama Family</label>
                <input
                  value={config.mainFamilyName}
                  onChange={(e) => setConfig((p) => ({ ...p, mainFamilyName: e.target.value }))}
                  placeholder="mis. Keluarga Budi"
                  className={inputCls}
                />
              </div>
              <NumFieldInline label="Jumlah pasangan (suami/istri)" value={config.spouseCount} onChange={(v) => setConfig((p) => ({ ...p, spouseCount: v }))} dark={dark} />
              <NumFieldInline label="Jumlah anak" value={config.childCount} onChange={(v) => setConfig((p) => ({ ...p, childCount: v }))} dark={dark} />
            </div>

            <div className="mt-6">
              <button
                onClick={() => setStep('create-ext')}
                disabled={!config.mainFamilyName.trim()}
                className={`${btnPrimary} ${!config.mainFamilyName.trim() ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                Simpan dan Lanjut <ArrowRight size={16} />
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Step: Create Extended Family
  if (step === 'create-ext') {
    return (
      <div className={overlay} style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}>
        <div className={panelCls}>
          <div className="p-6">
            <ProgressBar current={config.configured ? 1 : 2} total={3} dark={dark} />

            <div className="flex items-center gap-3 mb-4 mt-4">
              <button onClick={() => setStep(config.configured ? 'search' : 'create-main')} className={`w-8 h-8 flex items-center justify-center rounded-full ${dark ? 'hover:bg-white/10 text-white/60' : 'hover:bg-slate-100 text-slate-400'}`}>
                <ArrowLeft size={18} />
              </button>
              <h2 className={`text-lg font-bold ${textMain}`}>Buatlah Keluarga Besarmu</h2>
            </div>

            <div className="space-y-4">
              <div>
                <label className={`block text-xs ${textMuted} mb-1`}>Nama Family Keluarga Besar</label>
                <input
                  value={config.extFamilyName}
                  onChange={(e) => setConfig((p) => ({ ...p, extFamilyName: e.target.value }))}
                  placeholder="mis. Trah Kartodikromo"
                  className={inputCls}
                />
              </div>
              <NumFieldInline label="Jumlah Orang Tua" value={config.parentCount} onChange={(v) => setConfig((p) => ({ ...p, parentCount: v }))} dark={dark} />
              <NumFieldInline label="Jumlah Saudara (Kakak)" value={config.olderCount} onChange={(v) => setConfig((p) => ({ ...p, olderCount: v }))} dark={dark} />
              <NumFieldInline label="Jumlah Saudara (Adik)" value={config.youngerCount} onChange={(v) => setConfig((p) => ({ ...p, youngerCount: v }))} dark={dark} />
            </div>

            <div className="mt-6">
              <button onClick={() => setStep('create-simbah')} className={btnPrimary}>
                Simpan dan Lanjut <ArrowRight size={16} />
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Step: Create Simbah Family
  if (step === 'create-simbah') {
    return (
      <div className={overlay} style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}>
        <div className={panelCls}>
          <div className="p-6">
            <ProgressBar current={3} total={3} dark={dark} />

            <div className="flex items-center gap-3 mb-4 mt-4">
              <button onClick={() => setStep('create-ext')} className={`w-8 h-8 flex items-center justify-center rounded-full ${dark ? 'hover:bg-white/10 text-white/60' : 'hover:bg-slate-100 text-slate-400'}`}>
                <ArrowLeft size={18} />
              </button>
              <h2 className={`text-lg font-bold ${textMain}`}>Keluarga Simbah</h2>
            </div>

            <div className="space-y-4">
              <NumFieldInline label="Jumlah Simbah (Kakek-Nenek) dari pihak Ayah" value={config.simbahP} onChange={(v) => setConfig((p) => ({ ...p, simbahP: v }))} dark={dark} />
              <NumFieldInline label="Jumlah Simbah dari pihak Ibu" value={config.simbahM} onChange={(v) => setConfig((p) => ({ ...p, simbahM: v }))} dark={dark} />
            </div>

            <p className={`text-xs ${textMuted} italic mt-4`}>
              Catatan: jumlah di atas termasuk anggota keluarga yang sudah meninggal dunia.
            </p>

            <div className="mt-6">
              <button onClick={handleSaveAndBuild} className={btnPrimary}>
                <Check size={16} />Simpan dan Bangun
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return null;
}

// ─── Sub-components ─────────────────────────────────────────

function ProgressBar({ current, total, dark }: { current: number; total: number; dark: boolean }) {
  return (
    <div className="flex items-center gap-2">
      {Array.from({ length: total }, (_, i) => (
        <div
          key={i}
          className={`h-1.5 flex-1 rounded-full transition-colors ${
            i < current
              ? 'bg-blue-500'
              : dark
                ? 'bg-white/10'
                : 'bg-slate-200'
          }`}
        />
      ))}
    </div>
  );
}

function NumFieldInline({ label, value, onChange, dark }: { label: string; value: number; onChange: (v: number) => void; dark: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3 py-1.5">
      <label className={`text-sm ${dark ? 'text-white/70' : 'text-slate-600'}`}>{label}</label>
      <div className={`flex items-center rounded-lg border overflow-hidden ${dark ? 'border-white/15' : 'border-slate-200'}`}>
        <button type="button" onClick={() => onChange(Math.max(0, value - 1))} className={`w-8 h-8 flex items-center justify-center ${dark ? 'text-white/60 hover:bg-white/10' : 'text-slate-500 hover:bg-slate-100'}`}>
          <Minus size={13} />
        </button>
        <input
          type="number"
          min={0}
          value={value}
          onChange={(e) => onChange(Math.max(0, parseInt(e.target.value) || 0))}
          className={`w-12 h-8 text-center text-sm bg-transparent outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none ${dark ? 'text-white' : 'text-slate-900'}`}
        />
        <button type="button" onClick={() => onChange(value + 1)} className={`w-8 h-8 flex items-center justify-center ${dark ? 'text-white/60 hover:bg-white/10' : 'text-slate-500 hover:bg-slate-100'}`}>
          <Plus size={13} />
        </button>
      </div>
    </div>
  );
}
