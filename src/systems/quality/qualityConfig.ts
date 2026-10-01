import type { QualityLevel } from "@/types";

export interface QualityConfig {
  pixelRatioMax: number;
  /**
   * Render-scale multiplier applied on top of devicePixelRatio (SSAA).
   * > 1 supersamples, which is the cheapest big win for scanline aliasing.
   */
  supersample: number;
  shadowMapSize: number;
  /** PCFSoft shadows instead of hard shadow map lookups. */
  softShadows: boolean;
  /** MSAA samples for the post-processing composer. */
  msaaSamples: number;
  enablePost: boolean;
  enableDof: boolean;
  enableBloom: boolean;
  enableGrain: boolean;
  bloomIntensity: number;
  bloomThreshold: number;
  vignetteDarkness: number;
  grainOpacity: number;
  videoScale: number;
  renderTargetSize: number;
  environmentDetail: "full" | "simple" | "none";
  antialias: boolean;
  shadows: boolean;
  /** In-shader CRT look (cheaper than full-screen post). */
  crt: CrtQualityProfile;
}

/** Per-tier CRT shader knobs — applied via uniforms, one shader program. */
export interface CrtQualityProfile {
  curvature: number;
  scanlineStrength: number;
  maskStrength: number;
  rgbSeparation: number;
  softFocus: number;
  interlace: number;
  vignette: number;
  /** Fake phosphor bloom in-shader (helps when post bloom is off). */
  phosphorGlow: number;
  /** Neighborhood halo radius for phosphor bleed; 0 disables the extra taps. */
  phosphorSpread: number;
  /** Extra glass specular / fresnel. */
  glassSpec: number;
  /** 0 = mono grille, 1 = RGB aperture stripe. */
  maskMode: number;
  /** 0 = off, 1 = 4-tap, 2 = 9-tap soft focus (main CRT; previews force 0). */
  softFocusQuality: number;
}

