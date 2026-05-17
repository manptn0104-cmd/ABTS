export const API_BASE_URL = 'http://localhost:5000/api';
export const SOCKET_URL   = 'http://localhost:5000';

export const GOOGLE_MAPS_API_KEY = 'YOUR_GOOGLE_MAPS_API_KEY';

export const EMERGENCY_TYPES = [
  { label: 'Accident',    value: 'accident',    icon: 'car-crash' },
  { label: 'Cardiac',     value: 'cardiac',     icon: 'heart-pulse' },
  { label: 'Respiratory', value: 'respiratory', icon: 'lungs' },
  { label: 'Trauma',      value: 'trauma',      icon: 'medical-bag' },
  { label: 'Maternity',   value: 'maternity',   icon: 'baby-carriage' },
  { label: 'General',     value: 'general',     icon: 'ambulance' },
  { label: 'Other',       value: 'other',       icon: 'dots-horizontal' },
];

export const FACILITIES = [
  { key: 'oxygen',        label: 'Oxygen',        icon: 'weather-windy' },
  { key: 'saline',        label: 'Saline',        icon: 'water-outline' },
  { key: 'stretcher',     label: 'Stretcher',     icon: 'bed' },
  { key: 'nurse',         label: 'Nurse',         icon: 'account-heart' },
  { key: 'doctor',        label: 'Doctor',        icon: 'doctor' },
  { key: 'defibrillator', label: 'Defibrillator', icon: 'lightning-bolt' },
  { key: 'ventilator',    label: 'Ventilator',    icon: 'air-filter' },
];

export const AMBULANCE_TYPES = [
  { label: 'Basic',    value: 'basic',    color: '#43A047' },
  { label: 'Advanced', value: 'advanced', color: '#1E88E5' },
  { label: 'ICU',      value: 'icu',      color: '#E53935' },
  { label: 'Neonatal', value: 'neonatal', color: '#8E24AA' },
];

export const BOOKING_STATUS = {
  pending:     { label: 'Pending',      color: '#FF8F00', bg: '#FFF8E1' },
  confirmed:   { label: 'Confirmed',    color: '#2E7D32', bg: '#E8F5E9' },
  in_progress: { label: 'In Progress',  color: '#1565C0', bg: '#E3F2FD' },
  completed:   { label: 'Completed',    color: '#546E7A', bg: '#ECEFF1' },
  cancelled:   { label: 'Cancelled',    color: '#757575', bg: '#F5F5F5' },
  rejected:    { label: 'Rejected',     color: '#B71C1C', bg: '#FFEBEE' },
};

export const PAYMENT_METHODS = [
  { label: 'Cash',      value: 'cash' },
  { label: 'Online',    value: 'online' },
  { label: 'Insurance', value: 'insurance' },
];

export const DEFAULT_REGION = {
  latitude:       12.9716,
  longitude:      77.5946,
  latitudeDelta:  0.05,
  longitudeDelta: 0.05,
};
