export const colors = {
  background: '#F8FAFC',
  surface: '#FFFFFF',
  surfaceMuted: '#F1F5F9',
  border: '#CBD5E1',
  borderStrong: '#475569',
  primary: '#1E40AF',
  primaryPressed: '#1E3A8A',
  onPrimary: '#FFFFFF',
  text: '#0F172A',
  textSecondary: '#334155',
  textMuted: '#475569',
  danger: '#B91C1C',
  dangerPressed: '#991B1B',
  dangerSurface: '#FEE2E2',
  dangerBorder: '#FCA5A5',
  successSurface: '#DCFCE7',
  successText: '#166534',
  focus: '#2563EB',
  tabInactive: '#475569',
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
} as const;

export const radius = {
  md: 12,
  lg: 18,
  full: 999,
} as const;

export const layout = {
  touchTarget: 56,
  maxContentWidth: 560,
} as const;

export const typography = {
  title: 30,
  heading: 24,
  body: 17,
  label: 15,
  small: 14,
} as const;
