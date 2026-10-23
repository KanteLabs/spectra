import { create } from "zustand";
import type {
  PictureControls,
  PowerState,
  ScreenId,
  SignalCondition,
} from "@/types";
import {
  clearTransitionSignals,
  createDefaultRouting,
  promotePreview,
  setLocked,
  setScreenPowered,
  setScreenSignal,
  setScreenSource,
  type RoutingState,
} from "@/systems/routing/screenRouter";
import { emit } from "@/state/events";
import { getChannelBankIds } from "@/systems/media/sourceCatalog";

const DEFAULT_SOURCES = {
  main: "weather",
  preview1: "newsroom",
  preview2: "starfield",
  preview3: "automata",
};

/** After main source changes, load media then attach program audio. */
function syncMainProgramAudio(sourceId: string, volume: number, power: PowerState) {
  if (power !== "on") {
    void import("@/systems/media/SourceManager").then(({ getSourceManager }) => {
      void getSourceManager().ensure(sourceId);
    });
    return;
  }
  void import("@/systems/media/AudioRouter").then(({ getAudioRouter }) => {
    const audio = getAudioRouter();
    if (!useTvStore.getState().audioUnlocked) {
      void import("@/systems/media/SourceManager").then(({ getSourceManager }) => {
        void getSourceManager().ensure(sourceId);
      });
      return;
    }
    void audio.syncToSource(sourceId, volume);
  });
}

export interface TvStore extends RoutingState {
  power: PowerState;
  powerProgress: number;
  picture: PictureControls;
  selectedControlId: string | null;
  transitionActive: boolean;
  channelBank: number;
  audioUnlocked: boolean;

  setPower: (power: PowerState) => void;
  setPowerProgress: (n: number) => void;
  togglePower: () => void;
  promote: (previewId: Exclude<ScreenId, "main">) => boolean;
  assignSource: (screenId: ScreenId, sourceId: string) => boolean;
  setLock: (locked: boolean) => void;
  setScreenOn: (screenId: ScreenId, powered: boolean) => void;
  cyclePreviewSource: (previewId: Exclude<ScreenId, "main">) => boolean;
  setPreviewsPowered: (powered: boolean) => void;
  setSignal: (screenId: ScreenId, signal: SignalCondition) => void;
  finishTransition: () => void;
  setPicture: (partial: Partial<PictureControls>) => void;
  setSelectedControl: (id: string | null) => void;
  setChannelBank: (bank: number) => void;
  unlockAudio: () => void;
  reset: () => void;
}

const initialRouting = createDefaultRouting(DEFAULT_SOURCES);

const initialPicture: PictureControls = {
  brightness: 0.85,
  contrast: 1.2,
  saturation: 1,
  tuning: 0.92,
  volume: 0.6,
  previewLevel: 0.9,
};

