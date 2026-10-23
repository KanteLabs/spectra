"use client";

import dynamic from "next/dynamic";
import { memo } from "react";
import { ControlPanel } from "@/components/ui/ControlPanel";
import { XRButton } from "@/components/ui/XRButton";
import { useUiStore } from "@/state/uiStore";
import { GuideButton, SpectraGuide } from "@/components/ui/SpectraGuide";

const Experience = memo(dynamic(
  () =>
    import("@/components/scene/Experience").then((m) => m.Experience),
  { ssr: false, loading: () => <div className="loading">Loading Spectra…</div> }
));

export function AppShell() {
  const panelOpen = useUiStore((s) => s.panelOpen);
  const guideOpen = useUiStore((s) => s.guideOpen);
  return (
    <div className={`app-shell ${panelOpen ? "controls-open" : ""} ${guideOpen ? "guide-open" : ""}`}>
      <div className="scene-viewport">
        <Experience />
      </div>
      <div className="hud">
        <div className="brand-mark" aria-hidden="true">
          <span className="brand">NORDMENDE</span>
          <span className="product">Spectra Color Studio · 1973</span>
        </div>
        <div className="hud-actions"><GuideButton /><XRButton /></div>
      </div>
      <p className="touch-hint">Drag to orbit · Pinch to zoom · Tap a screen</p>
      <ControlPanel />
      <SpectraGuide />
    </div>
  );
}
