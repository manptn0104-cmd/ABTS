import { MD3LightTheme } from 'react-native-paper';

export const Colors = {
  primary:        '#C62828',   // Emergency red
  primaryDark:    '#8E0000',
  primaryLight:   '#FF5F52',
  secondary:      '#1565C0',   // Medical blue
  secondaryLight: '#5E92F3',
  accent:         '#00897B',   // Teal
  success:        '#2E7D32',
  warning:        '#F57F17',
  error:          '#B71C1C',
  background:     '#F5F5F5',
  surface:        '#FFFFFF',
  card:           '#FFFFFF',
  text:           '#212121',
  textSecondary:  '#757575',
  textMuted:      '#9E9E9E',
  border:         '#E0E0E0',
  divider:        '#EEEEEE',
  white:          '#FFFFFF',
  black:          '#000000',
  overlay:        'rgba(0,0,0,0.5)',

  // Status colors
  statusPending:    '#FF8F00',
  statusConfirmed:  '#2E7D32',
  statusInProgress: '#1565C0',
  statusCompleted:  '#546E7A',
  statusCancelled:  '#757575',
  statusRejected:   '#B71C1C',

  // Ambulance type colors
  typeBasic:    '#43A047',
  typeAdvanced: '#1E88E5',
  typeICU:      '#E53935',
  typeNeonatal: '#8E24AA',
};

export const paperTheme = {
  ...MD3LightTheme,
  colors: {
    ...MD3LightTheme.colors,
    primary:          Colors.primary,
    onPrimary:        Colors.white,
    primaryContainer: Colors.primaryLight,
    secondary:        Colors.secondary,
    background:       Colors.background,
    surface:          Colors.surface,
    error:            Colors.error,
  },
};

export const Typography = {
  h1:       { fontSize: 28, fontWeight: '700', color: Colors.text },
  h2:       { fontSize: 22, fontWeight: '700', color: Colors.text },
  h3:       { fontSize: 18, fontWeight: '600', color: Colors.text },
  h4:       { fontSize: 16, fontWeight: '600', color: Colors.text },
  body:     { fontSize: 14, fontWeight: '400', color: Colors.text },
  caption:  { fontSize: 12, fontWeight: '400', color: Colors.textSecondary },
  label:    { fontSize: 13, fontWeight: '500', color: Colors.textSecondary },
};

export const Spacing = {
  xs:  4,
  sm:  8,
  md:  16,
  lg:  24,
  xl:  32,
  xxl: 48,
};

export const BorderRadius = {
  sm:  4,
  md:  8,
  lg:  12,
  xl:  16,
  xxl: 24,
  full: 999,
};

export const Shadow = {
  light: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 2,
  },
  medium: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
    elevation: 4,
  },
  heavy: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 12,
    elevation: 8,
  },
};
