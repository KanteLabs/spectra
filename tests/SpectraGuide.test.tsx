// @vitest-environment jsdom

import React from "react";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const audio = vi.hoisted(() => {
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    value: vi.fn(() => ({ matches: false })),
  });
  return {
    unlock: vi.fn().mockResolvedValue(undefined),
    syncToSource: vi.fn().mockResolvedValue(undefined),
  };
});

vi.mock("@/systems/media/AudioRouter", () => ({
  getAudioRouter: () => audio,
}));
vi.mock("@/systems/media/SourceManager", () => ({
  getSourceManager: () => ({ ensure: vi.fn().mockResolvedValue(undefined) }),
}));

import { GuideButton, GUIDE_SEEN_KEY, SpectraGuide } from "@/components/ui/SpectraGuide";
import { useUiStore } from "@/state/uiStore";
import { useTvStore } from "@/state/tvStore";

function mountGuide(embedded = false) {
  return render(
    <div className="app-shell">
      <GuideButton />
      <SpectraGuide embedded={embedded} />
      <aside className="control-panel">
        <h1 tabIndex={-1}>Spectra controls</h1>
      </aside>
    </div>
  );
}

function advanceTo(step: number) {
  fireEvent.click(screen.getByRole("button", { name: /Start guide/ }));
  for (let current = 1; current < step; current += 1) {
    fireEvent.click(screen.getByRole("button", { name: /Next/ }));
  }
}

