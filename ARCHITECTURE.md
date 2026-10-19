# Architecture

## Overview

TriareApp is a React Native (Expo) companion app for the TRIARE rehabilitation tricycle. It scans for and connects to the tricycle over Bluetooth Low Energy, then exposes real-time data (speed, resistance) and controls on a tab-based dashboard.

## Tech Stack

| Concern | Library |
|---|---|
| Framework | Expo ~54, React 19, React Native 0.81 |
| Routing | expo-router ~6 (file-based, Expo Router v3 API) |
| BLE | react-native-ble-plx ^3 |
| Navigation primitives | @react-navigation/native + bottom-tabs ^7 |
| Animations | react-native-reanimated ~4 |
| Icons | @expo/vector-icons (Ionicons) |
| Language | TypeScript (strict) |

## Directory Layout

```
/
├── app/                        # Expo Router screens (file = route)
│   ├── _layout.tsx             # Root Stack; mounts BleSessionProvider
│   ├── index.tsx               # Pairing screen
│   ├── connection_lost.tsx     # Unused placeholder (a lost link now goes back to index.tsx)
│   └── (tabs)/
│       ├── _layout.tsx         # Bottom-tab layout
│       ├── speed.tsx           # Motor control, system state badge, live telemetry + pedal dial (still an engineering test UI)
│       ├── resistance.tsx      # Physiotherapy modes: assist valley by crank angle (zones) and static hold; bench-oriented
│       └── settings.tsx        # Language selector (more settings later)
│
├── src/
│   ├── components/ui/          # Reusable, theme-aware UI primitives
│   ├── components/telemetry/   # Telemetry panel: MetricTile, BarSparkline, TelemetryPanel
│   ├── components/resistance/  # EffortMap (help around the turn) and ZoneEditor
│   ├── features/bluetooth/     # All BLE logic (see BLE Stack section)
│   ├── features/telemetry/     # Rolling history, chart ranges, limits and fault texts (no BLE inside)
│   ├── features/resistance/    # Zone maths shared with the firmware (assist factor, leg conversion, validation)
│   ├── i18n/                   # English + Brazilian Portuguese strings, t() / useI18n()
│   ├── models/                 # DTO types and mappers
│   └── theme/                  # Design tokens (colors, typography, spacing …)
│
└── __tests__/                  # Jest tests (unit/ + integration/, mirrors src/)
```

## Routing & Navigation

Expo Router drives navigation through the file system. Two nested navigators are registered in `_layout.tsx` files:

```
Stack (app/_layout.tsx)
├── index              → Pairing / device selection
├── connection_lost    → Error recovery
└── (tabs) ───────────→ Tab group (app/(tabs)/_layout.tsx)
                           ├── speed
                           ├── resistance
                           └── settings
```

After a successful BLE connection the app programmatically calls `router.replace("/(tabs)/speed")` so the user lands on the dashboard automatically and cannot navigate back to the pairing screen with the back gesture.

## BLE Stack

All Bluetooth logic is isolated inside `src/features/bluetooth/` and organised in layers. Nothing outside this directory imports from `react-native-ble-plx` directly.

