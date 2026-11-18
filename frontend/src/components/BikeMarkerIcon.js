import React from 'react';
import Svg, { Ellipse, Rect, Circle } from 'react-native-svg';

// Top-down bike-ambulance icon facing north (0°); the map marker's rotation
// turns it to the direction of travel.
export default function BikeMarkerIcon({ size = 40 }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 64 64">
      <Ellipse cx={32} cy={34} rx={9} ry={27} fill="rgba(0,0,0,0.18)" />
      <Rect x={28} y={5} width={8} height={15} rx={4} fill="#263238" />
      <Rect x={28} y={44} width={8} height={15} rx={4} fill="#263238" />
      <Rect x={16} y={17} width={32} height={4} rx={2} fill="#37474F" />
      <Rect x={26} y={20} width={12} height={28} rx={5} fill="#E53935" stroke="#B71C1C" strokeWidth={1.5} />
      <Circle cx={32} cy={32} r={6.5} fill="#FFFFFF" stroke="#37474F" strokeWidth={1.5} />
      <Rect x={30.8} y={27} width={2.4} height={10} fill="#E53935" />
      <Rect x={27} y={30.8} width={10} height={2.4} fill="#E53935" />
    </Svg>
  );
}
