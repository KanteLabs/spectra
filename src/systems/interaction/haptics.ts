type HapticActuator = {
  pulse: (intensity: number, durationMs: number) => Promise<boolean>;
};

function getActuator(
  pad: Gamepad | null | undefined
): HapticActuator | undefined {
  if (!pad) return undefined;
  const extended = pad as Gamepad & {
    hapticActuators?: HapticActuator[];
  };
  return extended.hapticActuators?.[0];
}

export function pulseHaptic(
  source: { gamepad?: Gamepad | null } | null | undefined,
  intensity = 0.4,
  durationMs = 40
): void {
  const actuator = getActuator(source?.gamepad);
  if (actuator) void actuator.pulse(intensity, durationMs);
}

export function tryXrHaptic(
  inputSource: XRInputSource | undefined,
  intensity = 0.35,
  durationMs = 35
): void {
  const actuator = getActuator(inputSource?.gamepad);
  if (actuator) void actuator.pulse(intensity, durationMs);
}
