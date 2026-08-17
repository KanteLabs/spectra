"use client";

import { useCallback, useEffect, useMemo, useRef } from "react";
import { ThreeEvent, useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import gsap from "gsap";
import {
  buildSpectraModel,
  type SpectraModelResult,
} from "@/model/buildSpectraModel";
import { CRT_ASSEMBLY_REV } from "@/model/parts/crtAssembly";
import { applyExplodedProgress } from "@/model/explodedLayout";
import {
  createCRTMaterial,
  applyQualityTier,
  CRT_FRAG_REV,
  CRT_VERT_REV,
} from "@/shaders/crt/CRTScreenMaterial";
import {
  SIGNAL_PRESETS,
  writeSignalUniforms,
} from "@/shaders/crt/signalPresets";
import { useTvStore } from "@/state/tvStore";
import { useUiStore } from "@/state/uiStore";
import { getSourceManager } from "@/systems/media/SourceManager";
import { createProductOrbitSource } from "@/systems/media/renderTargetSource";
import { getAudioRouter } from "@/systems/media/AudioRouter";
import { CAMERA_PRESET_MS } from "@/systems/camera/mainCrtFraming";
import type { PictureControls, ScreenId } from "@/types";
import { CONTROL_SPECS } from "@/model/controlRegistry";
import {
  accumulateKnobAngle,
  createPointerCapture,
  knobRawFromAngleDelta,
  knobRotationForValue,
  knobValueFromAngleDelta,
  pointerAngle,
  sliderValueFromDelta,
  isClickNotDrag,
  KNOB_ANGLE_DEADZONE_PX,
  KNOB_FULL_TRAVEL,
} from "@/systems/interaction/pointer";
import { tryXrHaptic } from "@/systems/interaction/haptics";
import { xrStore } from "@/systems/xr/xrStore";

import { getChannelBankIds } from "@/systems/media/sourceCatalog";
import { QUALITY_CONFIGS } from "@/systems/quality/qualityConfig";
import {
  DEPTH_MODE_CODE,
  depthAmountForQuality,
} from "@/systems/quality/depthPresets";
import { visibleSourceIdsFromScreens } from "@/systems/media/playbackPolicy";
import { MediaDropBridge } from "./MediaDropBridge";

const CHANNEL_BANK = () => getChannelBankIds();

const SCREEN_IDS = ["main", "preview1", "preview2", "preview3"] as const;
const EMPTY_IDS: ReadonlySet<string> = new Set();
/** Reused so the frame loop allocates no signal bundles. */
const signalScratch = { ...SIGNAL_PRESETS.clean };

/** Hoisted so the per-frame control sync does not rebuild it 60x a second. */
const SLIDER_RANGES: {
  id: string;
  key: keyof PictureControls;
  min: number;
  max: number;
}[] = [
  { id: "sliderBrightness", key: "brightness", min: 0.2, max: 1 },
  { id: "sliderContrast", key: "contrast", min: 0.2, max: 1.2 },
  { id: "sliderSaturation", key: "saturation", min: 0, max: 1 },
  { id: "sliderTuning", key: "tuning", min: 0, max: 1 },
  { id: "sliderVolume", key: "volume", min: 0, max: 1 },
  { id: "sliderPreview", key: "previewLevel", min: 0, max: 1 },
];

function syncPhysicalControls(
  model: SpectraModelResult,
  picture: PictureControls,
  channelBank: number
): void {
  for (const s of SLIDER_RANGES) {
    const mesh = model.controls.get(s.id);
    if (!mesh || typeof mesh.userData.restY !== "number") continue;
    const travel = 0.06;
    const t = (picture[s.key] - s.min) / (s.max - s.min);
    mesh.position.y = mesh.userData.restY + (t - 0.5) * travel;
  }

  const knob = model.controls.get("mainKnob");
  if (knob) {
    const max = Math.max(1, CHANNEL_BANK().length - 1);
    knob.rotation.set(0, 0, knobRotationForValue(channelBank, 0, max));
  }
}

function resolveControlId(object: THREE.Object3D): string | null {
  let obj: THREE.Object3D | null = object;
  while (obj) {
    if (obj.userData?.controlId) return obj.userData.controlId as string;
    if (obj.userData?.screenId) {
      const sid = obj.userData.screenId as ScreenId;
      const map: Record<ScreenId, string> = {
        main: "screenMain",
        preview1: "screenP1",
        preview2: "screenP2",
        preview3: "screenP3",
      };
      return map[sid];
    }
    obj = obj.parent;
  }
  return null;
}

function cursorForControl(controlId: string | null, dragging: boolean): string {
  if (!controlId) return "auto";
  const spec = CONTROL_SPECS.find((c) => c.id === controlId);
  if (!spec) return "auto";
  if (spec.kind === "knob" || spec.kind === "slider") {
    return dragging ? "grabbing" : "grab";
  }
  // buttons, switches, screens
  return "pointer";
}

function interactiveObjects(model: SpectraModelResult): THREE.Object3D[] {
  return [
    ...Array.from(model.controls.values()),
    model.screens.main,
    model.screens.preview1,
    model.screens.preview2,
    model.screens.preview3,
  ];
}

function pickControlId(
  raycaster: THREE.Raycaster,
  camera: THREE.Camera,
  ndc: THREE.Vector2,
  targets: THREE.Object3D[]
): string | null {
  raycaster.setFromCamera(ndc, camera);
  const hits = raycaster.intersectObjects(targets, true);
  for (const hit of hits) {
    const id = resolveControlId(hit.object);
    if (id) return id;
  }
  return null;
}

function clientToNdc(
  el: HTMLElement,
  clientX: number,
  clientY: number,
  out: THREE.Vector2
): void {
  const rect = el.getBoundingClientRect();
  out.x = ((clientX - rect.left) / rect.width) * 2 - 1;
  out.y = -((clientY - rect.top) / rect.height) * 2 + 1;
}

const LOCK_ON = new THREE.Color("#ff1a1a");
const LOCK_OFF = new THREE.Color("#e8eef2");
const LOCK_EMISSIVE_ON = new THREE.Color("#ff0000");
const LOCK_EMISSIVE_OFF = new THREE.Color("#000000");

type IndicatorMesh = { role: string; mat: THREE.MeshStandardMaterial };

/**
 * Indicator meshes never change after the model is built, so collect them once
 * instead of traversing the whole graph every frame.
 */
const indicatorCache = new WeakMap<THREE.Object3D, IndicatorMesh[]>();

function indicatorMeshes(model: SpectraModelResult): IndicatorMesh[] {
  const cached = indicatorCache.get(model.root);
  if (cached) return cached;
  const found: IndicatorMesh[] = [];
  model.root.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;
    const role = mesh.userData.indicatorRole as string | undefined;
    if (!role) return;
    const mat = mesh.material as THREE.MeshStandardMaterial;
    if (!mat || !("emissiveIntensity" in mat)) return;
    found.push({ role, mat });
  });
  indicatorCache.set(model.root, found);
  return found;
}

