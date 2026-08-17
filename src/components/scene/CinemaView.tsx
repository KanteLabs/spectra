"use client";

import { useEffect, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import { useXR } from "@react-three/xr";
import { useUiStore } from "@/state/uiStore";
import { getSourceManager } from "@/systems/media/SourceManager";
import { useTvStore } from "@/state/tvStore";
import { createCRTMaterial } from "@/shaders/crt/CRTScreenMaterial";

/**
 * Floating cinema panel — only while an immersive XR session is active.
 */
export function CinemaView() {
  const session = useXR((s) => s.session);
  const cinemaId = useUiStore((s) => s.cinemaScreenId);
  const sourceId = useTvStore((s) => s.screens.main.sourceId);
  const mat = useMemo(
    () => createCRTMaterial({ colorAmount: 1, quality: "medium" }),
    []
  );

  // Always clear cinema state outside a live XR session
  useEffect(() => {
    if (!session && cinemaId) {
      useUiStore.getState().setCinemaScreen(null);
    }
  }, [session, cinemaId]);

  useFrame((state) => {
    if (!cinemaId || !session) return;
    const tex = getSourceManager().getTexture(sourceId);
    if (tex) mat.uniforms.sourceTexture.value = tex;
    mat.uniforms.time.value = state.clock.elapsedTime;
    mat.uniforms.powerProgress.value = 1;
    mat.uniforms.screenOn.value = 1;
    mat.uniforms.signalQuality.value = 1;
    mat.uniforms.brightness.value = 0.7;
    mat.uniforms.contrast.value = 0.65;
  });

  if (!session || !cinemaId) return null;

  return (
    <group position={[0, 1.4, -0.8]}>
      <mesh
        onClick={(e) => {
          e.stopPropagation();
          useUiStore.getState().setCinemaScreen(null);
        }}
      >
        <planeGeometry args={[1.6, 0.9, 24, 16]} />
        <primitive object={mat} attach="material" />
      </mesh>
    </group>
  );
}
