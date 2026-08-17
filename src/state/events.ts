export type SpectraEvent =
  | { type: "power"; state: "on" | "off" }
  | { type: "promote"; previewId: "preview1" | "preview2" | "preview3" }
  | { type: "announce"; message: string }
  | { type: "controlSelect"; controlId: string | null }
  | { type: "transitionStart"; durationMs: number }
  | { type: "transitionEnd" }
  | { type: "audioUnlock" }
  | { type: "warning"; kind: "flicker" | "static"; acknowledged: boolean };

type Listener = (event: SpectraEvent) => void;

const listeners = new Set<Listener>();

export function emit(event: SpectraEvent): void {
  listeners.forEach((l) => l(event));
}

export function subscribe(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