export const QUALITY_CONFIGS: Record<QualityLevel, QualityConfig> = {
  ultra: {
    pixelRatioMax: 3,
    // 1.25 supersample — 1.5× was a large fill-rate hit with 4 CRTs + post
    supersample: 1.25,
    shadowMapSize: 2048,
    softShadows: true,
    msaaSamples: 4,
    enablePost: true,
    enableDof: true,
    enableBloom: true,
    enableGrain: true,
    bloomIntensity: 0.6,
    bloomThreshold: 0.68,
    vignetteDarkness: 0.5,
    grainOpacity: 0.035,
    videoScale: 1,
    renderTargetSize: 1024,
    environmentDetail: "full",
    antialias: true,
    shadows: true,
    crt: {
      curvature: 0.58,
      scanlineStrength: 0.44,
      maskStrength: 0.34,
      rgbSeparation: 0.0024,
      // Mild beam bloom — keep HUD/UI readable under supersample (was 0.13/9-tap)
      softFocus: 0.045,
      interlace: 0.48,
      vignette: 0.28,
      phosphorGlow: 0.35,
      phosphorSpread: 0,
      glassSpec: 0.22,
      maskMode: 1,
      softFocusQuality: 1,
    },
  },
  high: {
    pixelRatioMax: 2,
    supersample: 1,
    shadowMapSize: 2048,
    softShadows: true,
    msaaSamples: 4,
    enablePost: true,
    enableDof: true,
    enableBloom: true,
    enableGrain: true,
    bloomIntensity: 0.55,
    bloomThreshold: 0.72,
    vignetteDarkness: 0.5,
    grainOpacity: 0.04,
    videoScale: 1,
    renderTargetSize: 512,
    environmentDetail: "full",
    antialias: true,
    shadows: true,
    crt: {
      curvature: 0.52,
      scanlineStrength: 0.42,
      maskStrength: 0.32,
      rgbSeparation: 0.0022,
      softFocus: 0.04,
      interlace: 0.45,
      vignette: 0.28,
      phosphorGlow: 0.35,
      phosphorSpread: 0,
      glassSpec: 0.14,
      maskMode: 1,
      softFocusQuality: 1,
    },
  },
  medium: {
    pixelRatioMax: 1.5,
    supersample: 1,
    shadowMapSize: 1024,
    softShadows: false,
    msaaSamples: 4,
    enablePost: true,
    enableDof: false,
    enableBloom: true,
    enableGrain: true,
    bloomIntensity: 0.35,
    bloomThreshold: 0.82,
    vignetteDarkness: 0.45,
    grainOpacity: 0.03,
    videoScale: 0.75,
    renderTargetSize: 384,
    environmentDetail: "full",
    antialias: true,
    shadows: true,
    crt: {
      curvature: 0.42,
      scanlineStrength: 0.32,
      maskStrength: 0.22,
      rgbSeparation: 0.0015,
      softFocus: 0.06,
      interlace: 0.3,
      vignette: 0.24,
      phosphorGlow: 0.18,
      phosphorSpread: 0,
      glassSpec: 0.1,
      maskMode: 1,
      softFocusQuality: 1,
    },
  },
  low: {
    pixelRatioMax: 1,
    supersample: 1,
    shadowMapSize: 512,
    softShadows: false,
    msaaSamples: 0,
    enablePost: false,
    enableDof: false,
    enableBloom: false,
    enableGrain: false,
    bloomIntensity: 0,
    bloomThreshold: 1,
    vignetteDarkness: 0.35,
    grainOpacity: 0,
    videoScale: 0.5,
    renderTargetSize: 256,
    environmentDetail: "simple",
    antialias: false,
    shadows: false,
    crt: {
      curvature: 0.38,
      scanlineStrength: 0.18,
      maskStrength: 0.1,
      rgbSeparation: 0.0006,
      softFocus: 0,
      interlace: 0.12,
      vignette: 0.28,
      phosphorGlow: 0.12,
      phosphorSpread: 0,
      glassSpec: 0.05,
      maskMode: 0,
      softFocusQuality: 0,
    },
  },
  xr: {
    pixelRatioMax: 1,
    supersample: 1,
    shadowMapSize: 512,
    softShadows: false,
    msaaSamples: 0,
    enablePost: false,
    enableDof: false,
    enableBloom: false,
    enableGrain: false,
    bloomIntensity: 0,
    bloomThreshold: 1,
    vignetteDarkness: 0.3,
    grainOpacity: 0,
    videoScale: 0.5,
    renderTargetSize: 256,
    environmentDetail: "simple",
    antialias: true,
    shadows: false,
    crt: {
      curvature: 0.34,
      scanlineStrength: 0.16,
      maskStrength: 0.08,
      rgbSeparation: 0.0005,
      softFocus: 0,
      interlace: 0.1,
      vignette: 0.25,
      phosphorGlow: 0.1,
      phosphorSpread: 0,
      glassSpec: 0.04,
      maskMode: 0,
      softFocusQuality: 0,
    },
  },
};

const TIER_RANK: Record<QualityLevel, number> = {
  low: 0,
  xr: 0,
  medium: 1,
  high: 2,
  ultra: 3,
};

/** One step down / up the desktop tier ladder. */
export const TIER_BELOW: Record<QualityLevel, QualityLevel> = {
  ultra: "high",
  high: "medium",
  medium: "low",
  low: "low",
  xr: "xr",
};

export const TIER_ABOVE: Record<QualityLevel, QualityLevel> = {
  low: "medium",
  medium: "high",
  high: "ultra",
  ultra: "ultra",
  xr: "xr",
};

export function qualityRank(q: QualityLevel): number {
  return TIER_RANK[q] ?? 1;
}

export function clampQualityToCeiling(
  requested: QualityLevel,
  ceiling: QualityLevel
): QualityLevel {
  if (requested === "xr") return "xr";
  if (qualityRank(requested) <= qualityRank(ceiling)) return requested;
  return ceiling === "xr" ? "low" : ceiling;
}

