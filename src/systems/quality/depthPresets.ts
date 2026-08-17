import type { MainDepthEffect } from "@/types";

/** Shader `depthMode` codes — keep in sync with `crt.frag.ts`. */
export const DEPTH_MODE_CODE: Record<MainDepthEffect, number> = {
  off: 0,
  parallax: 1,
  anaglyph: 2,
  crtDepth: 3,
};

export const MAIN_DEPTH_OPTIONS: {
  id: MainDepthEffect;
  label: string;
  hint: string;
}[] = [
  {
    id: "parallax",
    label: "Glass parallax",
    hint: "Orbit the camera — the picture should slide opposite your view",
  },
  {
    id: "anaglyph",
    label: "Anaglyph 3D",
    hint: "Red fringe on the left of edges, cyan on the right (always visible)",
  },
  {
    id: "crtDepth",
    label: "CRT depth",
    hint: "Rainbow chroma + softness toward the bezel; center looks closer",
  },
  {
    id: "off",
    label: "Off",
    hint: "Flat picture — use as the A/B reference",
  },
];

/**
 * Strength multiplier by graphics tier. Low/XR keep a whisper of parallax
 * so the default still reads, but skip heavy anaglyph/crt boosts in the shader
 * via the same scale.
 */
export function depthAmountForQuality(quality: string): number {
  switch (quality) {
    case "ultra":
      return 1.25;
    case "high":
      return 1.1;
    case "medium":
      return 0.95;
    case "low":
    case "xr":
      return 0.7;
    default:
      return 0.95;
  }
}
