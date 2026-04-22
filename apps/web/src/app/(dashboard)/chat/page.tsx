'use client';

import { useState } from 'react';
import { useApi, useAuthApi } from '@/lib/hooks';
import { useAuth } from '@/components/providers/auth-provider';
import { MessageSquare, Plus, Send, ArrowLeft, Users } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { id as localeId } from 'date-fns/locale';

export default function ChatPage() {
  const { user } = useAuth();
  const { data: rooms, loading, refetch } = useApi<any[]>('/chat/rooms');
  const { request } = useAuthApi();

  const [selectedRoom, setSelectedRoom] = useState<any>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [msgLoading, setMsgLoading] = useState(false);
  const [newMsg, setNewMsg] = useState('');
  const [sending, setSending] = useState(false);

  const loadMessages = async (room: any) => {
    setSelectedRoom(room);
    setMsgLoading(true);
    try {
      const res = await request(`/chat/rooms/${room.id}/messages`);
      setMessages((res.messages ?? []).reverse());
      // Mark as read
      await request(`/chat/rooms/${room.id}/read`, { method: 'POST' }).catch(() => {});
    } catch (err: any) {
      console.error(err);
    } finally {
      setMsgLoading(false);
    }
  };

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMsg.trim() || !selectedRoom) return;
    setSending(true);
    try {
      const msg = await request(`/chat/rooms/${selectedRoom.id}/messages`, {
        method: 'POST',
        body: JSON.stringify({ content: newMsg }),
      });
      setMessages((prev) => [...prev, msg]);
      setNewMsg('');
      refetch();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSending(false);
    }
  };

  const getRoomName = (room: any) => {
    if (room.name) return room.name;
    if (room.type === 'DIRECT') {
      const other = room.members?.find((m: any) => m.userId !== user?.id);
      return other?.user?.name || 'Direct Message';
    }
    return 'Chat Room';
  };

  // ─── ROOM LIST VIEW ─────────────────────────────────────────
  if (!selectedRoom) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Chat</h1>
            <p className="text-slate-500 mt-1">Percakapan Anda</p>
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
          </div>
        ) : !rooms?.length ? (
          <div className="text-center py-16 bg-white rounded-xl border border-slate-200">
            <MessageSquare size={48} className="mx-auto text-slate-300 mb-4" />
            <h3 className="text-lg font-medium text-slate-900">Belum ada percakapan</h3>
            <p className="text-slate-500 mt-1">Mulai chat dari halaman profil pengguna</p>
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-slate-200 divide-y divide-slate-100">
            {rooms.map((room: any) => (
              <button
                key={room.id}
                onClick={() => loadMessages(room)}
                className="w-full flex items-center gap-3 p-4 hover:bg-slate-50 transition-colors text-left"
              >
                <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
                  {room.type === 'DIRECT' ? (
                    <MessageSquare size={18} className="text-blue-600" />
                  ) : (
                    <Users size={18} className="text-blue-600" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium text-slate-900 truncate">
                      {getRoomName(room)}
                    </p>
                    {room.lastMessage && (
                      <span className="text-xs text-slate-400 shrink-0 ml-2">
                        {formatDistanceToNow(new Date(room.lastMessage.createdAt), {
                          addSuffix: true,
                          locale: localeId,
                        })}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-500 truncate mt-0.5">
                    {room.lastMessage?.content || 'Belum ada pesan'}
                  </p>
                </div>
                {room.unreadCount > 0 && (
                  <span className="shrink-0 w-5 h-5 bg-blue-600 text-white rounded-full flex items-center justify-center text-xs font-medium">
                    {room.unreadCount}
                  </span>
                )}
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }

  // ─── CONVERSATION VIEW ──────────────────────────────────────
  return (
    <div className="flex flex-col h-[calc(100vh-4rem)]">
      {/* Header */}
      <div className="flex items-center gap-3 pb-4 border-b border-slate-200">
        <button
          onClick={() => { setSelectedRoom(null); refetch(); }}
          className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
        >
          <ArrowLeft size={20} className="text-slate-600" />
        </button>
        <div className="w-9 h-9 rounded-full bg-blue-100 flex items-center justify-center">
          <MessageSquare size={16} className="text-blue-600" />
        </div>
        <div>
          <p className="text-sm font-semibold text-slate-900">{getRoomName(selectedRoom)}</p>
          <p className="text-xs text-slate-500">
            {selectedRoom.members?.length || 0} anggota
          </p>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto py-4 space-y-3">
        {msgLoading ? (
          <div className="flex justify-center py-8">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600" />
          </div>
        ) : !messages.length ? (
          <p className="text-center text-sm text-slate-400 py-8">Belum ada pesan</p>
        ) : (
          messages.map((msg: any) => {
            const isMe = msg.senderId === user?.id;
            return (
              <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                <div
                  className={`max-w-[70%] px-4 py-2.5 rounded-2xl text-sm ${
                    isMe
                      ? 'bg-blue-600 text-white rounded-br-md'
                      : 'bg-white border border-slate-200 text-slate-900 rounded-bl-md'
                  }`}
                >
                  {!isMe && (
                    <p className="text-xs font-medium text-blue-600 mb-1">
                      {msg.sender?.name || 'User'}
                    </p>
                  )}
                  <p>{msg.content}</p>
                  <p className={`text-[10px] mt-1 ${isMe ? 'text-blue-200' : 'text-slate-400'}`}>
                    {new Date(msg.createdAt).toLocaleTimeString('id-ID', {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </p>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Input */}
      <form onSubmit={sendMessage} className="flex items-center gap-2 pt-4 border-t border-slate-200">
        <input
          type="text"
          value={newMsg}
          onChange={(e) => setNewMsg(e.target.value)}
          placeholder="Ketik pesan..."
          className="flex-1 px-4 py-2.5 border border-slate-300 rounded-full focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
        />
        <button
          type="submit"
          disabled={sending || !newMsg.trim()}
          className="p-2.5 bg-blue-600 text-white rounded-full hover:bg-blue-700 disabled:opacity-50 transition-colors"
        >
          <Send size={18} />
        </button>
      </form>
    </div>
  );
}
