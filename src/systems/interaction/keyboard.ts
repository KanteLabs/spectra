import { CONTROL_SPECS } from "@/model/controlRegistry";

export type KeyAction =
  | { type: "focusNext" }
  | { type: "focusPrev" }
  | { type: "activate" }
  | { type: "adjust"; delta: number }
  | { type: "escape" }
  | { type: "cameraPreset"; preset: string }
  | { type: "togglePower" }
  | { type: "resetCamera" };

export function parseKeyAction(e: KeyboardEvent): KeyAction | null {
  const target = e.target as Element | null;
  // Native focus traversal and focused DOM controls own their keyboard events.
  // In particular, do not trap Tab on MSFN's Eject button or the control panel.
  if (e.defaultPrevented || e.key === "Tab" || e.ctrlKey || e.metaKey || e.altKey ||
      target?.closest?.("button,a,input,select,textarea,[contenteditable]:not([contenteditable=false]),[role=button],[role=slider],[role=tab]")) {
    return null;
  }
  switch (e.key) {
    case "Enter":
    case " ":
      return { type: "activate" };
    case "ArrowUp":
    case "ArrowRight":
      return { type: "adjust", delta: 1 };
    case "ArrowDown":
    case "ArrowLeft":
      return { type: "adjust", delta: -1 };
    case "Escape":
      return { type: "escape" };
    case "1":
      return { type: "cameraPreset", preset: "front" };
    case "2":
      return { type: "cameraPreset", preset: "side" };
    case "3":
      return { type: "cameraPreset", preset: "rear" };
    case "4":
      return { type: "cameraPreset", preset: "top" };
    case "5":
      return { type: "cameraPreset", preset: "isometric" };
    case "6":
    case "r":
    case "R":
      return { type: "resetCamera" };
    case "p":
    case "P":
      return { type: "togglePower" };
    default:
      return null;
  }
}

export function cycleControlId(
  current: string | null,
  direction: 1 | -1
): string {
  const ids = CONTROL_SPECS.map((c) => c.id);
  if (!current) return ids[0];
  const idx = ids.indexOf(current);
  const next = (idx + direction + ids.length) % ids.length;
  return ids[next];
}
