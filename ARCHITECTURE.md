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
│   ├── connection_lost.tsx     # Shown on unexpected disconnect
│   └── (tabs)/
│       ├── _layout.tsx         # Bottom-tab layout
│       ├── speed.tsx           # Speed dashboard (primary screen)
│       ├── resistance.tsx      # Resistance controls
│       └── settings.tsx        # App settings
│
├── src/
│   ├── components/ui/          # Reusable, theme-aware UI primitives
│   ├── features/bluetooth/     # All BLE logic (see BLE Stack section)
│   ├── models/                 # DTO types and mappers
│   └── theme/                  # Design tokens (colors, typography, spacing …)
│
└── __tests__/                  # Jest unit tests (mirrors src/ structure)
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
│   └── bleUUIDs.ts                 # All TRIARE UUIDs as named constants
├── handler/
│   ├── IBluetoothConnectionHandler.tsx   # Interface (testability contract)
│   └── BluetoothConnectionHandler.tsx    # Singleton; wraps BleManager
├── services/
│   ├── BasicCommunicationService.tsx     # Domain service for Read/Write/Notify
│   └── BleSession.ts                     # Aggregates services for one connection
├── context/
│   └── BleSessionContext.tsx             # React Context + Provider + hooks
├── hooks/
│   ├── useBluetoothConnection.tsx        # Scan / connect lifecycle
│   └── useBasicCommunication.ts          # Read, write, subscribe hook
├── BleCharacteristicManager.tsx          # Low-level GATT primitives
└── requestBluetoothPermission.tsx        # Android permission helper
```

### Layer Responsibilities

```
UI (screens / hooks)
        │
        ▼
useBluetoothConnection     — scan, connect, connection status state machine
useBasicCommunication      — initial read, live notifications, sendBytes()
        │
        ▼
BleSession                 — created once per connection; owns both services below
        │
        ├── BleCharacteristicManager   — thin GATT wrapper (read / write / subscribe)
        │                                values are raw base64 strings at this layer
        └── BasicCommunicationService  — domain layer; converts base64 ↔ Uint8Array,
                                         addresses characteristics by name (not UUID)
        │
        ▼
BluetoothConnectionHandler             — scan, connect, discoverAllServicesAndCharacteristics
        │
        ▼
react-native-ble-plx (BleManager)      — native BLE adapter
```

### TRIARE BLE Protocol

| Element | UUID | Role |
|---|---|---|
| Service | `00000000-0000-0000-0000-000000000011` | Primary TRIARE service |
| Read char | `00000000-0000-0000-0000-000000004444` | Returns 20 bytes from device |
| Write char | `00000000-0000-0000-0000-000000003333` | Write without response |
| Notify char | `00000000-0000-0000-0000-000000002222` | Device-initiated notifications |
| CCCD | `00002902-0000-1000-8000-00805f9b34fb` | Enables/disables notifications |

All UUIDs are declared once in `bleUUIDs.ts` and imported everywhere; no UUID string is duplicated.

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
| Characteristic data | `useState` inside `useBasicCommunication` |
| UI-local state | `useState` in individual components |

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

Tests live in `__tests__/` mirroring the `src/` structure. The `IBluetoothConnectionHandler` interface allows `useBluetoothConnection` and `BluetoothConnectionHandler` to be tested with a mock adapter without requiring real hardware or a running BLE stack.
