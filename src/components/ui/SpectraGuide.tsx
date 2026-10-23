"use client";

import { useEffect, useRef, useState } from "react";
import { useUiStore } from "@/state/uiStore";
import { useTvStore } from "@/state/tvStore";
import { getAudioRouter } from "@/systems/media/AudioRouter";
import { SOURCE_CATALOG } from "@/systems/media/sourceCatalog";

export const GUIDE_SEEN_KEY = "spectra.field-guide.seen.v1";

const STEPS = [
  {
    title: "Your own television studio",
    text: "Meet the 1973 Spectra: one main screen, three previews, and a whole world of signals. Learn the essentials in five short stops.",
    hint: "Try each control as you go. You can leave and return to the guide at any time.",
  },
  {
    title: "Bring the picture to life",
    text: "Press the red dial on the TV to switch it on, or use the power button below. Give the tubes a moment to warm up.",
    hint: "Built-in graphics play with a gentle TV hum. Videos with audio play their soundtrack on the main screen.",
  },
  {
    title: "Three previews. One program.",
    text: "The large screen is your main program. Tap any small screen to swap it with the main one. The other previews keep playing, silently.",
    hint: "Try a preview below. Lock assignments in Controls keeps your chosen arrangement in place.",
  },
  {
    title: "Find your next signal",
    text: "Turn the red dial to tune the main screen. Each small dial changes its own preview. Try one of these built-in channels.",
    hint: "For an exact choice, open Controls → Sources. Every screen has its own source menu.",
  },
  {
    title: "Take a closer look",
    text: "Tap the main screen to move in for a clear view; tap it again to return. You can also use the button below.",
    hint: "Around the TV: drag to orbit, pinch or scroll to zoom. The front view recenters after a drag. Camera presets in Controls let you inspect other sides.",
  },
  {
    title: "Make it your Spectra",
    text: "You’re ready to explore. Open Controls for picture and sound, individual sources, and a look inside the cabinet.",
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
  const mainSource = useTvStore((s) => s.screens.main.sourceId);
  const mainPowered = useTvStore((s) => s.screens.main.powered);
  const [step, setStep] = useState(0);
  const [feedback, setFeedback] = useState("");
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
    setFeedback(changed ? "New signal on the main screen." : "Assignments are locked. Unlock them in Controls to change channels.");
  };

  if (!open || mode === "xr") return null;
  const current = STEPS[step];
  const sourceLabel = SOURCE_CATALOG.find((source) => source.id === mainSource)?.label ?? "Your media";
  const ready = power === "on";

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
        <span className="guide-eyebrow">Spectra · Field guide</span>
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
              setFeedback(changed ? `Preview ${index + 1} and the main screen swapped places.` : "Assignments are locked. Unlock them in Controls to swap screens.");
            }}>Try preview {index + 1}</button>
          ))}
        </div>
      )}
      {step === 3 && (
        <div className="guide-try-row">
          {([["newsroom", "Moiré"], ["starfield", "Starfield"], ["smpte", "Test pattern"]] as const).map(([id, label]) => (
            <button type="button" key={id} aria-pressed={mainSource === id} disabled={!ready || !mainPowered || locked} onClick={() => tryChannel(id)}>{label}</button>
          ))}
        </div>
      )}
      {(step === 2 || step === 3) && (
        <p className="guide-current">{!ready ? "Turn on the TV in the Power step to try this." : !mainPowered ? "The main screen is off. Enable it under Controls → Sources." : locked ? "Assignments are locked. Unlock them in Controls to try this." : `Main program: ${sourceLabel}`}</p>
      )}
      {step === 4 && (
        <button type="button" className="guide-action" onClick={() => useUiStore.getState().setMainCrtZoom(cameraPreset !== "mainCrt")}>
          {cameraPreset === "mainCrt" ? "Back to the whole TV" : "View the main screen"}
        </button>
      )}
      {step === 5 && (
        <ul className="guide-features">
          <li><strong>Your media</strong> Add a video or still from your device. It stays in this browser.</li>
          <li><strong>Picture & sound</strong> Adjust brightness, color, depth, and volume.</li>
          <li><strong>Inspection & accessibility</strong> Look inside, reduce flicker, or enable reduced motion.</li>
        </ul>
      )}
      <p className="guide-hint">{current.hint}</p>
      <p className="guide-feedback" role="status" aria-live="polite">{feedback}</p>
      </div>
      <footer className="guide-navigation">
        {step > 0 ? <button type="button" onClick={() => setStep(step - 1)}>Back</button> : <button type="button" onClick={close}>Explore on my own</button>}
        {step < STEPS.length - 1 ? (
          <button type="button" className="guide-next" onClick={() => { rememberGuide(); setStep(step + 1); }}>{step === 0 ? "Start guide" : "Next"}<span aria-hidden="true"> →</span></button>
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
