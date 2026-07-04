import React, { useRef, useEffect, useCallback } from 'react';
import { View, StyleSheet } from 'react-native';

// Self-contained Leaflet map loaded via srcdoc — no API key needed
const MAP_HTML = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <style>
    *{margin:0;padding:0;box-sizing:border-box}
    html,body,#map{width:100%;height:100%;overflow:hidden}
  </style>
</head>
<body>
  <div id="map"></div>
  <script>
    var map = L.map('map',{zoomControl:true,attributionControl:false});
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19}).addTo(map);
    map.setView([19.076,72.8777],13);

    var userMarker=null, ambMarker=null, routeLine=null;

    var userIcon = L.divIcon({
      html:'<div style="width:16px;height:16px;border-radius:50%;background:#2563EB;border:3px solid #fff;box-shadow:0 2px 8px rgba(37,99,235,.6)"></div>',
      iconSize:[16,16],iconAnchor:[8,8],className:''
    });
    var ambIcon = L.divIcon({
      html:'<div style="font-size:26px;line-height:1;filter:drop-shadow(0 2px 6px rgba(0,0,0,.5))">&#x1F691;</div>',
      iconSize:[28,28],iconAnchor:[14,14],className:''
    });

    function updateRoute(){
      if(!userMarker||!ambMarker) return;
      var pts=[ambMarker.getLatLng(),userMarker.getLatLng()];
      if(!routeLine){
        routeLine=L.polyline(pts,{color:'#3B82F6',weight:4,dashArray:'10 6',opacity:.9}).addTo(map);
      } else { routeLine.setLatLngs(pts); }
      try{ map.fitBounds(L.latLngBounds(pts),{padding:[50,50],maxZoom:15,animate:true}); }catch(e){}
    }

    window.addEventListener('message',function(e){
      var d=e.data; if(!d||!d.type) return;
      if(d.type==='setRegion'){
        if(!ambMarker&&!userMarker) map.setView([d.lat,d.lng],d.zoom||14,{animate:true});
      } else if(d.type==='setUserLocation'){
        var ll=[d.lat,d.lng];
        if(!userMarker){
          userMarker=L.marker(ll,{icon:userIcon}).addTo(map).bindPopup('<b>&#x1F4CD; Pickup Location</b>');
          if(!ambMarker) map.setView(ll,14);
        } else { userMarker.setLatLng(ll); }
        updateRoute();
      } else if(d.type==='setAmbulanceLocation'){
        var ll=[d.lat,d.lng];
        if(!ambMarker){
          ambMarker=L.marker(ll,{icon:ambIcon}).addTo(map).bindPopup('<b>&#x1F691; Ambulance en route</b>');
        } else { ambMarker.setLatLng(ll); }
        updateRoute();
      }
    });
    window.parent.postMessage('map_ready','*');
  </script>
</body>
</html>`;

export default function MapComponent({ region, userLocation, ambulanceLocation, style }) {
  const iframeRef = useRef(null);
  const readyRef  = useRef(false);
  const queueRef  = useRef([]);

  const post = useCallback((msg) => {
    if (readyRef.current && iframeRef.current?.contentWindow) {
      iframeRef.current.contentWindow.postMessage(msg, '*');
    } else {
      queueRef.current.push(msg);
    }
  }, []);

  // Listen for the iframe's map_ready signal, then flush queued messages
  useEffect(() => {
    const handler = (e) => {
      if (e.data === 'map_ready') {
        readyRef.current = true;
        queueRef.current.forEach((m) => iframeRef.current?.contentWindow?.postMessage(m, '*'));
        queueRef.current = [];
      }
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, []);

  useEffect(() => {
    if (region) post({ type: 'setRegion', lat: region.latitude, lng: region.longitude });
  }, [region?.latitude, region?.longitude, post]);

  useEffect(() => {
    if (userLocation) post({ type: 'setUserLocation', lat: userLocation.latitude, lng: userLocation.longitude });
  }, [userLocation?.latitude, userLocation?.longitude, post]);

  useEffect(() => {
    if (ambulanceLocation) post({ type: 'setAmbulanceLocation', lat: ambulanceLocation.latitude, lng: ambulanceLocation.longitude });
  }, [ambulanceLocation?.latitude, ambulanceLocation?.longitude, post]);

  return (
    <View style={[styles.container, style]}>
      <iframe
        ref={iframeRef}
        srcDoc={MAP_HTML}
        title="Live Tracking Map"
        style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', border: 'none' }}
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
