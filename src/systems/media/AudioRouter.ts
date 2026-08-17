import { getSourceManager } from "./SourceManager";

import { shouldUseProgramAudio } from "./playbackPolicy";

const HUM_IDLE = 0.025;
const HUM_UNDER_PROGRAM = 0.004;

/**
 * Routes audio to a single active screen source.
 * Ambient electrical hum starts only after unlock.
 * User videos with audio duck the hum; silent sources keep full TV noise.
 *
 * Browsers suspend AudioContext / pause media on tab hide, calls, etc.
 * Lifecycle listeners resume the context and re-apply routing.
 */
export class AudioRouter {
  private hum: OscillatorNode | null = null;
  private humGain: GainNode | null = null;
  private hum2: OscillatorNode | null = null;
  private hum2Gain: GainNode | null = null;
  private ctx: AudioContext | null = null;
  private unlocked = false;
  private activeSourceId: string | null = null;
  private masterVolume = 0.6;
  private lifecycleAttached = false;
  private recovering = false;

  async unlock(): Promise<void> {
    if (typeof window === "undefined") return;
    if (!this.ctx) {
      this.ctx = new AudioContext();
    }
    await this.ensureRunning();
    this.unlocked = true;
    this.attachLifecycle();
  }

  get isUnlocked(): boolean {
    return this.unlocked && !!this.ctx && this.ctx.state === "running";
  }

  /** Resume AudioContext after browser interruption / tab return. */
  async ensureRunning(): Promise<boolean> {
    if (!this.ctx) return false;
    const state = this.ctx.state as string;
    if (state === "suspended" || state === "interrupted") {
      try {
        await this.ctx.resume();
      } catch {
        /* gesture may still be required */
      }
    }
    return this.ctx.state === "running";
  }

  private attachLifecycle(): void {
    if (this.lifecycleAttached || typeof window === "undefined") return;
    this.lifecycleAttached = true;

    const onVisible = () => {
      if (document.visibilityState === "visible") {
        void this.recoverAfterInterruption();
      }
    };
    const onFocus = () => {
      void this.recoverAfterInterruption();
    };

    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onFocus);
    window.addEventListener("pageshow", onFocus);

