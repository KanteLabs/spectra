"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import gsap from "gsap";
import * as THREE from "three";
import { useUiStore } from "@/state/uiStore";
import type { CameraPreset } from "@/types";
import {
  applyLevelCameraPose,
  computeMainCrtView,
  CAMERA_PRESET_MS,
} from "@/systems/camera/mainCrtFraming";
import {
  FRONT_VIEW,
  INSPECT_ORBIT_LIMITS,
  frontOrbitLimits,
} from "@/systems/camera/orbitLimits";

export { CAMERA_PRESET_MS };

const PRESETS: Record<
  Exclude<CameraPreset, "focused" | "mainCrt">,
  { position: [number, number, number]; target: [number, number, number] }
> = {
  front: { position: [...FRONT_VIEW.position], target: [...FRONT_VIEW.target] },
  side: { position: [2.4, 1.2, 0.4], target: [0, 1.0, 0] },
  rear: { position: [0, 1.2, -2.4], target: [0, 1.0, 0] },
  top: { position: [0, 3.2, 0.2], target: [0, 0.8, 0] },
  isometric: { position: [1.8, 1.8, 1.8], target: [0, 0.9, 0] },
  reset: { position: [...FRONT_VIEW.position], target: [...FRONT_VIEW.target] },
};

function goalForPreset(
  preset: CameraPreset,
  focusControlId: string | null,
  aspect: number,
  fov: number
): { position: [number, number, number]; target: [number, number, number] } {
  if (preset === "mainCrt") return computeMainCrtView(aspect, fov);
  if (preset === "focused" && focusControlId) {
    return {
      position: [0.35, 1.05, 1.35],
      target: [0.25, 0.95, 0.2],
    };
  }
  return PRESETS[preset === "focused" ? "front" : preset] ?? PRESETS.front;
}

type Orbit = NonNullable<React.ComponentRef<typeof OrbitControls>>;

const HOME_RETURN_SEC = 0.75;
const ORBIT_RETURN_ANGLE = 0.008;
const ORBIT_RETURN_PAN = 0.012;

const _offset = new THREE.Vector3();
const _sph = new THREE.Spherical();

/**
 * Drive camera + orbit target. Skip `controls.update()` during tweens — after a
 * level-locked zoom the spherical state is stale and update() snaps/jumps.
 */
function applyPose(
  camera: THREE.Camera,
  controls: Orbit,
  position: [number, number, number],
  target: [number, number, number],
  opts: { level: boolean; syncOrbit: boolean }
): void {
  controls.target.set(target[0], target[1], target[2]);
  if (opts.level) {
    applyLevelCameraPose(
      camera,
      { x: target[0], y: target[1], z: target[2] },
      { x: position[0], y: position[1], z: position[2] }
    );
  } else {
    camera.position.set(position[0], position[1], position[2]);
    camera.up.set(0, 1, 0);
    camera.lookAt(controls.target);
  }
  if (opts.syncOrbit) controls.update();
}