const SLIDER_INDICATOR_KEYS: Record<string, keyof PictureControls> = {
  sliderTuning: "tuning",
  sliderVolume: "volume",
  sliderPreview: "previewLevel",
};

function syncControlFeedback(
  model: SpectraModelResult,
  opts: {
    power: string;
    locked: boolean;
    screens: ReturnType<typeof useTvStore.getState>["screens"];
    picture: PictureControls;
    selectedControlId: string | null;
    time: number;
  }
): void {
  const powered = opts.power === "on" || opts.power === "starting";
  const mainSource = opts.screens.main.sourceId;

  for (const { role, mat } of indicatorMeshes(model)) {
    if (role === "preview1" || role === "preview2" || role === "preview3") {
      const slot = opts.screens[role];
      const lit = powered && slot.powered;
      const onMain = slot.sourceId === mainSource;
      let intensity = lit ? 0.55 : 0.06;
      if (lit && onMain) {
        intensity = 1.15 + Math.sin(opts.time * 5) * 0.2;
      }
      mat.emissiveIntensity = intensity;
      continue;
    }

    const key = SLIDER_INDICATOR_KEYS[role];
    if (key) {
      mat.emissiveIntensity = powered ? 0.12 + opts.picture[key] * 1.05 : 0.04;
    }
  }

  const lock = model.controls.get("switchLock");
  if (lock) {
    const target = opts.locked ? 0.42 : -0.38;
    lock.rotation.x = THREE.MathUtils.lerp(lock.rotation.x, target, 0.18);
    const mat = (lock as THREE.Mesh).material as THREE.MeshStandardMaterial;
    if (mat?.color) {
      mat.color.lerp(opts.locked ? LOCK_ON : LOCK_OFF, 0.28);
    }
    if (mat?.emissive) {
      mat.emissive.lerp(
        opts.locked ? LOCK_EMISSIVE_ON : LOCK_EMISSIVE_OFF,
        0.28
      );
      mat.emissiveIntensity = THREE.MathUtils.lerp(
        mat.emissiveIntensity,
        opts.locked ? 1.35 : 0,
        0.28
      );
    }
  }

  const previewSw = model.controls.get("switchPreviews");
  if (previewSw) {
    const previewsOn =
      opts.screens.preview1.powered ||
      opts.screens.preview2.powered ||
      opts.screens.preview3.powered;
    const target = previewsOn ? 0.42 : -0.38;
    previewSw.rotation.x = THREE.MathUtils.lerp(
      previewSw.rotation.x,
      target,
      0.18
    );
  }

  for (let i = 1; i <= 3; i++) {
    const kn = model.controls.get(`secondaryKnob${i}`) as THREE.Mesh | undefined;
    if (!kn?.isMesh) continue;
    const mat = kn.material as THREE.MeshStandardMaterial;
    const selected = opts.selectedControlId === `secondaryKnob${i}`;
    const previewId = `preview${i}` as Exclude<ScreenId, "main">;
    const active =
      powered &&
      opts.screens[previewId].powered &&
      opts.screens[previewId].sourceId === mainSource;
    if (mat.emissive) {
      mat.emissive.set(active || selected ? "#a87820" : "#000000");
      mat.emissiveIntensity = active ? 0.65 : selected ? 0.35 : 0;
    }
  }

  for (let i = 1; i <= 3; i++) {
    const btn = model.controls.get(`previewBtn${i}`) as THREE.Mesh | undefined;
    if (!btn?.isMesh) continue;
    const previewId = `preview${i}` as Exclude<ScreenId, "main">;
    const promoted =
      powered &&
      opts.screens[previewId].sourceId === mainSource;
    const mat = btn.material as THREE.MeshStandardMaterial;
    if (mat.emissive) {
      mat.emissive.set(promoted ? "#ff3038" : "#40080a");
      mat.emissiveIntensity = promoted
        ? 0.85 + Math.sin(opts.time * 4) * 0.15
        : 0.15;
    }
  }
}

