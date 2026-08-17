import * as THREE from "three";
import { crtVertexShader, CRT_VERT_REV } from "./crt.vert";
import { crtFragmentShader, CRT_FRAG_REV } from "./crt.frag";
import type { QualityLevel } from "@/types";
import { QUALITY_CONFIGS, type CrtQualityProfile } from "@/systems/quality/qualityConfig";

export { crtVertexShader, CRT_VERT_REV } from "./crt.vert";
export { CRT_FRAG_REV } from "./crt.frag";

const blank = new THREE.DataTexture(new Uint8Array([8, 8, 10, 255]), 1, 1);
blank.needsUpdate = true;

function applyCrtProfile(
  uniforms: Record<string, { value: number }>,
  profile: CrtQualityProfile
): void {
  uniforms.curvature.value = profile.curvature;
  uniforms.scanlineStrength.value = profile.scanlineStrength;
  uniforms.maskStrength.value = profile.maskStrength;
  uniforms.rgbSeparation.value = profile.rgbSeparation;
  uniforms.softFocus.value = profile.softFocus;
  uniforms.interlace.value = profile.interlace;
  uniforms.vignette.value = profile.vignette;
  uniforms.phosphorGlow.value = profile.phosphorGlow;
  uniforms.phosphorSpread.value = profile.phosphorSpread;
  uniforms.glassSpec.value = profile.glassSpec;
  uniforms.maskMode.value = profile.maskMode;
  uniforms.softFocusQuality.value = profile.softFocusQuality;
}

export function createCRTMaterial(options?: {
  colorAmount?: number;
  quality?: QualityLevel;
  /** 1 = main tube; <1 softens live vertex dome on smaller CRTs. */
  domeScale?: number;
}): THREE.ShaderMaterial {
  const quality = options?.quality ?? "medium";
  const profile = QUALITY_CONFIGS[quality].crt;

  const mat = new THREE.ShaderMaterial({
    uniforms: {
      sourceTexture: { value: blank },
      curvature: { value: profile.curvature },
      domeScale: { value: options?.domeScale ?? 1 },
      scanlineStrength: { value: profile.scanlineStrength },
      maskStrength: { value: profile.maskStrength },
      noiseStrength: { value: 0.02 },
      colorAmount: { value: options?.colorAmount ?? 1 },
      signalQuality: { value: 1 },
      time: { value: 0 },
      brightness: { value: 0.55 },
      contrast: { value: 0.55 },
      powerProgress: { value: 0 },
      rollOffset: { value: 0 },
      syncDrift: { value: 0 },
      vignette: { value: profile.vignette },
      rgbSeparation: { value: profile.rgbSeparation },
      interlace: { value: profile.interlace },
      softFocus: { value: profile.softFocus },
      screenOn: { value: 0 },
      phosphorGlow: { value: profile.phosphorGlow },
      phosphorSpread: { value: profile.phosphorSpread },
      glassSpec: { value: profile.glassSpec },
      maskMode: { value: profile.maskMode },
      softFocusQuality: { value: profile.softFocusQuality },
      depthMode: { value: 0 },
      depthAmount: { value: 0 },
    },
    vertexShader: crtVertexShader,
    fragmentShader: crtFragmentShader,
    transparent: false,
    toneMapped: false,
  });

  return mat;
}

export function applyQualityTier(
  mat: THREE.ShaderMaterial,
  quality: QualityLevel
): void {
  const profile = QUALITY_CONFIGS[quality].crt;
  applyCrtProfile(
    mat.uniforms as unknown as Record<string, { value: number }>,
    profile
  );
}
