import type { ScreenId, ScreenSlot, SignalCondition } from "@/types";
import { getSourceDef } from "@/systems/media/sourceCatalog";

export interface RoutingState {
  screens: Record<ScreenId, ScreenSlot>;
  locked: boolean;
  activeAudioScreen: ScreenId;
}

function colorForSource(sourceId: string, preview: boolean): number {
  const fromCatalog = getSourceDef(sourceId)?.colorAmount;
  if (typeof fromCatalog === "number") {
    // Previews stay slightly softer than main, but still clearly in color.
    return preview ? Math.min(1, fromCatalog * 0.92) : fromCatalog;
  }
  return preview ? 0.9 : 1;
}

export function createDefaultRouting(sourceIds: {
  main: string;
  preview1: string;
  preview2: string;
  preview3: string;
}): RoutingState {
  return {
    locked: false,
    activeAudioScreen: "main",
    screens: {
      main: {
        screenId: "main",
        sourceId: sourceIds.main,
        powered: true,
        signal: "clean",
        colorAmount: colorForSource(sourceIds.main, false),
      },
      preview1: {
        screenId: "preview1",
        sourceId: sourceIds.preview1,
        powered: true,
        signal: "clean",
        colorAmount: colorForSource(sourceIds.preview1, true),
      },
      preview2: {
        screenId: "preview2",
        sourceId: sourceIds.preview2,
        powered: true,
        signal: "clean",
        colorAmount: colorForSource(sourceIds.preview2, true),
      },
      preview3: {
        screenId: "preview3",
        sourceId: sourceIds.preview3,
        powered: true,
        signal: "clean",
        colorAmount: colorForSource(sourceIds.preview3, true),
      },
    },
  };
}

/**
 * Promote a preview screen's source to the main CRT.
 * Previous main source moves into the selected preview slot.
 * Returns null if locked or if previewId is "main".
 */
export function promotePreview(
  state: RoutingState,
  previewId: Exclude<ScreenId, "main">
): RoutingState | null {
  if (state.locked) return null;
  if (previewId === ("main" as ScreenId)) return null;

  const main = state.screens.main;
  const preview = state.screens[previewId];
  if (!main || !preview) return null;

  return {
    ...state,
    activeAudioScreen: "main",
    screens: {
      ...state.screens,
      main: {
        ...main,
        sourceId: preview.sourceId,
        colorAmount: colorForSource(preview.sourceId, false),
        signal: "tuning" as SignalCondition,
      },
      [previewId]: {
        ...preview,
        sourceId: main.sourceId,
        colorAmount: colorForSource(main.sourceId, true),
        signal: "tuning" as SignalCondition,
      },
    },
  };
}

export function setScreenSource(
  state: RoutingState,
  screenId: ScreenId,
  sourceId: string
): RoutingState | null {
  if (state.locked) return null;
  return {
    ...state,
    screens: {
      ...state.screens,
      [screenId]: {
        ...state.screens[screenId],
        sourceId,
        colorAmount: colorForSource(sourceId, screenId !== "main"),
        signal: "tuning",
      },
    },
    activeAudioScreen: screenId === "main" ? "main" : state.activeAudioScreen,
  };
}

export function setLocked(state: RoutingState, locked: boolean): RoutingState {
  return { ...state, locked };
}

export function setScreenPowered(
  state: RoutingState,
  screenId: ScreenId,
  powered: boolean
): RoutingState {
  return {
    ...state,
    screens: {
      ...state.screens,
      [screenId]: { ...state.screens[screenId], powered },
    },
  };
}

export function setScreenSignal(
  state: RoutingState,
  screenId: ScreenId,
  signal: SignalCondition
): RoutingState {
  return {
    ...state,
    screens: {
      ...state.screens,
      [screenId]: { ...state.screens[screenId], signal },
    },
  };
}

export function clearTransitionSignals(state: RoutingState): RoutingState {
  const screens = { ...state.screens };
  (Object.keys(screens) as ScreenId[]).forEach((id) => {
    if (screens[id].signal === "tuning") {
      screens[id] = { ...screens[id], signal: "clean" };
    }
  });
  return { ...state, screens };
}

/** Quantize a continuous knob angle into detent steps. */
export function quantizeDetent(
  value: number,
  min: number,
  max: number,
  detents: number
): number {
  if (detents <= 1) return Math.min(max, Math.max(min, value));
  const t = (value - min) / (max - min);
  const step = Math.round(t * (detents - 1));
  const clamped = Math.min(detents - 1, Math.max(0, step));
  return min + (clamped / (detents - 1)) * (max - min);
}