/** Desktop / workstation GPUs that can absorb supersampling + 4K shadows. */
const ULTRA_CLASS_GPU =
  /rtx\s?(20|30|40|50)90|rtx\s?(40|50)[78]0|rtx\s?(30)[78]0|radeon\s?(rx\s?)?(7[89]|9[07])00|apple\s?m[3-9]\s?(max|ultra)|radeon\s?pro\s?w[67]/i;

/**
 * Score-based device probe → ultra | high | medium | low.
 * Factors: mobile, CPU cores, deviceMemory, Save-Data, reduced motion,
 * WebGL renderer / max texture size, DPR tax.
 *
 * `ultra` additionally requires a recognised desktop-class GPU so that a
 * high-score laptop does not get supersampled into a slideshow.
 */
export function detectDeviceQuality(): QualityLevel {
  if (typeof window === "undefined") return "medium";

  let score = 48;
  let ultraClassGpu = false;
  const nav = navigator as Navigator & {
    deviceMemory?: number;
    connection?: { saveData?: boolean; effectiveType?: string };
  };

  const isMobile = /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent);
  if (isMobile) score -= 22;

  const cores = navigator.hardwareConcurrency ?? 4;
  const mem = nav.deviceMemory ?? 4;
  score += Math.max(-12, Math.min(22, (cores - 4) * 3));
  score += Math.max(-12, Math.min(22, (mem - 4) * 4));

  if (nav.connection?.saveData) score -= 28;
  const net = nav.connection?.effectiveType;
  if (net === "2g" || net === "slow-2g") score -= 18;
  if (net === "3g") score -= 8;

  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    score -= 12;
  }

  try {
    const canvas = document.createElement("canvas");
    const gl =
      (canvas.getContext("webgl2") as WebGL2RenderingContext | null) ||
      (canvas.getContext("webgl") as WebGLRenderingContext | null);
    if (!gl) {
      score -= 25;
    } else {
      const maxTex = gl.getParameter(gl.MAX_TEXTURE_SIZE) as number;
      if (maxTex >= 16384) score += 8;
      else if (maxTex >= 8192) score += 5;
      else if (maxTex < 4096) score -= 12;

      const debugInfo = gl.getExtension("WEBGL_debug_renderer_info");
      if (debugInfo) {
        const renderer = String(
          gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL)
        ).toLowerCase();
        if (
          /nvidia|geforce|rtx|quadro|radeon|rx |apple m[1-9]|metal|adreno 7|mali-g7/i.test(
            renderer
          )
        ) {
          score += 16;
        }
        if (/apple m[2-9]|rtx [3-9]|rx 6|rx 7|radeon pro/i.test(renderer)) {
          score += 8;
        }
        if (ULTRA_CLASS_GPU.test(renderer) && !isMobile) {
          score += 12;
          ultraClassGpu = true;
        }
        if (
          /swiftshader|llvmpipe|software|microsoft basic/i.test(renderer)
        ) {
          score -= 35;
        } else if (
          /intel|uhd|hd graphics|mesa|mali-|adreno [3-5]|powervr/i.test(
            renderer
          ) &&
          !/iris xe|arc /i.test(renderer)
        ) {
          score -= 10;
        }
      }
      gl.getExtension("WEBGL_lose_context")?.loseContext();
    }
  } catch {
    score -= 8;
  }

  const dpr = window.devicePixelRatio || 1;
  if (dpr >= 2.5 && score < 75) score -= 8;
  else if (dpr >= 2 && score < 65) score -= 4;

  if (ultraClassGpu && cores >= 8 && score >= 100) return "ultra";
  if (score >= 72) return "high";
  if (score >= 42) return "medium";
  return "low";
}

/** Internal render resolution multiplier for a tier. */
export function renderScaleFor(
  quality: QualityLevel,
  devicePixelRatio: number
): number {
  const cfg = QUALITY_CONFIGS[quality];
  return Math.min(devicePixelRatio * cfg.supersample, cfg.pixelRatioMax);
}

/** @deprecated use detectDeviceQuality */
export const detectInitialQuality = detectDeviceQuality;
