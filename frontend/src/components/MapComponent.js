import React, { useRef, useEffect, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from 'react-native-maps';
import { Colors } from '../theme';
import AmbulanceMarkerIcon from './AmbulanceMarkerIcon';
import BikeMarkerIcon from './BikeMarkerIcon';

const toRad = (d) => (d * Math.PI) / 180;

const bearingDeg = (a, b) => {
  const y = Math.sin(toRad(b.longitude - a.longitude)) * Math.cos(toRad(b.latitude));
  const x = Math.cos(toRad(a.latitude)) * Math.sin(toRad(b.latitude)) -
    Math.sin(toRad(a.latitude)) * Math.cos(toRad(b.latitude)) * Math.cos(toRad(b.longitude - a.longitude));
  return (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
};

const metres = (a, b) => {
  const dy = (b.latitude - a.latitude) * 111320;
  const dx = (b.longitude - a.longitude) * 111320 * Math.cos(toRad(a.latitude));
  return Math.hypot(dx, dy);
};

export default function MapComponent({
  region,
  userLocation,
  ambulanceLocation,
  ambulanceType,
  ambulances = [],
  routeCoords = [],
  destinationEmoji = '📍',
  destinationTitle = 'Pickup Location',
  onAmbulancePress,
  style,
  children,
}) {
  const animRef = useRef(null);
  const headingRef = useRef(0);
  const lastTickRef = useRef(0);
  const lastDrawRef = useRef(0);
  // Last position actually rendered — the start point of the next glide.
  const posRef = useRef(null);
  const [markerPos, setMarkerPos] = useState(null);
  const [heading, setHeading] = useState(0);
  // Remaining road ahead of the vehicle for this tick, thinned by the backend.
  const [liveRoute, setLiveRoute] = useState([]);

  // Glide the marker (and rotate it) along the road vertices travelled since
  // the previous update instead of jumping straight to the new point, so
  // native tracking moves the same way the web map does.
  useEffect(() => {
    if (!ambulanceLocation) return undefined;
    const target = { latitude: ambulanceLocation.latitude, longitude: ambulanceLocation.longitude };
    const hasRoute = Array.isArray(ambulanceLocation.route) && ambulanceLocation.route.length > 0;
    const routePts = hasRoute
      ? ambulanceLocation.route.map(([lat, lng]) => ({ latitude: lat, longitude: lng }))
      : [];

    if (!posRef.current) {
      // First update for this ambulance: nothing to animate from yet.
      posRef.current = target;
      setMarkerPos(target);
      headingRef.current = ambulanceLocation.heading || 0;
      setHeading(headingRef.current);
      setLiveRoute(routePts);
      return undefined;
    }

    const tail = Array.isArray(ambulanceLocation.path) && ambulanceLocation.path.length > 1
      ? ambulanceLocation.path.slice(1).map(([lat, lng]) => ({ latitude: lat, longitude: lng }))
      : [target];
    const pts = [posRef.current, ...tail];

    const cum = [0];
    for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + metres(pts[i - 1], pts[i]));
    const total = cum[cum.length - 1];

    if (animRef.current) cancelAnimationFrame(animRef.current);
    const now = Date.now();
    // Match the ~4s simulator tick interval, clamped so a slow/fast tick
    // doesn't produce a jarring glide speed.
    const duration = lastTickRef.current ? Math.min(5000, Math.max(1000, now - lastTickRef.current)) : 4000;
    lastTickRef.current = now;
    const startTime = now;

    const frame = () => {
      const t = Math.min(1, (Date.now() - startTime) / duration);
      const dist = t * total;
      let i = 1;
      while (i < pts.length - 1 && cum[i] < dist) i++;
      const segLen = cum[i] - cum[i - 1];
      const k = segLen > 0 ? (dist - cum[i - 1]) / segLen : 1;
      const a = pts[i - 1];
      const b = pts[i];
      const pos = {
        latitude: a.latitude + (b.latitude - a.latitude) * k,
        longitude: a.longitude + (b.longitude - a.longitude) * k,
      };

      if (segLen > 0.5) {
        const targetHeading = bearingDeg(a, b);
        let diff = ((targetHeading - headingRef.current + 540) % 360) - 180;
        headingRef.current = (headingRef.current + diff * 0.25 + 360) % 360;
      }

      // Re-rendering the marker on every animation frame (~60/s) forces
      // react-native-maps to re-snapshot the custom view that often, which is
      // expensive enough on Android to make the marker appear to stall. ~12
      // updates/sec is still visually smooth for a slow map glide.
      const frameNow = Date.now();
      if (frameNow - lastDrawRef.current > 80 || t === 1) {
        lastDrawRef.current = frameNow;
        setMarkerPos(pos);
        setHeading(headingRef.current);
        if (routePts.length) {
          setLiveRoute([pos, ...pts.slice(i), ...routePts.slice(1)]);
        }
      }

      if (t < 1) {
        animRef.current = requestAnimationFrame(frame);
      } else {
        posRef.current = target;
      }
    };
    animRef.current = requestAnimationFrame(frame);

    return () => {
      if (animRef.current) cancelAnimationFrame(animRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ambulanceLocation]);

  useEffect(() => () => {
    if (animRef.current) cancelAnimationFrame(animRef.current);
  }, []);

  const displayAmbulancePos = markerPos
    || (ambulanceLocation ? { latitude: ambulanceLocation.latitude, longitude: ambulanceLocation.longitude } : null);

  // Prefer the live road route from the backend; fall back to the simple
  // straight/dashed line the caller supplies when no route is available yet.
  const routeToDraw = liveRoute.length > 1 ? liveRoute : routeCoords;

  return (
    <MapView
      style={[styles.map, style]}
      provider={PROVIDER_GOOGLE}
      region={region}
      showsUserLocation
      showsMyLocationButton
      showsCompass
    >
      {userLocation && (
        <Marker coordinate={userLocation} title={destinationTitle}>
          <View style={styles.destMarker}>
            <Text style={styles.destEmoji}>{destinationEmoji}</Text>
          </View>
        </Marker>
      )}

      {displayAmbulancePos && (
        <Marker
          coordinate={displayAmbulancePos}
          title="Ambulance"
          description="En route to you"
          anchor={{ x: 0.5, y: 0.5 }}
          rotation={heading}
          flat
          // `tracksViewChanges={false}` is meant for static icons; on Android it
          // can also stop react-native-maps from re-applying position/rotation
          // updates for a custom-view marker, which made the ambulance look
          // frozen in place. This marker moves constantly, so keep it tracking.
        >
          {ambulanceType === 'bike' ? <BikeMarkerIcon size={40} /> : <AmbulanceMarkerIcon size={40} />}
        </Marker>
      )}

      {ambulances.map((amb) => {
        const [lng, lat] = amb.currentLocation?.coordinates || [0, 0];
        if (!lat || !lng) return null;
        return (
          <Marker
            key={amb._id}
            coordinate={{ latitude: lat, longitude: lng }}
            title={amb.vehicleNumber}
            description={`${amb.type} • ${amb.driverName}`}
            onPress={() => onAmbulancePress?.(amb)}
          >
            <View style={styles.listMarker}>
              <Text style={{ fontSize: 18 }}>{amb.type === 'bike' ? '🏍️' : '🚑'}</Text>
            </View>
          </Marker>
        );
      })}

      {routeToDraw.length > 1 && (
        <Polyline
          coordinates={routeToDraw}
          strokeColor="#1A73E8"
          strokeWidth={5}
        />
      )}

      {children}
    </MapView>
  );
}

const styles = StyleSheet.create({
  map: { flex: 1 },
  destMarker: {
    backgroundColor: Colors.white,
    borderRadius: 18,
    padding: 3,
    borderWidth: 1,
    borderColor: Colors.primaryLight,
  },
  destEmoji: { fontSize: 22 },
  listMarker: {
    backgroundColor: Colors.white,
    borderRadius: 16,
    padding: 2,
    borderWidth: 1,
    borderColor: Colors.primaryLight,
  },
});
