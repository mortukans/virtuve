/**
 * Virtuve design tokens. Dark, warm, premium — deliberately NOT a green "eco
 * recipe app". One confident honey-amber accent, large food imagery, strong
 * typography. Freshness has its own small semantic scale.
 */
export const colors = {
  bg: '#12140F', // warm near-black
  surface: '#1C1E17',
  surfaceAlt: '#262921',
  surfaceHigh: '#30332A',
  border: '#343830',
  text: '#F5F3EC', // warm white
  textMuted: '#A6A596',
  textFaint: '#71756A',
  accent: '#F2A33C', // honey amber
  accentDeep: '#D98521',
  accentText: '#2A1A00',
  green: '#5BBF66', // fresh / positive
  yellow: '#F2C94C', // use soon
  orange: '#F08E3C', // use today
  red: '#E5674F', // expired / urgent / tomato
  blue: '#6AA9FF', // info
  heart: '#FF5E7A', // loved
  overlay: 'rgba(0,0,0,0.6)',
} as const;

/** Freshness → colour (matches inventory `freshness` enum). */
export const freshnessColor = (f: string): string =>
  f === 'fresh' ? colors.green : f === 'use_soon' ? colors.yellow : f === 'use_today' ? colors.orange : f === 'expired' ? colors.red : colors.textMuted;

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32, huge: 48 } as const;
export const radius = { sm: 8, md: 12, lg: 18, xl: 26, pill: 999 } as const;

export const type = {
  display: { fontSize: 40, fontWeight: '800' as const, letterSpacing: -1, color: colors.text },
  h1: { fontSize: 28, fontWeight: '800' as const, letterSpacing: -0.5, color: colors.text },
  h2: { fontSize: 22, fontWeight: '700' as const, color: colors.text },
  h3: { fontSize: 18, fontWeight: '700' as const, color: colors.text },
  body: { fontSize: 16, fontWeight: '400' as const, color: colors.text },
  bodyStrong: { fontSize: 16, fontWeight: '600' as const, color: colors.text },
  small: { fontSize: 13, fontWeight: '500' as const, color: colors.textMuted },
  tiny: { fontSize: 11, fontWeight: '600' as const, letterSpacing: 0.4, color: colors.textMuted },
} as const;

export const shadow = {
  card: {
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
  },
} as const;
