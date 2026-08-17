import * as THREE from "three";
import type { SpectraMaterials } from "../materials";
import { previewBankCenters } from "./crtAssembly";
import { namedGroup, namedMesh } from "./geometry";

/**
 * Educational reconstruction of internal components.
 * Not claimed as documented factory layout for the Spectra Color Studio.
 */
export function buildInternals(mats: SpectraMaterials): THREE.Group {
  const group = namedGroup("Internals");
  group.visible = false;

  const mainTube = namedMesh(
    "MainCRTTube",
    new THREE.CylinderGeometry(0.22, 0.28, 0.35, 24),
    mats.smokedGlass,
    [-0.12, 0.42, -0.02]
  );
  mainTube.rotation.x = Math.PI / 2;
  group.add(mainTube);

  const yoke = namedMesh(
    "MainDeflectionYoke",
    new THREE.TorusGeometry(0.16, 0.03, 12, 24),
    mats.darkPlastic,
    [-0.12, 0.42, 0.12]
  );
  group.add(yoke);

  const previewXs = previewBankCenters();
  for (let i = 0; i < 3; i++) {
    const x = previewXs[i];
    const tube = namedMesh(
      `PreviewCRTTube0${i + 1}`,
      new THREE.CylinderGeometry(0.06, 0.08, 0.14, 16),
      mats.smokedGlass,
      [x, 0.02, 0.0]
    );
    tube.rotation.x = Math.PI / 2;
    group.add(tube);

    const py = namedMesh(
      `PreviewYoke0${i + 1}`,
      new THREE.TorusGeometry(0.05, 0.012, 8, 16),
      mats.darkPlastic,
      [x, 0.02, 0.08]
    );
    group.add(py);

    const tuner = namedMesh(
      `PreviewTuner0${i + 1}`,
      new THREE.BoxGeometry(0.08, 0.04, 0.06),
      mats.ventPlastic,
      [x, -0.08, -0.05]
    );
    group.add(tuner);
  }

  const mainTuner = namedMesh(
    "MainTunerAssembly",
    new THREE.BoxGeometry(0.18, 0.1, 0.12),
    mats.ventPlastic,
    [0.25, 0.45, -0.05]
  );
  group.add(mainTuner);

  const psu = namedMesh(
    "PowerSupply",
    new THREE.BoxGeometry(0.2, 0.12, 0.14),
    mats.darkPlastic,
    [0.3, 0.15, -0.05]
  );
  group.add(psu);

  const board = namedMesh(
    "ControlBoard",
    new THREE.BoxGeometry(0.22, 0.02, 0.16),
    mats.indicatorGreen,
    [0.35, 0.0, -0.02]
  );
  group.add(board);

  const amp = namedMesh(
    "AudioAmplifier",
    new THREE.BoxGeometry(0.12, 0.06, 0.08),
    mats.warmGray,
    [-0.35, 0.25, -0.05]
  );
  group.add(amp);

  const speaker = namedMesh(
    "Speaker",
    new THREE.CylinderGeometry(0.07, 0.08, 0.04, 24),
    mats.darkPlastic,
    [-0.35, 0.55, 0.05]
  );
  speaker.rotation.x = Math.PI / 2;
  group.add(speaker);

  const routing = namedMesh(
    "ChannelRoutingElectronics",
    new THREE.BoxGeometry(0.2, 0.05, 0.1),
    mats.label,
    [0.0, 0.2, -0.08]
  );
  group.add(routing);

  const frame = namedMesh(
    "CabinetFrame",
    new THREE.BoxGeometry(0.95, 0.75, 0.02),
    mats.warmGray,
    [0, 0.22, -0.15]
  );
  group.add(frame);

  // Simplified harness
  const harness = namedGroup("WiringHarness");
  for (let i = 0; i < 5; i++) {
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-0.2 + i * 0.08, 0.4, 0.05),
      new THREE.Vector3(-0.15 + i * 0.08, 0.2, -0.05),
      new THREE.Vector3(0.2, 0.1 - i * 0.02, -0.08),
    ]);
    const wire = namedMesh(
      `HarnessWire${i}`,
      new THREE.TubeGeometry(curve, 16, 0.004, 6, false),
      mats.wire
    );
    harness.add(wire);
  }
  group.add(harness);

  return group;
}
