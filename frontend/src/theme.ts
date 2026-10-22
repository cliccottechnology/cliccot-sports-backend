/** JETZ brand tokens — Deep Navy Blue + Athletic Orange only (+ neutrals). */
export const theme = {
  colors: {
    navy: '#102A56', // Deep Navy Blue — sidebar, headings, primary surfaces
    navyHover: '#0C2145',
    navyActive: '#091A38',
    navySoft: '#E8EDF5', // navy tint for chips / hovers

    accent: '#FF6B2C', // Athletic Orange — actions & selected indicators only
    accentHover: '#E85A1F',
    accentSoft: '#FFF1E8', // light orange tint for icon chips / highlights

    background: '#F5F7FB', // Main Background
    surface: '#FFFFFF', // Card Background
    surfaceHover: '#EEF2F8',

    text: '#142238', // Primary Text
    textMuted: '#64748B', // Secondary Text
    textFaint: '#8A99B0',

    border: '#E2E8F0', // Border

    // functional status colors (not brand decoration)
    success: '#16A34A',
    successBg: '#E7F6EC',
    warning: '#D97706',
    warningBg: '#FEF3C7',
    danger: '#DC2626',
    dangerBg: '#FDECEC',
  },
  font: {
    family: "'Poppins', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
  },
  radius: { sm: 8, md: 10, lg: 12, pill: 999 },
  shadow: {
    card: '0 1px 2px rgba(16,42,86,0.05), 0 8px 24px rgba(16,42,86,0.06)',
    cardHover: '0 2px 6px rgba(16,42,86,0.08), 0 12px 32px rgba(16,42,86,0.10)',
  },
  spacing: (n: number) => n * 8,
} as const;

export type Theme = typeof theme;
