import { useState, useEffect, useCallback } from 'react';
import * as ExpoLocation from 'expo-location';

export const useLocation = () => {
  const [location, setLocation]       = useState(null);
  const [address, setAddress]         = useState('');
  const [error, setError]             = useState(null);
  const [isLoading, setIsLoading]     = useState(false);

  const requestPermission = async () => {
    const { status } = await ExpoLocation.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      setError('Location permission denied. Please enable it in settings.');
      return false;
    }
    return true;
  };

  const getCurrentLocation = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const granted = await requestPermission();
      if (!granted) return null;

      const loc = await ExpoLocation.getCurrentPositionAsync({
        accuracy: ExpoLocation.Accuracy.Balanced,
      });

      const coords = {
        latitude:  loc.coords.latitude,
        longitude: loc.coords.longitude,
      };

      setLocation(coords);

      // Reverse geocode
      try {
        const geo = await ExpoLocation.reverseGeocodeAsync(coords);
        if (geo.length > 0) {
          const g = geo[0];
          const parts = [g.name, g.street, g.district, g.city, g.region].filter(Boolean);
          setAddress(parts.join(', '));
        }
      } catch {
        // Geocoding failure is non-critical
      }

      return coords;
    } catch (err) {
      setError('Failed to get your location. Please try again.');
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const geocodeAddress = useCallback(async (addressText) => {
    try {
      const results = await ExpoLocation.geocodeAsync(addressText);
      if (results.length > 0) {
        const { latitude, longitude } = results[0];
        return { latitude, longitude };
      }
      return null;
    } catch {
      return null;
    }
  }, []);

  useEffect(() => {
    getCurrentLocation();
  }, []);

  return {
    location,
    address,
    error,
    isLoading,
    getCurrentLocation,
    geocodeAddress,
    setLocation,
    setAddress,
  };
};
