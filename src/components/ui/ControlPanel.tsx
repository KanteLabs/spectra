"use client";

import { useEffect, useRef, useState } from "react";
import { useTvStore } from "@/state/tvStore";
import { useUiStore } from "@/state/uiStore";
import {
  SOURCE_CATALOG,
  getChannelBankIds,
} from "@/systems/media/sourceCatalog";
import {
  listUserSources,
  registerUserMediaFile,
  removeUserSource,
  subscribeUserSources,
  hydrateUserSourcesFromDb,
  MAX_USER_MEDIA,
} from "@/systems/media/userSources";
import { getSourceManager } from "@/systems/media/SourceManager";
import { subscribe } from "@/state/events";
import { getAudioRouter } from "@/systems/media/AudioRouter";
import type {
  MainDepthEffect,
  QualityLevel,
  ScreenId,
  SignalCondition,
  SourceDefinition,
} from "@/types";
import { MAIN_DEPTH_OPTIONS } from "@/systems/quality/depthPresets";

function unlockMedia() {
  useTvStore.getState().unlockAudio();
  void getAudioRouter().unlock();
}

const SIGNALS: SignalCondition[] = [
  "clean",
  "weak",
  "tuning",
  "noSignal",
  "verticalHold",
  "horizontalHold",
  "static",
  "testPattern",
];

const STRONG_SIGNALS = new Set<SignalCondition>([
  "static",
  "noSignal",
  "verticalHold",
  "horizontalHold",
]);

