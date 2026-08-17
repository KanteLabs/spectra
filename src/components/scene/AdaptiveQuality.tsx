"use client";

import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { useUiStore } from "@/state/uiStore";
import {
  TIER_ABOVE,
  TIER_BELOW,
  clampQualityToCeiling,
  qualityRank,
} from "@/systems/quality/qualityConfig";

const DROP_FPS = 26;
const RECOVER_FPS = 52;
const DROP_HOLD_SEC = 1.6;
const RECOVER_HOLD_SEC = 4.5;

/**
 * Gently lowers quality when FPS tanks; climbs back toward the device ceiling
 * when stable. Manual quality picks still win until the next auto step.
 */
export function AdaptiveQuality() {
  const emaFps = useRef(60);
  const lowTimer = useRef(0);
  const highTimer = useRef(0);

  useFrame((_, dt) => {
    const fps = 1 / Math.max(dt, 1 / 240);
    emaFps.current = emaFps.current * 0.9 + fps * 0.1;

    const { quality, qualityCeiling, mode, setQuality } = useUiStore.getState();
    if (mode === "xr" || quality === "xr") return;

    const ceiling = qualityCeiling === "xr" ? "medium" : qualityCeiling;

    if (emaFps.current < DROP_FPS) {
      lowTimer.current += dt;
      highTimer.current = 0;
      if (lowTimer.current >= DROP_HOLD_SEC && qualityRank(quality) > 0) {
        setQuality(clampQualityToCeiling(TIER_BELOW[quality], ceiling));
        lowTimer.current = 0;
      }
    } else if (emaFps.current > RECOVER_FPS) {
      highTimer.current += dt;
      lowTimer.current = 0;
      if (
        highTimer.current >= RECOVER_HOLD_SEC &&
        qualityRank(quality) < qualityRank(ceiling)
      ) {
        setQuality(clampQualityToCeiling(TIER_ABOVE[quality], ceiling));
        highTimer.current = 0;
      }
    } else {
      lowTimer.current = 0;
      highTimer.current = 0;
    }
  });

  return null;
}
