import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from 'react-native-maps';
import { Colors } from '../theme';

export default function MapComponent({
  region,
  userLocation,
  ambulanceLocation,
  ambulances = [],
  routeCoords = [],
  onAmbulancePress,
  style,
  children,
}) {
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
        <Marker
          coordinate={userLocation}
          title="Your Location"
          pinColor={Colors.primary}
        />
      )}

      {ambulanceLocation && (
        <Marker
          coordinate={ambulanceLocation}
          title="Ambulance"
          description="En route to you"
        >
          <View style={styles.ambulanceMarker}>
            <Text style={styles.ambulanceEmoji}>🚑</Text>
          </View>
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
              <Text style={{ fontSize: 18 }}>🚑</Text>
            </View>
          </Marker>
        );
      })}

      {routeCoords.length > 1 && (
        <Polyline
          coordinates={routeCoords}
          strokeColor={Colors.primary}
          strokeWidth={4}
          lineDashPattern={[1]}
        />
      )}

      {children}
    </MapView>
  );
}

const styles = StyleSheet.create({
  map: { flex: 1 },
  ambulanceMarker: {
    backgroundColor: Colors.white,
    borderRadius: 20,
    padding: 4,
    borderWidth: 2,
    borderColor: Colors.primary,
  },
  ambulanceEmoji: { fontSize: 22 },
  listMarker: {
    backgroundColor: Colors.white,
    borderRadius: 16,
    padding: 2,
    borderWidth: 1,
    borderColor: Colors.primaryLight,
  },
});
