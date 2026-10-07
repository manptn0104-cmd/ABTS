import React from 'react';
import { View, StyleSheet } from 'react-native';

export default function MapComponent({ region, userLocation, ambulanceLocation, style }) {
  const centerLat = region?.latitude ?? userLocation?.latitude ?? ambulanceLocation?.latitude ?? 12.9716;
  const centerLng = region?.longitude ?? userLocation?.longitude ?? ambulanceLocation?.longitude ?? 77.5946;

  const markerQuery = [];
  if (userLocation) markerQuery.push(`color:blue|${userLocation.latitude},${userLocation.longitude}`);
  if (ambulanceLocation) markerQuery.push(`color:red|${ambulanceLocation.latitude},${ambulanceLocation.longitude}`);

  const googleMapUrl = `https://www.google.com/maps?q=${centerLat},${centerLng}&z=13&output=embed`;
  const mapUrl = markerQuery.length > 0
    ? `https://www.google.com/maps?q=${markerQuery.join('&markers=')}&z=13&output=embed`
    : googleMapUrl;

  return (
    <View style={[styles.container, style]}>
      <iframe
        title="Google Maps live tracking"
        src={mapUrl}
        style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', border: 'none' }}
        allowFullScreen
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    position: 'relative',
    overflow: 'hidden',
    backgroundColor: '#e8f4f8',
  },
});
