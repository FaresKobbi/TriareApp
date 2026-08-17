# TRIARE BLE Protocol (WBA65 firmware)

> **Status:** Current, confirmed against the reference host script `triare_host_ble.py`
> (kept in this repo) and the operational GUI `triare_ble_interface.py`, both of
> which run this command set against real firmware. This supersedes the earlier
> STM32WB0 echo-test notes (`TRIARE_BLE_STM32WB0_Communication_Notes.docx`): the
> old `00000000-…` UUIDs and single-byte echo scheme are obsolete. The general
> BLE/GATT background from those notes (roles, MTU, write-without-response
> semantics, Android permission flow) remains valid and is summarized at the end.
>
> **Update [DATA]:** added crank calibration / gear ratio commands
> (`0x17`, `0x18`) and the resulting telemetry frame change (18 → 22 bytes).
> Firmware source of truth: `app_triare.c/h` + `p2p_server_app.c`.

## Advertising

Devices advertise as **`TRI-XXXXXX`** (e.g. `TRI-2C108F`). The app's scan filter
matches this prefix, the older test-board names (`STM32*`, `*TRIARE*`), or the
service UUID below.

## GATT profile

Must match firmware `p2p_server.h`.

| Element | UUID | Properties | Role |
|---|---|---|---|
| Service | `12345678-1234-5678-1234-56789abcdef0` | — | Primary TRIARE service |
| TX char | `12345678-1234-5678-1234-56789abcdef1` | Write without response | Command frames, host → device |
| RX char | `12345678-1234-5678-1234-56789abcdef2` | Notify | Response frames, device → host |
| DevEUI char | `12345678-1234-5678-1234-56789abcdef3` | Read | 8-byte DevEUI |
| CCCD | `00002902-0000-1000-8000-00805f9b34fb` | — | Enables notifications (handled by `react-native-ble-plx`) |

Declared once in `src/features/bluetooth/constants/bleUUIDs.ts`.

## Command set

Opcodes live in `src/features/bluetooth/constants/triareProtocol.ts`. All float
payloads are IEEE-754 **float32, little-endian** (`struct.pack('<f')`).

| Opcode | Command | Request payload | Response frame |
|---|---|---|---|
| `0x01` | GET_DEVEUI | none | `[0x01, 8× DevEUI byte]` |
| `0x02` | ECHO | arbitrary bytes | `[0x02, same bytes]` (diagnostic only) |
| `0x10` | SYSTEM_ENABLE | none | `[0x14, 0x10]` — arms system, motor freewheels |
| `0x11` | SYSTEM_DISABLE | none | `[0x14, 0x11]` — disarms system |
| `0x12` | SET_RPM | 1× f32 target ERPM | `[0x14, 0x12]` — requires enabled system |
| `0x13` | REQ_TELEMETRY | none | 22-byte telemetry frame (below) |
| `0x14` | ACK | — | Generic ack opcode; only appears in responses |
| `0x15` | SET_DUTY | 1× f32 in [−1.0, 1.0] | `[0x14, 0x15]` — negative reverses the motor |
| `0x16` | STOP | none | `[0x14, 0x16]` — freewheels motor, system **stays armed** |
| `0x17` | CALIBRATE_CRANK | none | `[0x14, 0x17]` — zeroes crank angle at current position |
| `0x18` | SET_GEAR_RATIO | 1× f32 (crank teeth ÷ motor teeth) | `[0x14, 0x18]` — rejected (no response) if ≤ 0 or non-finite |

### Framing convention

- Every command written to TX elicits **exactly one notification** on RX.
- State-changing commands respond `[CMD_ACK, <echoed opcode>]`.
- Data commands (GET_DEVEUI, ECHO, REQ_TELEMETRY) respond `[<echoed opcode>, …payload]`.
- There are no correlation IDs, so commands must be serialized (one in flight).
  `TriareCommandService` enforces this.
- **Timeout:** if no notification arrives within **3 s** (`ACK_TIMEOUT` in the
  reference script, `ACK_TIMEOUT_MS` in the app), the command failed with an
  unknown outcome — surfaced as `AckTimeoutError`.
- **`SET_RPM` / `SET_DUTY` while disarmed:** firmware sends **no response at
  all** (not even a NACK) — this is indistinguishable from a lost packet and
  will surface as `AckTimeoutError`. The app must not send motion commands
  before `SYSTEM_ENABLE` has been ACKed.
- **`SET_GEAR_RATIO` with an invalid value** (`≤ 0`, `NaN`, `Infinity`)
  behaves the same way — silently no response, same `AckTimeoutError` path.

