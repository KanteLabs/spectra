"use client";

import dynamic from "next/dynamic";
import { memo } from "react";
import { ControlPanel } from "@/components/ui/ControlPanel";
import { XRButton } from "@/components/ui/XRButton";
import { useUiStore } from "@/state/uiStore";

const Experience = memo(dynamic(
  () =>
    import("@/components/scene/Experience").then((m) => m.Experience),
  { ssr: false, loading: () => <div className="loading">Loading Spectra…</div> }
));

export function AppShell() {
  const panelOpen = useUiStore((s) => s.panelOpen);
  return (
    <div className={`app-shell ${panelOpen ? "controls-open" : ""}`}>
      <div className="scene-viewport">
        <Experience />
      </div>
      <div className="hud">
        <div className="brand-mark" aria-hidden="true">
          <span className="brand">NORDMENDE</span>
          <span className="product">Spectra Color Studio · 1973</span>
        </div>
        <XRButton />
      </div>
      <p className="touch-hint">Drag to orbit · Pinch to zoom · Tap a screen</p>
      <ControlPanel />
    </div>
  );
}
