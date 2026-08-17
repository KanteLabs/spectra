import * as THREE from "three";
import { createMaterials } from "./materials";
import { buildCabinet, buildPedestal, buildRear } from "./parts/cabinet";
import { buildMainCRT, buildPreviewCRTs } from "./parts/crtAssembly";
import { buildControlPanel } from "./parts/controlPanel";
import { buildInternals } from "./parts/internals";
import { namedGroup } from "./parts/geometry";
import { captureRestPoses, type ExplodeRestPose } from "./explodedLayout";

export interface SpectraModelResult {
  root: THREE.Group;
  materials: ReturnType<typeof createMaterials>;
  screens: {
    main: THREE.Mesh;
    preview1: THREE.Mesh;
    preview2: THREE.Mesh;
    preview3: THREE.Mesh;
  };
  controls: Map<string, THREE.Object3D>;
  restPoses: Map<string, ExplodeRestPose>;
  internals: THREE.Group;
  rear: THREE.Group;
}

function findMesh(root: THREE.Object3D, name: string): THREE.Mesh {
  let found: THREE.Mesh | null = null;
  root.traverse((o) => {
    if (o.name === name && (o as THREE.Mesh).isMesh) found = o as THREE.Mesh;
  });
  if (!found) throw new Error(`Missing mesh: ${name}`);
  return found;
}

export function buildSpectraModel(): SpectraModelResult {
  const materials = createMaterials();
  const root = namedGroup("NordmendeSpectraColorStudio");

  const pedestal = buildPedestal(materials);
  pedestal.position.y = 0;
  root.add(pedestal);

  const body = namedGroup("CabinetBody");
  body.position.y = 0.78;
  body.add(buildCabinet(materials));
  body.add(buildMainCRT(materials));
  body.add(buildPreviewCRTs(materials));
  body.add(buildControlPanel(materials));
  const rear = buildRear(materials);
  body.add(rear);
  const internals = buildInternals(materials);
  body.add(internals);
  root.add(body);

  const screens = {
    main: findMesh(root, "MainCRTGlass"),
    preview1: findMesh(root, "PreviewCRT01"),
    preview2: findMesh(root, "PreviewCRT02"),
    preview3: findMesh(root, "PreviewCRT03"),
  };

  const controls = new Map<string, THREE.Object3D>();
  root.traverse((o) => {
    if (o.userData?.controlId) {
      controls.set(o.userData.controlId as string, o);
    }
  });

  const restPoses = captureRestPoses(root);

  return { root, materials, screens, controls, restPoses, internals, rear };
}
