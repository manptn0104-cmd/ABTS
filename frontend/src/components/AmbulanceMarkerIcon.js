import React from 'react';
import Svg, { Ellipse, Rect } from 'react-native-svg';

// Top-down ambulance icon that faces north (0°) by default — the enclosing
// react-native-maps <Marker rotation={heading} /> handles turning it to face
// the current direction of travel, so no per-angle pre-rendering is needed
// (unlike the web map, which has to bake the rotation into the SVG itself).
export default function AmbulanceMarkerIcon({ size = 40 }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 64 64">
      <Ellipse cx={32} cy={34} rx={15} ry={27} fill="rgba(0,0,0,0.18)" />
      <Rect x={22} y={7} width={20} height={50} rx={7} fill="#FFFFFF" stroke="#37474F" strokeWidth={2} />
      <Rect x={24.5} y={11} width={15} height={9} rx={2.5} fill="#64B5F6" stroke="#37474F" strokeWidth={1} />
      <Rect x={24.5} y={23} width={6.5} height={3.5} rx={1} fill="#E53935" />
      <Rect x={33} y={23} width={6.5} height={3.5} rx={1} fill="#1E88E5" />
      <Rect x={30} y={31} width={4} height={15} fill="#E53935" />
      <Rect x={26.5} y={36.5} width={11} height={4} fill="#E53935" />
      <Rect x={24.5} y={52} width={15} height={3} rx={1} fill="#B0BEC5" />
    </Svg>
  );
}