```
src/features/bluetooth/
├── constants/
│   ├── bleUUIDs.ts                 # All TRIARE UUIDs as named constants
│   └── triareProtocol.ts           # Opcodes, ACK timeout, payload limits
├── protocol/
│   ├── TriareFrames.ts             # Typed decoded-frame union + telemetry type
│   ├── CommandCodec.ts             # Codec interface (the wire-format seam)
│   └── TriareVescCodec.ts          # WBA65 implementation (LE float32 payloads)
├── handler/
│   ├── IBluetoothConnectionHandler.tsx   # Interface (testability contract)
│   └── BluetoothConnectionHandler.tsx    # Singleton; wraps BleManager
├── services/
│   ├── BasicCommunicationService.tsx     # Raw byte Read/Write/Notify (diagnostics)
│   ├── TriareCommandService.ts           # Typed commands, response matching, timeouts
│   └── BleSession.ts                     # Aggregates services for one connection
├── mock/
│   └── MockBleCharacteristicManager.ts   # In-memory firmware simulator
├── context/
│   └── BleSessionContext.tsx             # React Context + Provider + hooks
├── hooks/
│   ├── useBluetoothConnection.tsx        # Scan / connect lifecycle
│   ├── useMotorControl.ts                # Typed motor commands, system state (armed / emergency…), feedback toasts
│   ├── useTelemetryStream.ts             # 20 Hz telemetry pushed by the board (+ fast BLE link while on)
│   ├── useTelemetryPolling.ts            # Fallback: ask for telemetry every 150 ms (firmware without streaming)
│   └── useBasicCommunication.ts          # Raw read, write, subscribe (diagnostics)
├── utils/
│   ├── base64.ts                         # base64 ↔ Uint8Array helpers
│   ├── commandFeedback.ts                # Maps ACK / NACK / timeout to user-facing messages and system state
│   └── motorUnits.ts                     # ERPM ↔ motor RPM ↔ crank RPM conversions
├── IBleCharacteristicManager.ts          # GATT-layer contract (real + mock impls)
├── BleCharacteristicManager.tsx          # Low-level GATT primitives
└── requestBluetoothPermission.tsx        # Android permission helper
```

### Layer Responsibilities

```
UI (screens / hooks)
        │
        ▼
useBluetoothConnection     — scan, connect, connection status state machine
useMotorControl            — typed motor commands + telemetry state
useBasicCommunication      — raw bytes: initial read, notifications, sendBytes()
        │
        ▼
BleSession                 — created once per connection; composition root that
        │                    wires the concrete manager + codec into the services
        ├── TriareCommandService       — typed protocol commands; serializes
        │        │                       write → notification round-trips with a
        │        │                       3 s ACK timeout (AckTimeoutError /
        │        │                       UnexpectedFrameError as first-class errors)
        │        └── CommandCodec (TriareVescCodec) — encode/decode wire frames
        ├── BasicCommunicationService  — raw byte access for diagnostics
        │
        ▼
IBleCharacteristicManager              — GATT-layer contract (base64 values)
   ├── BleCharacteristicManager       — real device via react-native-ble-plx
   └── MockBleCharacteristicManager   — in-memory firmware simulator (tests /
                                         offline development)
        │
        ▼
BluetoothConnectionHandler             — scan, connect, discoverAllServicesAndCharacteristics
        │
        ▼
react-native-ble-plx (BleManager)      — native BLE adapter
```

### TRIARE BLE Protocol

The full protocol — GATT profile, opcode table, framing, telemetry layout, and
known gaps — is documented in [BLE_PROTOCOL.md](./BLE_PROTOCOL.md) and confirmed
against the reference host script `triare_host_ble.py` (WBA65 firmware).

| Element | UUID | Role |
|---|---|---|
| Service | `12345678-1234-5678-1234-56789abcdef0` | Primary TRIARE service |
| TX char | `12345678-1234-5678-1234-56789abcdef1` | Command frames (write without response) |
| RX char | `12345678-1234-5678-1234-56789abcdef2` | Response frames (notify) |
| DevEUI char | `12345678-1234-5678-1234-56789abcdef3` | 8-byte DevEUI (read) |
| CCCD | `00002902-0000-1000-8000-00805f9b34fb` | Enables/disables notifications |

All UUIDs are declared once in `bleUUIDs.ts` and imported everywhere; no UUID
string is duplicated. Opcodes and protocol constants live in
`triareProtocol.ts`; the wire format itself is confined to `protocol/` behind
the `CommandCodec` interface so a firmware protocol change stays a one-module swap.

### Connection Flow

```
index.tsx
  └── useBluetoothConnection(BluetoothConnectionHandler.getInstance())
        1. startScan()   → adapter scans, filters by name/service UUID, 10 s auto-stop
        2. connect(id)   → connectToDevice() + discoverAllServicesAndCharacteristics()
                           → new BleSession(connectedDevice)
                           → setSession(session)   [BleSessionContext]
                           → router.replace("/(tabs)/speed")
```

### Push frames: state, NACK and telemetry stream

