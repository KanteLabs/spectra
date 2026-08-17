"use client";

import { Html } from "@react-three/drei";
import { useUiStore } from "@/state/uiStore";

const LABELS: { name: string; position: [number, number, number]; text: string }[] = [
  { name: "MainCRTTube", position: [-0.12, 1.35, 0.3], text: "Main CRT tube (reconstruction)" },
  { name: "MainTunerAssembly", position: [0.4, 1.35, 0], text: "Main tuner assembly" },
  { name: "PowerSupply", position: [0.45, 0.95, 0], text: "Power supply" },
  { name: "Speaker", position: [-0.5, 1.4, 0.2], text: "Speaker" },
  { name: "ControlBoard", position: [0.5, 0.8, 0.1], text: "Control board" },
  { name: "ChannelRoutingElectronics", position: [0, 1.05, -0.1], text: "Channel routing (educational)" },
];

export function InspectionLabels() {
  const show = useUiStore((s) => s.showLabels);
  const inspection = useUiStore((s) => s.inspectionMode);
  if (!show || !inspection) return null;

  return (
    <group>
      {LABELS.map((l) => (
        <Html key={l.name} position={l.position} center distanceFactor={6}>
          <div
            style={{
              background: "rgba(20,16,12,0.85)",
              color: "#f0e6d4",
              padding: "4px 8px",
              fontSize: 11,
              fontFamily: "Georgia, serif",
              border: "1px solid #8a6a4a",
              whiteSpace: "nowrap",
              pointerEvents: "none",
            }}
          >
            {l.text}
          </div>
        </Html>
      ))}
      <Html position={[0, 2.1, 0]} center>
        <div
          style={{
            color: "#d4b896",
            fontSize: 12,
            fontFamily: "Georgia, serif",
            textAlign: "center",
            maxWidth: 280,
          }}
        >
          Internal layout is an educational reconstruction, not factory documentation.
        </div>
      </Html>
    </group>
  );
}