export function ControlPanel() {
  const power = useTvStore((s) => s.power);
  const screens = useTvStore((s) => s.screens);
  const picture = useTvStore((s) => s.picture);
  const locked = useTvStore((s) => s.locked);
  const togglePower = useTvStore((s) => s.togglePower);
  const promote = useTvStore((s) => s.promote);
  const assignSource = useTvStore((s) => s.assignSource);
  const setLock = useTvStore((s) => s.setLock);
  const setPicture = useTvStore((s) => s.setPicture);
  const setScreenOn = useTvStore((s) => s.setScreenOn);
  const setSignal = useTvStore((s) => s.setSignal);
  const reset = useTvStore((s) => s.reset);

  const panelOpen = useUiStore((s) => s.panelOpen);
  const setPanelOpen = useUiStore((s) => s.setPanelOpen);
  const environment = useUiStore((s) => s.environment);
  const setEnvironment = useUiStore((s) => s.setEnvironment);
  const quality = useUiStore((s) => s.quality);
  const setQuality = useUiStore((s) => s.setQuality);
  const inspectionMode = useUiStore((s) => s.inspectionMode);
  const setInspectionMode = useUiStore((s) => s.setInspectionMode);
  const explodedProgress = useUiStore((s) => s.explodedProgress);
  const setExplodedProgress = useUiStore((s) => s.setExplodedProgress);
  const cabinetTransparent = useUiStore((s) => s.cabinetTransparent);
  const setCabinetTransparent = useUiStore((s) => s.setCabinetTransparent);
  const rearRemoved = useUiStore((s) => s.rearRemoved);
  const setRearRemoved = useUiStore((s) => s.setRearRemoved);
  const showLabels = useUiStore((s) => s.showLabels);
  const setShowLabels = useUiStore((s) => s.setShowLabels);
  const reducedMotion = useUiStore((s) => s.reducedMotion);
  const setReducedMotion = useUiStore((s) => s.setReducedMotion);
  const reducedFlicker = useUiStore((s) => s.reducedFlicker);
  const setReducedFlicker = useUiStore((s) => s.setReducedFlicker);
  const highContrast = useUiStore((s) => s.highContrast);
  const setHighContrast = useUiStore((s) => s.setHighContrast);
  const setCameraPreset = useUiStore((s) => s.setCameraPreset);
  const cameraPreset = useUiStore((s) => s.cameraPreset);
  const warningAcknowledged = useUiStore((s) => s.warningAcknowledged);
  const setWarningAcknowledged = useUiStore((s) => s.setWarningAcknowledged);
  const mainDepthEffect = useUiStore((s) => s.mainDepthEffect);
  const setMainDepthEffect = useUiStore((s) => s.setMainDepthEffect);

  const [announce, setAnnounce] = useState("");
  const [pendingSignal, setPendingSignal] = useState<{
    screen: ScreenId;
    signal: SignalCondition;
  } | null>(null);
  const [userMedia, setUserMedia] = useState<SourceDefinition[]>(() =>
    listUserSources()
  );
  const [uploadError, setUploadError] = useState("");
  const [uploadBusy, setUploadBusy] = useState(false);
  const [dropActive, setDropActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const panelRef = useRef<HTMLElement>(null);
  const toggleRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    // A translated-offscreen drawer must not retain keyboard focus.
    if (!panelOpen && panelRef.current?.contains(document.activeElement)) {
      toggleRef.current?.focus({ preventScroll: true });
    }
    panelRef.current?.toggleAttribute("inert", !panelOpen);
  }, [panelOpen]);

  useEffect(() => {
    return subscribe((ev) => {
      if (ev.type === "announce") setAnnounce(ev.message);
    });
  }, []);

  useEffect(() => {
    return subscribeUserSources(() => setUserMedia(listUserSources()));
  }, []);

  useEffect(() => {
    void hydrateUserSourcesFromDb().then(async () => {
      setUserMedia(listUserSources());
      const mgr = getSourceManager();
      for (const s of listUserSources()) {
        await mgr.ensure(s.id);
      }
    });
  }, []);

  const ingestFile = async (file: File | undefined, screen: ScreenId = "main") => {
    if (!file) return;
    setUploadError("");
    setUploadBusy(true);
    unlockMedia();
    try {
      const def = await registerUserMediaFile(file);
      await getSourceManager().ensure(def.id);
      assignSource(screen, def.id);
      // Main assign path re-syncs program audio after ensure
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploadBusy(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const onRemoveUserMedia = (id: string) => {
    unlockMedia();
    const mgr = getSourceManager();
    mgr.remove(id);
    removeUserSource(id);
    const bank = getChannelBankIds();
    const tv = useTvStore.getState();
    (["main", "preview1", "preview2", "preview3"] as ScreenId[]).forEach(
      (screenId) => {
        if (screens[screenId].sourceId === id) {
          assignSource(screenId, SOURCE_CATALOG[0]?.id ?? "smpte");
        }
      }
    );
    if (tv.channelBank >= bank.length) {
      tv.setChannelBank(Math.max(0, bank.length - 1));
    }
    if (getAudioRouter().getActiveSourceId() === id) {
      void getAudioRouter().syncToSource(
        useTvStore.getState().screens.main.sourceId,
        picture.volume
      );
    }
  };

  const requestSignal = (screen: ScreenId, signal: SignalCondition) => {
    if (STRONG_SIGNALS.has(signal) && !warningAcknowledged) {
      setPendingSignal({ screen, signal });
      return;
    }
    setSignal(screen, signal);
  };

  return (
    <>
      <div className="sr-live" role="status" aria-live="polite" aria-atomic="true">
        {announce}
      </div>

      <div className="control-dock" role="group" aria-label="Quick controls">
        <button
          type="button"
          className="quick-control"
          aria-label="Toggle TV power"
          aria-pressed={power === "on" || power === "starting"}
          onClick={() => {
            unlockMedia();
            togglePower();
          }}
        >
          Power {power === "on" || power === "starting" ? "on" : "off"}
        </button>
        <button
          type="button"
          className="quick-control"
          onClick={() => useUiStore.getState().setMainCrtZoom(cameraPreset !== "mainCrt")}
        >
          {cameraPreset === "mainCrt" ? "Back to TV" : "View screen"}
        </button>
        <button
          ref={toggleRef}
          type="button"
          className="panel-toggle"
          aria-expanded={panelOpen}
          aria-controls="spectra-controls"
          onClick={() => {
            unlockMedia();
            setPanelOpen(!panelOpen);
          }}
        >
          {panelOpen ? "Hide controls" : "Controls"}
        </button>
      </div>

      <aside
        ref={panelRef}
        id="spectra-controls"
        className={`control-panel ${panelOpen ? "open" : ""} ${highContrast ? "hc" : ""}`}
        aria-label="Nordmende Spectra accessible controls"
        aria-hidden={!panelOpen}
      >
        <header>
          <h1>Spectra Color Studio</h1>
          <p className="sub">1973 · Multiview television</p>
        </header>

        <section aria-labelledby="power-heading">
          <h2 id="power-heading">Power</h2>
          <button
            type="button"
            className="primary"
            aria-pressed={power === "on"}
            onClick={() => {
              unlockMedia();
              togglePower();
            }}
          >
            Power{" "}
            {power === "on" || power === "starting" ? "On" : "Off"} ({power})
          </button>
        </section>

        <section aria-labelledby="routing-heading">
          <h2 id="routing-heading">Channel routing</h2>
          <p>
            Main: <strong>{screens.main.sourceId}</strong>
          </p>
          <div className="row">
            {(["preview1", "preview2", "preview3"] as const).map((id, i) => (
              <button
                key={id}
                type="button"
                onClick={() => {
                  unlockMedia();
                  promote(id);
                }}
                aria-label={`Promote preview ${i + 1} (${screens[id].sourceId}) to main`}
              >
                Promote P{i + 1}
              </button>
            ))}
          </div>
          <div className="row wrap">
            {(["preview1", "preview2", "preview3"] as const).map((id, i) => (
              <button
                key={`cycle-${id}`}
                type="button"
                onClick={() => {
                  unlockMedia();
                  useTvStore.getState().cyclePreviewSource(id);
                }}
                aria-label={`Cycle source on preview ${i + 1}`}
              >
                Cycle P{i + 1}
              </button>
            ))}
          </div>
          <label className="check">
            <input
              type="checkbox"
              checked={locked}
              onChange={(e) => setLock(e.target.checked)}
            />
            Lock assignments
          </label>
          <label className="check">
            <input
              type="checkbox"
              checked={
                screens.preview1.powered ||
                screens.preview2.powered ||
                screens.preview3.powered
              }
              onChange={(e) => {
                unlockMedia();
                useTvStore.getState().setPreviewsPowered(e.target.checked);
              }}
            />
            Preview screens on
          </label>
        </section>

        <section aria-labelledby="sources-heading">
          <h2 id="sources-heading">Sources</h2>
          {(["main", "preview1", "preview2", "preview3"] as ScreenId[]).map(
            (screenId) => (
              <div key={screenId} className="field">
                <span>{screenId}</span>
                <select
                  value={screens[screenId].sourceId}
                  aria-label={`Source for ${screenId}`}
                  onChange={(e) => {
                    unlockMedia();
                    assignSource(screenId, e.target.value);
                    // assignSource syncs main program audio when screen is main
                  }}
                >
                  <optgroup label="Built-in">
                    {SOURCE_CATALOG.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.label}
                      </option>
                    ))}
                  </optgroup>
                  {userMedia.length > 0 ? (
                    <optgroup label="Your media">
                      {userMedia.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.kind === "image" ? "[still] " : ""}
                          {s.label}
                          {s.kind === "video" && s.hasAudio === false
                            ? " (no audio)"
                            : ""}
                        </option>
                      ))}
                    </optgroup>
                  ) : null}
                </select>
                <label className="check inline">
                  <input
                    type="checkbox"
                    checked={screens[screenId].powered}
                    onChange={(e) => setScreenOn(screenId, e.target.checked)}
                  />
                  On
                </label>
              </div>
            )
          )}

          <h2 id="upload-heading">Your media</h2>
          <p className="sub" style={{ marginTop: 0 }}>
            Upload video or stills (saved in this browser). Drop a file on a CRT,
            or here. Long videos soft-trim to 10&nbsp;min; 4K is scaled for the
            CRT. Silent clips keep the TV hum.
          </p>
          <div
            className={`media-dropzone ${dropActive ? "active" : ""}`}
            onDragEnter={(e) => {
              e.preventDefault();
              setDropActive(true);
            }}
            onDragOver={(e) => {
              e.preventDefault();
              setDropActive(true);
            }}
            onDragLeave={() => setDropActive(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDropActive(false);
              void ingestFile(e.dataTransfer.files?.[0], "main");
            }}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept="video/*,image/*"
              aria-labelledby="upload-heading"
              className="file-input"
              onChange={(e) => void ingestFile(e.target.files?.[0], "main")}
            />
            <p>
              {uploadBusy
                ? "Processing…"
                : "Drop video / image here, or choose a file"}
            </p>
            <button
              type="button"
              className="primary"
              disabled={uploadBusy || userMedia.length >= MAX_USER_MEDIA}
              onClick={() => fileInputRef.current?.click()}
            >
              Add media
            </button>
          </div>
          {uploadError ? (
            <p className="upload-error" role="alert">
              {uploadError}
            </p>
          ) : null}
          {userMedia.length > 0 ? (
            <ul className="user-video-list">
              {userMedia.map((s) => (
                <li key={s.id}>
                  <span className="user-media-meta">
                    {s.posterUrl ? (
                      // Blob posters from local uploads — next/image cannot optimize these.
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={s.posterUrl}
                        alt=""
                        className="user-media-poster"
                      />
                    ) : null}
                    <span>
                      {s.label}
                      <small>
                        {s.kind === "image"
                          ? " · still"
                          : s.hasAudio === false
                            ? " · TV hum"
                            : " · with audio"}
                        {s.playEndSec ? " · trimmed" : ""}
                        {s.displayScaled ? " · scaled" : ""}
                      </small>
                    </span>
                  </span>
                  <span className="row">
                    <button
                      type="button"
                      onClick={() => {
                        unlockMedia();
                        assignSource("main", s.id);
                      }}
                    >
                      Main
                    </button>
                    <button type="button" onClick={() => onRemoveUserMedia(s.id)}>
                      Remove
                    </button>
                  </span>
                </li>
              ))}
            </ul>
          ) : null}
        </section>

        <section aria-labelledby="picture-heading">
          <h2 id="picture-heading">Picture &amp; sound</h2>
          {(
            [
              ["brightness", picture.brightness, 0.2, 1],
              ["contrast", picture.contrast, 0.2, 1.2],
              ["saturation", picture.saturation, 0, 1],
              ["tuning", picture.tuning, 0, 1],
              ["volume", picture.volume, 0, 1],
              ["previewLevel", picture.previewLevel, 0, 1],
            ] as const
          ).map(([key, val, min, max]) => (
            <label key={key} className="field">
              <span>{key === "previewLevel" ? "preview level" : key}</span>
              <input
                type="range"
                min={min}
                max={max}
                step={0.01}
                value={val}
                aria-valuemin={min}
                aria-valuemax={max}
                aria-valuenow={val}
                onChange={(e) => {
                  unlockMedia();
                  const next = Number(e.target.value);
                  setPicture({ [key]: next });
                  if (key === "volume" && power === "on") {
                    getAudioRouter().routeTo(screens.main.sourceId, next);
                  }
                }}
              />
            </label>
          ))}
          <label className="field">
            <span>Main screen depth</span>
            <select
              value={mainDepthEffect}
              aria-label="Main screen depth effect"
              onChange={(e) =>
                setMainDepthEffect(e.target.value as MainDepthEffect)
              }
            >
              {MAIN_DEPTH_OPTIONS.map((opt) => (
                <option key={opt.id} value={opt.id}>
                  {opt.label}
                </option>
              ))}
            </select>
          </label>
          <p className="sub" style={{ marginTop: "0.25rem" }}>
            {
              MAIN_DEPTH_OPTIONS.find((o) => o.id === mainDepthEffect)?.hint
            }
          </p>
        </section>

        <section aria-labelledby="signal-heading">
          <h2 id="signal-heading">Signal condition (main)</h2>
          <select
            value={screens.main.signal}
            aria-label="Main screen signal condition"
            onChange={(e) =>
              requestSignal("main", e.target.value as SignalCondition)
            }
          >
            {SIGNALS.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </section>

        <section aria-labelledby="camera-heading">
          <h2 id="camera-heading">Camera</h2>
          <div className="row wrap">
            {(["front", "side", "rear", "top", "isometric", "reset"] as const).map(
              (p) => (
                <button key={p} type="button" onClick={() => setCameraPreset(p)}>
                  {p}
                </button>
              )
            )}
          </div>
        </section>

        <section aria-labelledby="env-heading">
          <h2 id="env-heading">Environment</h2>
          <select
            value={environment}
            aria-label="Scene environment"
            onChange={(e) =>
              setEnvironment(e.target.value as "livingRoom" | "studio")
            }
          >
            <option value="livingRoom">1970s living room</option>
            <option value="studio">Neutral studio</option>
          </select>
          <label className="field">
            <span>Quality</span>
            <select
              value={quality}
              aria-label="Graphics quality"
              onChange={(e) => {
                const q = e.target.value as QualityLevel;
                setQuality(q);
                if (q !== "xr") {
                  useUiStore.getState().setQualityCeiling(q);
                }
              }}
            >
              <option value="ultra">Ultra (supersampled)</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
              <option value="xr">XR</option>
            </select>
          </label>
          <p className="sub" style={{ marginTop: "0.25rem" }}>
            Starts from device probe; may auto-drop if FPS dips, then recover.
          </p>
        </section>

        <section aria-labelledby="inspect-heading">
          <h2 id="inspect-heading">Inspection</h2>
          <label className="check">
            <input
              type="checkbox"
              checked={inspectionMode}
              onChange={(e) => setInspectionMode(e.target.checked)}
            />
            Inspection mode
          </label>
          <label className="field">
            <span>Exploded view</span>
            <input
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={explodedProgress}
              onChange={(e) => setExplodedProgress(Number(e.target.value))}
            />
          </label>
          <label className="check">
            <input
              type="checkbox"
              checked={cabinetTransparent}
              onChange={(e) => setCabinetTransparent(e.target.checked)}
            />
            Cabinet transparency
          </label>
          <label className="check">
            <input
              type="checkbox"
              checked={rearRemoved}
              onChange={(e) => setRearRemoved(e.target.checked)}
            />
            Remove rear panel
          </label>
          <label className="check">
            <input
              type="checkbox"
              checked={showLabels}
              onChange={(e) => setShowLabels(e.target.checked)}
            />
            Component labels
          </label>
        </section>

        <section aria-labelledby="a11y-heading">
          <h2 id="a11y-heading">Accessibility</h2>
          <label className="check">
            <input
              type="checkbox"
              checked={reducedMotion}
              onChange={(e) => setReducedMotion(e.target.checked)}
            />
            Reduced motion
          </label>
          <label className="check">
            <input
              type="checkbox"
              checked={reducedFlicker}
              onChange={(e) => setReducedFlicker(e.target.checked)}
            />
            Reduced CRT flicker
          </label>
          <label className="check">
            <input
              type="checkbox"
              checked={highContrast}
              onChange={(e) => setHighContrast(e.target.checked)}
            />
            High-contrast controls
          </label>
        </section>

        <button type="button" onClick={() => reset()}>
          Reset experience
        </button>
      </aside>

      {pendingSignal && (
        <div
          className="warning-modal"
          role="alertdialog"
          aria-labelledby="warn-title"
          aria-describedby="warn-desc"
        >
          <div className="warning-card">
            <h2 id="warn-title">Strong visual effect</h2>
            <p id="warn-desc">
              This signal condition may include intense static or flicker. Continue
              only if you are comfortable with that.
            </p>
            <div className="row">
              <button
                type="button"
                className="primary"
                onClick={() => {
                  setWarningAcknowledged(true);
                  setSignal(pendingSignal.screen, pendingSignal.signal);
                  setPendingSignal(null);
                }}
              >
                Continue
              </button>
              <button type="button" onClick={() => setPendingSignal(null)}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
