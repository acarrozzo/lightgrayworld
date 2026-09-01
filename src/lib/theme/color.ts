/**
 * Small colour maths used by theme derivation and the contrast checks.
 *
 * Deliberately dependency-free and sRGB-only: the values it handles are
 * hand-authored `#rrggbb` theme colours, and the results are compared against
 * WCAG ratios, which are themselves defined in sRGB.
 */

export interface Rgb {
  r: number
  g: number
  b: number
}

/** Parse `#rgb`, `#rrggbb` or `#rrggbbaa` (alpha ignored). Throws on garbage. */
export function parseHex(hex: string): Rgb {
  const raw = hex.trim().replace(/^#/, '')
  const expanded =
    raw.length === 3 || raw.length === 4
      ? raw
          .slice(0, 3)
          .split('')
          .map((c) => c + c)
          .join('')
      : raw.slice(0, 6)

  if (!/^[0-9a-fA-F]{6}$/.test(expanded)) {
    throw new Error(`Not a hex colour: ${hex}`)
  }

  const n = parseInt(expanded, 16)
  return { r: (n >> 16) & 0xff, g: (n >> 8) & 0xff, b: n & 0xff }
}

const clampByte = (n: number) => Math.max(0, Math.min(255, Math.round(n)))

export function toHex({ r, g, b }: Rgb): string {
  const hex = (n: number) => clampByte(n).toString(16).padStart(2, '0')
  return `#${hex(r)}${hex(g)}${hex(b)}`
}

/**
 * Blend `amount` of `to` into `from`, in sRGB.
 *
 * sRGB rather than a perceptual space on purpose: these mixes are almost always
 * "push this colour toward the panel behind it", and matching what the eye sees
 * in the browser's own `color-mix(in srgb, ...)` keeps authored and derived
 * values consistent.
 */
export function mix(from: string, to: string, amount: number): string {
  const a = parseHex(from)
  const b = parseHex(to)
  const t = Math.max(0, Math.min(1, amount))
  return toHex({
    r: a.r + (b.r - a.r) * t,
    g: a.g + (b.g - a.g) * t,
    b: a.b + (b.b - a.b) * t,
  })
}

/** `#rrggbb` plus an alpha channel, as `#rrggbbaa`. */
export function alpha(hex: string, a: number): string {
  const { r, g, b } = parseHex(hex)
  const byte = clampByte(Math.max(0, Math.min(1, a)) * 255)
  return `${toHex({ r, g, b })}${byte.toString(16).padStart(2, '0')}`
}

/** WCAG relative luminance. */
export function luminance(hex: string): number {
  const { r, g, b } = parseHex(hex)
  const channel = (v: number) => {
    const s = v / 255
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4)
  }
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b)
}

/** WCAG contrast ratio between two opaque colours, 1..21. */
export function contrast(a: string, b: string): number {
  const la = luminance(a)
  const lb = luminance(b)
  const [hi, lo] = la > lb ? [la, lb] : [lb, la]
  return (hi + 0.05) / (lo + 0.05)
}

/**
 * Lift `color` until it reads at `target` contrast against `background`.
 *
 * Used by region derivation and by the theme linter's auto-repair: a region's
 * identity colour is authored for recognisability, not for legibility as body
 * text, so the title/subtitle slots derived from it get pushed toward the
 * theme's brightest text until they clear the bar. Gives up after enough steps
 * to reach white/black, and returns the best it managed.
 */
export function ensureContrast(
  color: string,
  background: string,
  target: number,
  toward?: string
): string {
  if (contrast(color, background) >= target) return color

  const destination = toward ?? (luminance(background) > 0.5 ? '#000000' : '#ffffff')
  let best = color

  for (let step = 1; step <= 20; step++) {
    const candidate = mix(color, destination, step / 20)
    best = candidate
    if (contrast(candidate, background) >= target) return candidate
  }

  return best
}

/** OKLab coordinates: perceptual lightness plus two opponent axes. */
export interface Oklab {
  L: number
  a: number
  b: number
}

/**
 * sRGB to OKLab (Björn Ottosson's transform).
 *
 * Used for judging whether two colours are *visibly* different. Plain RGB
 * distance is not fit for that job here: the roles this codebase most needs to
 * keep apart — attack, HP, error, Red Town — are all reds, and RGB distance
 * rates two very different reds as near-identical because they share a channel.
 */
export function toOklab(hex: string): Oklab {
  const { r, g, b } = parseHex(hex)
  const lin = (v: number) => {
    const s = v / 255
    return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4)
  }
  const R = lin(r)
  const G = lin(g)
  const B = lin(b)

  const l = Math.cbrt(0.4122214708 * R + 0.5363325363 * G + 0.0514459929 * B)
  const m = Math.cbrt(0.2119034982 * R + 0.6806995451 * G + 0.1073969566 * B)
  const s = Math.cbrt(0.0883024619 * R + 0.2817188376 * G + 0.6299787005 * B)

  return {
    L: 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    a: 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    b: 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  }
}

/**
 * Perceptual difference between two colours, in OKLab units.
 *
 * Roughly: 0.02 is just noticeable side by side, 0.05 is comfortably different,
 * 0.10 reads as two different colours at a glance.
 */
export function deltaE(a: string, b: string): number {
  const x = toOklab(a)
  const y = toOklab(b)
  const dL = x.L - y.L
  const da = x.a - y.a
  const db = x.b - y.b
  return Math.sqrt(dL * dL + da * da + db * db)
}

/** OKLab back to an sRGB hex, clipped to gamut. */
export function fromOklab({ L, a, b }: Oklab): string {
  const l_ = L + 0.3963377774 * a + 0.2158037573 * b
  const m_ = L - 0.1055613458 * a - 0.0638541728 * b
  const s_ = L - 0.0894841775 * a - 1.291485548 * b

  const l = l_ * l_ * l_
  const m = m_ * m_ * m_
  const s = s_ * s_ * s_

  const R = 4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s
  const G = -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s
  const B = -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s

  const gamma = (v: number) => {
    const c = v <= 0.0031308 ? 12.92 * v : 1.055 * Math.pow(Math.max(v, 0), 1 / 2.4) - 0.055
    return c * 255
  }

  return toHex({ r: gamma(R), g: gamma(G), b: gamma(B) })
}

/**
 * Move a colour up or down in perceptual lightness, keeping its hue and chroma.
 *
 * The reason this exists rather than `mix(color, white, n)`: mixing toward
 * white raises lightness by draining chroma, so a red pushed brighter a few
 * times becomes beige. Separating theme roles needs a lightness axis that does
 * not spend the colour's saturation to move along it.
 */
export function adjustLightness(hex: string, delta: number): string {
  const lab = toOklab(hex)
  return fromOklab({ ...lab, L: Math.max(0, Math.min(1, lab.L + delta)) })
}

/**
 * Scale a colour's chroma, keeping its hue and lightness.
 *
 * The saturation axis. Useful where "more of this colour" is the right
 * correction rather than "lighter" — an error is loud because it is saturated,
 * and brightening it instead turns red into pink.
 */
export function adjustChroma(hex: string, factor: number): string {
  const { L, a, b } = toOklab(hex)
  return fromOklab({ L, a: a * factor, b: b * factor })
}
