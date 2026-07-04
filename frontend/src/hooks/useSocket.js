import { useEffect, useRef, useCallback } from 'react';
import { io } from 'socket.io-client';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SOCKET_URL } from '../utils/constants';

let socketInstance = null;

export const useSocket = () => {
  const socketRef = useRef(null);

  const connect = useCallback(async () => {
    if (socketInstance?.connected) {
      socketRef.current = socketInstance;
      return socketInstance;
    }

    const token = await AsyncStorage.getItem('abts_token');
    if (!token) return null;

    const socket = io(SOCKET_URL, {
      auth: { token },
      transports: ['websocket'],
      reconnectionAttempts: 5,
      reconnectionDelay: 2000,
    });

    socket.on('connect', () => {
      console.log('🔌 Socket connected:', socket.id);
    });

    socket.on('connect_error', (err) => {
      console.warn('⚠️ Socket connection error:', err.message);
    });

    socket.on('disconnect', (reason) => {
      console.log('🔌 Socket disconnected:', reason);
    });

    socketInstance  = socket;
    socketRef.current = socket;
    return socket;
  }, []);

  const disconnect = useCallback(() => {
    if (socketInstance) {
      socketInstance.disconnect();
      socketInstance   = null;
      socketRef.current = null;
    }
  }, []);

  const emit = useCallback((event, data) => {
    socketRef.current?.emit(event, data);
  }, []);

  const on = useCallback((event, handler) => {
    socketRef.current?.on(event, handler);
    return () => socketRef.current?.off(event, handler);
  }, []);

  const off = useCallback((event, handler) => {
    socketRef.current?.off(event, handler);
  }, []);

  return { connect, disconnect, emit, on, off, socket: socketRef };
};