export const useTvStore = create<TvStore>((set, get) => ({
  ...initialRouting,
  power: "off",
  powerProgress: 0,
  picture: initialPicture,
  selectedControlId: null,
  transitionActive: false,
  channelBank: getChannelBankIds().indexOf(DEFAULT_SOURCES.main),
  audioUnlocked: false,

  setPower: (power) => {
    set({ power });
    if (power === "on") emit({ type: "power", state: "on" });
    if (power === "off") emit({ type: "power", state: "off" });
  },

  setPowerProgress: (powerProgress) => set({ powerProgress }),

  togglePower: () => {
    const { power } = get();
    if (power === "off") {
      set({ power: "starting", powerProgress: 0 });
      emit({ type: "announce", message: "Television powering on" });
    } else if (power === "on") {
      set({ power: "shuttingDown" });
      emit({ type: "announce", message: "Television powering off" });
    } else if (power === "starting") {
      // Cancel startup → shut down
      set({ power: "shuttingDown" });
      emit({ type: "announce", message: "Television powering off" });
    } else if (power === "shuttingDown") {
      // Cancel shutdown → start again
      set({ power: "starting" });
      emit({ type: "announce", message: "Television powering on" });
    }
  },

  promote: (previewId) => {
    const state = get();
    const next = promotePreview(state, previewId);
    if (!next) {
      emit({
        type: "announce",
        message: state.locked
          ? "Screen assignments are locked"
          : "Cannot promote that screen",
      });
      return false;
    }
    const bank = getChannelBankIds();
    const mainIdx = bank.indexOf(next.screens.main.sourceId);
    set({
      ...next,
      transitionActive: true,
      channelBank: mainIdx >= 0 ? mainIdx : state.channelBank,
    });
    emit({ type: "promote", previewId });
    emit({
      type: "announce",
      message: `${previewId} promoted to main screen`,
    });
    emit({ type: "transitionStart", durationMs: 400 });
    syncMainProgramAudio(
      next.screens.main.sourceId,
      get().picture.volume,
      get().power
    );
    return true;
  },

  assignSource: (screenId, sourceId) => {
    const next = setScreenSource(get(), screenId, sourceId);
    if (!next) return false;
    const patch: Partial<TvStore> = {
      ...next,
      transitionActive: true,
    };
    if (screenId === "main") {
      const bank = getChannelBankIds();
      const idx = bank.indexOf(sourceId);
      if (idx >= 0) patch.channelBank = idx;
    }
    set(patch);
    emit({ type: "transitionStart", durationMs: 400 });
    emit({
      type: "announce",
      message: `Source ${sourceId} assigned to ${screenId}`,
    });
    if (screenId === "main") {
      syncMainProgramAudio(sourceId, get().picture.volume, get().power);
    } else {
      void import("@/systems/media/SourceManager").then(({ getSourceManager }) => {
        void getSourceManager().ensure(sourceId);
      });
    }
    return true;
  },

  setLock: (locked) => {
    set(setLocked(get(), locked));
    emit({
      type: "announce",
      message: locked ? "Screen assignments locked" : "Screen assignments unlocked",
    });
  },

  setScreenOn: (screenId, powered) => {
    set(setScreenPowered(get(), screenId, powered));
  },

  cyclePreviewSource: (previewId) => {
    const state = get();
    if (state.locked) {
      emit({
        type: "announce",
        message: "Screen assignments are locked",
      });
      return false;
    }
    const bank = getChannelBankIds();
    const current = state.screens[previewId].sourceId;
    const idx = Math.max(0, bank.indexOf(current));
    const nextId = bank[(idx + 1) % bank.length];
    return get().assignSource(previewId, nextId);
  },

  setPreviewsPowered: (powered) => {
    const next = setScreenPowered(
      setScreenPowered(
        setScreenPowered(get(), "preview1", powered),
        "preview2",
        powered
      ),
      "preview3",
      powered
    );
    set(next);
    emit({
      type: "announce",
      message: powered ? "Preview screens on" : "Preview screens off",
    });
  },

  setSignal: (screenId, signal) => {
    set(setScreenSignal(get(), screenId, signal));
  },

  finishTransition: () => {
    set({
      ...clearTransitionSignals(get()),
      transitionActive: false,
    });
    emit({ type: "transitionEnd" });
  },

  setPicture: (partial) => {
    set({ picture: { ...get().picture, ...partial } });
  },

  setSelectedControl: (id) => {
    set({ selectedControlId: id });
    emit({ type: "controlSelect", controlId: id });
  },

  setChannelBank: (bank) => set({ channelBank: bank }),

  unlockAudio: () => {
    if (!get().audioUnlocked) {
      set({ audioUnlocked: true });
      emit({ type: "audioUnlock" });
    }
  },

  reset: () => {
    set({
      ...createDefaultRouting(DEFAULT_SOURCES),
      power: "off",
      powerProgress: 0,
      picture: initialPicture,
      selectedControlId: null,
      transitionActive: false,
      channelBank: getChannelBankIds().indexOf(DEFAULT_SOURCES.main),
    });
    emit({ type: "announce", message: "Experience reset" });
  },
}));
