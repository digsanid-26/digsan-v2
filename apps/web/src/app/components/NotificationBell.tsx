'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import { Bell, CheckCheck, X } from 'lucide-react';
import { getTokens } from '@/lib/auth';
import { formatDistanceToNow } from 'date-fns';
import { id as localeId } from 'date-fns/locale';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';

interface NotifItem {
  id: string;
  type: string;
  title: string;
  message: string;
  isRead: boolean;
  createdAt: string;
}

export default function NotificationBell({ dark }: { dark: boolean }) {
  const [unread, setUnread] = useState(0);
  const [list, setList] = useState<NotifItem[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const pollRef = useRef<ReturnType<typeof setInterval>>(null);

  const fetchUnread = useCallback(async () => {
    const tokens = getTokens();
    if (!tokens?.accessToken) return;
    try {
      const res = await fetch(`${API_URL}/notifications/unread-count`, {
        headers: { Authorization: `Bearer ${tokens.accessToken}` },
      });
      const data = await res.json();
      setUnread(data.unreadCount ?? 0);
    } catch {}
  }, []);

  const fetchList = useCallback(async () => {
    const tokens = getTokens();
    if (!tokens?.accessToken) return;
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/notifications?limit=8`, {
        headers: { Authorization: `Bearer ${tokens.accessToken}` },
      });
      const data = await res.json();
      setList(data.notifications ?? []);
    } catch {}
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    fetchUnread();
    pollRef.current = setInterval(fetchUnread, 30000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [fetchUnread]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const toggle = () => {
    if (!open) fetchList();
    setOpen((v) => !v);
  };

  const markRead = async (id: string) => {
    const tokens = getTokens();
    if (!tokens?.accessToken) return;
    try {
      await fetch(`${API_URL}/notifications/${id}/read`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${tokens.accessToken}` },
      });
      setList((prev) => prev.map((n) => n.id === id ? { ...n, isRead: true } : n));
      setUnread((u) => Math.max(0, u - 1));
    } catch {}
  };

  const markAllRead = async () => {
    const tokens = getTokens();
    if (!tokens?.accessToken) return;
    try {
      await fetch(`${API_URL}/notifications/read-all`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${tokens.accessToken}` },
      });
      setList((prev) => prev.map((n) => ({ ...n, isRead: true })));
      setUnread(0);
    } catch {}
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={toggle}
        className={`relative w-9 h-9 rounded-full flex items-center justify-center transition-all
          ${dark
            ? 'bg-white/5 hover:bg-white/10 text-white/70 hover:text-white'
            : 'bg-slate-100 hover:bg-slate-200 text-slate-600 hover:text-slate-900'
          }`}
        aria-label="Notifikasi"
      >
        <Bell size={18} />
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
            {unread > 99 ? '99+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div className={`absolute right-0 mt-2 w-80 max-w-[calc(100vw-2rem)] rounded-2xl overflow-hidden border shadow-2xl z-50 backdrop-blur-xl
          ${dark ? 'bg-[#0f1629]/95 border-white/10' : 'bg-white/95 border-slate-200'}`}
        >
          {/* Header */}
          <div className={`flex items-center justify-between px-4 py-3 border-b ${dark ? 'border-white/10' : 'border-slate-100'}`}>
            <h3 className={`text-sm font-semibold ${dark ? 'text-white' : 'text-slate-900'}`}>Notifikasi</h3>
            <div className="flex items-center gap-2">
              {unread > 0 && (
                <button
                  onClick={markAllRead}
                  className={`text-xs flex items-center gap-1 ${dark ? 'text-blue-400 hover:text-blue-300' : 'text-blue-600 hover:text-blue-500'}`}
                >
                  <CheckCheck size={13} />Tandai dibaca
                </button>
              )}
              <button onClick={() => setOpen(false)} className={`p-0.5 ${dark ? 'text-white/40 hover:text-white' : 'text-slate-400 hover:text-slate-600'}`}>
                <X size={15} />
              </button>
            </div>
          </div>

          {/* List */}
          <div className="max-h-80 overflow-y-auto">
            {loading ? (
              <div className="flex justify-center py-8">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500" />
              </div>
            ) : list.length === 0 ? (
              <div className={`text-center py-8 ${dark ? 'text-white/40' : 'text-slate-400'}`}>
                <Bell size={32} className="mx-auto mb-2 opacity-40" />
                <p className="text-sm">Tidak ada notifikasi</p>
              </div>
            ) : (
              list.map((n) => (
                <div
                  key={n.id}
                  className={`flex items-start gap-3 px-4 py-3 cursor-pointer transition-colors border-b last:border-0
                    ${dark ? 'border-white/[0.04] hover:bg-white/5' : 'border-slate-50 hover:bg-slate-50'}
                    ${!n.isRead ? (dark ? 'bg-blue-500/[0.08]' : 'bg-blue-50/50') : ''}`}
                  onClick={() => { if (!n.isRead) markRead(n.id); }}
                >
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0
                    ${!n.isRead ? (dark ? 'bg-blue-500/20' : 'bg-blue-100') : (dark ? 'bg-white/5' : 'bg-slate-100')}`}
                  >
                    <Bell size={14} className={!n.isRead ? (dark ? 'text-blue-400' : 'text-blue-600') : (dark ? 'text-white/30' : 'text-slate-400')} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-medium truncate ${dark ? 'text-white' : 'text-slate-900'}`}>{n.title}</p>
                    <p className={`text-xs mt-0.5 line-clamp-2 ${dark ? 'text-white/50' : 'text-slate-500'}`}>{n.message}</p>
                    <p className={`text-[10px] mt-1 ${dark ? 'text-white/30' : 'text-slate-400'}`}>
                      {formatDistanceToNow(new Date(n.createdAt), { addSuffix: true, locale: localeId })}
                    </p>
                  </div>
                  {!n.isRead && <div className="w-2 h-2 rounded-full bg-blue-500 shrink-0 mt-2" />}
                </div>
              ))
            )}
          </div>

          {/* Footer */}
          <Link
            href="/notifications"
            onClick={() => setOpen(false)}
            className={`block text-center py-2.5 text-sm font-medium border-t transition-colors
              ${dark ? 'border-white/10 text-blue-400 hover:bg-white/5' : 'border-slate-100 text-blue-600 hover:bg-slate-50'}`}
          >
            Lihat semua notifikasi
          </Link>
        </div>
      )}
    </div>
  );
}
