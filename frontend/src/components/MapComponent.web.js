import React, { useRef, useEffect, useState } from 'react';
import { View, StyleSheet, ActivityIndicator, Text } from 'react-native';
import { loadGoogleMapsLibrary } from '../utils/googleMapsLoader';

// Loads the Maps JS library (shared loader also used by the Places Autocomplete
// utility, so the Google Maps script tag is only ever injected once for the app).
function loadGoogleMaps() {
  return loadGoogleMapsLibrary('maps');
}

export default function MapComponent({
  region,
  userLocation,
  ambulanceLocation,
  ambulances = [],
  destinationEmoji = '📍',
  destinationTitle = 'Pickup Location',
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
  const animRef = useRef(null);
  const headingRef = useRef(0);
  const lastTickRef = useRef(0);
  const iconCacheRef = useRef({});
  // Sequence counter ensuring only the newest OSRM route response is applied
  const routeSeqRef = useRef(0);
  // Track whether initial viewport has been set and previous ambulance ID for reassignment detection
  const hasInitializedViewportRef = useRef(false);
  const prevAmbulanceIdRef = useRef(null);
  const prevDestKeyRef = useRef(null);
  const [loading, setLoading] = useState(true);
  const [mapReady, setMapReady] = useState(false);
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
        setMapReady(true);
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
      if (animRef.current) cancelAnimationFrame(animRef.current);
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
 const createEmojiMarker = (position, emoji, title) => {
  return new window.google.maps.Marker({
    position,
    map: mapRef.current,
    title,

    // Transparent icon so only the emoji is visible
    icon: {
      url:
        'data:image/svg+xml;charset=UTF-8,' +
        encodeURIComponent(
          '<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1"></svg>'
        ),
      scaledSize: new window.google.maps.Size(1, 1),
    },

    label: {
      text: emoji,
      fontSize: '28px',
      fontWeight: 'bold',
    },
  });
};

  // Top-down ambulance icon rotated to the direction of travel (0° = north).
  const ambulanceIcon = (heading) => {
    const deg = Math.round(heading / 6) * 6 % 360;
    if (!iconCacheRef.current[deg]) {
      const svg =
        '<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64">' +
        `<g transform="rotate(${deg} 32 32)">` +
        '<ellipse cx="32" cy="34" rx="15" ry="27" fill="rgba(0,0,0,0.18)"/>' +
        '<rect x="22" y="7" width="20" height="50" rx="7" fill="#FFFFFF" stroke="#37474F" stroke-width="2"/>' +
        '<rect x="24.5" y="11" width="15" height="9" rx="2.5" fill="#64B5F6" stroke="#37474F" stroke-width="1"/>' +
        '<rect x="24.5" y="23" width="6.5" height="3.5" rx="1" fill="#E53935"/>' +
        '<rect x="33" y="23" width="6.5" height="3.5" rx="1" fill="#1E88E5"/>' +
        '<rect x="30" y="31" width="4" height="15" fill="#E53935"/>' +
        '<rect x="26.5" y="36.5" width="11" height="4" fill="#E53935"/>' +
        '<rect x="24.5" y="52" width="15" height="3" rx="1" fill="#B0BEC5"/>' +
        '</g></svg>';
      iconCacheRef.current[deg] = {
        url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(svg),
        scaledSize: new window.google.maps.Size(48, 48),
        anchor: new window.google.maps.Point(24, 24),
      };
    }
    return iconCacheRef.current[deg];
  };

  const bearing = (a, b) => {
    const toRad = (d) => (d * Math.PI) / 180;
    const y = Math.sin(toRad(b.lng - a.lng)) * Math.cos(toRad(b.lat));
    const x = Math.cos(toRad(a.lat)) * Math.sin(toRad(b.lat)) -
      Math.sin(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.cos(toRad(b.lng - a.lng));
    return (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
  };

  const metres = (a, b) => {
    const dy = (b.lat - a.lat) * 111320;
    const dx = (b.lng - a.lng) * 111320 * Math.cos((a.lat * Math.PI) / 180);
    return Math.hypot(dx, dy);
  };

  const setRouteLine = (pts) => {
    if (!routeRef.current) {
      routeRef.current = new window.google.maps.Polyline({
        path: pts,
        strokeColor: '#1A73E8',
        strokeOpacity: 0.95,
        strokeWeight: 6,
        map: mapRef.current,
      });
    } else {
      routeRef.current.setPath(pts);
      routeRef.current.setOptions({
        strokeColor: '#1A73E8',
        strokeOpacity: 0.95,
        strokeWeight: 6,
        strokePattern: undefined,
      });
    }
  };

  // Glide the marker along the road vertices travelled since the last update,
  // rotating it to the road direction and trimming the route line behind it.
  const animateAmbulance = (loc) => {
    const marker = markersRef.current.ambulance;
    if (!marker) return;
    if (animRef.current) cancelAnimationFrame(animRef.current);

    const route = (loc.route || []).map((p) => ({ lat: p[0], lng: p[1] }));
    const cur = marker.getPosition();
    const from = { lat: cur.lat(), lng: cur.lng() };
    const tail = (loc.path || []).slice(1).map((p) => ({ lat: p[0], lng: p[1] }));
    const pts = [from, ...(tail.length ? tail : [{ lat: loc.latitude, lng: loc.longitude }])];

    const cum = [0];
    for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + metres(pts[i - 1], pts[i]));
    const total = cum[cum.length - 1];

    const now = performance.now();
    const duration = lastTickRef.current
      ? Math.min(5000, Math.max(1000, now - lastTickRef.current))
      : 4000;
    lastTickRef.current = now;
    const startTime = now;
    let lastDraw = 0;

    const frame = (ts) => {
      const t = Math.min(1, (ts - startTime) / duration);
      const dist = t * total;
      let i = 1;
      while (i < pts.length - 1 && cum[i] < dist) i++;
      const segLen = cum[i] - cum[i - 1];
      const k = segLen > 0 ? (dist - cum[i - 1]) / segLen : 1;
      const a = pts[i - 1];
      const b = pts[i];
      const pos = { lat: a.lat + (b.lat - a.lat) * k, lng: a.lng + (b.lng - a.lng) * k };
      marker.setPosition(pos);

      // Ease the heading towards the direction of the current road segment.
      if (segLen > 0.5) {
        const target = bearing(a, b);
        let diff = ((target - headingRef.current + 540) % 360) - 180;
        headingRef.current = (headingRef.current + diff * 0.25 + 360) % 360;
        marker.setIcon(ambulanceIcon(headingRef.current));
      }

      if (ts - lastDraw > 66 || t === 1) {
        lastDraw = ts;
        if (route.length) setRouteLine([pos, ...pts.slice(i), ...route.slice(1)]);
        else if (routeRef.current) routeRef.current.setPath([]);
      }

      if (t < 1) animRef.current = requestAnimationFrame(frame);
    };
    animRef.current = requestAnimationFrame(frame);
  };

  // Update user location marker
  useEffect(() => {
    if (!mapRef.current || !userLocation) return;
    const pos = { lat: userLocation.latitude, lng: userLocation.longitude };
    if (!markersRef.current.user) {
markersRef.current.user = createEmojiMarker(
  pos,
  destinationEmoji,
  destinationTitle
);    } else {
      markersRef.current.user.setPosition(pos);
      markersRef.current.user.setLabel({ text: destinationEmoji, fontSize: '28px', fontWeight: 'bold' });
      markersRef.current.user.setTitle(destinationTitle);
    }
    // Center map on user if ambulance not yet present
    if (!markersRef.current.ambulance) {
      mapRef.current.setCenter(pos);
    }
    // Route recalculation is triggered solely by the ambulance-location effect,
    // so a re-created userLocation object no longer fires a duplicate request.
  }, [userLocation, destinationEmoji, mapReady]);

  // Update single ambulance location marker (used for the primary ambulance display)
  useEffect(() => {
    if (!mapRef.current || !ambulanceLocation) return;
    const pos = { lat: ambulanceLocation.latitude, lng: ambulanceLocation.longitude };
    const hasRoute = Array.isArray(ambulanceLocation.route);

    if (!markersRef.current.ambulance) {
      markersRef.current.ambulance = new window.google.maps.Marker({
        position: pos,
        map: mapRef.current,
        title: 'Ambulance',
        zIndex: 1000,
        icon: ambulanceIcon(ambulanceLocation.heading || 0),
      });
      headingRef.current = ambulanceLocation.heading || 0;
    }

    // Pan gently when the ambulance is about to leave the viewport.
    const bounds = mapRef.current.getBounds?.();
    if (bounds) {
      const ne = bounds.getNorthEast();
      const sw = bounds.getSouthWest();
      const latMargin = (ne.lat() - sw.lat()) * 0.2;
      const lngMargin = (ne.lng() - sw.lng()) * 0.2;
      if (
        pos.lat > ne.lat() - latMargin || pos.lat < sw.lat() + latMargin ||
        pos.lng > ne.lng() - lngMargin || pos.lng < sw.lng() + lngMargin
      ) {
        mapRef.current.panTo(pos);
      }
    }

    if (hasRoute) {
      animateAmbulance(ambulanceLocation);
    } else {
      markersRef.current.ambulance.setPosition(pos);
      // No server route supplied: fall back to an OSRM route to the destination.
      updateRoute(pos);
    }
  }, [ambulanceLocation, mapReady]);

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
  }, [ambulances, mapReady]);

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
    const destKey = userLocation ? `${userLocation.latitude},${userLocation.longitude}` : null;
    const needsFit =
      !hasInitializedViewportRef.current ||
      ambId !== prevAmbulanceIdRef.current ||
      destKey !== prevDestKeyRef.current;
    if (needsFit) {
      prevDestKeyRef.current = destKey;
      const bounds = new window.google.maps.LatLngBounds();
      bounds.extend(userMarker.getPosition());
      bounds.extend(ambMarker.getPosition());
      mapRef.current.fitBounds(bounds, { padding: 50, maxZoom: 15 });
      hasInitializedViewportRef.current = true;
      prevAmbulanceIdRef.current = ambId;
    }
  }, [userLocation, ambulanceLocation, mapReady]);

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
