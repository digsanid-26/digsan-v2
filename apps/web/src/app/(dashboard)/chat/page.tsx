'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useApi, useAuthApi } from '@/lib/hooks';
import { useAuth } from '@/components/providers/auth-provider';
import { useChatSocket } from '@/lib/chat-socket';
import { MessageSquare, Plus, Send, ArrowLeft, Users, Search, X, CheckCheck, Phone, Video, MoreVertical, Paperclip, Smile } from 'lucide-react';
import { isToday, isYesterday } from 'date-fns';

interface ChatRoom {
  id: string;
  name?: string;
  type: string;
  avatar?: string;
  members: { userId: string; user: { id: string; name: string; avatar: string | null } }[];
  lastMessage?: { id: string; content: string; senderId: string; createdAt: string; type: string };
  unreadCount?: number;
}

interface Message {
  id: string;
  roomId: string;
  senderId: string;
  content: string;
  type?: string;
  metadata?: any;
  createdAt: string;
  sender?: { id: string; name: string; avatar: string | null };
}

function formatTime(date: string) {
  return new Date(date).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
}

function formatDayLabel(date: string) {
  const d = new Date(date);
  if (isToday(d)) return 'Hari ini';
  if (isYesterday(d)) return 'Kemarin';
  return d.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
}

function formatLastMessageTime(date: string) {
  const d = new Date(date);
  if (isToday(d)) return formatTime(date);
  if (isYesterday(d)) return 'Kemarin';
  return d.toLocaleDateString('id-ID', { day: '2-digit', month: '2-digit' });
}