export function CameraRig() {
  const controlsRef = useRef<Orbit>(null);
  const tweenRef = useRef<gsap.core.Tween | null>(null);
  const presetAnimatingRef = useRef(false);
  const leveledGoalRef = useRef<{
    position: [number, number, number];
    target: [number, number, number];
  } | null>(null);
  const gestureRef = useRef({
    theta: 0,
    phi: 0,
    tx: 0,
    ty: 0,
    tz: 0,
  });
  const [freeOrbit, setFreeOrbit] = useState(true);
  const { camera, size } = useThree();
  const preset = useUiStore((s) => s.cameraPreset);
  const focusControlId = useUiStore((s) => s.focusControlId);
  const reducedMotion = useUiStore((s) => s.reducedMotion);
  const mode = useUiStore((s) => s.mode);

  const aspect =
    size.width > 0 && size.height > 0 ? size.width / size.height : 1;
  const fov = camera instanceof THREE.PerspectiveCamera ? camera.fov : 40;
  const lockSquare = preset === "mainCrt";
  const homeOrbit = preset === "front" || preset === "reset";
  const orbitLimits = homeOrbit ? frontOrbitLimits() : INSPECT_ORBIT_LIMITS;
  // Only "focused" cares about focusControlId — ignore it otherwise so CRT
  // zoom leave (preset+focus cleared together) cannot double-fire the tween.
  const focusKey = preset === "focused" ? focusControlId : null;

  useFrame(() => {
    if (mode === "xr" || preset !== "mainCrt") return;
    const goal = leveledGoalRef.current;
    const controls = controlsRef.current;
    if (!goal || !controls || presetAnimatingRef.current) return;
    applyPose(camera, controls, goal.position, goal.target, {
      level: true,
      syncOrbit: false,
    });
  }, -1);

  useEffect(() => {
    if (mode === "xr") return;

    let cancelled = false;
    let raf = 0;

    const goal = goalForPreset(preset, focusControlId, aspect, fov);
    const duration = reducedMotion ? 0.01 : CAMERA_PRESET_MS / 1000;
    const level = preset === "mainCrt";
    presetAnimatingRef.current = true;
    setFreeOrbit(false);
    if (level) leveledGoalRef.current = goal;
    else leveledGoalRef.current = null;

    const startTween = () => {
      if (cancelled) return;
      const controls = controlsRef.current;
      if (!controls) {
        raf = requestAnimationFrame(startTween);
        return;
      }

      tweenRef.current?.kill();

      // Seed proxy from the live camera (not stale orbit spherical).
      const proxy = {
        px: camera.position.x,
        py: camera.position.y,
        pz: camera.position.z,
        tx: controls.target.x,
        ty: controls.target.y,
        tz: controls.target.z,
      };

      controls.enabled = false;
      controls.enableRotate = false;

      tweenRef.current = gsap.to(proxy, {
        px: goal.position[0],
        py: goal.position[1],
        pz: goal.position[2],
        tx: goal.target[0],
        ty: goal.target[1],
        tz: goal.target[2],
        duration,
        ease: "power3.inOut",
        onUpdate: () => {
          applyPose(
            camera,
            controls,
            [proxy.px, proxy.py, proxy.pz],
            [proxy.tx, proxy.ty, proxy.tz],
            { level, syncOrbit: false }
          );
        },
        onComplete: () => {
          applyPose(camera, controls, goal.position, goal.target, {
            level,
            // Sync orbit once at the end so free-look matches the settled pose.
            syncOrbit: !level,
          });
          presetAnimatingRef.current = false;
          if (!cancelled) {
            if (level) {
              controls.enableRotate = false;
              controls.enabled = false;
              setFreeOrbit(false);
            } else {
              controls.enableRotate = true;
              controls.enabled = true;
              setFreeOrbit(true);
            }
          }
        },
      });
    };

    startTween();

    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      tweenRef.current?.kill();
      presetAnimatingRef.current = false;
      // Keep orbit disabled across handoff — next effect owns enablement.
      // Re-enabling here caused a one-frame jump before the zoom-out tween.
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preset, focusKey, camera, reducedMotion, mode]);

  useEffect(() => {
    if (mode === "xr") return;
    if (preset !== "mainCrt") return;
    if (presetAnimatingRef.current) return;
    if (reducedMotion) return;

    const controls = controlsRef.current;
    if (!controls) return;

    const goal = computeMainCrtView(aspect, fov);
    leveledGoalRef.current = goal;
    tweenRef.current?.kill();

    const proxy = {
      px: camera.position.x,
      py: camera.position.y,
      pz: camera.position.z,
      tx: controls.target.x,
      ty: controls.target.y,
      tz: controls.target.z,
    };

    tweenRef.current = gsap.to(proxy, {
      px: goal.position[0],
      py: goal.position[1],
      pz: goal.position[2],
      tx: goal.target[0],
      ty: goal.target[1],
      tz: goal.target[2],
      duration: 0.2,
      ease: "power2.out",
      onUpdate: () => {
        applyPose(
          camera,
          controls,
          [proxy.px, proxy.py, proxy.pz],
          [proxy.tx, proxy.ty, proxy.tz],
          { level: true, syncOrbit: false }
        );
      },
      onComplete: () => {
        applyPose(camera, controls, goal.position, goal.target, {
          level: true,
          syncOrbit: false,
        });
      },
    });
  }, [aspect, fov, preset, camera, mode, reducedMotion]);

  const targetSeededRef = useRef(false);
  useEffect(() => {
    if (mode === "xr") return;
    const controls = controlsRef.current;
    if (!controls || targetSeededRef.current) return;
    controls.target.set(
      FRONT_VIEW.target[0],
      FRONT_VIEW.target[1],
      FRONT_VIEW.target[2]
    );
    targetSeededRef.current = true;
    controls.update();
  }, [mode]);

  const snapshotOrbit = useCallback(() => {
    const controls = controlsRef.current;
    if (!controls) return;
    _offset.copy(camera.position).sub(controls.target);
    _sph.setFromVector3(_offset);
    gestureRef.current = {
      theta: _sph.theta,
      phi: _sph.phi,
      tx: controls.target.x,
      ty: controls.target.y,
      tz: controls.target.z,
    };
  }, [camera]);

  const returnHomeIfPeeked = useCallback(() => {
    const controls = controlsRef.current;
    if (!controls) return;
    const current = useUiStore.getState().cameraPreset;
    if (current !== "front" && current !== "reset") return;
    if (presetAnimatingRef.current) return;

    _offset.copy(camera.position).sub(controls.target);
    _sph.setFromVector3(_offset);
    const g = gestureRef.current;
    const rotated =
      Math.abs(_sph.theta - g.theta) > ORBIT_RETURN_ANGLE ||
      Math.abs(_sph.phi - g.phi) > ORBIT_RETURN_ANGLE;
    const panned =
      Math.hypot(
        controls.target.x - g.tx,
        controls.target.y - g.ty,
        controls.target.z - g.tz
      ) > ORBIT_RETURN_PAN;
    if (!rotated && !panned) return;

    const goal = FRONT_VIEW;
    const alreadyHome =
      Math.hypot(
        camera.position.x - goal.position[0],
        camera.position.y - goal.position[1],
        camera.position.z - goal.position[2]
      ) < 0.02 &&
      Math.hypot(
        controls.target.x - goal.target[0],
        controls.target.y - goal.target[1],
        controls.target.z - goal.target[2]
      ) < 0.02;
    if (alreadyHome) return;

    const duration = useUiStore.getState().reducedMotion ? 0.01 : HOME_RETURN_SEC;
    presetAnimatingRef.current = true;
    setFreeOrbit(false);
    controls.enabled = false;
    controls.enableRotate = false;
    tweenRef.current?.kill();

    const proxy = {
      px: camera.position.x,
      py: camera.position.y,
      pz: camera.position.z,
      tx: controls.target.x,
      ty: controls.target.y,
      tz: controls.target.z,
    };
    tweenRef.current = gsap.to(proxy, {
      px: goal.position[0],
      py: goal.position[1],
      pz: goal.position[2],
      tx: goal.target[0],
      ty: goal.target[1],
      tz: goal.target[2],
      duration,
      ease: "power2.inOut",
      onUpdate: () => {
        applyPose(
          camera,
          controls,
          [proxy.px, proxy.py, proxy.pz],
          [proxy.tx, proxy.ty, proxy.tz],
          { level: false, syncOrbit: false }
        );
      },
      onComplete: () => {
        applyPose(camera, controls, goal.position, goal.target, {
          level: false,
          syncOrbit: true,
        });
        presetAnimatingRef.current = false;
        if (useUiStore.getState().cameraPreset === "mainCrt") return;
        controls.enableRotate = true;
        controls.enabled = true;
        setFreeOrbit(true);
      },
    });
  }, [camera]);

  if (mode === "xr") return null;

  return (
    <OrbitControls
      ref={controlsRef}
      makeDefault
      enableDamping={freeOrbit && !lockSquare}
      dampingFactor={0.08}
      rotateSpeed={0.5}
      enableRotate={freeOrbit && !lockSquare}
      enablePan={freeOrbit && !lockSquare}
      minDistance={orbitLimits.minDistance}
      maxDistance={orbitLimits.maxDistance}
      minAzimuthAngle={orbitLimits.minAzimuthAngle}
      maxAzimuthAngle={orbitLimits.maxAzimuthAngle}
      minPolarAngle={orbitLimits.minPolarAngle}
      maxPolarAngle={orbitLimits.maxPolarAngle}
      onStart={snapshotOrbit}
      onEnd={returnHomeIfPeeked}
    />
  );
}
