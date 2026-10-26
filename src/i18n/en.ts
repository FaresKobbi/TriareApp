/**
 * English strings: the source of truth for the keys.
 *
 * `{name}` marks a value filled in at run time. Keys ending in `_one` / `_other`
 * are the singular / plural forms of a message that counts something (see `tp`).
 * `pt-BR.ts` is typed against this file, so a missing or extra key there is a
 * compile error.
 */
export const en = {
  // ---- app ---------------------------------------------------------------
  "app.name": "Triare",
  "app.tagline": "Rehabilitation tricycle control",
  "common.notConnected": "Not connected",

  // ---- language ----------------------------------------------------------
  "language.title": "Language",
  "language.hint":
    "The app starts in your phone's language. Your choice lasts until the app is closed.",
  "language.a11y": "Language: {language}",

  // ---- tabs --------------------------------------------------------------
  "tabs.speed": "Speed",
  "tabs.resistance": "Resistance",
  "tabs.settings": "Settings",

  // ---- scan / connect screen ---------------------------------------------
  "home.connectLine1": "Connect a tricycle",
  "home.connectLine2": "to begin a session",
  "home.scanHelp":
    "Make sure the device is powered on and within range. Bluetooth scanning stays active for one minute.",
  "home.scanButton": "Scan for devices",
  "home.availableDevices": "AVAILABLE DEVICES",
  "home.devicesFound_one": "{count} found",
  "home.devicesFound_other": "{count} found",
  "device.unknownName": "Unknown",
  "signal.strong": "Strong signal",
  "signal.good": "Good signal",
  "signal.weak": "Weak signal",
  "signal.unknown": "Unknown signal",

  // ---- connection --------------------------------------------------------
  "connection.scanFailed": "BLE scan failed",
  "connection.deviceNotFound": "Device not found",
  "connection.connectFailed": "Unable to connect to device",
  "connection.lostTitle": "Connection lost",
  "connection.lostBody": "The board disconnected. Turn it on, then scan again to reconnect.",

  // ---- settings / resistance placeholders --------------------------------
  "settings.title": "Settings",
  "resistance.title": "Resistance",
  "resist.bench":
    "Bench test: motor free, low current. Keep a hand ready on the shaft and B3 within reach.",
  "resist.notArmed": "Tap Enable first. The modes only run while the system is armed.",

  "resist.status.title": "What the board is doing",
  "resist.status.idle": "No physiotherapy mode is active.",
  "resist.mode.none": "None",
  "resist.mode.1": "Assist valley",
  "resist.mode.2": "Brake",
  "resist.mode.3": "Static hold",
  "resist.phase.0": "Idle",
  "resist.phase.1": "Running",
  "resist.phase.2": "Waiting for the pedal to stop",
  "resist.phase.3": "Holding",
  "resist.phase.4": "Releasing",
  "resist.limit.thermal": "Current limited: the motor is warming up.",
  "resist.limit.yield": "The hold gave way because the pedal was forced.",
  "resist.limit.timeout": "The hold ended: maximum time reached.",
  "resist.metric.angle": "Pedal angle",
  "resist.metric.current": "Commanded current",
  "resist.metric.assist": "Help now",
  "resist.metric.load": "Motor load",
  "resist.releaseNow": "Release now",
  "resist.released": "Released",
  "resist.ended": "Mode ended",

  "resist.setup.title": "Setup",
  "resist.ratio.label": "Gear ratio",
  "resist.ratio.hint":
    "The static hold needs 3 or more. The bench gearbox is 10:1. Setting it also zeroes the pedal angle.",
  "resist.ratio.set": "Set ratio",
  "resist.ratio.error": "Enter a ratio greater than 0.",
  "resist.leg.title": "Leg being worked",
  "resist.leg.left": "Left",
  "resist.leg.right": "Right",
  "resist.leg.hint":
    "Zones are angles of this leg's pedal. The app converts them for the board.",

  "resist.pick.title": "Mode",
  "resist.pick.A.title": "Assist valley",
  "resist.pick.A.desc":
    "Holds a steady cadence and lowers the help in the weak part of the turn.",
  "resist.pick.C.title": "Static hold",
  "resist.pick.C.desc":
    "Holds the pedal in place for isometric work. It gives way if the pedal is forced.",
  "resist.pick.B.title": "Brake",
  "resist.pick.B.desc": "Not available yet: there is nowhere to send the braking energy.",

  "resist.cadence.title": "Cadence",
  "resist.cadence.label": "Crank RPM",
  "resist.cadence.sentAs": "{erpm} ERPM on the motor",
  "resist.cadence.error": "Enter a cadence above 0.",
  "resist.zones.title": "Zones with less help",
  "resist.zones.empty": "No zones. The help is the same all around the turn.",
  "resist.zones.item": "Zone {n}",
  "resist.zones.start": "From (°)",
  "resist.zones.end": "To (°)",
  "resist.zones.percent": "Help (%)",
  "resist.zones.add": "Add zone",
  "resist.zones.example": "Example",
  "resist.zones.remove": "Remove",
  "resist.zones.send": "Send zones",
  "resist.zones.read": "Read from board",
  "resist.zones.readResult_one": "{count} zone on the board.",
  "resist.zones.readResult_other": "{count} zones on the board.",
  "resist.zones.readNone": "The board has no zones.",
  "resist.zones.sent_one": "{count} zone sent",
  "resist.zones.sent_other": "{count} zones sent",
  "resist.zones.cleared": "Zones cleared on the board",
  "resist.zones.error.angle": "Angles must be between 0 and 360.",
  "resist.zones.error.length": "A zone must be at least 1° long.",
  "resist.zones.error.percent": "Help must be between 0 and 100 %.",
  "resist.zones.error.edge": "The edge must be a whole number from 0 to 60.",
  "resist.zones.error.count": "There is room for 8 zones.",
  "resist.map.title": "Help around the turn",
  "resist.map.legend": "Taller bars mean more help. The red line is the pedal.",
  "resist.start": "Start",
  "resist.end": "End mode",

  "resist.hold.title": "Holding current",
  "resist.hold.label": "Amps (0.1 to 3)",
  "resist.hold.engage": "Hold the pedal",
  "resist.hold.engaged": "Hold requested ({amps} A). It starts when the pedal is still.",
  "resist.hold.error": "Enter a current between 0.1 and 3 A.",
  "resist.hold.hint":
    "Stop the pedal by hand or let it stop. The hold never brakes: if you push too hard it lets go.",

  "resist.tune.title": "Fine tuning (bench)",
  "resist.tune.hint": "Change one value at a time. The board refuses unsafe values.",
  "resist.tune.kpSpeed": "Speed gain (P)",
  "resist.tune.kiSpeed": "Speed gain (I)",
  "resist.tune.kpPos": "Position gain (P)",
  "resist.tune.kdPos": "Position damping (D)",
  "resist.tune.send": "Send gains",
  "resist.tune.done": "Gains updated",
  "resist.tune.error": "Enter four numbers, 0 or more.",

  // ---- pedal zero (resistance screen) -------------------------------------
  "zero.title": "Pedal zero",
  "zero.intro":
    "The sensor gives the crank a fixed zero. Send the gear ratio above, mark the zero once at installation (left pedal up), then the board finds it again by itself after every boot.",
  "zero.state.valid": "Zero confirmed by the sensor",
  "zero.state.notValid": "Zero not confirmed yet",
  "zero.state.searching": "The motor is turning the pedals…",
  "zero.state.learning": "Turn the crank, in the pedalling direction, until the magnet passes the sensor.",
  "zero.state.unknown": "Reading the sensor state…",
  "zero.check.ratio": "Gear ratio sent",
  "zero.check.index": "Zero marked",
  "zero.check.saved": "Saved on the board",
  "zero.check.rev": "Reverse measured",
  "zero.metric.index": "Sensor angle",
  "zero.metric.drift": "Last drift",
  "zero.metric.pulses": "Pulses",
  "zero.metric.slips": "Slips",
  "zero.result.title": "Last search",
  "zero.result.0": "No search yet",
  "zero.result.1": "Searching…",
  "zero.result.2": "Found: the sensor fired",
  "zero.result.3": "Not found: about 1.25 turns without a pulse (sensor off or misaligned)",
  "zero.result.4": "The crank did not move (foot on the pedal or blocked)",
  "zero.result.5": "The crank moved against the direction the sensor was learned in",
  "zero.result.6": "Stopped before finding it",
  "zero.result.7": "The result is out of date",
  "zero.learn": "Mark zero (left pedal up)",
  "zero.learn.hint":
    "Put the left pedal up, tap, then turn the crank in the pedalling direction until the magnet passes the sensor. The crank must be moving: a pulse with the crank stopped is ignored.",
  "zero.search": "Calibrate pedal",
  "zero.search.hint": "The motor turns the crank slowly until the sensor fires. Keep your feet off the pedals.",
  "zero.cancel": "Cancel search",
  "zero.refresh": "Read state",
  "zero.confirm.title": "Move the pedals?",
  "zero.confirm.body":
    "The motor will turn the crank slowly (about 8 rpm) for up to 11 s. Keep feet and hands away from the pedals. Cancel at any time.",
  "zero.confirm.ok": "Start",
  "zero.confirm.cancel": "Not now",
  "zero.problem.noRatio": "Send the gear ratio first (Setup above).",
  "zero.problem.noIndex": "Mark the zero first: left pedal up, then turn the crank.",
  "zero.slow": "The search is taking longer than the board allows. Cancel it and check the sensor.",
  "zero.searchStarted": "Searching for the zero…",
  "zero.searchCancelled": "Zero search cancelled",

  // ---- command results (toasts) ------------------------------------------
  "motor.commandFailed": "BLE command failed",
  "motor.armed": "System armed",
  "motor.disarmed": "System disarmed",
  "motor.released": "Motor released (freewheel)",
  "motor.speedSent": "Speed target sent: {rpm} RPM ({erpm} ERPM)",
  "motor.dutySet": "Duty set to {duty}",
  "motor.crankZeroed": "Crank angle zeroed",
  "motor.ratioSet": "Gear ratio set to {ratio}",
  "motor.emergencyPressed": "Emergency stop pressed",
  "motor.emergencyPressedDetail":
    "The motor was released. Release B3, then hold it for 2 s to clear the stop (or tap Enable).",
  "motor.emergencyCleared": "Emergency stop cleared",
  "motor.emergencyClearedDetail": "The system is disarmed. Tap Enable when it is safe to arm.",
  "motor.selfDisarmed": "The board disarmed itself",
  "motor.selfDisarmedDetail": "Check the controller fault in the telemetry, then tap Enable.",
  "toast.enable": "Enable",

  "feedback.disarmed.title": "System is disarmed",
  "feedback.disarmed.detail": "Tap Enable first, then send the speed.",
  "feedback.emergency.title": "Emergency stop is active",
  "feedback.emergency.detail":
    "Release B3, then hold it for 2 s to clear the stop (or tap Enable).",
  "feedback.emergency.stillPressed":
    "The B3 button is still pressed. Release it, then tap Enable again.",
  "feedback.fault.title": "Motor controller fault",
  "feedback.fault.detail":
    "Arming and motion are blocked while the VESC reports a fault. Check the controller, power-cycle the board and reconnect.",
  "feedback.invalid.title": "Value rejected by the firmware",
  "feedback.invalid.detail": "Check the value and try again.",
  "feedback.invalid.hold":
    "The hold needs a current from 0.1 to 3 A and a gear ratio of 3 or more.",
  "feedback.invalid.zeroSearch":
    "The zero search needs an armed system, a gear ratio and a learned sensor, and the motor must be stopped.",
  "feedback.noRegen.title": "Brake is not available",
  "feedback.noRegen.detail": "There is nowhere to send the braking energy yet.",
  "feedback.zeroSetup.title": "The zero is not set up",
  "feedback.zeroSetup.detail": "Send the gear ratio and mark the zero first, then search again.",
  "feedback.rejected.title": "Command rejected by the firmware",
  "feedback.rejected.detail": "Reason code 0x{code}.",
  "feedback.rangeError": "Invalid value",
  "feedback.timeout.title": "No response from the board",
  "feedback.timeout.motion":
    "The system is probably disarmed or an emergency stop is active. Tap Enable and send the speed again.",
  "feedback.timeout.enable":
    "Enable was not confirmed. The B3 button may be pressed or the controller may be in fault; check the board and try again.",
  "feedback.timeout.ratio":
    "The ratio may be invalid (it must be greater than 0), or the link is unstable.",
  "feedback.timeout.stop":
    "The command may or may not have been applied. Check that the motor is stopped and press Emergency (B3) if it is not.",
  "feedback.timeout.zero":
    "The board did not answer. It may be disarmed or running older firmware without the zero search.",
  "feedback.timeout.default": "Check the connection and try again.",
  "feedback.timeout.resist":
    "The board did not answer. It may be disarmed or running older firmware without this mode.",

  // ---- speed screen ------------------------------------------------------
  "state.unknown.label": "State unknown",
  "state.unknown.hint": "Waiting for the board to report its state…",
  "state.unknown.legacyHint":
    "This firmware does not report its state. Update it for live status, or tap Enable / Disable.",
  "state.armed.label": "Armed",
  "state.armed.hint": "Motor released. Send a speed or duty to start it.",
  "state.running.label": "Running",
  "state.running.hint": "A speed or duty target is active. Stop releases the motor.",
  "state.disarmed.label": "Disarmed",
  "state.disarmed.hint": "Tap Enable before sending a speed.",
  "state.emergency.label": "Emergency stop",
  "state.emergency.hint": "Release B3, then hold it for 2 s to clear the stop (or tap Enable).",

  "speed.system": "System",
  "speed.enable": "Enable",
  "speed.disable": "Disable",
  "speed.stop": "Stop",
  "speed.targetTitle": "Speed target (motor RPM)",
  "speed.setSpeed": "Set speed",
  "speed.sentAs": "Sent to the firmware as {erpm} ERPM (RPM × 4). Pedal ≈ {crank} RPM.",
  "speed.dutyTitle": "Duty (-1.0 to 1.0)",
  "speed.setDuty": "Set Duty",
  "speed.ratioTitle": "Crank / gear ratio",
  "speed.calibrate": "Calibrate crank",
  "speed.setRatio": "Set gear ratio",
  "speed.error.rpm": "Enter the speed as a number (motor RPM).",
  "speed.error.duty": "Duty must be a number between -1.0 and 1.0.",
  "speed.error.ratio": "Gear ratio must be a number greater than 0.",
  "speed.telemetry": "Telemetry",
  "speed.live": "Live telemetry and pedal dial ({mode})",
  "speed.mode.streamed": "streamed, 20 Hz",
  "speed.mode.polled": "polled, ~7 Hz",
  "speed.mode.starting": "starting…",
  "speed.liveHint":
    "The state above updates by itself; this switch only refreshes the numbers and the dial. It also asks Bluetooth for a faster link, so leave it off when you do not need it.",
  "speed.liveStopped": "Live telemetry stopped.",
  "speed.liveStoppedWithReason": "Live telemetry stopped: {reason}.",
  "speed.retry": "Retry",
  "speed.requestTelemetry": "Request telemetry",
  "speed.deveui": "DevEUI",
  "speed.readDeveui": "Read DevEUI",
  "speed.deveuiFailed": "Failed to read DevEUI",
  "speed.connection": "Connection",
  "speed.disconnect": "Disconnect",

  // ---- pedal dial and units ----------------------------------------------
  "dial.position": "Pedal position {angle}",
  "dial.unavailable": "Pedal position unavailable",
  "dial.left": "Left",
  "dial.right": "Right",
  "unit.erpm": "ERPM",
  "unit.motorRpm": "Motor RPM",
  "unit.crankRpm": "Crank RPM",

  // ---- telemetry panel ---------------------------------------------------
  "telemetry.waiting": "Waiting for the first sample…",
  "telemetry.turnOn": "Turn on Live telemetry to see the measurements and their trend.",
  "tile.showHint": "Shows what this means",
  "tile.hideHint": "Hides the explanation",
  "level.ok": "normal",
  "level.warn": "attention",
  "level.danger": "out of range",

  "tile.speed.label": "Pedal speed",
  "tile.speed.detail": "Motor {motor} RPM · {erpm} ERPM",
  "tile.speed.hint":
    "How fast the pedals turn. Negative means reverse. The motor turns faster than the pedals by the gear ratio (set in 'Crank / gear ratio'). ERPM is the unit the motor controller uses: motor RPM × 4 pole pairs.",
  "tile.speed.chart": "Pedal speed over the last 30 seconds",
  "tile.current.label": "Motor current",
  "tile.current.hint":
    "Current in the motor. Positive: the motor is pushing. Negative: it is braking and sending energy back to the supply, which raises the voltage. A sudden rise at constant speed means more load.",
  "tile.current.chart": "Motor current over the last 30 seconds",
  "tile.voltage.label": "Supply voltage",
  "tile.voltage.hint":
    "Voltage at the controller. Below 22 V the pack is low and the controller cuts power at about 20 V. Above 28 V braking is limited, and 30 V is the maximum. With a bench supply, braking can push this up quickly.",
  "tile.voltage.chart": "Supply voltage over the last 30 seconds",
  "tile.temp.label": "Controller temp",
  "tile.temp.hint":
    "Temperature of the power transistors (FET) in the motor controller. It rises with current. Around 85 °C the controller reduces power on its own.",
  "tile.temp.chart": "Controller temperature over the last 30 seconds",
  "tile.fault.label": "Controller fault",
  "tile.fault.okHint":
    "The motor controller (VESC) reports no fault. A fault cuts the motor and blocks arming until it is cleared.",
  "tile.fault.withCode": "{hint} Code {code}.",

  "fault.none.name": "No fault",
  "fault.none.hint": "The motor controller reports no fault.",
  "fault.unknown.name": "Fault code {code}",
  "fault.unknown.hint": "See the fault list of the VESC firmware version in VESC Tool.",
  "fault.1.name": "Over voltage",
  "fault.1.hint":
    "The supply voltage went above the limit. Braking pushes energy back into the supply, and a bench supply cannot absorb it.",
  "fault.2.name": "Under voltage",
  "fault.2.hint":
    "The supply voltage fell below the cutoff. Check the battery charge or the supply's current limit.",
  "fault.3.name": "Gate driver fault",
  "fault.3.hint": "The motor driver chip reported a fault. Power-cycle and check the phase wiring.",
  "fault.4.name": "Over current",
  "fault.4.hint": "The current went above the hardware limit.",
  "fault.5.name": "Controller too hot",
  "fault.5.hint":
    "The power transistors (FET) are above the temperature limit. Let it cool down.",
  "fault.6.name": "Motor too hot",
  "fault.6.hint": "The motor temperature sensor is above the limit.",
  "fault.7.name": "Gate driver over voltage",
  "fault.7.hint": "The driver supply is too high.",
  "fault.8.name": "Gate driver under voltage",
  "fault.8.hint": "The driver supply is too low.",
  "fault.9.name": "Controller logic under voltage",
  "fault.9.hint": "The controller's own 3.3 V supply dipped.",
  "fault.10.name": "Restarted by watchdog",
  "fault.10.hint": "The controller reset itself after freezing.",
  "fault.11.name": "Encoder SPI fault",
  "fault.11.hint": "The position sensor did not answer.",
  "fault.12.name": "Sin/cos encoder amplitude too low",
  "fault.12.hint": "Check the position sensor wiring.",
  "fault.13.name": "Sin/cos encoder amplitude too high",
  "fault.13.hint": "Check the position sensor wiring.",
} as const;

export type TranslationKey = keyof typeof en;

/** Keys that have `_one` / `_other` forms, without the suffix. */
export type PluralKey = TranslationKey extends infer K
  ? K extends `${infer Base}_one`
    ? Base
    : never
  : never;
