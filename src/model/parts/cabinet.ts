import * as THREE from "three";
import type { SpectraMaterials } from "../materials";
import { namedGroup, namedMesh, roundedBox } from "./geometry";

export function buildPedestal(mats: SpectraMaterials): THREE.Group {
  const group = namedGroup("Pedestal");

  const column = namedMesh(
    "SupportColumn",
    new THREE.CylinderGeometry(0.045, 0.05, 0.72, 32),
    mats.chrome,
    [0, 0.36, 0]
  );
  group.add(column);

  const mount = namedMesh(
    "PedestalMount",
    new THREE.CylinderGeometry(0.08, 0.07, 0.04, 24),
    mats.chrome,
    [0, 0.74, 0]
  );
  group.add(mount);

  const base = namedMesh(
    "CircularBase",
    new THREE.CylinderGeometry(0.42, 0.44, 0.05, 48),
    mats.glossyBlack,
    [0, 0.025, 0]
  );
  group.add(base);

  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
    const foot = namedMesh(
      `RubberFoot0${i + 1}`,
      new THREE.CylinderGeometry(0.025, 0.028, 0.012, 12),
      mats.rubber,
      [Math.cos(a) * 0.32, 0.004, Math.sin(a) * 0.32]
    );
    group.add(foot);
  }

  return group;
}

export function buildCabinet(mats: SpectraMaterials): THREE.Group {
  const group = namedGroup("MainCabinet");

  // Overall cabinet proportions inspired by the reference (~1.1 wide, 0.85 tall upper+lower)
  const upper = namedMesh(
    "UpperFrontPanel",
    roundedBox(1.05, 0.58, 0.42, 0.02, 5),
    mats.cabinetPlastic,
    [0, 0.42, 0]
  );
  group.add(upper);

  const lower = namedMesh(
    "LowerCabinet",
    roundedBox(1.05, 0.28, 0.42, 0.018, 4),
    mats.warmGray,
    [0, 0.0, 0]
  );
  group.add(lower);

  const trim = namedMesh(
    "LowerBlackTrim",
    roundedBox(1.06, 0.035, 0.43, 0.008, 3),
    mats.darkPlastic,
    [0, -0.145, 0]
  );
  group.add(trim);

  // Right ventilation panel with vertical grooves
  const ventGroup = namedGroup("RightVentilationPanel");
  const ventBack = namedMesh(
    "VentPanelBase",
    roundedBox(0.22, 0.52, 0.04, 0.01, 3),
    mats.ventPlastic,
    [0.38, 0.42, 0.2]
  );
  ventGroup.add(ventBack);

  for (let i = 0; i < 28; i++) {
    const groove = namedMesh(
      `VentGroove${String(i).padStart(2, "0")}`,
      new THREE.BoxGeometry(0.004, 0.48, 0.008),
      mats.warmGray,
      [0.28 + i * 0.0075, 0.42, 0.222]
    );
    groove.castShadow = false;
    ventGroup.add(groove);
  }
  group.add(ventGroup);

  // Brand badge
  const brand = namedMesh(
    "NordmendeBadge",
    new THREE.BoxGeometry(0.12, 0.018, 0.004),
    mats.label,
    [-0.38, 0.16, 0.215]
  );
  group.add(brand);

  const brandDot = namedMesh(
    "NordmendeDot",
    new THREE.BoxGeometry(0.012, 0.012, 0.004),
    mats.redPlastic,
    [-0.3, 0.16, 0.215]
  );
  group.add(brandDot);

  const logo = namedMesh(
    "SpectraLogo",
    new THREE.BoxGeometry(0.1, 0.012, 0.003),
    mats.label,
    [0.38, 0.62, 0.225]
  );
  group.add(logo);

  return group;
}

export function buildRear(mats: SpectraMaterials): THREE.Group {
  const group = namedGroup("RearCabinet");

  const rear = namedMesh(
    "RearPanel",
    roundedBox(1.0, 0.82, 0.06, 0.015, 3),
    mats.darkPlastic,
    [0, 0.22, -0.22]
  );
  group.add(rear);

  const vent = namedMesh(
    "RearVentilation",
    new THREE.BoxGeometry(0.7, 0.35, 0.02),
    mats.ventPlastic,
    [0, 0.35, -0.255]
  );
  group.add(vent);

  // Power cable
  const cableCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0.35, -0.05, -0.25),
    new THREE.Vector3(0.45, -0.2, -0.15),
    new THREE.Vector3(0.5, -0.45, 0.1),
    new THREE.Vector3(0.55, -0.7, 0.3),
  ]);
  const cable = namedMesh(
    "PowerCable",
    new THREE.TubeGeometry(cableCurve, 32, 0.008, 8, false),
    mats.wire
  );
  group.add(cable);

  return group;
}
