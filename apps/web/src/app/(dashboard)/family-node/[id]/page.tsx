'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { treeApi, type FamilyNodeData, type UpdateFamilyNodePayload } from '@/lib/tree';
import {
  ArrowLeft, Camera, Save, Loader2, Users, Heart,
  Check, Image as ImageIcon, Lock,
} from 'lucide-react';

const MARRIAGE_STATUS_OPTIONS: { value: UpdateFamilyNodePayload['marriageStatus']; label: string }[] = [
  { value: 'NONE', label: 'Tanpa Status' },
  { value: 'ONGOING', label: 'Berlangsung' },
  { value: 'DIVORCED', label: 'Cerai Hidup' },
  { value: 'WIDOWED', label: 'Cerai Mati' },
];

export default function FamilyNodeEditPage() {
  const { id } = useParams<{ id: string }>();

  const [data, setData] = useState<FamilyNodeData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedMsg, setSavedMsg] = useState('');

  const [form, setForm] = useState<UpdateFamilyNodePayload>({
    name: '',
    description: '',
    isPublic: false,
    coverImage: '',
    familyImage: '',
    familyBio: '',
    marriageDate: '',
    marriageStatus: 'NONE',
    headName: '',
  });

  const [slugInput, setSlugInput] = useState('');
  const [slugSaving, setSlugSaving] = useState(false);
  const [slugMsg, setSlugMsg] = useState('');
  const canEdit = data?.canEdit !== false;

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const node = await treeApi.getFamilyNode(id);
      setData(node);
      setForm({
        name: node.name || '',
        description: node.description || '',
        isPublic: node.isPublic ?? false,
        coverImage: node.coverImage || '',
        familyImage: node.familyImage || '',
        familyBio: node.familyBio || '',
        marriageDate: node.marriageDate ? new Date(node.marriageDate).toISOString().split('T')[0] : '',
        marriageStatus: (node.marriageStatus as UpdateFamilyNodePayload['marriageStatus']) || 'NONE',
        headName: node.headName || '',
      });
      setSlugInput(node.slug || '');
    } catch (e: any) {
      setError(e.message || 'Gagal memuat data family node');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const handleSave = async () => {
    if (!id) return;
    setSaving(true);
    setError(null);
    setSavedMsg('');
    try {
      const updated = await treeApi.updateFamilyNode(id, form);
      setData(updated);
      setSavedMsg('Family Node berhasil diperbarui');
      setTimeout(() => setSavedMsg(''), 3000);
    } catch (e: any) {
      setError(e.message || 'Gagal menyimpan');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveSlug = async () => {
    if (!id) return;
    setSlugSaving(true);
    setSlugMsg('');
    try {
      await treeApi.setSlug(slugInput || undefined);
      setSlugMsg('Slug berhasil diperbarui');
      setTimeout(() => setSlugMsg(''), 3000);
      load();
    } catch (e: any) {
      setSlugMsg(e.message || 'Gagal menyimpan slug');
    } finally {
      setSlugSaving(false);
    }
  };

  const handleImageUpload = (field: 'familyImage' | 'coverImage') => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      if (file.size > 2 * 1024 * 1024) {
        setError('Ukuran gambar maksimal 2MB');
        return;
      }
      const reader = new FileReader();
      reader.onload = () => {
        const dataUrl = reader.result as string;
        setForm((f) => ({ ...f, [field]: dataUrl }));
      };
      reader.onerror = () => setError('Gagal memuat gambar');
      reader.readAsDataURL(file);
    };
    input.click();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh] text-white/50">
        <Loader2 className="animate-spin mr-2" size={20} /> Memuat Family Node…
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
        <Users size={40} className="text-white/25 mb-3" />
        <p className="text-white/50 text-sm mb-4">{error}</p>
        <Link href="/tree" className="text-blue-400 hover:underline text-sm">Kembali ke Tree</Link>
      </div>
    );
  }

  const inputCls = `w-full px-3 py-2.5 rounded-lg text-sm outline-none border bg-white/5 border-white/15 text-white placeholder-white/30 focus:border-blue-500/50 transition-colors`;

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8">
      {/* Back link */}
      <Link href="/tree" className="inline-flex items-center gap-1.5 text-white/50 hover:text-white text-sm mb-6 transition-colors">
        <ArrowLeft size={16} /> Kembali ke Tree
      </Link>

      <h1 className="text-2xl font-bold text-white mb-1">Family Node</h1>
      <p className="text-white/40 text-sm mb-8">
        {canEdit ? 'Kelola profil keluarga utama Anda' : 'Pratinjau profil keluarga (read-only)'}
      </p>
      {!canEdit && (
        <div className="mb-6 rounded-lg border border-amber-400/30 bg-amber-400/10 px-4 py-3 text-sm text-amber-300 flex items-center gap-2">
          <Lock size={15} /> Hanya kepala keluarga yang dapat mengedit Family Node ini.
        </div>
      )}

      {error && (
        <div className="mb-4 rounded-lg border border-red-400/30 bg-red-400/10 px-4 py-3 text-sm text-red-300">
          {error}
        </div>
      )}
      {savedMsg && (
        <div className="mb-4 rounded-lg border border-emerald-400/30 bg-emerald-400/10 px-4 py-3 text-sm text-emerald-300 flex items-center gap-2">
          <Check size={15} /> {savedMsg}
        </div>
      )}

      {/* Family Image & Cover */}
      <section className="mb-6 rounded-2xl border border-white/10 bg-white/[0.02] p-6">
        <h2 className="text-white font-semibold mb-4 flex items-center gap-2">
          <ImageIcon size={18} /> Gambar Family
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Family Image */}
          <div>
            <label className="text-white/50 text-xs mb-2 block">Family Image</label>
            <div
              onClick={() => canEdit && handleImageUpload('familyImage')}
              className="relative w-full h-32 rounded-xl border border-white/10 bg-white/5 cursor-pointer hover:border-white/20 transition-colors overflow-hidden group"
            >
              {form.familyImage ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={form.familyImage} alt="Family" className="w-full h-full object-cover" />
              ) : (
                <div className="flex items-center justify-center h-full text-white/30">
                  <Camera size={24} />
                </div>
              )}
              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                <span className="text-white text-xs">Ganti Gambar</span>
              </div>
            </div>
          </div>
          {/* Cover Image */}
          <div>
            <label className="text-white/50 text-xs mb-2 block">Cover Image</label>
            <div
              onClick={() => canEdit && handleImageUpload('coverImage')}
              className="relative w-full h-32 rounded-xl border border-white/10 bg-white/5 cursor-pointer hover:border-white/20 transition-colors overflow-hidden group"
            >
              {form.coverImage ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={form.coverImage} alt="Cover" className="w-full h-full object-cover" />
              ) : (
                <div className="flex items-center justify-center h-full text-white/30">
                  <Camera size={24} />
                </div>
              )}
              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                <span className="text-white text-xs">Ganti Cover</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Basic Info */}
      <section className="mb-6 rounded-2xl border border-white/10 bg-white/[0.02] p-6 space-y-4">
        <h2 className="text-white font-semibold mb-2">Informasi Dasar</h2>

        <div>
          <label className="text-white/50 text-xs mb-1.5 block">Nama Family</label>
          <input
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            className={inputCls}
            placeholder="Keluarga Besar Sutrisno"
            disabled={!canEdit}
          />
        </div>

        <div>
          <label className="text-white/50 text-xs mb-1.5 block">Nama Kepala Keluarga</label>
          <input
            value={form.headName}
            onChange={(e) => setForm((f) => ({ ...f, headName: e.target.value }))}
            className={inputCls}
            placeholder="Budi Sutrisno"
            disabled={!canEdit}
          />
        </div>

        <div>
          <label className="text-white/50 text-xs mb-1.5 block">Deskripsi</label>
          <textarea
            value={form.description}
            onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            className={`${inputCls} min-h-[80px] resize-y`}
            placeholder="Silsilah keluarga dari kakek Sutrisno"
            disabled={!canEdit}
          />
        </div>

        <div>
          <label className="text-white/50 text-xs mb-1.5 block">Family Bio</label>
          <textarea
            value={form.familyBio}
            onChange={(e) => setForm((f) => ({ ...f, familyBio: e.target.value }))}
            className={`${inputCls} min-h-[100px] resize-y`}
            placeholder="Cerita singkat tentang keluarga Anda"
            disabled={!canEdit}
          />
        </div>
      </section>

      {/* Marriage Info */}
      <section className="mb-6 rounded-2xl border border-white/10 bg-white/[0.02] p-6 space-y-4">
        <h2 className="text-white font-semibold mb-2 flex items-center gap-2">
          <Heart size={18} /> Informasi Pernikahan
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="text-white/50 text-xs mb-1.5 block">Tanggal Pernikahan</label>
            <input
              type="date"
              value={form.marriageDate}
              onChange={(e) => setForm((f) => ({ ...f, marriageDate: e.target.value }))}
              className={inputCls}
              disabled={!canEdit}
            />
          </div>
          <div>
            <label className="text-white/50 text-xs mb-1.5 block">Status Pernikahan</label>
            <select
              value={form.marriageStatus}
              onChange={(e) => setForm((f) => ({ ...f, marriageStatus: e.target.value as UpdateFamilyNodePayload['marriageStatus'] }))}
              className={inputCls}
              disabled={!canEdit}
            >
              {MARRIAGE_STATUS_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value} className="bg-[#0a0a16]">
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </section>

      {/* Slug & Visibility */}
      <section className="mb-6 rounded-2xl border border-white/10 bg-white/[0.02] p-6 space-y-4">
        <h2 className="text-white font-semibold mb-2">URL & Visibilitas</h2>

        <div>
          <label className="text-white/50 text-xs mb-1.5 block">Slug (URL publik)</label>
          <div className="flex gap-2">
            <input
              value={slugInput}
              onChange={(e) => setSlugInput(e.target.value)}
              className={inputCls}
              placeholder="keluarga-sutrisno"
              disabled={!canEdit}
            />
            <button
              onClick={handleSaveSlug}
              disabled={slugSaving || !canEdit}
              className="px-4 py-2.5 rounded-lg text-sm font-medium bg-white/10 hover:bg-white/15 text-white transition-colors disabled:opacity-50 whitespace-nowrap"
            >
              {slugSaving ? 'Menyimpan…' : 'Simpan Slug'}
            </button>
          </div>
          {slugMsg && <p className="text-xs mt-1.5 text-white/50">{slugMsg}</p>}
          {data?.slug && (
            <p className="text-xs mt-1.5 text-white/30">
              URL publik: /family/{data.slug}
            </p>
          )}
        </div>

        <div>
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={form.isPublic}
              onChange={(e) => setForm((f) => ({ ...f, isPublic: e.target.checked }))}
              className="w-4 h-4 rounded accent-blue-500"
              disabled={!canEdit}
            />
            <span className="text-sm text-white/70">Publik (dapat diakses oleh siapa pun dengan link)</span>
          </label>
        </div>
      </section>

      {/* Member List */}
      {data && Array.isArray(data.members) && data.members.length > 0 && (
        <section className="mb-6 rounded-2xl border border-white/10 bg-white/[0.02] p-6">
          <h2 className="text-white font-semibold mb-1">Anggota Terdaftar</h2>
          <p className="text-xs text-white/40 mb-4">
            Anggota inti (kepala keluarga, pasangan, dan anak-anak) terdeteksi otomatis dari silsilah
            di /tree dan menjadi anggota tetap Family Node ini.
          </p>
          <div className="space-y-2">
            {data.members.map((m) => (
              <div key={m.id} className="flex items-center gap-3 rounded-lg bg-white/5 px-3 py-2.5">
                {m.photo ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={m.photo} alt={m.name} className="w-8 h-8 rounded-full object-cover" />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center">
                    <Users size={14} className="text-white/40" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-white/80 truncate">{m.name}</p>
                  <p className="text-xs text-white/40">{m.familyRole || 'Anggota'}</p>
                </div>
                {m.isCore && (
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 shrink-0">
                    Anggota Tetap
                  </span>
                )}
                {m.accountStatus && (
                  <span className={`text-[10px] px-2 py-0.5 rounded-full ${
                    m.accountStatus === 'ACTIVE' ? 'bg-emerald-500/20 text-emerald-300' :
                    m.accountStatus === 'EARLY_ACCESS' ? 'bg-amber-500/20 text-amber-300' :
                    'bg-white/10 text-white/40'
                  }`}>
                    {m.accountStatus}
                  </span>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Save button */}
      {canEdit && (
      <div className="sticky bottom-4 flex justify-end">
        <button
          onClick={handleSave}
          disabled={saving}
          className="inline-flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-medium bg-blue-600 hover:bg-blue-500 disabled:bg-blue-600/50 text-white transition-colors shadow-lg"
        >
          {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
          {saving ? 'Menyimpan…' : 'Simpan Perubahan'}
        </button>
      </div>
      )}
    </div>
  );
}