export default function ChatPage() {
  const { user } = useAuth();
  const { data: rooms, loading, refetch } = useApi<ChatRoom[]>('/chat/rooms');
  const { request } = useAuthApi();

  const [selectedRoom, setSelectedRoom] = useState<ChatRoom | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [msgLoading, setMsgLoading] = useState(false);
  const [newMsg, setNewMsg] = useState('');
  const [sending, setSending] = useState(false);
  const [showNewChat, setShowNewChat] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isTypingRef = useRef(false);

  const {
    isConnected,
    typingUsers,
    onMessage,
    sendMessage: socketSendMessage,
    sendTyping,
    sendStopTyping,
    markRead,
  } = useChatSocket(selectedRoom?.id ?? null);

  useEffect(() => {
    if (!selectedRoom) return;
    const cleanup = onMessage((msg: Message) => {
      if (msg.roomId === selectedRoom.id) {
        setMessages((prev) => {
          if (prev.some((m) => m.id === msg.id)) return prev;
          return [...prev, msg];
        });
        markRead();
      }
    });
    return cleanup;
  }, [selectedRoom, onMessage, markRead]);

  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  const loadMessages = useCallback(async (room: ChatRoom) => {
    setSelectedRoom(room);
    setMessages([]);
    setMsgLoading(true);
    try {
      const res = await request<{ messages: Message[]; total: number }>(`/chat/rooms/${room.id}/messages?limit=50`);
      setMessages((res.messages ?? []).reverse());
      await request(`/chat/rooms/${room.id}/read`, { method: 'POST' }).catch(() => {});
      markRead();
    } catch (err: any) {
      console.error(err);
    } finally {
      setMsgLoading(false);
    }
  }, [request, markRead]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMsg.trim() || !selectedRoom) return;
    const content = newMsg.trim();
    setNewMsg('');
    setSending(true);

    if (isTypingRef.current) {
      sendStopTyping();
      isTypingRef.current = false;
    }

    try {
      const msg = await socketSendMessage(selectedRoom.id, content);
      if (msg) {
        setMessages((prev) => {
          if (prev.some((m) => m.id === msg.id)) return prev;
          return [...prev, msg];
        });
      } else {
        throw new Error('No response');
      }
    } catch {
      try {
        const msg = await request<Message>(`/chat/rooms/${selectedRoom.id}/messages`, {
          method: 'POST',
          body: JSON.stringify({ content }),
        });
        setMessages((prev) => {
          if (prev.some((m) => m.id === msg.id)) return prev;
          return [...prev, msg];
        });
      } catch (err: any) {
        alert(err.message);
        setNewMsg(content);
      }
    } finally {
      setSending(false);
      refetch();
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setNewMsg(e.target.value);
    if (!selectedRoom) return;

    if (!isTypingRef.current) {
      isTypingRef.current = true;
      sendTyping();
    }

    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      if (isTypingRef.current) {
        sendStopTyping();
        isTypingRef.current = false;
      }
    }, 2000);
  };

  const getRoomName = (room: ChatRoom) => {
    if (room.name) return room.name;
    if (room.type === 'DIRECT') {
      const other = room.members?.find((m) => m.userId !== user?.id);
      return other?.user?.name || 'Pesan Langsung';
    }
    return 'Grup Chat';
  };

  const getRoomAvatar = (room: ChatRoom) => {
    if (room.avatar) return room.avatar;
    if (room.type === 'DIRECT') {
      const other = room.members?.find((m) => m.userId !== user?.id);
      return other?.user?.avatar || null;
    }
    return null;
  };

  const groupedMessages: { date: string; label: string; messages: Message[] }[] = [];
  for (const msg of messages) {
    const dayKey = new Date(msg.createdAt).toDateString();
    const lastGroup = groupedMessages[groupedMessages.length - 1];
    if (lastGroup && lastGroup.date === dayKey) {
      lastGroup.messages.push(msg);
    } else {
      groupedMessages.push({ date: dayKey, label: formatDayLabel(msg.createdAt), messages: [msg] });
    }
  }

  const filteredRooms = rooms?.filter((room) => {
    if (!searchQuery) return true;
    const name = getRoomName(room).toLowerCase();
    return name.includes(searchQuery.toLowerCase());
  }) || [];

  const startDirectChat = async (targetUserId: string) => {
    try {
      const room = await request<ChatRoom>('/chat/rooms/direct', {
        method: 'POST',
        body: JSON.stringify({ targetUserId }),
      });
      setShowNewChat(false);
      await loadMessages(room);
      refetch();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const showConversation = !!selectedRoom;

  return (
    <div className="flex h-[calc(100vh-4rem)] bg-slate-50 dark:bg-[#05050f] overflow-hidden">
      {/* ─── CHAT LIST (left panel) ──────────────────────────── */}
      <div className={`${showConversation ? 'hidden md:flex' : 'flex'} flex-col w-full md:w-[360px] lg:w-[400px] bg-white dark:bg-transparent border-r border-slate-200 dark:border-white/[0.06]`}>
        {/* Header */}
        <div className="px-4 py-3 bg-white dark:bg-transparent border-b border-slate-200 dark:border-white/[0.06]">
          <div className="flex items-center justify-between mb-3">
            <h1 className="text-xl font-bold text-slate-900 dark:text-white">Chat Keluarga</h1>
            <button
              onClick={() => setShowNewChat(true)}
              className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-white/10 transition-colors"
              title="Chat Baru"
            >
              <Plus size={20} className="text-slate-600 dark:text-white/70" />
            </button>
          </div>
          {/* Search */}
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-white/40" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari percakapan..."
              className="w-full pl-9 pr-3 py-2 bg-slate-100 dark:bg-white/5 rounded-lg text-sm text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white dark:focus:bg-white/10 transition-all"
            />
          </div>
        </div>

        {/* Connection status */}
        {!isConnected && selectedRoom && (
          <div className="px-4 py-1.5 bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-300 text-xs text-center">
            Menghubungkan...
          </div>
        )}

        {/* Room list */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 dark:border-blue-400" />
            </div>
          ) : !filteredRooms.length ? (
            <div className="text-center py-16 px-4">
              <MessageSquare size={40} className="mx-auto text-slate-300 dark:text-white/20 mb-3" />
              <p className="text-sm text-slate-500 dark:text-white/50 font-medium">Belum ada percakapan</p>
              <p className="text-xs text-slate-400 dark:text-white/30 mt-1">Tekan + untuk mulai chat baru</p>
            </div>
          ) : (
            filteredRooms.map((room) => {
              const isActive = selectedRoom?.id === room.id;
              const avatar = getRoomAvatar(room);
              return (
                <button
                  key={room.id}
                  onClick={() => loadMessages(room)}
                  className={`w-full flex items-center gap-3 px-4 py-3 hover:bg-slate-50 dark:hover:bg-white/5 transition-colors text-left border-b border-slate-50 dark:border-white/[0.04] ${
                    isActive ? 'bg-blue-50 dark:bg-blue-500/10' : ''
                  }`}
                >
                  {/* Avatar */}
                  <div className="relative shrink-0">
                    {avatar ? (
                      <img src={avatar} alt="" className="w-12 h-12 rounded-full object-cover" />
                    ) : (
                      <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-white font-medium text-sm">
                        {getRoomName(room).charAt(0).toUpperCase()}
                      </div>
                    )}
                    {room.type !== 'DIRECT' && (
                      <div className="absolute -bottom-0.5 -right-0.5 w-5 h-5 bg-slate-700 dark:bg-slate-600 rounded-full flex items-center justify-center border-2 border-white dark:border-[#05050f]">
                        <Users size={10} className="text-white" />
                      </div>
                    )}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <p className={`text-sm truncate ${room.unreadCount ? 'font-semibold text-slate-900 dark:text-white' : 'font-medium text-slate-800 dark:text-white/80'}`}>
                        {getRoomName(room)}
                      </p>
                      {room.lastMessage && (
                        <span className={`text-xs shrink-0 ml-2 ${room.unreadCount ? 'text-blue-600 dark:text-blue-400 font-medium' : 'text-slate-400 dark:text-white/40'}`}>
                          {formatLastMessageTime(room.lastMessage.createdAt)}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center justify-between mt-0.5">
                      <p className="text-xs text-slate-500 dark:text-white/50 truncate flex-1">
                        {room.lastMessage?.senderId === user?.id && 'Anda: '}
                        {room.lastMessage?.content || 'Belum ada pesan'}
                      </p>
                      {room.unreadCount ? (
                        <span className="shrink-0 ml-2 min-w-[20px] h-5 px-1.5 bg-green-500 text-white rounded-full flex items-center justify-center text-xs font-bold">
                          {room.unreadCount > 99 ? '99+' : room.unreadCount}
                        </span>
                      ) : null}
                    </div>
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>

      {/* ─── CONVERSATION (right panel) ──────────────────────── */}
      {showConversation && selectedRoom ? (
        <div className="flex flex-col flex-1 bg-slate-100 dark:bg-[#0a0a1a]">
          {/* Chat header */}
          <div className="flex items-center gap-3 px-4 py-2.5 bg-white dark:bg-transparent border-b border-slate-200 dark:border-white/[0.06] shadow-sm">
            <button
              onClick={() => { setSelectedRoom(null); refetch(); }}
              className="p-1.5 hover:bg-slate-100 dark:hover:bg-white/10 rounded-full transition-colors md:hidden"
            >
              <ArrowLeft size={20} className="text-slate-600 dark:text-white/70" />
            </button>
            {getRoomAvatar(selectedRoom) ? (
              <img src={getRoomAvatar(selectedRoom)!} alt="" className="w-10 h-10 rounded-full object-cover" />
            ) : (
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-white font-medium">
                {getRoomName(selectedRoom).charAt(0).toUpperCase()}
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">{getRoomName(selectedRoom)}</p>
              <p className="text-xs text-slate-500 dark:text-white/50">
                {typingUsers.size > 0 ? (
                  <span className="text-green-600 dark:text-green-400">sedang mengetik...</span>
                ) : selectedRoom.type === 'DIRECT' ? (
                  'online'
                ) : (
                  `${selectedRoom.members?.length || 0} anggota`
                )}
              </p>
            </div>
            <div className="flex items-center gap-1">
              <button className="p-2 hover:bg-slate-100 dark:hover:bg-white/10 rounded-full transition-colors">
                <Phone size={18} className="text-slate-500 dark:text-white/50" />
              </button>
              <button className="p-2 hover:bg-slate-100 dark:hover:bg-white/10 rounded-full transition-colors">
                <Video size={18} className="text-slate-500 dark:text-white/50" />
              </button>
              <button className="p-2 hover:bg-slate-100 dark:hover:bg-white/10 rounded-full transition-colors">
                <MoreVertical size={18} className="text-slate-500 dark:text-white/50" />
              </button>
            </div>
          </div>

          {/* Messages area */}
          <div
            className="flex-1 overflow-y-auto px-4 py-4 space-y-1 bg-slate-100 dark:bg-[#0a0a1a]"
            style={{
              backgroundImage: 'url("data:image/svg+xml,%3Csvg width="60" height="60" viewBox="0 0 60 60" xmlns="http://www.w3.org/2000/svg"%3E%3Cg fill="none" fill-rule="evenodd"%3E%3Cg fill="%23e8e8e8" fill-opacity="0.4"%3E%3Cpath d="M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z"/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")',
            }}
          >
            {msgLoading ? (
              <div className="flex justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 dark:border-blue-400" />
              </div>
            ) : !groupedMessages.length ? (
              <div className="flex flex-col items-center justify-center py-16">
                <MessageSquare size={40} className="text-slate-300 dark:text-white/20 mb-3" />
                <p className="text-sm text-slate-400 dark:text-white/40">Belum ada pesan</p>
                <p className="text-xs text-slate-400 dark:text-white/30 mt-1">Mulai percakapan dengan mengirim pesan</p>
              </div>
            ) : (
              groupedMessages.map((group, gi) => (
                <div key={gi}>
                  {/* Day separator */}
                  <div className="flex justify-center my-3">
                    <span className="px-3 py-1 bg-white/80 dark:bg-white/10 rounded-full text-xs text-slate-500 dark:text-white/50 shadow-sm">
                      {group.label}
                    </span>
                  </div>
                  {/* Messages */}
                  {group.messages.map((msg, mi) => {
                    const isMe = msg.senderId === user?.id;
                    const prevMsg = group.messages[mi - 1];
                    const nextMsg = group.messages[mi + 1];
                    const showSender = !isMe && selectedRoom.type !== 'DIRECT' && (!prevMsg || prevMsg.senderId !== msg.senderId);

                    return (
                      <div
                        key={msg.id}
                        className={`flex ${isMe ? 'justify-end' : 'justify-start'} ${mi > 0 && prevMsg?.senderId === msg.senderId ? 'mt-0.5' : 'mt-2'}`}
                      >
                        <div
                          className={`max-w-[75%] md:max-w-[65%] px-3 py-2 shadow-sm text-sm ${
                            isMe
                              ? 'bg-green-500 text-white rounded-2xl rounded-br-md'
                              : 'bg-white dark:bg-white/10 text-slate-900 dark:text-white rounded-2xl rounded-bl-md'
                          }`}
                        >
                          {showSender && (
                            <p className="text-xs font-semibold text-blue-600 dark:text-blue-400 mb-0.5">
                              {msg.sender?.name || 'User'}
                            </p>
                          )}
                          <p className="whitespace-pre-wrap break-words">{msg.content}</p>
                          <div className={`flex items-center gap-1 mt-0.5 ${isMe ? 'justify-end' : 'justify-start'}`}>
                            <span className={`text-[10px] ${isMe ? 'text-green-100' : 'text-slate-400 dark:text-white/40'}`}>
                              {formatTime(msg.createdAt)}
                            </span>
                            {isMe && (
                              <CheckCheck size={14} className="text-green-100" />
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ))
            )}

            {/* Typing indicator */}
            {typingUsers.size > 0 && (
              <div className="flex justify-start mt-2">
                <div className="bg-white dark:bg-white/10 rounded-2xl rounded-bl-md px-4 py-3 shadow-sm">
                  <div className="flex gap-1">
                    <span className="w-2 h-2 bg-slate-300 dark:bg-white/40 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                    <span className="w-2 h-2 bg-slate-300 dark:bg-white/40 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                    <span className="w-2 h-2 bg-slate-300 dark:bg-white/40 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Input bar */}
          <div className="px-3 py-2.5 bg-white dark:bg-transparent border-t border-slate-200 dark:border-white/[0.06]">
            <form onSubmit={handleSend} className="flex items-center gap-2">
              <button type="button" className="p-2 text-slate-400 dark:text-white/40 hover:text-slate-600 dark:hover:text-white/70 transition-colors">
                <Smile size={22} />
              </button>
              <button type="button" className="p-2 text-slate-400 dark:text-white/40 hover:text-slate-600 dark:hover:text-white/70 transition-colors">
                <Paperclip size={22} />
              </button>
              <input
                type="text"
                value={newMsg}
                onChange={handleInputChange}
                placeholder="Ketik pesan..."
                className="flex-1 px-4 py-2.5 bg-slate-100 dark:bg-white/5 rounded-full text-sm text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:bg-white dark:focus:bg-white/10 transition-all"
              />
              <button
                type="submit"
                disabled={sending || !newMsg.trim()}
                className="p-2.5 bg-green-500 text-white rounded-full hover:bg-green-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors shrink-0"
              >
                <Send size={20} />
              </button>
            </form>
          </div>
        </div>
      ) : (
        /* ─── EMPTY STATE (right panel, desktop only) ─────────── */
        <div className="hidden md:flex flex-col items-center justify-center flex-1 bg-slate-50 dark:bg-[#05050f]">
          <div className="text-center max-w-sm">
            <div className="w-24 h-24 mx-auto mb-4 rounded-full bg-slate-200 dark:bg-white/5 flex items-center justify-center">
              <MessageSquare size={40} className="text-slate-400 dark:text-white/30" />
            </div>
            <h2 className="text-lg font-semibold text-slate-700 dark:text-white/80 mb-2">Chat Keluarga</h2>
            <p className="text-sm text-slate-500 dark:text-white/50">
              Pilih percakapan di samping atau mulai chat baru dengan menekan tombol +
            </p>
          </div>
        </div>
      )}

      {/* ─── NEW CHAT MODAL ──────────────────────────────────── */}
      {showNewChat && (
        <NewChatModal
          onClose={() => setShowNewChat(false)}
          onStart={startDirectChat}
          currentUserId={user?.id || ''}
          request={request}
        />
      )}
    </div>
  );
}

// ─── NEW CHAT MODAL ────────────────────────────────────────────
function NewChatModal({
  onClose,
  onStart,
  currentUserId,
  request,
}: {
  onClose: () => void;
  onStart: (userId: string) => void;
  currentUserId: string;
  request: <T = any>(endpoint: string, options?: RequestInit) => Promise<T>;
}) {
  const [search, setSearch] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!search.trim()) {
      setResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await request<{ users: any[] }>(`/users/search?q=${encodeURIComponent(search)}&limit=20`);
        setResults((res.users ?? []).filter((u) => u.id !== currentUserId));
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [search, request, currentUserId]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 dark:bg-black/60" onClick={onClose}>
      <div
        className="bg-white dark:bg-[#0a0a1a] rounded-2xl shadow-xl w-full max-w-md mx-4 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 dark:border-white/[0.06]">
          <h3 className="text-base font-semibold text-slate-900 dark:text-white">Chat Baru</h3>
          <button onClick={onClose} className="p-1.5 hover:bg-slate-100 dark:hover:bg-white/10 rounded-full transition-colors">
            <X size={20} className="text-slate-500 dark:text-white/50" />
          </button>
        </div>

        {/* Search */}
        <div className="p-4 border-b border-slate-100 dark:border-white/[0.04]">
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-white/40" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari nama atau email keluarga..."
              autoFocus
              className="w-full pl-9 pr-3 py-2.5 bg-slate-100 dark:bg-white/5 rounded-lg text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-400 focus:bg-white dark:focus:bg-white/10 transition-all"
            />
          </div>
        </div>

        {/* Results */}
        <div className="max-h-80 overflow-y-auto">
          {loading ? (
            <div className="flex justify-center py-8">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 dark:border-blue-400" />
            </div>
          ) : !search.trim() ? (
            <p className="text-center text-sm text-slate-400 dark:text-white/40 py-8">Ketik nama untuk mencari anggota keluarga</p>
          ) : !results.length ? (
            <p className="text-center text-sm text-slate-400 dark:text-white/40 py-8">Tidak ditemukan</p>
          ) : (
            results.map((u) => (
              <button
                key={u.id}
                onClick={() => onStart(u.id)}
                className="w-full flex items-center gap-3 px-4 py-3 hover:bg-slate-50 dark:hover:bg-white/5 transition-colors text-left"
              >
                {u.avatar ? (
                  <img src={u.avatar} alt="" className="w-10 h-10 rounded-full object-cover" />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-white font-medium text-sm">
                    {u.name?.charAt(0).toUpperCase()}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-900 dark:text-white truncate">{u.name}</p>
                  <p className="text-xs text-slate-500 dark:text-white/50 truncate">{u.email}</p>
                </div>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
