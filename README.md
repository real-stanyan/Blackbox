# OBD Health Logger

Personal tool: auto-log BMW engine data from an OBDLink CX (BLE) and, later, run each trip
through an LLM for engine-health analysis. This repo is currently the **V0 validation build** —
it proves the riskiest link in the chain: talking to the OBDLink CX over BLE from our own code.

## V0 scope

- Scan + connect to OBDLink CX, discover its (undocumented) GATT serial channel
- ELM327/STN init sequence (`ATZ`, `ATE0`, `ATL0`, `ATS0`, `ATH0`, `ATSP0`, `0100` bus probe)
- Poll 6 standard Mode 01 PIDs in a loop: RPM, speed, coolant temp, oil temp, STFT, LTFT
- Export session JSON (GATT dump + full samples) via share sheet

Out of scope for V0 (by design): background auto-record, BMW-specific UDS DIDs, LLM analysis,
trip storage. See the project decision log at the bottom.

## Run it

BLE needs a real device + dev client (Expo Go cannot do BLE).

```bash
npm install

# iOS (device plugged in, needs signing)
npx expo run:ios --device

# Android (more forgiving for this use case)
npx expo run:android --device
```

Then in the car, ignition on (engine can be off for the probe, on for real values):

1. **Connect** — scans for names containing `OBDLink`/`OBDII`/`CX`, connects, dumps every
   GATT service/characteristic to the console (`N` notify / `W` write / `w` write-no-response),
   picks the serial pair, runs the ELM init.
2. **Poll** — cycles the 6 PIDs continuously; live tiles update.
3. **Export** — share sheet with the full session JSON (keep this file — the GATT dump in it
   pins down the CX's real UUIDs for all future work).

### Success criteria for V0

- `ATZ` returns an STN/OBDLink version banner
- `0100` returns `41 00 ...` (bus alive)
- RPM tile shows a plausible idle (~600–900) and reacts to throttle
- Export produces JSON with >100 samples and a GATT dump

Any of these failing → the exported JSON + console log is the debugging artifact.

### Known risks (accepted for V0)

- **CX GATT UUIDs are undocumented.** We discover instead of hardcode. If no notify+write pair
  is found, export the GATT dump — that's still a successful reconnaissance run.
- **Writes over BLE MTU fail on the CX** (per OBDLink adapter notes), so all writes are chunked
  to 20 bytes.
- **`015C` (oil temp) may return NO DATA** on some DMEs — the app logs and skips, not fatal.

## web-fallback/

`web-fallback/index.html` — zero-install smoke test using Web Bluetooth (Chrome on
macOS/Android; iOS Safari unsupported). Limitation: Web Bluetooth can only open service UUIDs
it lists in advance, so it tries a candidate list of common OBD serial services. If none match,
that's not a failure verdict — the Expo app does unrestricted discovery.

## Roadmap (agreed 2026-07-05)

- **V0 (this)**: BLE link validation, foreground only, standard PIDs
- **V1**: trip recording to SQLite, trip-end feature extraction (local, deterministic),
  DeepSeek/MiniMax structured report with evidence validation; rule-layer alerts stay local
- **V2 (only if V1 earns it)**: BimmerLink BLE traffic capture to reverse the BMW UDS DIDs
  (VANOS spread, knock reference, oil pressure), iOS background auto-record
- **Not planned**: App Store release, multi-car support (decision: personal tool; market
  already served by Carly/OBDAI)
