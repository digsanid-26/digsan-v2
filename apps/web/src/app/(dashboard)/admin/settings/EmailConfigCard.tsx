'use client';

import { useState, useEffect } from 'react';
import { useApi, useAuthApi } from '@/lib/hooks';
import {
  Mail, Link2, Send, Save, CheckCircle2, AlertCircle, Copy, Unplug, Loader2,
} from 'lucide-react';

interface EmailStatus {
  provider: string;
  connected: boolean;
  connectedEmail: string | null;
  hasClientId: boolean;
  hasClientSecret: boolean;
  redirectUri: string;
  smtpEnvHost: string | null;
}

export default function EmailConfigCard() {
  const { data: status, loading, refetch } = useApi<EmailStatus>('/admin/email/status');
  const { request } = useAuthApi();

  const [clientId, setClientId] = useState('');
  const [clientSecret, setClientSecret] = useState('');
  const [testTo, setTestTo] = useState('');
  const [savingCreds, setSavingCreds] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [testing, setTesting] = useState(false);
  const [copied, setCopied] = useState(false);
  const [msg, setMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  // Read OAuth callback result from the URL (?email=connected|error).
  useEffect(() => {
    const sp = new URLSearchParams(window.location.search);
    const e = sp.get('email');
    if (e === 'connected') {
      const addr = sp.get('addr');
      setMsg({ type: 'ok', text: `Gmail berhasil terhubung${addr ? `: ${addr}` : ''}` });
    } else if (e === 'error') {
      setMsg({ type: 'err', text: sp.get('msg') || 'Gagal menghubungkan Gmail' });
    }
    if (e) {
      const url = new URL(window.location.href);
      url.searchParams.delete('email');
      url.searchParams.delete('addr');
      url.searchParams.delete('msg');
      window.history.replaceState({}, '', url.toString());
    }
  }, []);

  const saveCreds = async () => {
    setSavingCreds(true); setMsg(null);
    try {
      await request('/admin/email/credentials', {
        method: 'POST',
        body: JSON.stringify({ clientId, clientSecret }),
      });
      setClientId(''); setClientSecret('');
      setMsg({ type: 'ok', text: 'Kredensial Google berhasil disimpan' });
      refetch();
    } catch (err: any) {
      setMsg({ type: 'err', text: err.message });
    } finally {
      setSavingCreds(false);
    }
  };

  const connect = async () => {
    setConnecting(true); setMsg(null);
    try {
      const { url } = await request<{ url: string }>('/admin/email/gmail/connect');
      window.location.href = url;
    } catch (err: any) {
      setMsg({ type: 'err', text: err.message });
      setConnecting(false);
    }
  };

  const disconnect = async () => {
    if (!confirm('Putuskan koneksi Gmail? Email akan kembali ke SMTP/env atau mode log.')) return;
    setDisconnecting(true); setMsg(null);
    try {
      await request('/admin/email/gmail/disconnect', { method: 'POST' });
      setMsg({ type: 'ok', text: 'Koneksi Gmail diputus' });
      refetch();
    } catch (err: any) {
      setMsg({ type: 'err', text: err.message });
    } finally {
      setDisconnecting(false);
    }
  };

  const sendTest = async () => {
    if (!testTo.trim()) return;
    setTesting(true); setMsg(null);
    try {
      const r = await request<{ message: string }>('/admin/email/test', {
        method: 'POST',
        body: JSON.stringify({ to: testTo.trim() }),
      });
      setMsg({ type: 'ok', text: r.message });
    } catch (err: any) {
      setMsg({ type: 'err', text: err.message });
    } finally {
      setTesting(false);
    }
  };

  const copyRedirect = async () => {
    if (!status?.redirectUri) return;
    try {
      await navigator.clipboard.writeText(status.redirectUri);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch { /* ignore */ }
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-5">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-rose-50 flex items-center justify-center">
          <Mail size={20} className="text-rose-600" />
        </div>
        <div>
          <h2 className="font-semibold text-slate-900">Konfigurasi Email (Gmail OAuth)</h2>
          <p className="text-xs text-slate-500">Hubungkan akun Google untuk mengirim email dari Digsan</p>
        </div>
      </div>

      {msg && (
        <div className={`flex items-start gap-2 rounded-lg px-3 py-2 text-sm ${
          msg.type === 'ok' ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'
        }`}>
          {msg.type === 'ok' ? <CheckCircle2 size={16} className="mt-0.5 shrink-0" /> : <AlertCircle size={16} className="mt-0.5 shrink-0" />}
          <span>{msg.text}</span>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-6">
          <Loader2 size={22} className="animate-spin text-blue-600" />
        </div>
      ) : (
        <>
          {/* Redirect URI helper */}
          <div className="rounded-lg bg-slate-50 border border-slate-200 p-3">
            <p className="text-xs font-medium text-slate-600 mb-1">Authorized redirect URI (daftarkan di Google Cloud Console)</p>
            <div className="flex items-center gap-2">
              <code className="flex-1 text-xs text-slate-700 break-all">{status?.redirectUri}</code>
              <button onClick={copyRedirect} className="flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium bg-white border border-slate-200 text-slate-600 hover:bg-slate-100 shrink-0">
                {copied ? <CheckCircle2 size={13} className="text-emerald-500" /> : <Copy size={13} />}
                {copied ? 'Tersalin' : 'Salin'}
              </button>
            </div>
          </div>

          {/* Connected state */}
          {status?.connected ? (
            <div className="flex items-center justify-between gap-3 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3">
              <div className="flex items-center gap-2 min-w-0">
                <CheckCircle2 size={18} className="text-emerald-600 shrink-0" />
                <div className="min-w-0">
                  <p className="text-sm font-medium text-emerald-800">Terhubung</p>
                  <p className="text-xs text-emerald-700 truncate">{status.connectedEmail}</p>
                </div>
              </div>
              <button onClick={disconnect} disabled={disconnecting}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-white border border-rose-200 text-rose-600 hover:bg-rose-50 disabled:opacity-50 shrink-0">
                <Unplug size={14} />{disconnecting ? 'Memutus...' : 'Putuskan'}
              </button>
            </div>
          ) : (
            <>
              {/* Credentials form */}
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Google Client ID</label>
                  <input value={clientId} onChange={(e) => setClientId(e.target.value)}
                    placeholder={status?.hasClientId ? '•••• (tersimpan — isi untuk mengganti)' : 'xxxxx.apps.googleusercontent.com'}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Google Client Secret</label>
                  <input type="password" value={clientSecret} onChange={(e) => setClientSecret(e.target.value)}
                    placeholder={status?.hasClientSecret ? '•••• (tersimpan — isi untuk mengganti)' : 'GOCSPX-...'}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
                </div>
                <button onClick={saveCreds} disabled={savingCreds || !clientId.trim() || !clientSecret.trim()}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium bg-slate-800 text-white hover:bg-slate-700 disabled:opacity-50">
                  <Save size={15} />{savingCreds ? 'Menyimpan...' : 'Simpan Kredensial'}
                </button>
              </div>

              {/* Connect button */}
              <button onClick={connect} disabled={connecting || !(status?.hasClientId && status?.hasClientSecret)}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 transition-colors">
                {connecting ? <Loader2 size={16} className="animate-spin" /> : <Link2 size={16} />}
                {connecting ? 'Mengalihkan ke Google...' : 'Connect with Google'}
              </button>
              {!(status?.hasClientId && status?.hasClientSecret) && (
                <p className="text-xs text-slate-400 -mt-2">Simpan Client ID & Secret terlebih dahulu untuk mengaktifkan tombol Connect.</p>
              )}
            </>
          )}

          {/* Test email */}
          <div className="pt-4 border-t border-slate-100">
            <label className="block text-xs font-medium text-slate-600 mb-1">Kirim email tes</label>
            <div className="flex gap-2">
              <input type="email" value={testTo} onChange={(e) => setTestTo(e.target.value)}
                placeholder="email@tujuan.com"
                className="flex-1 px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
              <button onClick={sendTest} disabled={testing || !testTo.trim()}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50 shrink-0">
                <Send size={15} />{testing ? 'Mengirim...' : 'Kirim'}
              </button>
            </div>
            <p className="text-xs text-slate-400 mt-1">Provider aktif saat ini: <span className="font-medium text-slate-500">{status?.provider}</span></p>
          </div>
        </>
      )}
    </div>
  );
}
