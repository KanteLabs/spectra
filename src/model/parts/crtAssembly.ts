import * as THREE from "three";
import type { SpectraMaterials } from "../materials";
import { MAIN_CRT_FRAME } from "@/systems/camera/mainCrtFraming";
import {
  namedGroup,
  namedMesh,
  roundedFrame,
  roundedPlane,
  crtGlassPlane,
  crtApertureRadius,
} from "./geometry";

/** Bump when CRT geometry changes so SpectraTV rebuilds the model on HMR. */
export const CRT_ASSEMBLY_REV = 25;

/**
 * Equal-spaced preview bank under the main CRT.
 * Sized to leave a clear margin before {@link CONTROL_STRIP}.
 */
export const PREVIEW_BANK = {
  outerW: 0.21,
  outerH: 0.155,
  /** Clear gap between neighboring bezels (equal by construction). */
  gap: 0.055,
  /** First preview center X — bank grows rightward with equal spacing. */
  startX: -0.38,
  y: 0.02,
  z: 0.2,
} as const;

/** Lower-right control face — must clear preview3's right bezel. */
export const CONTROL_STRIP = {
  panelX: 0.412,
  panelW: 0.17,
  panelZ: 0.2,
  /** Main channel knob stays under the vent (not tied to strip X). */
  mainKnobX: 0.42,
  mainKnobY: 0.22,
} as const;

export function previewBankCenters(): [number, number, number] {
  const { outerW, gap, startX } = PREVIEW_BANK;
  const spacing = outerW + gap;
  return [startX, startX + spacing, startX + 2 * spacing];
}

export function previewBankClearance(): number {
  const [, , c3] = previewBankCenters();
  const previewRight = c3 + PREVIEW_BANK.outerW * 0.5;
  const panelLeft = CONTROL_STRIP.panelX - CONTROL_STRIP.panelW * 0.5;
  return panelLeft - previewRight;
}

/**
 * Hollow bezel lip + glass that plugs the opening from the front.
 * Glass overlaps the lip from in front so top/bottom never show the dark
 * tube backing (that was reading as letterbox “screening”).
 */
function buildCrtStack(
  mats: SpectraMaterials,
  opts: {
    glassName: string;
    screenId: string;
    cx: number;
    cy: number;
    z: number;
    outerW: number;
    outerH: number;
    depth: number;
    bezelR: number;
    rim: number;
    /** Horizontal / vertical subdivisions for CRT dome bulge. */
    glassSegX: number;
    glassSegY: number;
    cloneGlassMat?: boolean;
  }
): { root: THREE.Group; glass: THREE.Mesh } {
  const root = namedGroup(`${opts.glassName}_Stack`);
  const {
    cx,
    cy,
    z,
    outerW,
    outerH,
    depth,
    bezelR,
    rim,
    glassSegX,
    glassSegY,
  } = opts;

  const innerW = outerW - rim * 2;
  const innerH = outerH - rim * 2;
  // Overlap past the hole so the raster seals the aperture
  const overlap = Math.max(rim * 0.55, 0.004);
  const glassW = innerW + overlap * 2;
  const glassH = innerH + overlap * 2;
  const apertureR = crtApertureRadius(outerW, outerH, bezelR, rim);
  // Glass corners track the hole, slightly larger so they tuck under the lip
  const glassCornerR = Math.min(
    apertureR + overlap,
    glassW / 2 - 0.001,
    glassH / 2 - 0.001
  );
  // In front of the lip — never a dark cavity strip above/below the picture
  const glassZ = z + depth / 2 + 0.0015;

  root.add(
    namedMesh(
      `${opts.glassName}_Bezel`,
      roundedFrame(outerW, outerH, depth, bezelR, rim, 12),
      mats.bezel,
      [cx, cy, z]
    )
  );

  // Far backing only (deep in the tube) — not visible when glass seals the hole
  root.add(
    namedMesh(
      `${opts.glassName}_Mask`,
      roundedPlane(innerW * 0.98, innerH * 0.98, apertureR * 0.95, 10),
      mats.darkPlastic,
      [cx, cy, z - depth * 0.15]
    )
  );

  const glassMat = opts.cloneGlassMat
    ? mats.smokedGlass.clone()
    : mats.smokedGlass;
  const glass = namedMesh(
    opts.glassName,
    crtGlassPlane(glassW, glassH, glassCornerR, glassSegX, glassSegY),
    glassMat,
    [cx, cy, glassZ]
  );
  glass.userData.isScreen = true;
  glass.userData.screenId = opts.screenId;
  glass.renderOrder = 2;
  root.add(glass);

  return { root, glass };
}

export function buildMainCRT(mats: SpectraMaterials): THREE.Group {
  const group = namedGroup("MainCRTAssembly");
  const { root } = buildCrtStack(mats, {
    glassName: "MainCRTGlass",
    screenId: "main",
    cx: MAIN_CRT_FRAME.localCx,
    cy: MAIN_CRT_FRAME.localCy,
    z: 0.2,
    outerW: MAIN_CRT_FRAME.outerW,
    outerH: MAIN_CRT_FRAME.outerH,
    depth: 0.048,
    bezelR: 0.016,
    rim: 0.012,
    glassSegX: 28,
    glassSegY: 20,
  });
  group.add(root);
  return group;
}

export function buildPreviewCRTs(mats: SpectraMaterials): THREE.Group {
  const group = namedGroup("PreviewCRTAssembly");
  const { outerW, outerH, y, z } = PREVIEW_BANK;
  const centers = previewBankCenters();

  for (let i = 0; i < 3; i++) {
    const x = centers[i];
    const idx = String(i + 1).padStart(2, "0");

    const { root } = buildCrtStack(mats, {
      glassName: `PreviewCRT${idx}`,
      screenId: `preview${i + 1}`,
      cx: x,
      cy: y,
      z,
      outerW,
      outerH,
      depth: 0.034,
      bezelR: 0.01,
      rim: 0.007,
      glassSegX: 20,
      glassSegY: 14,
      cloneGlassMat: true,
    });
    group.add(root);

    // Promote button + channel marker — pair sits slightly left of tube center
    const btn = namedMesh(
      `PreviewButton${idx}`,
      new THREE.CylinderGeometry(0.018, 0.018, 0.014, 20),
      mats.redPlastic.clone(),
      [x - 0.045, y - 0.1, z + 0.03]
    );
    btn.rotation.x = Math.PI / 2;
    btn.userData.controlId = `previewBtn${i + 1}`;
    btn.userData.restZ = btn.position.z;
    group.add(btn);

    const markerMats = [
      mats.indicatorGreen,
      mats.indicatorOrange,
      mats.indicatorBlue,
    ];
    const markerMat = markerMats[i].clone();
    markerMat.emissiveIntensity = 0.15;
    group.add(
      namedMesh(
        `ChannelMarker${idx}`,
        new THREE.BoxGeometry(0.04, 0.01, 0.006),
        markerMat,
        [x + 0.015, y - 0.1, z + 0.028]
      )
    );
  }

  return group;
}
