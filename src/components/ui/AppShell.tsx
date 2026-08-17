"use client";

import dynamic from "next/dynamic";
import { ControlPanel } from "@/components/ui/ControlPanel";
import { XRButton } from "@/components/ui/XRButton";

const Experience = dynamic(
  () =>
    import("@/components/scene/Experience").then((m) => m.Experience),
  { ssr: false, loading: () => <div className="loading">Loading Spectra…</div> }
);

export function AppShell() {
  return (
    <div className="app-shell">
      <Experience />
      <div className="hud">
        <div className="brand-mark" aria-hidden="true">
          <span className="brand">NORDMENDE</span>
          <span className="product">Spectra Color Studio · 1973</span>
        </div>
        <XRButton />
      </div>
      <ControlPanel />
    </div>
  );
}