The protocol has no correlation ids, so the board's *unsolicited* frames use their
own opcodes and are never mistaken for the reply to a command:
`0x1E` STATUS_EVENT (emergency stop, arming, faults), `0x1F` NACK (a command was
refused and why) and `0x1D` STREAM_FRAME (telemetry at 20 Hz after `0x1C`).
`TriareCommandService` routes them to listeners (`onStatus`, `startStream`) and
the system state shown in the Speed tab comes from these events, not from polling.
Details in [BLE_PROTOCOL.md](./BLE_PROTOCOL.md).

### Losing the connection

`BleSessionContext` watches the link. When the board disconnects unexpectedly it
clears the session, shows an alert and calls `router.replace("/")`, which returns
to the scan screen.

### Session Sharing Across Screens

`BleSession` is stored in a React Context (`BleSessionContext`) mounted at the root of the Stack navigator. This allows any screen to call `useBleSession()` to obtain the active session without prop-drilling across navigation boundaries.

```
BleSessionProvider  (app/_layout.tsx)
    └── useBleSession()      → BleSession | null   (consumed in speed.tsx, etc.)
    └── useBleSessionContext() → { session, setSession }  (written in useBluetoothConnection)
```

## State Management

The app has no global state library. State is managed at two levels:

| Scope | Mechanism |
|---|---|
| BLE session (cross-screen) | React Context (`BleSessionContext`) |
| Connection lifecycle | `useState` inside `useBluetoothConnection` |
| Motor command status / system state / last telemetry sample | `useState` inside `useMotorControl` |
| Live telemetry (stream or polling) | `useState` inside `useTelemetryStream` / `useTelemetryPolling` |
| Characteristic data (diagnostics) | `useState` inside `useBasicCommunication` |
| UI-local state | `useState` in individual components |

`useMotorControl` holds only the *latest* telemetry sample. The recent past (60 s)
lives in a `TelemetryHistory` ring buffer (`src/features/telemetry/`), kept in a
ref and not in React state: the stream delivers 20 samples a second and
re-rendering for each one just to keep a history would waste battery. The mini
charts read it through `useTelemetryHistory`, which bumps a `version` counter
4 times a second, and the numbers are throttled by `useThrottledValue`. Sharing
the history between screens would be the point to move it into a small store.

### Telemetry panel

`TelemetryPanel` (engineering view) draws one `MetricTile` per measurement:
pedal speed, motor current, supply voltage, controller temperature and fault.
Tiles that have a known limit show a green / amber / red dot
(`telemetryInfo.ts` holds the limits and the plain-language fault names; it is
the only place to edit when the VESC configuration changes). Tapping a tile
explains what it measures. The mini charts are `BarSparkline`s made of plain
`View`s on purpose, so no native drawing library (and no new build) is needed.

## Physiotherapy modes (Resistance tab)

Design and safety rationale: `PROJETO_MODO_RESISTENCIA.md`. The wire format
(opcodes `0x20`–`0x29`, the resistance frame, NACK reason 5) is in
[BLE_PROTOCOL.md](BLE_PROTOCOL.md).

- **Protocol layer**: `CommandCodec` / `TriareVescCodec` encode and validate
  (a bad zone or current throws `RangeError` before anything is written);
  `TriareCommandService` has `setResistMode`, `applyResistZones`
  (clear → stage → commit, the board switches only at the commit),
  `getResistZones` (one request, several notifications, collected until the
  count the board announced), `engageHold`, `releaseHold`, `tuneResist`, and
  `onResistance` for the frames the board pushes with the telemetry stream.
- **Hook**: `useMotorControl` exposes the same commands with the usual
  busy/feedback/state handling, plus `resistance` (last frame) and
  `boardStatus` (last status byte). Arming is checked locally first.
- **Zones are in the angle of the leg being worked.** The board only knows the
  left pedal's crank angle; the right pedal is half a turn away, so
  `features/resistance/zones.ts` converts when sending and when reading back.
  `assistFactorAt` repeats the firmware's smooth-edge maths so the effort map
  shows what the board will do; change both together.