### Telemetry frame layout (22 bytes)

| Offset | Type | Field |
|---|---|---|
| 0 | u8 | opcode `0x13` |
| 1 | f32 LE | motor ERPM |
| 5 | f32 LE | motor current (A) |
| 9 | f32 LE | battery voltage (V) |
| 13 | f32 LE | FET temperature (°C) |
| 17 | f32 LE | **crank angle (degrees, 0–360)** — new field |
| 21 | u8 | VESC fault code (0 = none) — **offset moved from 17 to 21** |

> ⚠️ If the current parser hardcodes a 17- or 18-byte frame length, or reads
> the fault byte at a fixed offset of 16/17, it will silently read garbage
> once the firmware sends the new 22-byte frame. Update the frame length
> check and the fault byte offset together with adding the new field.

### Crank angle semantics

- Reported angle is **already in degrees** (0–360), no client-side conversion
  needed.
- Angle is computed by the firmware from the VESC tachometer, scaled by the
  gear ratio set via `SET_GEAR_RATIO`. Default gear ratio at boot is `1.0`
  (direct motor drive, no reduction) until the app or another client sets it.
- Left pedal = reported angle. Right pedal = reported angle `+ 180°` (always
  opposite), same convention as `triare_ble_interface.py`'s dial.
- Calling `SET_GEAR_RATIO` re-zeroes the crank angle as a side effect (avoids
  a visual jump) — if the UI shows a "calibrated" indicator, treat a
  successful `SET_GEAR_RATIO` ACK as also clearing it, same as
  `CALIBRATE_CRANK`.

## Pairing / identification (open item)

The reference script derives a 6-digit PIN from the DevEUI for OS-level pairing:
`PIN = crc32(devEui) % 1_000_000`. That flow is Windows-specific
(`--pair` + OS popup). The Android pairing/bonding flow via
`react-native-ble-plx` differs and **has not been investigated yet** — do not
assume the same UX. The DevEUI itself is readable both via the DevEUI
characteristic and via `CMD_GET_DEVEUI`.

## Known gaps and assumptions (firmware-team follow-up)

1. **No resistance-zone command.** The requirements include pedal resistance
   zone configuration, but the protocol defines no such command. Confirmed gap
   — do not invent an opcode. (See TODO in `triareProtocol.ts`.)
2. **Stop semantics are partially unmapped.** `CMD_STOP` freewheels (coast)
   while armed — the best available fit for a "smooth stop". There is **no
   active-brake command**, so "abrupt stop" has no clean mapping; candidates
   are `SET_DUTY(0)` / `SET_RPM(0)` (actively regulate toward zero) or
   `SYSTEM_DISABLE`. **Assumption to confirm with the firmware team.**
3. **Failure responses are undocumented** beyond "no response at all" (see
   Framing convention above) — confirmed for `SET_RPM`/`SET_DUTY` while
   disarmed and for `SET_GEAR_RATIO` with an invalid value. Treat any
   silence past the ACK timeout as a rejection, not just a lost packet.
4. **Fault byte values are undocumented** beyond 0 = no fault (VESC fault codes).
5. **No battery percentage** — only pack voltage; and **no ERPM → wheel-speed
   conversion parameters** (needs motor pole count / gearing / wheel diameter
   to display km/h).
6. **MTU:** all protocol frames fit the default 23-byte MTU (20-byte payload),
   **except the new 22-byte telemetry frame**, which needs 23 bytes of ATT
   payload (1 opcode + 22 data bytes) — this **exceeds the default 20-byte
   write payload** of a 23-byte MTU connection. Negotiate a larger MTU
   (e.g. request 27+ bytes) before relying on `REQ_TELEMETRY`, or confirm
   `react-native-ble-plx` is already negotiating this — otherwise telemetry
   notifications may arrive truncated.

## General BLE/GATT background (still valid from the old notes)

- The phone is the GATT **central/client**; the tricycle is the
  **peripheral/server**.
- **Write without response** gives no GATT-level delivery confirmation — in
  this protocol, delivery feedback is the application-level response
  notification, which is why the ACK timeout is a first-class error path.
- Notifications must be enabled by the client (CCCD write);
  `react-native-ble-plx`'s `monitorCharacteristicForService` does this
  automatically.
- Android requires runtime permissions (`BLUETOOTH_SCAN`, `BLUETOOTH_CONNECT`,
  and location on older API levels) before scanning — handled in
  `requestBluetoothPermission.tsx`.