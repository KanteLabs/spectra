import type { SignalCondition } from "@/types";

export interface SignalUniformBundle {
  signalQuality: number;
  noiseStrength: number;
  rollOffset: number;
  syncDrift: number;
  scanlineStrength: number;
  maskStrength: number;
  rgbSeparation: number;
  interlace: number;
}

export const SIGNAL_PRESETS: Record<SignalCondition, SignalUniformBundle> = {
  clean: {
    signalQuality: 1,
    noiseStrength: 0.02,
    rollOffset: 0,
    syncDrift: 0,
    scanlineStrength: 0.35,
    maskStrength: 0.25,
    rgbSeparation: 0.0015,
    interlace: 0.4,
  },
  weak: {
    signalQuality: 0.55,
    noiseStrength: 0.18,
    rollOffset: 0.01,
    syncDrift: 0.004,
    scanlineStrength: 0.45,
    maskStrength: 0.3,
    rgbSeparation: 0.004,
    interlace: 0.55,
  },
  tuning: {
    signalQuality: 0.35,
    noiseStrength: 0.35,
    rollOffset: 0.08,
    syncDrift: 0.02,
    scanlineStrength: 0.5,
    maskStrength: 0.35,
    rgbSeparation: 0.008,
    interlace: 0.7,
  },
  noSignal: {
    signalQuality: 0,
    noiseStrength: 0.9,
    rollOffset: 0,
    syncDrift: 0,
    scanlineStrength: 0.6,
    maskStrength: 0.2,
    rgbSeparation: 0.002,
    interlace: 0.3,
  },
  verticalHold: {
    signalQuality: 0.7,
    noiseStrength: 0.08,
    rollOffset: 0.35,
    syncDrift: 0.002,
    scanlineStrength: 0.4,
    maskStrength: 0.25,
    rgbSeparation: 0.002,
    interlace: 0.5,
  },
  horizontalHold: {
    signalQuality: 0.65,
    noiseStrength: 0.1,
    rollOffset: 0.02,
    syncDrift: 0.06,
    scanlineStrength: 0.45,
    maskStrength: 0.28,
    rgbSeparation: 0.006,
    interlace: 0.6,
  },
  static: {
    signalQuality: 0.05,
    noiseStrength: 1,
    rollOffset: 0.02,
    syncDrift: 0.01,
    scanlineStrength: 0.7,
    maskStrength: 0.15,
    rgbSeparation: 0.003,
    interlace: 0.8,
  },
  testPattern: {
    signalQuality: 1,
    noiseStrength: 0.01,
    rollOffset: 0,
    syncDrift: 0,
    scanlineStrength: 0.3,
    maskStrength: 0.2,
    rgbSeparation: 0.001,
    interlace: 0.35,
  },
};

/** Fill an existing bundle — avoids an object allocation per screen per frame. */
export function writeSignalUniforms(
  signal: SignalCondition,
  reducedFlicker: boolean,
  out: SignalUniformBundle
): SignalUniformBundle {
  const preset = SIGNAL_PRESETS[signal];
  out.signalQuality = preset.signalQuality;
  out.scanlineStrength = preset.scanlineStrength;
  out.maskStrength = preset.maskStrength;
  out.rgbSeparation = preset.rgbSeparation;
  out.noiseStrength = preset.noiseStrength;
  out.rollOffset = preset.rollOffset;
  out.syncDrift = preset.syncDrift;
  out.interlace = preset.interlace;
  if (reducedFlicker) {
    out.interlace *= 0.2;
    out.noiseStrength *= 0.4;
    out.syncDrift *= 0.3;
    out.rollOffset *= 0.3;
  }
  return out;
}

export function getSignalUniforms(
  signal: SignalCondition,
  reducedFlicker: boolean
): SignalUniformBundle {
  return writeSignalUniforms(signal, reducedFlicker, {
    ...SIGNAL_PRESETS[signal],
  });
}
