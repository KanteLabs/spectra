import * as THREE from "three";
import type { SpectraMaterials } from "../materials";
import { namedGroup, namedMesh, roundedBox } from "./geometry";
import { CONTROL_STRIP } from "./crtAssembly";

const SLIDER_IDS = [
  "sliderBrightness",
  "sliderContrast",
  "sliderSaturation",
  "sliderTuning",
  "sliderVolume",
  "sliderPreview",
] as const;

export function buildControlPanel(mats: SpectraMaterials): THREE.Group {
  const group = namedGroup("RightControlAssembly");
  const { panelX: px, panelW: pw, panelZ: pz, mainKnobX, mainKnobY } =
    CONTROL_STRIP;

  const panel = namedMesh(
    "ControlPanelFace",
    roundedBox(pw, 0.26, 0.05, 0.01, 3),
    mats.warmGray,
    [px, 0.02, pz]
  );
  group.add(panel);

  // Main red channel knob — under the vent column (not on the lower strip)
  const knobPivot = namedGroup("MainRedKnob");
  knobPivot.position.set(mainKnobX, mainKnobY, 0.24);
  knobPivot.userData.controlId = "mainKnob";

  const knobBody = namedMesh(
    "MainRedKnobBody",
    new THREE.CylinderGeometry(0.032, 0.035, 0.028, 32),
    mats.redPlastic
  );
  knobBody.rotation.x = Math.PI / 2;
  knobPivot.add(knobBody);

  const knobRim = namedMesh(
    "MainRedKnobRim",
    new THREE.TorusGeometry(0.033, 0.0035, 8, 36),
    mats.darkPlastic,
    [0, 0, 0.002]
  );
  knobPivot.add(knobRim);

  const knobCap = namedMesh(
    "MainRedKnobCap",
    new THREE.CylinderGeometry(0.011, 0.011, 0.005, 16),
    mats.darkPlastic,
    [0, 0, 0.016]
  );
  knobCap.rotation.x = Math.PI / 2;
  knobPivot.add(knobCap);

  const dialPointer = namedMesh(
    "MainKnobDialPointer",
    new THREE.BoxGeometry(0.005, 0.024, 0.004),
    mats.chrome.clone(),
    [0, 0.011, 0.019]
  );
  const dialMat = dialPointer.material as THREE.MeshStandardMaterial;
  dialMat.color = new THREE.Color("#f2ebe0");
  dialMat.metalness = 0.15;
  dialMat.roughness = 0.45;
  dialPointer.userData.partOf = "mainKnob";
  knobPivot.add(dialPointer);

  const dialHub = namedMesh(
    "MainKnobDialHub",
    new THREE.CylinderGeometry(0.004, 0.004, 0.003, 12),
    mats.chrome,
    [0, 0, 0.02]
  );
  dialHub.rotation.x = Math.PI / 2;
  knobPivot.add(dialHub);
  group.add(knobPivot);

  const dialFace = namedGroup("MainKnobDialFace");
  dialFace.position.set(mainKnobX, mainKnobY, 0.225);

  const indexMark = namedMesh(
    "MainKnobIndex",
    new THREE.ConeGeometry(0.004, 0.01, 3),
    mats.darkPlastic,
    [0, 0.048, 0.008]
  );
  indexMark.rotation.z = Math.PI;
  dialFace.add(indexMark);

  const detentCount = 10;
  const tickTravel = Math.PI * 1.5;
  for (let i = 0; i < detentCount; i++) {
    const t = i / (detentCount - 1);
    const angle = -t * tickTravel;
    const major = i === 0 || i === detentCount - 1 || i % 3 === 0;
    const tick = namedMesh(
      `MainKnobTick${String(i).padStart(2, "0")}`,
      new THREE.BoxGeometry(major ? 0.0035 : 0.002, major ? 0.01 : 0.006, 0.002),
      mats.darkPlastic,
      [Math.sin(angle) * 0.045, Math.cos(angle) * 0.045, 0.006]
    );
    tick.rotation.z = -angle;
    dialFace.add(tick);
  }
  group.add(dialFace);

  const lampMats = [
    mats.indicatorGreen,
    mats.indicatorOrange,
    mats.indicatorBlue,
    mats.redPlastic,
    mats.indicatorGreen,
    mats.indicatorOrange,
  ];

  for (let i = 0; i < 6; i++) {
    const idx = String(i + 1).padStart(2, "0");
    const y = 0.1 - i * 0.035;

    const track = namedMesh(
      `SliderTrack${idx}`,
      new THREE.BoxGeometry(0.01, 0.06, 0.006),
      mats.darkPlastic,
      [px + 0.025, y, 0.228]
    );
    group.add(track);

    const slider = namedMesh(
      `Slider${idx}`,
      new THREE.BoxGeometry(0.022, 0.012, 0.014),
      mats.chrome,
      [px + 0.025, y, 0.238]
    );
    slider.userData.controlId = SLIDER_IDS[i];
    slider.userData.sliderIndex = i;
    slider.userData.restY = y;
    group.add(slider);

    const lampMat = lampMats[i].clone() as THREE.MeshStandardMaterial;
    if (i === 3) {
      lampMat.color = new THREE.Color("#c4121a");
      lampMat.emissive = new THREE.Color("#5a0808");
    }
    lampMat.emissiveIntensity = 0.08;
    const indicator = namedMesh(
      `IndicatorLamp${idx}`,
      new THREE.SphereGeometry(0.006, 12, 12),
      lampMat,
      [px - 0.02, y, 0.232]
    );
    indicator.userData.indicatorRole =
      i < 3 ? `preview${i + 1}` : SLIDER_IDS[i];
    indicator.userData.baseEmissive = lampMat.emissive.clone();
    group.add(indicator);
  }

  // Secondary knobs live on the strip face (right of preview3 clearance)
  for (let i = 0; i < 3; i++) {
    const kn = namedMesh(
      `SecondaryKnob${i + 1}`,
      new THREE.CylinderGeometry(0.012, 0.013, 0.014, 16),
      mats.darkPlastic.clone(),
      [px - 0.045, 0.08 - i * 0.04, 0.235]
    );
    kn.rotation.x = Math.PI / 2;
    kn.userData.controlId = `secondaryKnob${i + 1}`;
    kn.userData.restZ = kn.position.z;
    kn.userData.previewId = `preview${i + 1}`;
    group.add(kn);
  }

  const lock = namedMesh(
    "LockSwitch",
    new THREE.BoxGeometry(0.014, 0.02, 0.01),
    mats.chrome.clone(),
    [px - 0.045, -0.05, 0.235]
  );
  lock.userData.controlId = "switchLock";
  lock.userData.restRotationX = 0;
  group.add(lock);

  const previewSw = namedMesh(
    "ToggleSwitch2",
    new THREE.BoxGeometry(0.014, 0.02, 0.01),
    mats.chrome.clone(),
    [px - 0.045, -0.08, 0.235]
  );
  previewSw.userData.controlId = "switchPreviews";
  previewSw.userData.restRotationX = 0;
  group.add(previewSw);

  const power = namedMesh(
    "PowerButton",
    new THREE.CylinderGeometry(0.012, 0.012, 0.01, 16),
    mats.redPlastic,
    [-0.42, -0.08, 0.225]
  );
  power.rotation.x = Math.PI / 2;
  power.userData.controlId = "power";
  group.add(power);

  return group;
}
