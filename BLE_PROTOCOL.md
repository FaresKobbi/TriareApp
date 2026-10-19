# TRIARE BLE Protocol (WBA65 firmware)

> **Status:** Current, confirmed against the reference host script `triare_host_ble.py`
> (kept in this repo) and the operational GUI `triare_ble_interface.py`, both of
> which run this command set against real firmware. This supersedes the earlier
> STM32WB0 echo-test notes (`TRIARE_BLE_STM32WB0_Communication_Notes.docx`): the
> old `00000000-…` UUIDs and single-byte echo scheme are obsolete. The general
> BLE/GATT background from those notes (roles, MTU, write-without-response
> semantics, Android permission flow) remains valid and is summarized at the end.
>
> **Update:** the base table below predates opcodes `0x19`–`0x1F` (stream `0x1C`/`0x1D`,
> status event `0x1E`, NACK `0x1F`); their authoritative description is the header of
> `p2p_server_app.c`. Physiotherapy commands (`0x20`–`0x29`) are documented in their own section.
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

## Physiotherapy (torque) commands — opcodes 0x20–0x29

> Design and safety rationale: `PROJETO_MODO_RESISTENCIA.md` (project docs).
> Firmware source of truth: `triare_resist.c/h`, `app_triare.c`, `p2p_server_app.c`.
> **Bench status:** implemented for testing with the motor **free** (not coupled to the
> tricycle). Mode B (brake) is refused until the team decides on an energy sink.

These commands follow the same one-command-one-notification rule. A rejected command
answers `[0x1F][opcode][reason]` (never silence). All floats are f32 little-endian.

| Opcode | Command | Request payload | Response |
|---|---|---|---|
| `0x20` | RESIST_MODE | u8: `0` none, `1` assist valley (mode A), `2` brake (mode B) | ACK, or NACK. Needs the system **armed**. Mode `2` → NACK reason `5` |
| `0x21` | RESIST_ZONE | 15 B: `idx` u8 (0–7), `start` f32°, `end` f32°, `type` u8 (`0` = % of assist kept), `value` f32 (0–100), `edge` u8° (0–60) | ACK (stages a draft; nothing changes yet) or NACK `4` |
| `0x22` | RESIST_COMMIT | none | ACK — publishes the staged draft **atomically** |
| `0x23` | RESIST_CLEAR | none | ACK — clears draft and active zones |
| `0x24` | HOLD_ENGAGE | f32: holding current (A, 0 < I ≤ 3) | ACK, or NACK. Mode C (static hold). Needs armed and `gear_ratio ≥ 3` (else NACK `4`) |
| `0x25` | HOLD_RELEASE | none | ACK — releases in a ramp (never brakes) |
| `0x26` | RESIST_GET | none | One notification per active zone `[0x26][idx][total][start f32][end f32][type][value f32][edge]` (17 B); `[0x26][0xFF][0]` if none |
| `0x27` | RESIST_TUNE | 4× f32: `kp_speed`, `ki_speed`, `kp_pos`, `kd_pos` | ACK, or NACK `4` if out of range |

Zone semantics: angles are **crank degrees 0–360** in the same frame as the telemetry
angle; `start == 0` and `end == 360` is a full circle; a zone that wraps (start > end)
is fine. `value` is the percentage of the assist current **kept** inside the zone
(0 = no assist in the zone). `edge` widens the zone outward with a smooth ramp, so the
current never steps. Up to 8 zones; later zones multiply the factor (the smallest wins).

Mode A takes its cadence reference from the normal `SET_RPM` (`0x12`, in ERPM): in this
mode the firmware turns it into a **current** command; the VESC speed controller is
not used. Mode C has no cadence: `SET_RPM` is refused. `SET_DUTY` leaves the mode.

### Resistance frame `0x29` (unsolicited, 20 bytes)

Sent right after each `0x1D` stream frame while any physiotherapy mode is active.

| Offset | Type | Field |
|---|---|---|
| 0 | u8 | `0x29` |
| 1 | u32 | tick (ms) |
| 5 | f32 | commanded current (A, signed) |
| 9 | f32 | assist factor applied (0–1) |
| 13 | u8 | mode (0 none, 1 A, 2 B, 3 C) |
| 14 | u8 | phase (0 idle, 1 active, 2 waiting for pedal to stop, 3 holding, 4 releasing) |
| 15 | u8 | limit flags: `0x01` thermal, `0x02` yielded, `0x04` max hold time |
| 16 | f32 | thermal model (% of the continuous limit) |

