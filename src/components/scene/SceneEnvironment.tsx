"use client";

import { Suspense, useMemo, useEffect } from "react";
import * as THREE from "three";
import { Environment, ContactShadows } from "@react-three/drei";
import { useUiStore } from "@/state/uiStore";
import { QUALITY_CONFIGS } from "@/systems/quality/qualityConfig";

function LivingRoom({
  detail,
  shadowMapSize,
}: {
  detail: "full" | "simple" | "none";
  shadowMapSize: number;
}) {
  const wallMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: "#6b3a2e",
        roughness: 0.85,
      }),
    []
  );
  const carpetMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: "#b89a5c",
        roughness: 1,
      }),
    []
  );

  const woodMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({ color: "#4a3020", roughness: 0.7 }),
    []
  );

  useEffect(() => () => { wallMat.dispose(); carpetMat.dispose(); woodMat.dispose(); }, [wallMat, carpetMat, woodMat]);

  return (
    <group>
      {/* Floor */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
        <circleGeometry args={[5, 48]} />
        <primitive object={carpetMat} attach="material" />
      </mesh>
      {/* Back wall */}
      <mesh position={[0, 1.6, -2.2]} receiveShadow>
        <planeGeometry args={[8, 3.5]} />
        <primitive object={wallMat} attach="material" />
      </mesh>
      {/* Side walls hint */}
      <mesh position={[-3.2, 1.6, 0]} rotation={[0, Math.PI / 2, 0]}>
        <planeGeometry args={[6, 3.5]} />
        <meshStandardMaterial color="#5c3228" roughness={0.9} />
      </mesh>

      {detail === "full" && (
        <>
          {/* Lounge chair silhouette */}
          <group position={[-1.6, 0, 1.2]} rotation={[0, 0.6, 0]}>
            <mesh position={[0, 0.35, 0]} castShadow>
              <boxGeometry args={[0.7, 0.15, 0.7]} />
              <primitive object={woodMat} attach="material" />
            </mesh>
            <mesh position={[0, 0.55, -0.25]} castShadow>
              <boxGeometry args={[0.7, 0.5, 0.1]} />
              <meshStandardMaterial color="#8a5a40" roughness={0.8} />
            </mesh>
            <mesh position={[0, 0.15, 0]}>
              <cylinderGeometry args={[0.02, 0.02, 0.3, 8]} />
              <meshStandardMaterial color="#c0c8d0" metalness={1} roughness={0.2} />
            </mesh>
          </group>
          {/* Plant */}
          <group position={[1.5, 0, -1.2]}>
            <mesh position={[0, 0.2, 0]}>
              <cylinderGeometry args={[0.12, 0.1, 0.25, 12]} />
              <meshStandardMaterial color="#6a4030" />
            </mesh>
            <mesh position={[0, 0.55, 0]}>
              <sphereGeometry args={[0.28, 12, 12]} />
              <meshStandardMaterial color="#2d5a27" roughness={0.9} />
            </mesh>
          </group>
          {/* Glass table */}
          <group position={[0.9, 0, 1.4]}>
            <mesh position={[0, 0.35, 0]}>
              <cylinderGeometry args={[0.35, 0.35, 0.02, 24]} />
              <meshPhysicalMaterial
                color="#aaccff"
                transmission={0.6}
                roughness={0.1}
                thickness={0.02}
                transparent
                opacity={0.5}
              />
            </mesh>
            <mesh position={[0, 0.17, 0]}>
              <cylinderGeometry args={[0.03, 0.05, 0.34, 12]} />
              <meshStandardMaterial color="#c0c8d0" metalness={1} roughness={0.15} />
            </mesh>
          </group>
        </>
      )}

      <ambientLight intensity={0.35} color="#ffd8b0" />
      <directionalLight
        position={[2.5, 4, 2]}
        intensity={1.1}
        color="#ffe2c0"
        castShadow={shadowMapSize > 0}
        shadow-mapSize-width={Math.max(shadowMapSize, 256)}
        shadow-mapSize-height={Math.max(shadowMapSize, 256)}
      />
      <pointLight position={[-1.5, 1.8, 0.5]} intensity={0.4} color="#ffaa66" />
      {shadowMapSize > 0 && (
        <ContactShadows
          position={[0, 0.01, 0]}
          opacity={0.45}
          scale={8}
          blur={2.5}
          far={4}
        />
      )}
    </group>
  );
}

function StudioEnv({ shadowMapSize }: { shadowMapSize: number }) {
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
        <circleGeometry args={[4, 48]} />
        <meshStandardMaterial color="#c8c4bc" roughness={0.9} />
      </mesh>
      <mesh position={[0, 2, -3]}>
        <planeGeometry args={[10, 6]} />
        <meshStandardMaterial color="#e8e4dc" />
      </mesh>
      <ambientLight intensity={0.55} />
      <directionalLight
        position={[3, 5, 2]}
        intensity={1.3}
        castShadow={shadowMapSize > 0}
        shadow-mapSize-width={Math.max(shadowMapSize, 256)}
        shadow-mapSize-height={Math.max(shadowMapSize, 256)}
      />
      {shadowMapSize > 0 && (
        <ContactShadows position={[0, 0.01, 0]} opacity={0.35} scale={6} blur={2} />
      )}
    </group>
  );
}

export function SceneEnvironment() {
  const environment = useUiStore((s) => s.environment);
  const quality = useUiStore((s) => s.quality);
  const cfg = QUALITY_CONFIGS[quality];
  const detail = cfg.environmentDetail;
  const shadowSize = cfg.shadows ? cfg.shadowMapSize : 0;

  return (
    <>
      {environment === "livingRoom" ? (
        <LivingRoom detail={detail} shadowMapSize={shadowSize} />
      ) : (
        <StudioEnv shadowMapSize={shadowSize} />
      )}
      {detail !== "none" && (
        <Suspense fallback={null}>
          <Environment
            preset={environment === "livingRoom" ? "apartment" : "studio"}
            environmentIntensity={
              quality === "ultra" || quality === "high" ? 0.42 : 0.35
            }
          />
        </Suspense>
      )}
    </>
  );
}
