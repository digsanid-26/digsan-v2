'use client';

import { io, Socket } from 'socket.io-client';
import { getTokens } from './auth';
import { useEffect, useRef, useState, useCallback } from 'react';

const SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_URL || process.env.NEXT_PUBLIC_API_URL?.replace('/api', '') || 'http://localhost:4000';

let socket: Socket | null = null;

function getSocket(): Socket | null {
  if (socket?.connected) return socket;
  const tokens = getTokens();
  if (!tokens?.accessToken) return null;

  socket = io(`${SOCKET_URL}/chat`, {
    auth: { token: tokens.accessToken },
    transports: ['websocket'],
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionAttempts: 5,
  });

  return socket;
}

function disconnectSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}

export interface ChatMessage {
  id: string;
  roomId: string;
  senderId: string;
  content: string;
  type?: string;
  metadata?: any;
  createdAt: string;
  sender?: { id: string; name: string; avatar: string | null };
}

export function useChatSocket(roomId: string | null) {
  const [isConnected, setIsConnected] = useState(false);
  const [typingUsers, setTypingUsers] = useState<Set<string>>(new Set());
  const socketRef = useRef<Socket | null>(null);
  const typingTimeouts = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const onMessage = useCallback((cb: (msg: ChatMessage) => void) => {
    const s = socketRef.current;
    if (!s) return () => {};
    s.on('new_message', cb);
    return () => { s.off('new_message', cb); };
  }, []);

  const onUserTyping = useCallback((userId: string) => {
    setTypingUsers((prev) => new Set(prev).add(userId));
    const existing = typingTimeouts.current.get(userId);
    if (existing) clearTimeout(existing);
    typingTimeouts.current.set(
      userId,
      setTimeout(() => {
        setTypingUsers((prev) => {
          const next = new Set(prev);
          next.delete(userId);
          return next;
        });
      }, 3000),
    );
  }, []);

  const onUserStopTyping = useCallback((userId: string) => {
    setTypingUsers((prev) => {
      const next = new Set(prev);
      next.delete(userId);
      return next;
    });
  }, []);

  useEffect(() => {
    if (!roomId) return;

    const s = getSocket();
    if (!s) return;
    socketRef.current = s;

    const onConnect = () => setIsConnected(true);
    const onDisconnect = () => setIsConnected(false);

    s.on('connect', onConnect);
    s.on('disconnect', onDisconnect);

    if (!s.connected) s.connect();

    // Join the specific room
    s.emit('join_room', { roomId });

    // Listen for typing events
    s.on('user_typing', (data: { roomId: string; userId: string }) => {
      if (data.roomId === roomId) onUserTyping(data.userId);
    });
    s.on('user_stop_typing', (data: { roomId: string; userId: string }) => {
      if (data.roomId === roomId) onUserStopTyping(data.userId);
    });

    return () => {
      s.off('connect', onConnect);
      s.off('disconnect', onDisconnect);
      s.off('user_typing');
      s.off('user_stop_typing');
      s.emit('leave_room', { roomId });
    };
  }, [roomId, onUserTyping, onUserStopTyping]);

  const sendMessage = useCallback(
    (targetRoomId: string, content: string, type?: string): Promise<ChatMessage | null> => {
      return new Promise((resolve, reject) => {
        const s = socketRef.current;
        if (!s?.connected) {
          reject(new Error('Socket not connected'));
          return;
        }
        s.emit('send_message', { roomId: targetRoomId, content, type }, (response: any) => {
          if (response?.success) resolve(response.message as ChatMessage);
          else reject(new Error(response?.error || 'Failed to send'));
        });
      });
    },
    [],
  );

  const sendTyping = useCallback(() => {
    const s = socketRef.current;
    if (!s?.connected || !roomId) return;
    s.emit('typing', { roomId });
  }, [roomId]);

  const sendStopTyping = useCallback(() => {
    const s = socketRef.current;
    if (!s?.connected || !roomId) return;
    s.emit('stop_typing', { roomId });
  }, [roomId]);

  const markRead = useCallback(() => {
    const s = socketRef.current;
    if (!s?.connected || !roomId) return;
    s.emit('mark_read', { roomId });
  }, [roomId]);

  return {
    isConnected,
    typingUsers,
    onMessage,
    sendMessage,
    sendTyping,
    sendStopTyping,
    markRead,
  };
}

export { getSocket, disconnectSocket };