- **Screen**: the Resistance tab turns the telemetry stream on only while it is
  focused (for the pedal angle and the resistance frames). *Release now* is
  always on screen. Mode B (brake) is shown but disabled: the board refuses it
  (`NO_REGEN_PATH`) until there is somewhere to send the energy.
- **Mock**: `MockBleCharacteristicManager` simulates the board's answers for the
  new commands (NACKs included), so the whole flow is tested offline.

## Languages (i18n)

The app speaks English and Brazilian Portuguese. `src/i18n/` holds:

- `en.ts`: every string, keyed (`"feedback.disarmed.title"`). It is the source
  of truth for the keys. `{name}` marks a value filled in at run time; keys
  ending in `_one` / `_other` are singular / plural forms (`tp()`).
- `pt-BR.ts`: typed as `Record<TranslationKey, string>`, so a missing or extra
  key is a compile error, and a unit test checks that both languages use the
  same `{placeholders}`.
- `index.ts`: `t(key, params)` for code outside React (feedback messages,
  fault texts, toasts built in hooks), `useI18n()` for components (re-renders
  when the language changes) and `setLanguage()`.

The starting language comes from the phone (any Portuguese locale gives pt-BR,
everything else English). It can be changed on the scan screen (EN / PT) and in
the Settings tab. Tests run in English because the module starts in English and
only `app/_layout.tsx` calls `initLanguage()`.

The choice is **not** remembered after the app is closed: the project has no
storage library yet, and adding one (`@react-native-async-storage/async-storage`)
needs a new native build. When that is done, call
`configureLanguageStorage({ load, save })` once at startup; the saved language
then overrides the phone's.

Rules when adding text: never write a user-visible string in a component, add
a key to `en.ts` and `pt-BR.ts`; messages created in hooks must call `t()` when
they are *produced* (inside the callback), not at module load, so they follow
the language in use; use the `tp()` helper for anything with a count.

## UI & Theme System

All screens and components consume a shared design token system exported from `src/theme/`:

| Module | Contents |
|---|---|
| `colors.ts` | Palette — primary `#14B8A6`, surface, danger, warning, success, text variants |
| `typography.ts` | 6 text styles — from `speedReadout` (72 px) to `eyebrow` (11 px) |
| `spacing.ts` | Spacing scale (`xs` → `xl`) |
| `radius.ts` | Border-radius values |
| `shadows.ts` | Shadow helpers including `coloredShadow(color)` |
| `responsive.ts` | Screen-dimension utilities |

Components live in `src/components/ui/` and are theme-aware but contain no business logic. Notable ones:

- **AppScreen** — safe-area-aware root container with tab-bar bottom padding
- **AppButton** — pressable with icon support, scale animation, optional colored shadow
- **AppCard / AppCardGradient** — surface containers
- **AppDeviceSelector** — renders a `TriareDeviceDTO` as a tappable device row
- **BatteryStatusBar** — color-coded battery indicator with null state for unimplemented firmware fields

## Data Models

`TriareDeviceDTO` (`src/models/triareDeviceDTO.tsx`) is the only model crossing the BLE/UI boundary. It is a plain TypeScript type — not a class — produced by `mapBleDeviceToTriareDeviceDTO()`.

```ts
type TriareDeviceDTO = {
  id: string;
  name: string | null;
  battery: number | null;  // null until firmware exposes Battery Service (0x180F)
  rssi: number | null;
}
```

Raw `Device` objects from `react-native-ble-plx` never leave `src/features/bluetooth/`.

## Testing

Tests live in `__tests__/` mirroring the `src/` structure, split into two Jest
projects: `npm run test:unit` and `npm run test:integration`.

- The `IBluetoothConnectionHandler` interface allows `useBluetoothConnection` and `BluetoothConnectionHandler` to be tested with a mock adapter without requiring real hardware or a running BLE stack.
- The `IBleCharacteristicManager` interface does the same for the protocol stack: `MockBleCharacteristicManager` simulates the WBA65 firmware (ACK/data framing per opcode, simulated arm/disarm state, configurable telemetry, and a silence switch for timeout testing), so the integration tests drive the full codec → command-service flow end-to-end offline.