export function SpectraTV() {
  const { gl, camera } = useThree();
  const cursorTarget = gl.domElement;
  const raycaster = useMemo(() => new THREE.Raycaster(), []);
  const ndc = useMemo(() => new THREE.Vector2(), []);

  const setSceneCursor = useCallback((cursor: string) => {
    cursorTarget.style.cursor = cursor;
  }, [cursorTarget]);

  const modelRef = useRef<SpectraModelResult | null>(null);
  const materialsRef = useRef<Record<ScreenId, THREE.ShaderMaterial> | null>(
    null
  );
  const productOrbitRef = useRef<ReturnType<
    typeof createProductOrbitSource
  > | null>(null);
  const capture = useRef(createPointerCapture());
  /** CRT glass: wait for pointer-up so a drag can orbit instead of zoom/promote. */
  const pendingScreenClick = useRef<{
    controlId: string;
    startX: number;
    startY: number;
    pointerId: number;
  } | null>(null);
  /** Ids on powered CRTs; recomputed on screen changes, read every frame. */
  const visibleIdsRef = useRef<ReadonlySet<string>>(EMPTY_IDS);
  const controlsRef = useThree((s) => s.controls) as unknown as {
    enabled: boolean;
  } | null;

  const power = useTvStore((s) => s.power);
  const powerProgress = useTvStore((s) => s.powerProgress);
  const screens = useTvStore((s) => s.screens);
  const picture = useTvStore((s) => s.picture);
  const channelBank = useTvStore((s) => s.channelBank);
  const quality = useUiStore((s) => s.quality);
  const explodedProgress = useUiStore((s) => s.explodedProgress);
  const inspectionMode = useUiStore((s) => s.inspectionMode);
  const cabinetTransparent = useUiStore((s) => s.cabinetTransparent);
  const rearRemoved = useUiStore((s) => s.rearRemoved);
  const reducedFlicker = useUiStore((s) => s.reducedFlicker);
  const focusControlId = useUiStore((s) => s.focusControlId);
  const mainDepthEffect = useUiStore((s) => s.mainDepthEffect);
  const cameraPreset = useUiStore((s) => s.cameraPreset);

  // CRT_ASSEMBLY_REV is a module constant; listing it rebuilds glass/bezels on HMR.
  const model = useMemo(
    () => buildSpectraModel(),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- assembly rev is an HMR bust key
    [CRT_ASSEMBLY_REV]
  );

  useEffect(() => {
    modelRef.current = model;

    // Live-layout probe for CDP / manual checks
    if (typeof window !== "undefined") {
      (
        window as unknown as {
          __spectraLayout: () => Record<
            string,
            { x: number; minX: number; maxX: number }
          >;
        }
      ).__spectraLayout = () => {
        const out: Record<string, { x: number; minX: number; maxX: number }> =
          {};
        const box = new THREE.Box3();
        const v = new THREE.Vector3();
        model.root.updateMatrixWorld(true);
        model.root.traverse((o) => {
          if (
            !(
              /^PreviewCRT0[123]$/.test(o.name) ||
              /^PreviewButton0[123]$/.test(o.name) ||
              /^ChannelMarker0[123]$/.test(o.name) ||
              o.name === "ControlPanelFace" ||
              /^SecondaryKnob[123]$/.test(o.name) ||
              o.name === "MainRedKnob"
            )
          ) {
            return;
          }
          box.setFromObject(o);
          o.getWorldPosition(v);
          out[o.name] = {
            x: +v.x.toFixed(4),
            minX: +box.min.x.toFixed(4),
            maxX: +box.max.x.toFixed(4),
          };
        });
        return out;
      };
    }

    // Store rest Z for buttons
    model.controls.forEach((obj) => {
      const id = obj.userData.controlId as string | undefined;
      if (
        id?.startsWith("previewBtn") ||
        id?.startsWith("secondaryKnob") ||
        id === "power"
      ) {
        obj.userData.restZ = obj.position.z;
      }
    });

    const mats: Record<ScreenId, THREE.ShaderMaterial> = {
      main: createCRTMaterial({ colorAmount: 1, quality, domeScale: 1 }),
      preview1: createCRTMaterial({ colorAmount: 0.9, quality, domeScale: 0.35 }),
      preview2: createCRTMaterial({ colorAmount: 0.9, quality, domeScale: 0.35 }),
      preview3: createCRTMaterial({ colorAmount: 0.9, quality, domeScale: 0.35 }),
    };
    materialsRef.current = mats;

    (Object.keys(model.screens) as ScreenId[]).forEach((id) => {
      model.screens[id].material = mats[id];
    });

    const mgr = getSourceManager();
    mgr.ensureFallback();
    void mgr.ensure("newsroom");
    void mgr.ensure("weather");
    void mgr.ensure("starfield");
    void mgr.ensure("automata");
    void mgr.ensure("sports");
    void mgr.ensure("variety");
    void mgr.ensure("stationId");
    void mgr.ensure("smpte");
    void mgr.ensure("broadcast");
    void mgr.ensure("archival");
    void mgr.ensure("staticSnow");

    const orbit = createProductOrbitSource(
      gl,
      QUALITY_CONFIGS[useUiStore.getState().quality].renderTargetSize
    );
    productOrbitRef.current = orbit;
    mgr.registerExternal(orbit);

    // Initial physical control poses from store
    syncPhysicalControls(model, useTvStore.getState().picture, useTvStore.getState().channelBank);

    return () => {
      Object.values(mats).forEach((m) => m.dispose());
      orbit.dispose();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [model, gl, CRT_FRAG_REV, CRT_VERT_REV]);

  // Power sequence
  useEffect(() => {
    const store = useTvStore.getState();
    const reduced = useUiStore.getState().reducedMotion;
    const tweenTarget = { value: store.powerProgress };
    let tween: gsap.core.Tween | null = null;

    if (power === "starting") {
      tweenTarget.value = 0;
      store.setPowerProgress(0);
      tween = gsap.to(tweenTarget, {
        value: 1,
        duration: reduced ? 0.35 : 1.4,
        ease: "power2.out",
        onUpdate: () => store.setPowerProgress(tweenTarget.value),
        onComplete: () => {
          store.setPower("on");
          store.setPowerProgress(1);
          getSourceManager().resumeReady();
          const audio = getAudioRouter();
          void audio.unlock().then(() => {
            if (store.audioUnlocked || audio.isUnlocked) {
              audio.playPowerOn();
              audio.startHum(0.02);
              audio.routeTo(store.screens.main.sourceId, store.picture.volume);
            }
          });
        },
      });
    } else if (power === "shuttingDown") {
      tween = gsap.to(tweenTarget, {
        value: 0,
        duration: reduced ? 0.25 : 0.9,
        ease: "power2.in",
        onUpdate: () => store.setPowerProgress(tweenTarget.value),
        onComplete: () => {
          store.setPower("off");
          store.setPowerProgress(0);
          getSourceManager().pauseAll();
          const audio = getAudioRouter();
          audio.playPowerOff();
          audio.stopHum();
          audio.routeTo(null, 0);
        },
      });
    }

    return () => {
      tween?.kill();
    };
  }, [power]);

  useEffect(() => {
    if (!useTvStore.getState().transitionActive) return;
    const t = setTimeout(() => useTvStore.getState().finishTransition(), 400);
    return () => clearTimeout(t);
  }, [
    screens.main.sourceId,
    screens.preview1.sourceId,
    screens.preview2.sourceId,
    screens.preview3.sourceId,
  ]);

  useEffect(() => {
    if (!modelRef.current) return;
    modelRef.current.internals.visible = inspectionMode;
    applyExplodedProgress(
      modelRef.current.root,
      modelRef.current.restPoses,
      explodedProgress
    );
  }, [inspectionMode, explodedProgress]);

  useEffect(() => {
    if (!modelRef.current) return;
    modelRef.current.rear.visible = !rearRemoved;
    modelRef.current.root.traverse((o) => {
      if (
        o.name === "UpperFrontPanel" ||
        o.name === "LowerCabinet" ||
        o.name === "MainCabinet"
      ) {
        const mesh = o as THREE.Mesh;
        const mat = mesh.material as THREE.MeshStandardMaterial;
        if (mat && "transparent" in mat) {
          mat.transparent = cabinetTransparent;
          mat.opacity = cabinetTransparent ? 0.35 : 1;
          mat.depthWrite = !cabinetTransparent;
        }
      }
    });
  }, [cabinetTransparent, rearRemoved]);

  useEffect(() => {
    if (materialsRef.current) {
      (Object.keys(materialsRef.current) as ScreenId[]).forEach((id) => {
        applyQualityTier(materialsRef.current![id], quality);
      });
    }
    productOrbitRef.current?.setSize(QUALITY_CONFIGS[quality].renderTargetSize);
  }, [quality]);

  // Ease CRT soft-focus with the camera preset (snap looked harsh on zoom-out).
  useEffect(() => {
    const main = materialsRef.current?.main;
    if (!main) return;
    const profile = QUALITY_CONFIGS[quality].crt;
    const reduced = useUiStore.getState().reducedMotion;
    const duration = reduced ? 0.01 : CAMERA_PRESET_MS / 1000;
    const reading = cameraPreset === "mainCrt";
    const proxy = {
      soft: main.uniforms.softFocus.value as number,
      softQ: main.uniforms.softFocusQuality.value as number,
    };
    const tween = gsap.to(proxy, {
      soft: reading ? 0 : profile.softFocus,
      softQ: reading ? 0 : profile.softFocusQuality,
      duration,
      ease: "power2.inOut",
      onUpdate: () => {
        const m = materialsRef.current?.main;
        if (!m) return;
        m.uniforms.softFocus.value = proxy.soft;
        m.uniforms.softFocusQuality.value = proxy.softQ;
      },
    });
    return () => {
      tween.kill();
    };
  }, [cameraPreset, quality, model]);

  useEffect(() => {
    const audio = getAudioRouter();
    const mgr = getSourceManager();
    const mainId = screens.main.sourceId;
    const visibleIds = visibleSourceIdsFromScreens(screens);
    visibleIdsRef.current = new Set(visibleIds);

    const unsubLoad = mgr.onLoadState((id, state) => {
      if (state !== "ready") return;
      if (visibleIds.includes(id)) {
        mgr.syncPlaybackForSourceIds(visibleIds);
      }
      // Re-bind program audio when the main clip finishes loading / audio detect
      if (id === mainId || audio.getActiveSourceId() === id) {
        void audio.syncToSource(mainId, picture.volume);
      }
    });

    if (power === "on") {
      mgr.syncPlaybackForSourceIds(visibleIds);
      if (useTvStore.getState().audioUnlocked) {
        void audio.syncToSource(mainId, picture.volume);
      }
    } else if (power === "off") {
      audio.routeTo(null, 0);
      mgr.pauseAll();
    }
    return unsubLoad;
  }, [screens, picture.volume, power]);

  // Only the matching preview button animates on promote
  useEffect(() => {
    const unsub = useTvStore.subscribe((state, prev) => {
      if (state.screens.main.sourceId === prev.screens.main.sourceId) return;
      (["preview1", "preview2", "preview3"] as const).forEach((pid, i) => {
        if (state.screens.main.sourceId !== prev.screens[pid].sourceId) return;
        const btn = modelRef.current?.controls.get(`previewBtn${i + 1}`);
        if (!btn) return;
        const restZ = (btn.userData.restZ as number) ?? btn.position.z;
        gsap.fromTo(
          btn.position,
          { z: restZ },
          { z: restZ - 0.008, duration: 0.08, yoyo: true, repeat: 1 }
        );
      });
    });
    return unsub;
  }, []);

  useFrame((state) => {
    const mgr = getSourceManager();
    const visible = visibleIdsRef.current;
    const powered =
      power === "on" || power === "starting" || power === "shuttingDown";

    // Only advance channels that are actually on a powered CRT
    mgr.update(state.clock.elapsedTime, powered ? visible : EMPTY_IDS);
    if (powered && visible.has("productOrbit")) {
      productOrbitRef.current?.render();
    }

    const mats = materialsRef.current;
    if (!mats) return;

    (SCREEN_IDS as readonly ScreenId[]).forEach((id) => {
      const slot = screens[id];
      const mat = mats[id];
      const tex = mgr.getTexture(slot.sourceId);
      if (tex) mat.uniforms.sourceTexture.value = tex;

      const sig = writeSignalUniforms(slot.signal, reducedFlicker, signalScratch);
      mat.uniforms.time.value = state.clock.elapsedTime;
      mat.uniforms.signalQuality.value = sig.signalQuality * picture.tuning;
      mat.uniforms.noiseStrength.value = sig.noiseStrength;
      mat.uniforms.rollOffset.value = sig.rollOffset;
      mat.uniforms.syncDrift.value = sig.syncDrift;
      mat.uniforms.scanlineStrength.value = sig.scanlineStrength;
      mat.uniforms.maskStrength.value = sig.maskStrength;
      mat.uniforms.rgbSeparation.value = sig.rgbSeparation;
      mat.uniforms.interlace.value = sig.interlace;
      mat.uniforms.colorAmount.value =
        id === "main"
          ? picture.saturation
          : picture.saturation * slot.colorAmount;
      mat.uniforms.brightness.value =
        id === "main"
          ? picture.brightness
          : picture.brightness * picture.previewLevel;
      mat.uniforms.contrast.value = picture.contrast;
      mat.uniforms.powerProgress.value = powerProgress;
      mat.uniforms.screenOn.value = powered && slot.powered ? 1 : 0;

      // Fake 3D + expensive soft-focus taps are main CRT only
      if (id === "main") {
        mat.uniforms.depthMode.value = DEPTH_MODE_CODE[mainDepthEffect];
        mat.uniforms.depthAmount.value = depthAmountForQuality(quality);
      } else {
        mat.uniforms.depthMode.value = 0;
        mat.uniforms.depthAmount.value = 0;
        mat.uniforms.softFocusQuality.value = 0;
        mat.uniforms.phosphorSpread.value = 0;
      }
    });

    if (modelRef.current) {
      modelRef.current.controls.forEach((obj, id) => {
        if (id === focusControlId) {
          obj.scale.setScalar(1 + Math.sin(state.clock.elapsedTime * 4) * 0.04);
        } else if (obj.scale.x !== 1) {
          obj.scale.setScalar(1);
        }
      });
    }

    if (modelRef.current && !capture.current.active) {
      syncPhysicalControls(modelRef.current, picture, channelBank);
    }

    if (modelRef.current) {
      syncControlFeedback(modelRef.current, {
        power,
        locked: useTvStore.getState().locked,
        screens,
        picture,
        selectedControlId: useTvStore.getState().selectedControlId,
        time: state.clock.elapsedTime,
      });
    }
  });

  const activateControl = (controlId: string) => {
    const store = useTvStore.getState();
    store.unlockAudio();
    void getAudioRouter().unlock();
    store.setSelectedControl(controlId);
    useUiStore.getState().setFocusControlId(controlId);

    if (controlId === "power") {
      store.togglePower();
      return;
    }
    if (controlId === "previewBtn1") store.promote("preview1");
    if (controlId === "previewBtn2") store.promote("preview2");
    if (controlId === "previewBtn3") store.promote("preview3");
    if (controlId === "switchLock") store.setLock(!store.locked);
    if (controlId === "switchPreviews") {
      const anyOn =
        store.screens.preview1.powered ||
        store.screens.preview2.powered ||
        store.screens.preview3.powered;
      store.setPreviewsPowered(!anyOn);
    }
    if (controlId === "secondaryKnob1") store.cyclePreviewSource("preview1");
    if (controlId === "secondaryKnob2") store.cyclePreviewSource("preview2");
    if (controlId === "secondaryKnob3") store.cyclePreviewSource("preview3");

    if (controlId.startsWith("secondaryKnob")) {
      const kn = modelRef.current?.controls.get(controlId);
      if (kn) {
        const restZ = (kn.userData.restZ as number) ?? kn.position.z;
        gsap.fromTo(
          kn.position,
          { z: restZ },
          { z: restZ - 0.005, duration: 0.06, yoyo: true, repeat: 1 }
        );
        gsap.to(kn.rotation, {
          z: kn.rotation.z + Math.PI / 5,
          duration: 0.18,
          ease: "power2.out",
        });
      }
    }

    if (controlId.startsWith("screenP")) {
      const map: Record<string, "preview1" | "preview2" | "preview3"> = {
        screenP1: "preview1",
        screenP2: "preview2",
        screenP3: "preview3",
      };
      const pid = map[controlId];
      if (pid) store.promote(pid);
    }
    if (controlId === "screenMain") {
      const session = (xrStore.getState() as { session?: XRSession | null })
        .session;
      if (session) {
        useUiStore.getState().setCinemaScreen(
          useUiStore.getState().cinemaScreenId === "main" ? null : "main"
        );
      } else {
        const ui = useUiStore.getState();
        ui.setMainCrtZoom(ui.cameraPreset !== "mainCrt");
      }
    }
  };

  const activateControlRef = useRef(activateControl);
  activateControlRef.current = activateControl;

  const applyPictureValue = (id: string, v: number) => {
    const store = useTvStore.getState();
    switch (id) {
      case "sliderBrightness":
        store.setPicture({ brightness: v });
        break;
      case "sliderContrast":
        store.setPicture({ contrast: v });
        break;
      case "sliderSaturation":
        store.setPicture({ saturation: v });
        break;
      case "sliderTuning":
        store.setPicture({ tuning: v });
        break;
      case "sliderVolume":
        store.setPicture({ volume: v });
        if (store.power === "on") {
          getAudioRouter().routeTo(store.screens.main.sourceId, v);
        }
        break;
      case "sliderPreview":
        store.setPicture({ previewLevel: v });
        break;
    }
  };

  const onPointerDown = (e: ThreeEvent<PointerEvent>) => {
    // OrbitControls: left = rotate, right = pan. Don't steal those for zoom.
    if (e.button !== 0) return;

    clientToNdc(cursorTarget, e.clientX, e.clientY, ndc);
    const controlId = pickControlId(
      raycaster,
      camera,
      ndc,
      interactiveObjects(model)
    );
    if (!controlId) return;

    const spec = CONTROL_SPECS.find((c) => c.id === controlId);
    if (!spec) return;

    // Glass is huge — a press+slide is orbit, a tap still zooms / promotes.
    if (spec.kind === "screen") {
      pendingScreenClick.current = {
        controlId,
        startX: e.clientX,
        startY: e.clientY,
        pointerId: e.pointerId,
      };
      return;
    }

    e.stopPropagation();

    if (controlsRef) controlsRef.enabled = false;

    const store = useTvStore.getState();
    store.unlockAudio();
    void getAudioRouter().unlock();

    let startValue = 0;
    if (spec.kind === "knob") startValue = store.channelBank;
    if (spec.kind === "slider") {
      const map: Record<string, number> = {
        sliderBrightness: store.picture.brightness,
        sliderContrast: store.picture.contrast,
        sliderSaturation: store.picture.saturation,
        sliderTuning: store.picture.tuning,
        sliderVolume: store.picture.volume,
        sliderPreview: store.picture.previewLevel,
      };
      startValue = map[spec.id] ?? 0;
    }

    // Main red knob press powers the set on
    if (spec.id === "mainKnob" && (store.power === "off" || store.power === "shuttingDown")) {
      store.togglePower();
      const knob = modelRef.current?.controls.get("mainKnob");
      if (knob) {
        gsap.fromTo(
          knob.position,
          { z: knob.position.z },
          { z: knob.position.z - 0.006, duration: 0.08, yoyo: true, repeat: 1 }
        );
      }
      if (controlsRef) controlsRef.enabled = true;
      return;
    }

    const isDrag = spec.kind === "knob" || spec.kind === "slider";
    let pivotX = e.clientX;
    let pivotY = e.clientY;
    let startAngle = 0;
    let startRotation = 0;

    if (spec.kind === "knob") {
      const knob = modelRef.current?.controls.get(controlId);
      if (knob) {
        const rect = cursorTarget.getBoundingClientRect();
        const world = new THREE.Vector3();
        knob.getWorldPosition(world);
        world.project(camera);
        pivotX = (world.x * 0.5 + 0.5) * rect.width + rect.left;
        pivotY = (-world.y * 0.5 + 0.5) * rect.height + rect.top;
        startAngle = pointerAngle(e.clientX, e.clientY, pivotX, pivotY);
        startRotation = knob.rotation.z;
      }
    }

    capture.current = {
      active: isDrag,
      controlId,
      kind: spec.kind === "knob" || spec.kind === "slider" ? spec.kind : null,
      startX: e.clientX,
      startY: e.clientY,
      startValue,
      pivotX,
      pivotY,
      startAngle,
      lastAngle: startAngle,
      angleAccum: 0,
      startRotation,
      pointerId: e.pointerId,
    };
    setSceneCursor(cursorForControl(controlId, isDrag));

    if (isDrag) {
      try {
        cursorTarget.setPointerCapture(e.pointerId);
      } catch {
        /* ignore — some browsers reject capture on synthetic events */
      }
    }

    if (spec.kind === "button" || spec.kind === "switch") {
      activateControl(controlId);
      const btn = modelRef.current?.controls.get(controlId);
      if (btn && spec.kind === "button") {
        const restZ = (btn.userData.restZ as number) ?? btn.position.z;
        gsap.fromTo(
          btn.position,
          { z: restZ },
          { z: restZ - 0.006, duration: 0.06, yoyo: true, repeat: 1 }
        );
      }
      if (controlsRef) controlsRef.enabled = true;
    }
  };

  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      const c = capture.current;
      if (!c.active || !c.controlId) return;
      if (c.pointerId >= 0 && e.pointerId !== c.pointerId) return;
      const spec = CONTROL_SPECS.find((s) => s.id === c.controlId);
      if (!spec) return;

      // Keep orbit locked for the whole press, even off the mesh
      if (controlsRef) controlsRef.enabled = false;

      const dy = e.clientY - c.startY;
      const store = useTvStore.getState();

      if (spec.kind === "knob") {
        const bank = CHANNEL_BANK();
        const min = 0;
        const max = Math.max(0, bank.length - 1);
        const detents = Math.max(1, bank.length);
        const dist = Math.hypot(e.clientX - c.pivotX, e.clientY - c.pivotY);
        // Crossing the knob center makes atan2 jump — skip until outside deadzone
        if (dist >= KNOB_ANGLE_DEADZONE_PX) {
          const angle = pointerAngle(e.clientX, e.clientY, c.pivotX, c.pivotY);
          const next = accumulateKnobAngle(c.lastAngle, angle, c.angleAccum);
          c.lastAngle = next.lastAngle;
          c.angleAccum = next.angleAccum;
        }
        const delta = c.angleAccum;
        const smooth = knobRawFromAngleDelta(
          c.startValue,
          delta,
          min,
          max,
          KNOB_FULL_TRAVEL
        );
        const v = knobValueFromAngleDelta(
          c.startValue,
          delta,
          min,
          max,
          detents,
          KNOB_FULL_TRAVEL
        );
        const bankIndex = Math.round(v);
        const knob = modelRef.current?.controls.get("mainKnob");
        if (knob) {
          knob.rotation.set(0, 0, knobRotationForValue(smooth, min, max));
        }
        if (bankIndex !== store.channelBank && bank[bankIndex]) {
          store.setChannelBank(bankIndex);
          store.assignSource("main", bank[bankIndex]);
        }
      }

      if (spec.kind === "slider") {
        const v = sliderValueFromDelta(
          c.startValue,
          dy,
          spec.min ?? 0,
          spec.max ?? 1
        );
        applyPictureValue(spec.id, v);
        const mesh = modelRef.current?.controls.get(spec.id);
        if (mesh && typeof mesh.userData.restY === "number") {
          const travel = spec.travel ?? 0.06;
          const t =
            (v - (spec.min ?? 0)) / ((spec.max ?? 1) - (spec.min ?? 0));
          mesh.position.y = mesh.userData.restY + (t - 0.5) * travel;
        }
      }
    };

    const endDrag = (e: PointerEvent) => {
      const pending = pendingScreenClick.current;
      if (pending && (pending.pointerId < 0 || e.pointerId === pending.pointerId)) {
        pendingScreenClick.current = null;
        if (
          e.type !== "pointercancel" &&
          isClickNotDrag(pending.startX, pending.startY, e.clientX, e.clientY)
        ) {
          activateControlRef.current(pending.controlId);
        }
      }

      const c = capture.current;
      if (!c.active) return;
      if (c.pointerId >= 0 && e.pointerId !== c.pointerId) return;
      const id = c.controlId;
      const pointerId = c.pointerId;
      c.active = false;
      c.controlId = null;
      c.pointerId = -1;
      if (controlsRef) controlsRef.enabled = true;
      if (pointerId >= 0 && cursorTarget.hasPointerCapture?.(pointerId)) {
        try {
          cursorTarget.releasePointerCapture(pointerId);
        } catch {
          /* ignore */
        }
      }
      setSceneCursor(cursorForControl(id, false));
    };

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", endDrag);
    window.addEventListener("pointercancel", endDrag);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", endDrag);
      window.removeEventListener("pointercancel", endDrag);
    };
  }, [controlsRef, cursorTarget, setSceneCursor]);

  useEffect(() => {
    model.root.userData.activateControl = activateControl;
    model.root.userData.pulse = (src?: XRInputSource) => tryXrHaptic(src);
  });

  // Raycast only interactive meshes on the canvas so hover works without a
  // prior click, and cabinet geometry cannot steal the hit from controls.
  useEffect(() => {
    const el = cursorTarget;
    const targets = interactiveObjects(model);

    const onMove = (e: PointerEvent) => {
      if (capture.current.active) {
        setSceneCursor(cursorForControl(capture.current.controlId, true));
        return;
      }
      clientToNdc(el, e.clientX, e.clientY, ndc);
      const controlId = pickControlId(raycaster, camera, ndc, targets);
      setSceneCursor(cursorForControl(controlId, false));
    };

    const onLeave = () => {
      if (!capture.current.active) setSceneCursor("auto");
    };

    el.addEventListener("pointermove", onMove);
    el.addEventListener("pointerleave", onLeave);
    return () => {
      el.removeEventListener("pointermove", onMove);
      el.removeEventListener("pointerleave", onLeave);
      el.style.cursor = "auto";
    };
  }, [camera, cursorTarget, model, ndc, raycaster, setSceneCursor]);

  const screenMeshes = useMemo(
    () => [
      model.screens.main,
      model.screens.preview1,
      model.screens.preview2,
      model.screens.preview3,
    ],
    [model]
  );

  return (
    <>
      <primitive object={model.root} onPointerDown={onPointerDown} />
      <MediaDropBridge screenMeshes={screenMeshes} />
    </>
  );
}
