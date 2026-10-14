export const colors = {
  bg: '#F6F4FA',
  card: '#FFFFFF',
  text: '#16231B',
  muted: '#667369',
  border: '#E3E9E2',
  primary: '#1F8A4C',
  primaryDark: '#136B38',
  primarySoft: '#E3F4EA',
  accent: '#F28C28',
  danger: '#C0392B',
  protein: '#3B82C4',
  carbs: '#F2A93B',
  fat: '#D9667A',
  warnBg: '#FFF3DD',
  urgentBg: '#FDE7E4',
  water: '#3B9AD9',
  gradientA: '#17743F',
  gradientB: '#2FB172',
};

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24 };
export const radius = { sm: 10, md: 16, lg: 24, pill: 999 };

/** Soft, modern card shadow (react-native-web and RN 0.76+ understand `boxShadow`). */
export const shadow = { boxShadow: '0 6px 20px rgba(22, 35, 27, 0.07)' } as const;
export const shadowStrong = { boxShadow: '0 12px 32px rgba(22, 35, 27, 0.14)' } as const;