### Extra NACK reason and status bits

| Value | Meaning |
|---|---|
| NACK `5` | `NO_REGEN_PATH` — brake requested but there is no way to return energy |
| status `0x08` | physiotherapy mode active |
| status `0x10` | current is being limited (thermal or yield) |

### Safety behaviour (summary)

- **B3 emergency, VESC fault, `SYSTEM_DISABLE`:** current to 0 immediately.
- **`STOP`, `HOLD_RELEASE`, mode `0`:** ramp to 0 (rate-limited, ≤ ~0.5 s from 3 A).
- **Link lost** with a mode active: ramp to 0, then disarm.
- **Stale telemetry** (> 300 ms): mode cancelled and current set to 0.
- **Mode C** waits until the pedal is nearly still (< 3 crank RPM for 200 ms), yields if
  the pedal is forced (> 8 RPM for 300 ms), and ends after 30 s.

## Pairing / identification (open item)

The reference script derives a 6-digit PIN from the DevEUI for OS-level pairing:
`PIN = crc32(devEui) % 1_000_000`. That flow is Windows-specific
(`--pair` + OS popup). The Android pairing/bonding flow via
`react-native-ble-plx` differs and **has not been investigated yet** — do not
assume the same UX. The DevEUI itself is readable both via the DevEUI
characteristic and via `CMD_GET_DEVEUI`.

## Crank zero (index sensor) — opcodes 0x28 and 0x2A

The crank angle comes from the VESC tachometer, which is *relative*: at power-up "0°" is wherever
the crank happens to be. A PAS sensor with **one magnet** gives one absolute index per crank turn.
The firmware learns at which angle (left pedal up = 0°) the sensor fires, stores it in flash, and
re-references the angle on the first pulse after every boot. Details: `triare/ZERO_PEDIVELA.md`
in the firmware repo.

| Opcode | Name | Payload | Response |
|---|---|---|---|
| `0x17` | CALIBRATE_CRANK | none | ACK. *Now also arms learning*: the next sensor pulse (crank turned by hand in the pedalling direction) is stored as the index angle. Needs `SET_GEAR_RATIO` sent first in this boot |
| `0x18` | SET_GEAR_RATIO | f32 | ACK. Sending the **same ratio again is a no-op** (the app resends it on every connection) — it no longer resets the angle. A *different* ratio resets the angle and clears `ZERO_VALID` |
| `0x28` | ZERO_SEARCH | u8: `1` start, `0` cancel | ACK, or NACK: `1` not armed, `2` emergency, `3` fault, `4` busy/motor moving/stale telemetry, `6` **ZERO_SETUP** (no index learned or ratio not set) |
| `0x2A` | ZERO_GET | none | 15 B: `[0x2A][flags u8][searchState u8][indexAngle f32°][lastDrift f32°][pulses u16][slips u16]` |

Status byte (telemetry byte 22, stream byte 26, `0x1E` events): `0x20` = **ZERO_VALID**
(confirmed by the sensor since the last boot/ratio change), `0x40` = **ZERO_SEARCH** (motor turning).

`ZERO_GET` flags: `0x01` index known, `0x02` zero valid, `0x04` learning (waiting for the pulse),
`0x08` searching, `0x10` ratio set this boot, `0x20` index saved in flash.
`searchState`: `0` none, `1` running, `2` found, `3` timeout (≈1.25 turn, no pulse), `4` stalled
(crank did not move: foot on the pedal), `5` wrong direction, `6` aborted (stop/disarm/emergency/other
command), `7` telemetry went stale.

**Suggested app flow (not implemented in the app yet):**
1. On connect: send `SET_GEAR_RATIO`, then `ZERO_GET`.
2. If `ZERO_VALID` is clear and *index known*: show "The pedal zero must be confirmed. The crank will
   turn slowly. Take your feet off the pedals." → on **Confirm**: `SYSTEM_ENABLE` (if needed) → `ZERO_SEARCH(1)`;
   watch the status byte; when `ZERO_SEARCH` clears read `ZERO_GET` and report found / timeout / stalled.
3. If *index not known*: commissioning screen (mechanic/installer): put the left pedal up, `CALIBRATE_CRANK`,
   turn the crank by hand until `ZERO_GET` shows *index known*.
4. Never start `ZERO_SEARCH` without an explicit user confirmation in the same session.

## Known gaps and assumptions (firmware-team follow-up)

1. **Resistance zones:** now defined (opcodes `0x20`–`0x29`, section above). Mode B
   (brake) stays blocked until the team decides on an energy sink.
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