    this.ctx?.addEventListener("statechange", () => {
      const state = this.ctx?.state as string | undefined;
      if (state === "running") {
        void this.recoverAfterInterruption();
      } else if (state === "suspended" || state === "interrupted") {
        void this.ensureRunning();
      }
    });
  }

  /**
   * After tab hide / OS audio interrupt: resume context, restart keep-playing
   * videos, and re-apply program mute/volume + hum.
   */
  async recoverAfterInterruption(): Promise<void> {
    if (!this.unlocked || this.recovering) return;
    this.recovering = true;
    try {
      const running = await this.ensureRunning();
      getSourceManager().resumeKeepPlaying();
      if (!running) return;

      // Oscillators can die across hard interruptions — rebuild via routeTo.
      if (this.hum && this.activeSourceId !== null) {
        this.stopHum();
      }

      if (this.activeSourceId !== null) {
        this.routeTo(this.activeSourceId, this.masterVolume);
      }
    } finally {
      this.recovering = false;
    }
  }

  /** Brief power-on thump / CRT warm-up tone. */
  playPowerOn(): void {
    if (!this.ctx || this.ctx.state !== "running") return;
    const t0 = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(90, t0);
    osc.frequency.exponentialRampToValueAtTime(40, t0 + 0.35);
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(0.12, t0 + 0.04);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.4);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(t0);
    osc.stop(t0 + 0.45);
  }

  playPowerOff(): void {
    if (!this.ctx || this.ctx.state !== "running") return;
    const t0 = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(55, t0);
    osc.frequency.exponentialRampToValueAtTime(20, t0 + 0.25);
    gain.gain.setValueAtTime(0.08, t0);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.3);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(t0);
    osc.stop(t0 + 0.35);
  }

  startHum(volume = HUM_IDLE): void {
    if (!this.ctx || this.ctx.state !== "running") return;
    if (this.hum) {
      this.setHumVolume(volume);
      return;
    }
    this.hum = this.ctx.createOscillator();
    this.hum.type = "sine";
    this.hum.frequency.value = 60;
    this.humGain = this.ctx.createGain();
    this.humGain.gain.value = volume;

    this.hum2 = this.ctx.createOscillator();
    this.hum2.type = "sine";
    this.hum2.frequency.value = 120;
    this.hum2Gain = this.ctx.createGain();
    this.hum2Gain.gain.value = volume * 0.4;

    this.hum.connect(this.humGain);
    this.hum2.connect(this.hum2Gain);
    this.humGain.connect(this.ctx.destination);
    this.hum2Gain.connect(this.ctx.destination);
    this.hum.start();
    this.hum2.start();
  }

  stopHum(): void {
    try {
      this.hum?.stop();
      this.hum2?.stop();
    } catch {
      /* already stopped */
    }
    this.hum = null;
    this.hum2 = null;
    this.humGain = null;
    this.hum2Gain = null;
  }

  setHumVolume(volume: number): void {
    if (this.humGain) this.humGain.gain.value = volume;
    if (this.hum2Gain) this.hum2Gain.gain.value = volume * 0.4;
  }

  /**
   * Mute every video, then either:
   * - unmute the active source if it has audio (duck hum), or
   * - keep videos muted and play default TV hum.
   */
  routeTo(sourceId: string | null, volume: number): void {
    const mgr = getSourceManager();
    this.activeSourceId = sourceId;
    this.masterVolume = Math.min(1, Math.max(0, volume));

    mgr.muteAllVideos();
    // CRITICAL: do not pause non-program videos here — previews must keep playing.

    if (!this.unlocked || sourceId === null) {
      this.setHumVolume(0);
      return;
    }

    // Context may be suspended mid-session — kick resume without blocking route.
    if (this.ctx && this.ctx.state !== "running") {
      void this.ensureRunning().then((ok) => {
        if (ok && this.activeSourceId === sourceId) {
          this.routeTo(sourceId, this.masterVolume);
        }
      });
      return;
    }

    const src = mgr.get(sourceId);
    const hasProgramAudio = shouldUseProgramAudio({
      hasVideoElement: !!src?.video,
      hasAudio: !!src?.hasAudio,
    });

    if (hasProgramAudio && src?.video) {
      mgr.setMuted(sourceId, false);
      mgr.setVolume(sourceId, this.masterVolume);
      // Always re-call play after unmute so A/V attach on source switches
      // (not only when paused — browsers often keep playing muted without audio).
      void src.video.play().catch(() => undefined);
      this.startHum(HUM_UNDER_PROGRAM);
      this.setHumVolume(HUM_UNDER_PROGRAM * this.masterVolume);
    } else {
      if (src?.video) {
        mgr.setMuted(sourceId, true);
        void src.video.play().catch(() => undefined);
      }
      this.startHum(HUM_IDLE);
      this.setHumVolume(HUM_IDLE * Math.max(0.35, this.masterVolume));
    }
  }

  /**
   * Ensure the source is loaded, then route program audio to it.
   * Use when switching main/user content so we don't route before the video exists.
   */
  async syncToSource(sourceId: string | null, volume: number): Promise<void> {
    this.activeSourceId = sourceId;
    this.masterVolume = Math.min(1, Math.max(0, volume));
    await this.unlock();
    if (sourceId) {
      await getSourceManager().ensure(sourceId);
    }
    // A newer switch may have changed the target while we awaited
    if (this.activeSourceId !== sourceId) return;
    this.routeTo(sourceId, this.masterVolume);
  }

  /** Re-apply routing after async audio detection updates hasAudio. */
  refreshRoute(): void {
    if (this.activeSourceId === null) return;
    this.routeTo(this.activeSourceId, this.masterVolume);
  }

  getActiveSourceId(): string | null {
    return this.activeSourceId;
  }

  dispose(): void {
    this.stopHum();
    void this.ctx?.close();
    this.ctx = null;
    this.unlocked = false;
    this.lifecycleAttached = false;
  }
}

let audioSingleton: AudioRouter | null = null;

export function getAudioRouter(): AudioRouter {
  if (!audioSingleton) audioSingleton = new AudioRouter();
  return audioSingleton;
}
