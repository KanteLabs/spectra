"use client";

import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import {
  TeleportTarget,
  useXR,
  useXRControllerLocomotion,
  XROrigin,
} from "@react-three/xr";
import * as THREE from "three";
import { useUiStore } from "@/state/uiStore";
import { WristMenu } from "@/components/ui/WristMenu";

export function XRRig() {
  const mode = useUiStore((s) => s.mode);
  const seatedMode = useUiStore((s) => s.seatedMode);
  const smoothTurn = useUiStore((s) => s.smoothTurn);
  const session = useXR((s) => s.session);
  const originRef = useRef<THREE.Group>(null);

  useXRControllerLocomotion(
    originRef,
    { speed: 1.2 },
    {
      type: smoothTurn ? "smooth" : "snap",
      degrees: 45,
      speed: 1,
      deadZone: 0.6,
    },
    "left"
  );

  useFrame(() => {
    if (!originRef.current || !session) return;
    // Seated offset: lower the world slightly so the TV is at desk height
    const targetY = seatedMode ? -0.35 : 0;
    originRef.current.position.y = THREE.MathUtils.lerp(
      originRef.current.position.y,
      targetY,
      0.08
    );
  });

  if (mode !== "xr" && !session) return null;

  return (
    <XROrigin ref={originRef}>
      <TeleportTarget
        onTeleport={(point) => {
          if (originRef.current) {
            originRef.current.position.x = point.x;
            originRef.current.position.z = point.z;
          }
        }}
      >
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.002, 0]}>
          <circleGeometry args={[4, 32]} />
          <meshBasicMaterial transparent opacity={0} />
        </mesh>
      </TeleportTarget>
      <WristMenu />
    </XROrigin>
  );
}
