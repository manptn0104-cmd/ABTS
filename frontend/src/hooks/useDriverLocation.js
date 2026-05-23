import { useEffect, useRef, useCallback } from 'react';
import * as Location from 'expo-location';
import { Platform } from 'react-native';

const INTERVAL_MS = 5000;

/**
 * Broadcasts driver GPS every 5s via Socket.io.
 * Emits both legacy and new event names for backward compatibility.
 */
export function useDriverLocation({ socket, ambulanceId, bookingId, enabled }) {
  const intervalRef = useRef(null);
  const watchRef = useRef(null);

  const emitLocation = useCallback(
    (coords) => {
      if (!socket?.connected || !ambulanceId) return;
      const payload = {
        ambulanceId,
        bookingId: bookingId || null,
        latitude: coords.latitude,
        longitude: coords.longitude,
        speed: coords.speed ?? 0,
        heading: coords.heading ?? 0,
        accuracy: coords.accuracy ?? 0,
      };
      socket.emit('driver:location:update', payload);
      socket.emit('driver_location_update', payload);
    },
    [socket, ambulanceId, bookingId]
  );

  const captureAndEmit = useCallback(async () => {
    try {
      const { status } = await Location.getForegroundPermissionsAsync();
      if (status !== 'granted') return;

      const pos = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      emitLocation({
        latitude: pos.coords.latitude,
        longitude: pos.coords.longitude,
        speed: pos.coords.speed,
        heading: pos.coords.heading,
        accuracy: pos.coords.accuracy,
      });
    } catch (err) {
      if (__DEV__) console.warn('[useDriverLocation]', err.message);
    }
  }, [emitLocation]);

  useEffect(() => {
    if (!enabled || !socket || !ambulanceId) return undefined;

    let cancelled = false;

    const start = async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted' || cancelled) {
        if (__DEV__) console.warn('[useDriverLocation] permission denied');
        return;
      }

      await captureAndEmit();
      intervalRef.current = setInterval(captureAndEmit, INTERVAL_MS);

      if (Platform.OS !== 'web') {
        watchRef.current = await Location.watchPositionAsync(
          {
            accuracy: Location.Accuracy.Balanced,
            timeInterval: INTERVAL_MS,
            distanceInterval: 10,
          },
          (pos) => {
            emitLocation({
              latitude: pos.coords.latitude,
              longitude: pos.coords.longitude,
              speed: pos.coords.speed,
              heading: pos.coords.heading,
              accuracy: pos.coords.accuracy,
            });
          }
        );
      }
    };

    start();

    return () => {
      cancelled = true;
      if (intervalRef.current) clearInterval(intervalRef.current);
      if (watchRef.current?.remove) watchRef.current.remove();
    };
  }, [enabled, socket, ambulanceId, bookingId, captureAndEmit, emitLocation]);

  return { captureAndEmit };
}
