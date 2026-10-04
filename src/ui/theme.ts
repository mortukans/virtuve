/**
 * Virtuve design tokens — "Virtuve dzīvo" redesign.
 *
 * Three layers: a deep near-black "night kitchen" background, warm ingredient
 * cards (cream / saffron / herb / paprika) used sparingly, and motion as
 * feedback. Saffron is reserved for the current action, active tab, progress and
 * important states — it is NOT a background everywhere. Freshness keeps its own
 * small semantic scale (herb = fresh, saffron = soon, paprika = urgent).
 */
export const colors = {
  bg: '#0C100D', // night kitchen — deep near-black
  surface: '#151A16', // raised surface
  surfaceAlt: '#1D241E', // raised surface 2
  surfaceHigh: '#273028', // highest raise (pressed / nested)
  border: 'rgba(255,255,255,0.10)', // hairline
  text: '#FFF6E7', // cream
  textMuted: '#A8AEA5',
  textFaint: '#70756C',
  accent: '#FFB43E', // saffron — the current action
  accentDeep: '#E89A2E',
  accentSoft: '#FFD58C', // soft saffron
  accentText: '#241A06', // warm near-black text on saffron
  cream: '#FFF6E7',
  herb: '#92D37A', // fresh / positive
  paprika: '#FF715B', // urgent / destructive / tomato
  green: '#92D37A', // alias: fresh
  yellow: '#F2C94C', // use soon
  orange: '#F2994A', // use today
  red: '#FF715B', // expired / urgent / danger
  blue: '#7BB0FF', // info
  heart: '#FF6E86', // loved
  overlay: 'rgba(0,0,0,0.6)',
  scrim: 'rgba(12,16,13,0.0)', // for fade gradients (pair with bg)
} as const;

/** Add an alpha channel to a hex colour (#RRGGBB → rgba). */
export const withAlpha = (hex: string, a: number): string => {
  const h = hex.replace('#', '');
  if (h.length !== 6) return hex;
  const n = parseInt(h, 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
};

/** Freshness → colour (matches inventory `freshness` enum). */
export const freshnessColor = (f: string): string =>
  f === 'fresh' ? colors.herb
    : f === 'use_soon' ? colors.yellow
    : f === 'use_today' ? colors.orange
    : f === 'expired' ? colors.paprika
    : colors.textMuted;

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32, huge: 48 } as const;

/** Rounded, continuous-feeling corners. Cards = lg (22), inputs = md (18). */
export const radius = { sm: 14, md: 18, lg: 22, xl: 30, pill: 999 } as const;

/** Clearance so scroll content clears the floating tab dock. */
export const DOCK_CLEARANCE = 104;

export const type = {
  hero: { fontSize: 44, fontWeight: '800' as const, letterSpacing: -1.2, color: colors.text },
  display: { fontSize: 40, fontWeight: '800' as const, letterSpacing: -1, color: colors.text },
  h1: { fontSize: 33, fontWeight: '800' as const, letterSpacing: -0.6, color: colors.text },
  h2: { fontSize: 23, fontWeight: '700' as const, letterSpacing: -0.3, color: colors.text },
  h3: { fontSize: 18, fontWeight: '700' as const, color: colors.text },
  body: { fontSize: 17, fontWeight: '400' as const, color: colors.text },
  bodyStrong: { fontSize: 17, fontWeight: '600' as const, color: colors.text },
  small: { fontSize: 14, fontWeight: '500' as const, color: colors.textMuted },
  tiny: { fontSize: 13, fontWeight: '600' as const, letterSpacing: 1.0, color: colors.textMuted },
} as const;

export const shadow = {
  card: {
    shadowColor: '#000',
    shadowOpacity: 0.22,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 6,
  },
  dock: {
    shadowColor: '#000',
    shadowOpacity: 0.35,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 10 },
    elevation: 14,
  },
  fab: {
    shadowColor: colors.accentDeep,
    shadowOpacity: 0.45,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 12,
  },
} as const;

/**
 * Motion constants. Mirrors the spec's SwiftUI springs for Reanimated / Animated.
 * standard: response 0.38 / damping 0.82 · soft: response 0.55 / damping 0.90.
 */
export const motion = {
  spring: { damping: 17, stiffness: 190, mass: 1 },
  springSoft: { damping: 20, stiffness: 110, mass: 1 },
  pressScale: 0.985,
  riseMs: 350,
  pressMs: 120,
} as const;
