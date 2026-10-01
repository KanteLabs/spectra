import type { ComponentType } from "react";
declare const manifest: {
 id: string; runtimeApiVersion: number; mode: "full"; renderer: "isolated"; suspendHostScene: true;
 Component: ComponentType<{ active: boolean; onExit: () => void; containerSize: { width: number; height: number } }>;
};
export default manifest;