beforeEach(() => {
  // The app uses Next's automatic JSX transform; Vitest's default is classic.
  vi.stubGlobal("React", React);
  localStorage.clear();
  useUiStore.setState(useUiStore.getInitialState(), true);
  useTvStore.setState(useTvStore.getInitialState(), true);
  vi.clearAllMocks();
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("Spectra field guide", () => {
  it("opens on the first visit, remembers dismissal, and can be reopened", () => {
    const firstVisit = mountGuide();
    expect(screen.getByRole("dialog", { name: "Your own television studio" })).toBeVisible();

    fireEvent.click(screen.getByRole("button", { name: "Skip guide" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(localStorage.getItem(GUIDE_SEEN_KEY)).toBe("1");
    expect(screen.getByRole("button", { name: "Guide" })).toHaveFocus();

    firstVisit.unmount();
    mountGuide();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Guide" }));
    expect(screen.getByRole("dialog", { name: "Your own television studio" })).toBeVisible();
    expect(screen.getByRole("heading", { name: "Your own television studio" })).toHaveFocus();
  });

  it("supports Back and Next, then hands off to Controls and restarts on replay", async () => {
    mountGuide();
    advanceTo(1);
    expect(screen.getByRole("heading", { name: "Bring the picture to life" })).toHaveFocus();
    fireEvent.click(screen.getByRole("button", { name: "Back" }));
    expect(screen.getByRole("heading", { name: "Your own television studio" })).toBeVisible();

    advanceTo(5);
    expect(screen.getByRole("heading", { name: "Make it your Spectra" })).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: /Open Controls/ }));
    expect(useUiStore.getState().panelOpen).toBe(true);
    expect(useUiStore.getState().guideOpen).toBe(false);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole("heading", { name: "Spectra controls" })).toHaveFocus());

    fireEvent.click(screen.getByRole("button", { name: "Guide" }));
    expect(useUiStore.getState().panelOpen).toBe(false);
    expect(screen.getByRole("heading", { name: "Your own television studio" })).toBeVisible();
  });

  it("unlocks audio when powering on and never powers off on a repeat attempt", () => {
    mountGuide();
    advanceTo(1);
    fireEvent.click(screen.getByRole("button", { name: "Power on" }));
    expect(audio.unlock).toHaveBeenCalledTimes(1);
    expect(useTvStore.getState().audioUnlocked).toBe(true);
    expect(useTvStore.getState().power).toBe("starting");
    expect(screen.getByRole("button", { name: "Warming up…" })).toBeDisabled();

    fireEvent.click(screen.getByRole("button", { name: "Warming up…" }));
    expect(useTvStore.getState().power).toBe("starting");
    act(() => useTvStore.getState().setPower("on"));
    fireEvent.click(screen.getByRole("button", { name: "Power is on" }));
    expect(useTvStore.getState().power).toBe("on");
    expect(audio.unlock).toHaveBeenCalledTimes(1);
  });

  it("swaps previews, changes the main channel, and respects assignment locks", () => {
    useTvStore.getState().setPower("on");
    mountGuide();
    advanceTo(2);

    const originalMain = useTvStore.getState().screens.main.sourceId;
    const originalPreview = useTvStore.getState().screens.preview1.sourceId;
    fireEvent.click(screen.getByRole("button", { name: "Try preview 1" }));
    expect(useTvStore.getState().screens.main.sourceId).toBe(originalPreview);
    expect(useTvStore.getState().screens.preview1.sourceId).toBe(originalMain);
    expect(screen.getByRole("status")).toHaveTextContent("swapped with main");
    expect(audio.unlock).toHaveBeenCalledTimes(1);

    act(() => useTvStore.getState().setLock(true));
    expect(screen.getByRole("button", { name: "Try preview 2" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Try preview 2" }));
    expect(useTvStore.getState().screens.main.sourceId).toBe(originalPreview);
    expect(screen.getByText(/Assignments are locked\. Unlock them/)).toBeVisible();

    fireEvent.click(screen.getByRole("button", { name: /Next/ }));
    expect(screen.getByRole("button", { name: "Stars" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Stars" }));
    expect(useTvStore.getState().screens.main.sourceId).toBe(originalPreview);
    act(() => useTvStore.getState().setLock(false));
    fireEvent.click(screen.getByRole("button", { name: "Stars" }));
    expect(useTvStore.getState().screens.main.sourceId).toBe("starfield");
    expect(screen.getByRole("button", { name: "Stars" })).toHaveAttribute("aria-pressed", "true");
    expect(audio.unlock).toHaveBeenCalledTimes(2);
  });

  it("keeps demonstrations unavailable until the main screen can display them", () => {
    mountGuide();
    advanceTo(2);
    expect(screen.getByRole("button", { name: "Try preview 1" })).toBeDisabled();
    expect(screen.getByText(/Turn on the TV in the Power step/)).toBeVisible();
    act(() => {
      useTvStore.getState().setPower("on");
      useTvStore.getState().setScreenOn("main", false);
    });
    expect(screen.getByRole("button", { name: "Try preview 1" })).toBeDisabled();
    expect(screen.getByText(/The main screen is off/)).toBeVisible();
  });

  it("keeps tips optional and frames the picture for the procedural tuning stop", () => {
    useTvStore.getState().setPower("on");
    mountGuide();
    expect(screen.getByRole("button", { name: "Tips" })).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(screen.getByRole("button", { name: "Tips" }));
    expect(screen.getByText(/Use the buttons as you go/)).toBeVisible();
    advanceTo(3);
    expect(screen.getByRole("button", { name: "Tips" })).toHaveAttribute("aria-expanded", "false");
    expect(useUiStore.getState().cameraPreset).toBe("mainCrt");
    fireEvent.click(screen.getByRole("button", { name: "Plasma" }));
    expect(useTvStore.getState().screens.main.sourceId).toBe("weather");
    fireEvent.click(screen.getByRole("button", { name: "Moiré" }));
    expect(useTvStore.getState().screens.main.sourceId).toBe("newsroom");
    fireEvent.click(screen.getByRole("button", { name: /Next/ }));
    expect(useUiStore.getState().cameraPreset).toBe("front");
    fireEvent.click(screen.getByRole("button", { name: "Back" }));
    expect(useUiStore.getState().cameraPreset).toBe("mainCrt");
    fireEvent.click(screen.getByRole("button", { name: "Back" }));
    expect(useUiStore.getState().cameraPreset).toBe("front");
  });

  it("closes on standalone Escape without sending the key to the scene", () => {
    mountGuide();
    const sceneKeydown = vi.fn();
    window.addEventListener("keydown", sceneKeydown);
    try {
      const event = new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true });
      fireEvent(screen.getByRole("heading", { name: "Your own television studio" }), event);
      expect(event.defaultPrevented).toBe(true);
      expect(sceneKeydown).not.toHaveBeenCalled();
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
      expect(localStorage.getItem(GUIDE_SEEN_KEY)).toBe("1");
    } finally {
      window.removeEventListener("keydown", sceneKeydown);
    }
  });

  it("leaves embedded Escape available to the host", () => {
    mountGuide(true);
    const hostKeydown = vi.fn();
    window.addEventListener("keydown", hostKeydown);
    try {
      const event = new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true });
      fireEvent(screen.getByRole("heading", { name: "Your own television studio" }), event);
      expect(event.defaultPrevented).toBe(false);
      expect(hostKeydown).toHaveBeenCalledTimes(1);
      expect(screen.getByRole("dialog")).toBeVisible();
    } finally {
      window.removeEventListener("keydown", hostKeydown);
    }
  });

  it("remains usable when browser storage is unavailable", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => { throw new Error("Storage blocked"); });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("Storage blocked"); });
    mountGuide();
    fireEvent.click(screen.getByRole("button", { name: "Close guide" }));
    fireEvent.click(screen.getByRole("button", { name: "Guide" }));
    expect(screen.getByRole("dialog")).toBeVisible();
  });

  it("does not interrupt an already open Controls panel on first mount", () => {
    useUiStore.getState().setPanelOpen(true);
    mountGuide();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(useUiStore.getState().panelOpen).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "Guide" }));
    expect(useUiStore.getState().guideOpen).toBe(true);
    expect(useUiStore.getState().panelOpen).toBe(false);
    act(() => useUiStore.getState().setPanelOpen(true));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(useUiStore.getState().guideOpen).toBe(false);
  });
});
