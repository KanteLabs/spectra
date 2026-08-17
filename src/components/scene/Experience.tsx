"use client";

import { Suspense, useEffect, useMemo, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import * as THREE from "three";
import {
  EffectComposer,
  Bloom,
  Vignette,
  Noise,
  DepthOfField,
} from "@react-three/postprocessing";
import type { DepthOfFieldEffect } from "postprocessing";
import { XR } from "@react-three/xr";
import { SpectraTV } from "./SpectraTV";
import { CameraRig } from "./CameraRig";
import { CAMERA_PRESET_MS } from "@/systems/camera/mainCrtFraming";
import { SceneEnvironment } from "./SceneEnvironment";
import { XRRig } from "./XRRig";
import { CinemaView } from "./CinemaView";
import { InspectionLabels } from "./InspectionMode";
import { AdaptiveQuality } from "./AdaptiveQuality";
import { useUiStore } from "@/state/uiStore";
import {
  QUALITY_CONFIGS,
  detectDeviceQuality,
  renderScaleFor,
} from "@/systems/quality/qualityConfig";
import { KeyboardBridge } from "./KeyboardBridge";
import { xrStore } from "@/systems/xr/xrStore";

export { xrStore };

const DOF_BOKEH_ROOM = 2.4;
const DOF_BOKEH_READING = 0;

/**
 * Keep DepthOfField mounted and ease bokeh while reading the CRT.
 * Unmounting / recreating DoF rebuilds EffectComposer passes and can stall
 * VideoTexture uploads (audio keeps playing, picture freezes).
 */
function ReadingAwareDoF() {
  const ref = useRef<DepthOfFieldEffect>(null);
  useFrame((_, dt) => {
    const effect = ref.current;
    if (!effect) return;
    const reading = useUiStore.getState().cameraPreset === "mainCrt";
    const target = reading ? DOF_BOKEH_READING : DOF_BOKEH_ROOM;
    // Match camera preset duration — avoid snapping blur back on zoom-out.
    const tau = (CAMERA_PRESET_MS / 1000) * 0.35;
    const k = 1 - Math.exp(-dt / Math.max(0.05, tau));
    effect.bokehScale += (target - effect.bokehScale) * k;
  });
  return (
    <DepthOfField
      ref={ref}
      focusDistance={0.018}
      focalLength={0.045}
      bokehScale={DOF_BOKEH_ROOM}
    />
  );
}

function PostFX() {
  const quality = useUiStore((s) => s.quality);
  const mode = useUiStore((s) => s.mode);
  const cfg = QUALITY_CONFIGS[quality];
  // Intentionally do NOT subscribe to cameraPreset here — that re-renders
  // EffectComposer and rebuilds passes (video freeze with audio still playing).
  if (mode === "xr" || !cfg.enablePost) return null;
  return (
    <EffectComposer multisampling={cfg.antialias ? cfg.msaaSamples : 0}>
      {cfg.enableBloom ? (
        <Bloom
          intensity={cfg.bloomIntensity}
          luminanceThreshold={cfg.bloomThreshold}
          luminanceSmoothing={0.4}
          mipmapBlur
        />
      ) : (
        <></>
      )}
      {cfg.enableDof ? <ReadingAwareDoF /> : <></>}
      <Vignette offset={0.22} darkness={cfg.vignetteDarkness} />
      {cfg.enableGrain ? <Noise opacity={cfg.grainOpacity} /> : <></>}
    </EffectComposer>
  );
}

export function Experience() {
  const quality = useUiStore((s) => s.quality);
  const mode = useUiStore((s) => s.mode);
  const setMode = useUiStore((s) => s.setMode);
  const setXrSupported = useUiStore((s) => s.setXrSupported);
  const setQuality = useUiStore((s) => s.setQuality);
  const cfg = QUALITY_CONFIGS[quality];

  useEffect(() => {
    useUiStore.getState().setCinemaScreen(null);
  }, []);

  useEffect(() => {
    if (typeof navigator !== "undefined" && navigator.xr) {
      void navigator.xr.isSessionSupported("immersive-vr").then((ok) => {
        setXrSupported(ok);
      });
    }
  }, [setXrSupported]);

  useEffect(() => {
    const unsub = xrStore.subscribe((s, prev) => {
      const session = (s as { session?: XRSession | null }).session;
      const prevSession = (prev as { session?: XRSession | null })?.session;
      if (session && !prevSession) {
        setMode("xr");
        setQuality("xr");
      } else if (!session && prevSession) {
        setMode("desktop");
        const detected = detectDeviceQuality();
        setQuality(detected);
        useUiStore.getState().setQualityCeiling(
          detected === "xr" ? "medium" : detected
        );
      }
    });
    return unsub;
  }, [setMode, setQuality]);

  // Ultra supersamples above devicePixelRatio (1.25×) — fidelity win for
  // scanlines without the old 1.5× fill-rate hit across four CRTs.
  // scanline/aperture aliasing, and the first thing AdaptiveQuality gives back.
  const dpr = useMemo(
    () =>
      typeof window !== "undefined"
        ? renderScaleFor(quality, window.devicePixelRatio)
        : 1,
    [quality]
  );

  return (
    <>
      <KeyboardBridge />
      <Canvas
        shadows={cfg.shadows ? (cfg.softShadows ? "soft" : true) : false}
        dpr={dpr}
        gl={{
          antialias: cfg.antialias,
          powerPreference: "high-performance",
          outputColorSpace: THREE.SRGBColorSpace,
          toneMapping: THREE.ACESFilmicToneMapping,
          preserveDrawingBuffer: true,
        }}
        camera={{ position: [0, 1.12, 1.68], fov: 40, near: 0.05, far: 40 }}
        style={{ position: "absolute", inset: 0 }}
        onCreated={({ gl }) => {
          gl.toneMappingExposure =
            quality === "ultra" || quality === "high" ? 1.12 : 1.05;
        }}
      >
        <XR store={xrStore}>
          <color attach="background" args={["#1a1210"]} />
          <Suspense fallback={null}>
            <SceneEnvironment />
          </Suspense>
          <SpectraTV />
          <CameraRig />
          <XRRig />
          {mode === "xr" ? <CinemaView /> : null}
          <InspectionLabels />
          <AdaptiveQuality />
          {mode !== "xr" && cfg.enablePost && (
            <Suspense fallback={null}>
              <PostFX />
            </Suspense>
          )}
        </XR>
      </Canvas>
    </>
  );
}
