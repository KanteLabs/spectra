"use client";

import { useUiStore } from "@/state/uiStore";
import { useTvStore } from "@/state/tvStore";
import { xrStore } from "@/systems/xr/xrStore";

/** Small spatial utility menu for XR-only system functions. */
export function WristMenu() {
  const setEnvironment = useUiStore((s) => s.setEnvironment);
  const environment = useUiStore((s) => s.environment);
  const setQuality = useUiStore((s) => s.setQuality);
  const setSeatedMode = useUiStore((s) => s.setSeatedMode);
  const seatedMode = useUiStore((s) => s.seatedMode);
  const reset = useTvStore((s) => s.reset);

  return (
    <group position={[0.25, 1.1, -0.4]}>
      <mesh>
        <planeGeometry args={[0.28, 0.22]} />
        <meshBasicMaterial color="#2a2218" transparent opacity={0.85} />
      </mesh>
      {(
        [
          ["Exit XR", () => void xrStore.getState().session?.end()],
          [
            "Recenter",
            () => {
              /* origin handled by locomotion recenter via store if available */
              const s = xrStore.getState() as { session?: XRSession };
              void s.session;
            },
          ],
          [
            seatedMode ? "Standing" : "Seated",
            () => setSeatedMode(!seatedMode),
          ],
          [
            environment === "livingRoom" ? "Studio" : "Living Room",
            () =>
              setEnvironment(
                environment === "livingRoom" ? "studio" : "livingRoom"
              ),
          ],
          ["Quality Low", () => setQuality("xr")],
          ["Reset", () => reset()],
        ] as [string, () => void][]
      ).map(([label, fn], i) => (
        <mesh
          key={label}
          position={[0, 0.08 - i * 0.032, 0.01]}
          onClick={(e) => {
            e.stopPropagation();
            fn();
          }}
        >
          <planeGeometry args={[0.24, 0.028]} />
          <meshBasicMaterial color="#4a3828" />
        </mesh>
      ))}
    </group>
  );
}
