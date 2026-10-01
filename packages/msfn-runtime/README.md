# MSFN runtime adapter

This package imports the actual Spectra application source. Its API is a React component receiving active, onExit and containerSize plus a version-1 manifest. The MSFN host supplies React 19, R3F 9 and compatible renderer peers; the independent Next app continues to use its own React 18 dependency tree.

Build from the MSFN workspace with npm run runtimes:prepare. For live scene changes run npm run runtimes:watch alongside npm start. The entry point exports a full isolated renderer. Styles are scoped to .spectra-runtime, and the runtime never depends on MSFN archive state.

The adapter caps DPR at 1.75, owns its Canvas, and releases media, audio listeners, object URLs, GPU assets and transient stores on unmount. Media records in IndexedDB are retained. Host Escape is reserved for eject.
