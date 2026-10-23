"use client";

import { useEffect, useRef, useState } from "react";
import { useUiStore } from "@/state/uiStore";
import { useTvStore } from "@/state/tvStore";
import { getAudioRouter } from "@/systems/media/AudioRouter";

export const GUIDE_SEEN_KEY = "spectra.field-guide.seen.v1";

const PATTERN_LABELS: Record<string, string> = {
  newsroom: "Moiré", weather: "Plasma", starfield: "Stars", automata: "Cells",
};

const STEPS = [
  {
    title: "Your own television studio",
    text: "One main screen. Three previews. Get to know your Spectra in five quick steps.",
    hint: "Use the buttons as you go, or close the guide to explore. Reopen it from Guide.",
  },
  {
    title: "Bring the picture to life",
    text: "Power on and watch the colorful plasma come to life.",
    hint: "Built-in graphics play with a gentle TV hum. Videos with audio play their soundtrack on the main screen.",
  },
  {
    title: "Swap a preview",
    text: "Tap a preview to swap it with the main picture.",
    hint: "You can also tap a small screen on the TV. Previews stay silent. Lock assignments in Controls keeps your arrangement in place.",
  },
  {
    title: "Play with living patterns",
    text: "Pick a pattern: flowing plasma, moiré rings, or a star tunnel.",
    hint: "These patterns are generated live. Turn the red dial to change the main channel; the small dials tune previews. More choices live in Controls → Sources.",
  },
  {
    title: "Find your favorite view",
    text: "Drag around the TV. Pinch to zoom. Tap the main screen for a close-up.",
    hint: "Tap the main screen again to return. The front view recenters after a drag. On desktop, scroll to zoom. Controls has more camera presets.",
  },
  {
    title: "Make it your Spectra",
    text: "Add your own media, adjust the picture, or look inside the cabinet in Controls.",
    hint: "Guide is always here when you need a refresher.",
  },
] as const;

function rememberGuide() {
  try {
    localStorage.setItem(GUIDE_SEEN_KEY, "1");
  } catch {
    // Storage may be disabled; the guide remains usable for this visit.
  }
}

function unlockAudio() {
  useTvStore.getState().unlockAudio();
  void getAudioRouter().unlock();
}

export function GuideButton() {
  const open = useUiStore((s) => s.guideOpen);
  const mode = useUiStore((s) => s.mode);
  if (mode === "xr") return null;
  return (
    <button
      type="button"
      className="guide-toggle"
      aria-controls="spectra-guide"
      aria-expanded={open}
      onClick={() => {
        rememberGuide();
        useUiStore.getState().setGuideOpen(!open);
      }}
    >
      <span aria-hidden="true">?</span> Guide
    </button>
  );
}

