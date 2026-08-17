import * as THREE from "three";

/** Local-space explode offsets keyed by mesh/group name. */
export const EXPLODED_OFFSETS: Record<string, [number, number, number]> = {
  MainCRTAssembly: [0, 0.15, 0.25],
  PreviewCRTAssembly: [0, -0.2, 0.2],
  RightControlAssembly: [0.35, 0, 0.15],
  RightVentilationPanel: [0.25, 0.1, 0.1],
  RearCabinet: [0, 0, -0.4],
  Pedestal: [0, -0.25, 0],
  MainCRTTube: [0, 0.1, 0.35],
  MainDeflectionYoke: [0, 0.05, 0.28],
  MainTunerAssembly: [0.3, 0.15, -0.2],
  PowerSupply: [0.35, -0.1, -0.25],
  ControlBoard: [0.4, -0.15, -0.15],
  AudioAmplifier: [-0.35, 0.1, -0.2],
  Speaker: [-0.4, 0.3, 0.15],
  ChannelRoutingElectronics: [0, 0, -0.3],
  WiringHarness: [0, -0.1, -0.25],
  CabinetFrame: [0, 0, -0.35],
  PreviewCRTTube01: [-0.15, -0.15, 0.25],
  PreviewCRTTube02: [0, -0.15, 0.25],
  PreviewCRTTube03: [0.15, -0.15, 0.25],
};

export interface ExplodeRestPose {
  position: THREE.Vector3;
  quaternion: THREE.Quaternion;
}

export function captureRestPoses(root: THREE.Object3D): Map<string, ExplodeRestPose> {
  const map = new Map<string, ExplodeRestPose>();
  root.traverse((obj) => {
    if (EXPLODED_OFFSETS[obj.name]) {
      map.set(obj.name, {
        position: obj.position.clone(),
        quaternion: obj.quaternion.clone(),
      });
    }
  });
  return map;
}

export function applyExplodedProgress(
  root: THREE.Object3D,
  rest: Map<string, ExplodeRestPose>,
  progress: number
): void {
  const t = Math.min(1, Math.max(0, progress));
  root.traverse((obj) => {
    const offset = EXPLODED_OFFSETS[obj.name];
    const pose = rest.get(obj.name);
    if (!offset || !pose) return;
    obj.position.set(
      pose.position.x + offset[0] * t,
      pose.position.y + offset[1] * t,
      pose.position.z + offset[2] * t
    );
  });
}
