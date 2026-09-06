import React, { useRef, useEffect, useState } from 'react';
import { View, StyleSheet, ActivityIndicator, Text } from 'react-native';
import { setOptions, importLibrary } from '@googlemaps/js-api-loader';

// Module‑level promise to ensure the Google Maps script is loaded only once
let googleMapsPromise = null;
function loadGoogleMaps() {
  if (!googleMapsPromise) {
    // Configure the loader options (key, version, etc.)
    setOptions({
      key: process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY,
      v: 'weekly',
    });
    // Import the Maps library – this returns a promise that resolves when the script is ready
    googleMapsPromise = importLibrary('maps');
  }
  return googleMapsPromise;
}

export default function MapComponent({
  region,
  userLocation,
  ambulanceLocation,
  ambulances = [],
  style,
}) {
  const mapDivRef = useRef(null);
  const mapRef = useRef(null);
  const markersRef = useRef({
    user: null,
    ambulance: null,
    list: {}, // keyed by ambulance _id
  });
  const routeRef = useRef(null);
  // Sequence counter ensuring only the newest OSRM route response is applied
  const routeSeqRef = useRef(0);
  // Track whether initial viewport has been set and previous ambulance ID for reassignment detection
  const hasInitializedViewportRef = useRef(false);
  const prevAmbulanceIdRef = useRef(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Initialise Google Map – runs once per component instance
  useEffect(() => {
    // Validate API key presence early
    if (!process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY) {
      setError('Google Maps API key is not configured.');
      setLoading(false);
      return;
    }

    let cancelled = false;
    loadGoogleMaps()
      .then(() => {
        if (cancelled) return;
        if (!window.google?.maps) {
          throw new Error('Google Maps library not available after load');
        }
        const center = region
          ? { lat: region.latitude, lng: region.longitude }
          : { lat: 0, lng: 0 };
        const map = new window.google.maps.Map(mapDivRef.current, {
          center,
          zoom: region?.latitudeDelta ? Math.round(16 - Math.log(region.latitudeDelta)) : 13,
          mapTypeControl: false,
          streetViewControl: false,
        });
        mapRef.current = map;
        setLoading(false);
      })
      .catch((e) => {
        console.error('Google Maps loader error:', e);
        if (!cancelled) {
          setError('Google Maps failed to load.');
          setLoading(false);
        }
      });

    // Cleanup on unmount
    return () => {
      cancelled = true;
      if (routeRef.current) {
        routeRef.current.setMap(null);
        routeRef.current = null;
      }
      Object.values(markersRef.current.list).forEach((m) => m.setMap(null));
      if (markersRef.current.user) markersRef.current.user.setMap(null);
      if (markersRef.current.ambulance) markersRef.current.ambulance.setMap(null);
      if (mapRef.current) {
        mapRef.current = null;
      }
    };
  }, []);

  // Helper to create a coloured dot marker (uses SymbolPath from the loaded API)
  const createDotMarker = (position, color, title) => {
    return new window.google.maps.Marker({
      position,
      map: mapRef.current,
      title,
      icon: {
        path: window.google.maps.SymbolPath.CIRCLE,
        scale: 8,
        fillColor: color,
        fillOpacity: 1,
        strokeWeight: 2,
        strokeColor: '#fff',
      },
    });
  };

  // Update user location marker
  useEffect(() => {
    if (!mapRef.current || !userLocation) return;
    const pos = { lat: userLocation.latitude, lng: userLocation.longitude };
    if (!markersRef.current.user) {
      markersRef.current.user = createDotMarker(pos, '#2563EB', 'Your Location');
    } else {
      markersRef.current.user.setPosition(pos);
    }
    // Center map on user if ambulance not yet present
    if (!markersRef.current.ambulance) {
      mapRef.current.setCenter(pos);
    }
    // Route recalculation is triggered solely by the ambulance-location effect,
    // so a re-created userLocation object no longer fires a duplicate request.
  }, [userLocation]);

  // Update single ambulance location marker (used for the primary ambulance display)
  useEffect(() => {
    if (!mapRef.current || !ambulanceLocation) return;
    const pos = { lat: ambulanceLocation.latitude, lng: ambulanceLocation.longitude };
    if (!markersRef.current.ambulance) {
      markersRef.current.ambulance = createDotMarker(pos, '#EF4444', 'Ambulance');
    } else {
      markersRef.current.ambulance.setPosition(pos);
    }
    // After updating position, check if ambulance is near edge of viewport and pan gently if needed
    if (mapRef.current && typeof mapRef.current.getBounds === 'function') {
      const bounds = mapRef.current.getBounds();
      if (bounds && typeof bounds.getNorthEast === 'function' && typeof bounds.getSouthWest === 'function') {
        const ne = bounds.getNorthEast();
        const sw = bounds.getSouthWest();
        const latMargin = (ne.lat() - sw.lat()) * 0.2; // 20% margin
        const lngMargin = (ne.lng() - sw.lng()) * 0.2;
        const needsPan =
          pos.lat > ne.lat() - latMargin ||
          pos.lat < sw.lat() + latMargin ||
          pos.lng > ne.lng() - lngMargin ||
          pos.lng < sw.lng() + lngMargin;
        if (needsPan) {
          // Use panTo for a gentle transition
          mapRef.current.panTo(pos);
        }
      }
    }
    // Recalculate the route from the SAME latest ambulance position used for the marker
    updateRoute(pos);
  }, [ambulanceLocation]);

  // Update an array of additional ambulance markers
  useEffect(() => {
    if (!mapRef.current) return;
    const existingIds = new Set(Object.keys(markersRef.current.list));
    const newIds = new Set();
    ambulances.forEach((amb) => {
      const id = amb._id;
      if (!id) return;
      newIds.add(id);
      const coords = amb.currentLocation?.coordinates;
      if (!coords) return;
      const [lng, lat] = coords;
      const pos = { lat, lng };
      if (!markersRef.current.list[id]) {
        const marker = new window.google.maps.Marker({
          position: pos,
          map: mapRef.current,
          title: amb.vehicleNumber,
        });
        markersRef.current.list[id] = marker;
      } else {
        markersRef.current.list[id].setPosition(pos);
      }
    });
    // Remove any markers that are no longer in the list
    existingIds.forEach((id) => {
      if (!newIds.has(id)) {
        markersRef.current.list[id].setMap(null);
        delete markersRef.current.list[id];
      }
    });
  }, [ambulances]);

  // Draw route using OSRM – latest response wins; stale responses are discarded
  const updateRoute = (ambPos = null) => {
    if (!mapRef.current) return;
    const userMarker = markersRef.current.user;
    const ambMarker = markersRef.current.ambulance;
    if (!userMarker || !ambMarker) {
      if (routeRef.current) {
        routeRef.current.setMap(null);
        routeRef.current = null;
      }
      return;
    }
    // Prefer the exact latest ambulance coordinates so the route starts where the marker is
    const start = ambPos
      ? { lat: () => ambPos.lat, lng: () => ambPos.lng }
      : ambMarker.getPosition();
    const end = userMarker.getPosition();
    const url = `https://router.project-osrm.org/route/v1/driving/${start.lng()},${start.lat()};${end.lng()},${end.lat()}?overview=full&geometries=geojson`;
    const seq = ++routeSeqRef.current;
    fetch(url)
      .then((res) => res.json())
      .then((data) => {
        if (seq !== routeSeqRef.current) return; // a newer request superseded this one
        if (data.code === 'Ok' && data.routes && data.routes[0]) {
          const coords = data.routes[0].geometry.coordinates.map((c) => ({ lat: c[1], lng: c[0] }));
          if (!routeRef.current) {
            routeRef.current = new window.google.maps.Polyline({
              path: coords,
              strokeColor: '#EF4444',
              strokeWeight: 5,
              map: mapRef.current,
            });
          } else {
            routeRef.current.setPath(coords);
          }
          // Initial viewport fitting is handled separately; avoid auto‑zoom on every update
        } else {
          fallbackRoute();
        }
      })
      .catch(() => {
        if (seq !== routeSeqRef.current) return; // ignore failures from stale requests
        fallbackRoute();
      });
  };

  const fallbackRoute = () => {
    const userMarker = markersRef.current.user;
    const ambMarker = markersRef.current.ambulance;
    if (!userMarker || !ambMarker) return;
    const pts = [ambMarker.getPosition(), userMarker.getPosition()];
    if (!routeRef.current) {
      routeRef.current = new window.google.maps.Polyline({
        path: pts,
        strokeColor: '#3B82F6',
        strokeWeight: 4,
        strokeOpacity: 0.9,
        strokePattern: [{ type: 'dash', length: 10 }, { type: 'gap', length: 6 }],
        map: mapRef.current,
      });
    } else {
      routeRef.current.setPath(pts);
      routeRef.current.setOptions({
        strokeColor: '#3B82F6',
        strokeWeight: 4,
        strokePattern: [{ type: 'dash', length: 10 }, { type: 'gap', length: 6 }],
      });
    }
    // Viewport fitting is handled separately; avoid auto‑zoom on every update
  };

  // Adjust viewport once on initial load or when ambulance reassignment occurs
  useEffect(() => {
    if (!mapRef.current) return;
    const userMarker = markersRef.current.user;
    const ambMarker = markersRef.current.ambulance;
    if (!userMarker || !ambMarker) return;
    const ambId = ambulanceLocation?.id ?? ambulanceLocation?._id ?? null;
    const needsFit = !hasInitializedViewportRef.current || ambId !== prevAmbulanceIdRef.current;
    if (needsFit) {
      const bounds = new window.google.maps.LatLngBounds();
      bounds.extend(userMarker.getPosition());
      bounds.extend(ambMarker.getPosition());
      mapRef.current.fitBounds(bounds, { padding: 50, maxZoom: 15 });
      hasInitializedViewportRef.current = true;
      prevAmbulanceIdRef.current = ambId;
    }
  }, [userLocation, ambulanceLocation]);

  // Route updates are handled in the individual location effects; no additional effect needed

  if (error) {
    return (
      <View style={[styles.container, style]}>
        <Text>{error}</Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, style]}>
      {loading && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color="#2563EB" />
        </View>
      )}
      <div ref={mapDivRef} style={{ width: '100%', height: '100%' }} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, position: 'relative' },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.7)',
    zIndex: 10,
  },
});
