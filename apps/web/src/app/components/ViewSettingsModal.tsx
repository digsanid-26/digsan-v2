'use client';

import { useState, useEffect } from 'react';
import { X, Settings, Eye, EyeOff } from 'lucide-react';

const STORAGE_KEY = 'profile_visibility';

export interface VisibilitySettings {
  bio: boolean;
  birthPlace: boolean;
  birthDate: boolean;
  occupation: boolean;
  education: boolean;
  hobbies: boolean;
}

const DEFAULT_SETTINGS: VisibilitySettings = {
  bio: true,
  birthPlace: true,
  birthDate: true,
  occupation: true,
  education: true,
  hobbies: true,
};

const FIELDS: { key: keyof VisibilitySettings; label: string; desc: string }[] = [
  { key: 'bio', label: 'Bio / Sekilas Info', desc: 'Cerita singkat tentang diri Anda' },
  { key: 'birthPlace', label: 'Tempat Lahir', desc: 'Kota atau daerah tempat Anda lahir' },
  { key: 'birthDate', label: 'Tanggal Lahir', desc: 'Tanggal lengkap kelahiran Anda' },
  { key: 'occupation', label: 'Pekerjaan', desc: 'Profesi atau pekerjaan saat ini' },
  { key: 'education', label: 'Pendidikan', desc: 'Riwayat pendidikan terakhir' },
  { key: 'hobbies', label: 'Hobi / Kegemaran', desc: 'Aktivitas atau kesukaan Anda' },
];

interface Props {
  open: boolean;
  onClose: () => void;
}

export function loadVisibilitySettings(): VisibilitySettings {
  if (typeof window === 'undefined') return DEFAULT_SETTINGS;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch { /* ignore */ }
  return DEFAULT_SETTINGS;
}

export function saveVisibilitySettings(settings: VisibilitySettings) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch { /* ignore */ }
}

export default function ViewSettingsModal({ open, onClose }: Props) {
  const [settings, setSettings] = useState<VisibilitySettings>(DEFAULT_SETTINGS);

  useEffect(() => {
    if (!open) return;
    setSettings(loadVisibilitySettings());
  }, [open]);

  const toggle = (key: keyof VisibilitySettings) => {
    setSettings((prev) => {
      const next = { ...prev, [key]: !prev[key] };
      saveVisibilitySettings(next);
      return next;
    });
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50" onClick={onClose}>
      <div
        className="bg-white dark:bg-[#0a0e1a] rounded-2xl shadow-2xl w-full max-w-md mx-4 max-h-[90vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-white/10 shrink-0">
          <div className="flex items-center gap-2">
            <Settings size={20} className="text-slate-600 dark:text-white/60" />
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Pengaturan View</h2>
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full text-slate-400 hover:text-slate-900 hover:bg-slate-100 dark:text-white/50 dark:hover:text-white dark:hover:bg-white/10">
            <X size={20} />
          </button>
        </div>

        <div className="overflow-y-auto flex-1 px-6 py-5">
          <p className="text-sm text-slate-500 dark:text-white/50 mb-4">
            Atur informasi profil yang dapat dilihat oleh pengguna lain dan publik.
          </p>
          <div className="space-y-3">
            {FIELDS.map((field) => {
              const visible = settings[field.key];
              return (
                <div
                  key={field.key}
                  className="flex items-center justify-between rounded-xl border border-slate-200 dark:border-white/10 px-4 py-3"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-slate-900 dark:text-white">{field.label}</p>
                    <p className="text-xs text-slate-400 dark:text-white/40">{field.desc}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => toggle(field.key)}
                    className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${
                      visible ? 'bg-blue-600' : 'bg-slate-300 dark:bg-white/15'
                    }`}
                  >
                    <span
                      className={`inline-flex h-4 w-4 transform items-center justify-center rounded-full bg-white transition-transform ${
                        visible ? 'translate-x-6' : 'translate-x-1'
                      }`}
                    >
                      {visible ? <Eye size={10} className="text-blue-600" /> : <EyeOff size={10} className="text-slate-400" />}
                    </span>
                  </button>
                </div>
              );
            })}
          </div>
        </div>

        <div className="flex justify-end px-6 py-4 border-t border-slate-200 dark:border-white/10 shrink-0">
          <button onClick={onClose}
            className="px-5 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg">
            Selesai
          </button>
        </div>
      </div>
    </div>
  );
}