export function SpectraGuide({ embedded = false }: { embedded?: boolean }) {
  const open = useUiStore((s) => s.guideOpen);
  const mode = useUiStore((s) => s.mode);
  const cameraPreset = useUiStore((s) => s.cameraPreset);
  const panelOpen = useUiStore((s) => s.panelOpen);
  const highContrast = useUiStore((s) => s.highContrast);
  const power = useTvStore((s) => s.power);
  const locked = useTvStore((s) => s.locked);
  const screens = useTvStore((s) => s.screens);
  const { sourceId: mainSource, powered: mainPowered } = screens.main;
  const [step, setStep] = useState(0);
  const [feedback, setFeedback] = useState("");
  const [tipsOpen, setTipsOpen] = useState(false);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const cardRef = useRef<HTMLElement>(null);
  const previousFocus = useRef<HTMLElement | null>(null);
  const autoOpened = useRef(false);
  const controlsHandoff = useRef<Element | null>(null);

  useEffect(() => {
    if (!panelOpen || !controlsHandoff.current) return;
    const shell = controlsHandoff.current;
    let focusFrame = 0;
    const frame = requestAnimationFrame(() => {
      // Allow the drawer's hidden-to-visible styles to paint before focusing it.
      focusFrame = requestAnimationFrame(() => {
        shell.querySelector<HTMLElement>(".control-panel h1")?.focus({ preventScroll: true });
        controlsHandoff.current = null;
      });
    });
    return () => { cancelAnimationFrame(frame); cancelAnimationFrame(focusFrame); };
  }, [panelOpen]);

  useEffect(() => {
    let seen = false;
    try { seen = localStorage.getItem(GUIDE_SEEN_KEY) === "1"; } catch { /* optional */ }
    if (!seen && !useUiStore.getState().panelOpen) {
      autoOpened.current = true;
      useUiStore.getState().setGuideOpen(true);
    }
  }, []);

  useEffect(() => {
    if (!open || mode === "xr") return;
    const launcher = cardRef.current?.closest(".app-shell")?.querySelector<HTMLElement>(".guide-toggle") ?? null;
    previousFocus.current = document.activeElement instanceof HTMLElement && document.activeElement !== document.body ? document.activeElement : launcher;
    if (!autoOpened.current || document.activeElement === document.body) headingRef.current?.focus({ preventScroll: true });
    autoOpened.current = false;
    return () => {
      // Opening Controls should be free to move focus to its own contents.
      const focus = previousFocus.current;
      if (focus?.isConnected && !useUiStore.getState().panelOpen) focus.focus({ preventScroll: true });
    };
  }, [open, mode]);

  useEffect(() => {
    setFeedback("");
    setTipsOpen(false);
    if (useUiStore.getState().guideOpen) {
      headingRef.current?.focus({ preventScroll: true });
      const body = cardRef.current?.querySelector(".guide-body");
      if (body) body.scrollTop = 0;
    }
  }, [step]);

  const close = () => {
    rememberGuide();
    useUiStore.getState().setGuideOpen(false);
  };

  const tryChannel = (id: string) => {
    unlockAudio();
    const changed = useTvStore.getState().assignSource("main", id);
    setFeedback(changed ? `${PATTERN_LABELS[id] ?? "New signal"} on the main screen.` : "Assignments are locked. Unlock them in Controls to change channels.");
  };

  const changeStep = (next: number) => {
    rememberGuide();
    // The tuning stop needs a readable picture; preview swaps need the whole set.
    if (next === 3) useUiStore.getState().setMainCrtZoom(true);
    else if (step === 3 || next === 2) useUiStore.getState().setMainCrtZoom(false);
    setStep(next);
  };

  if (!open || mode === "xr") return null;
  const current = STEPS[step];
  const ready = power === "on";
  const unavailable = !ready
    ? "Turn on the TV in the Power step to try this."
    : !mainPowered
      ? "The main screen is off. Enable it under Controls → Sources."
      : locked
        ? "Assignments are locked. Unlock them in Controls to try this."
        : "";
  const status = ((step === 2 || step === 3) && unavailable) || feedback;

  return (
    <aside
      ref={cardRef}
      id="spectra-guide"
      className={`spectra-guide ${highContrast ? "hc" : ""}`}
      role="dialog"
      aria-modal="false"
      aria-labelledby="guide-title"
      aria-describedby="guide-description"
      onKeyDown={(event) => {
        // The embedded host owns Escape; other keys in the guide never operate the TV.
        if (event.key === "Escape" && embedded) return;
        event.stopPropagation();
        if (event.key === "Escape") {
          event.preventDefault();
          close();
        }
      }}
    >
      <div className="guide-topline">
        <span className="guide-eyebrow">Field guide <span className="guide-counter">{step === 0 ? "Start here" : `${step} / 5`}</span></span>
        <button type="button" className="guide-close" aria-label="Close guide" onClick={close}>×</button>
      </div>
      <div className="guide-progress" aria-label={step === 0 ? "Introduction" : `Step ${step} of 5`}>
        {STEPS.map((item, index) => (
          <span key={item.title} className={index <= step ? "filled" : ""} />
        ))}
      </div>
      <div className="guide-body">
      <div className="guide-intro-row">
        <div className={`guide-diagram step-${step}`} aria-hidden="true">
          <div className="diagram-main">MAIN</div>
          <div className="diagram-dial" />
          <div className="diagram-previews"><span>1</span><span>2</span><span>3</span></div>
        </div>
        <div>
          <p className="guide-step-label">{step === 0 ? "A brief introduction" : `${String(step).padStart(2, "0")} / 05`}</p>
          <h2 id="guide-title" ref={headingRef} tabIndex={-1}>{current.title}</h2>
        </div>
      </div>
      <p id="guide-description" className="guide-description">{current.text}</p>

      {step === 1 && (
        <button type="button" className="guide-action" disabled={ready || power === "starting"} onClick={() => {
          unlockAudio();
          const tv = useTvStore.getState();
          if (tv.power === "off" || tv.power === "shuttingDown") tv.togglePower();
        }}>
          {ready ? "Power is on" : power === "starting" ? "Warming up…" : "Power on"}
        </button>
      )}
      {step === 2 && (
        <div className="guide-try-row">
          {(["preview1", "preview2", "preview3"] as const).map((id, index) => (
            <button type="button" key={id} disabled={!ready || !mainPowered || locked} onClick={() => {
              unlockAudio();
              const changed = useTvStore.getState().promote(id);
              setFeedback(changed ? `Preview ${index + 1} swapped with main.` : "Assignments are locked. Unlock them in Controls to swap screens.");
            }} aria-label={`Try preview ${index + 1}`}><span className="guide-preview-number">{index + 1}</span> {PATTERN_LABELS[screens[id].sourceId] ?? "Preview"}</button>
          ))}
        </div>
      )}
      {step === 3 && (
        <div className="guide-try-row">
          {([["weather", "Plasma"], ["newsroom", "Moiré"], ["starfield", "Stars"]] as const).map(([id, label]) => (
            <button type="button" key={id} aria-pressed={mainSource === id} disabled={!ready || !mainPowered || locked} onClick={() => tryChannel(id)}>{label}</button>
          ))}
        </div>
      )}
      {step === 4 && (
        <button type="button" className="guide-action" onClick={() => useUiStore.getState().setMainCrtZoom(cameraPreset !== "mainCrt")}>
          {cameraPreset === "mainCrt" ? "Back to the whole TV" : "View the main screen"}
        </button>
      )}
      <p className="guide-feedback" role="status" aria-live="polite">{status}</p>
      <p id="guide-tips" className="guide-hint" hidden={!tipsOpen}>{current.hint}</p>
      </div>
      <footer className="guide-navigation">
        {step > 0 ? <button type="button" onClick={() => changeStep(step - 1)}>Back</button> : <button type="button" onClick={close}>Skip guide</button>}
        <button type="button" className="guide-tips-toggle" aria-expanded={tipsOpen} aria-controls="guide-tips" onClick={() => setTipsOpen(!tipsOpen)}>Tips</button>
        {step < STEPS.length - 1 ? (
          <button type="button" className="guide-next" onClick={() => changeStep(step + 1)}>{step === 0 ? "Start guide" : "Next"}<span aria-hidden="true"> →</span></button>
        ) : (
          <button type="button" className="guide-next" onClick={() => {
            controlsHandoff.current = cardRef.current?.closest(".app-shell") ?? null;
            close();
            setStep(0);
            useUiStore.getState().setPanelOpen(true);
          }}>Open Controls →</button>
        )}
      </footer>
    </aside>
  );
}
