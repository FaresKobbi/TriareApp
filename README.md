# TRIARE

A React Native / Expo mobile application for controlling a motorized tricycle via Bluetooth Low Energy.

> **Status:** Prototype stage. Current scope: BLE scan and connection, motor control (enable / disable / speed / duty / stop), emergency-stop state reported live by the board, live telemetry with a pedal-position dial, crank calibration and gear ratio. The **Resistance** tab is not implemented yet.

---

## Read this first: you need a development build

The app talks to the tricycle through `react-native-ble-plx`, which contains **native code**. That has three consequences:

| Target | Works? | Why |
|---|---|---|
| **Physical Android phone** (development build) | ✅ | The supported way to run and debug the app |
| Expo Go | ❌ | It does not include the BLE module. The app crashes with `Cannot read property 'createClient' of null` |
| Android emulator / iOS simulator / web | ❌ for BLE | No real Bluetooth radio, so the board can never be found. Only useful for looking at layouts |
| iOS device | ⚠️ not validated | Needs a Mac with Xcode (`npx expo run:ios --device`); nobody on the team has tested it yet |

So the plan is always: **install the toolchain once → build the development build onto a phone (`npx expo run:android --device`) → afterwards just run `npm start`** for hot reload.

You do **not** need the tricycle to work on the code: `npm test` runs the whole protocol stack against an in-memory firmware simulator (`MockBleCharacteristicManager`).

---

## Quick start

### 1. Prerequisites

| Tool | Version | Notes |
|---|---|---|
| [Node.js](https://nodejs.org/) | **22 LTS** | Same version as CI |
| npm | comes with Node | |
| [Git](https://git-scm.com/) | any recent | Husky and commitlint run through Git hooks |
| JDK | **17** (anything from 17 to 24 works) | ⚠️ **JDK 25 does not work**: Gradle 8.14.3 fails with `Unsupported class file major version 69`. This includes the JDK bundled with recent Android Studio versions |
| Android SDK | platform `android-36`, build-tools `36.0.0`, NDK `27.1.12297006`, CMake `3.22.1` | Installed by Android Studio or by the command-line steps below |
| Android phone | Android 7.0+ (API 24) with BLE | USB cable that carries data, USB debugging on |

### 2. Install dependencies

```bash
git clone https://github.com/FaresKobbi/TriareApp.git
cd TriareApp
npm ci
```

Use `npm ci` (not `npm install`): it installs exactly what `package-lock.json` says, so everyone has the same versions. `npm ci` also installs the Git hooks (Husky).

### 3. Set up Android and build

- **Windows:** follow **[WINDOWS_DEV_SETUP.md](WINDOWS_DEV_SETUP.md)** (PowerShell policy, `JAVA_HOME`, long paths, Defender and Gradle settings).
- **Linux:** follow the next section.
- **macOS (Android phone):** the Linux steps work the same way. Install the JDK and the Android command-line tools with Homebrew or Android Studio and use `~/.zshrc` instead of `~/.bashrc`.
- **No local Android SDK at all:** build in the cloud with `eas build --profile development --platform android` (needs an Expo account; free builds have a monthly limit), install the APK, then continue with `npm start`.

---

## Linux: run on an Android device

You build and run the app locally on a physical phone over USB. No Expo cloud, no emulator.

### 1. Install the tools

```bash
# Debian / Ubuntu
sudo apt update
sudo apt install -y curl unzip openjdk-17-jdk
java -version        # must say 17.x (not 25)
```

If several JDKs are installed, make sure 17 is the active one (`sudo update-alternatives --config java`) and point `JAVA_HOME` at it (step 3).

### 2. Install the Android SDK command-line tools

```bash
# Create the SDK folder
mkdir -p "$HOME/Android/Sdk/cmdline-tools"

# Download the command-line tools (Linux)
cd /tmp
curl -O https://dl.google.com/android/repository/commandlinetools-linux-11076708_latest.zip
unzip -q commandlinetools-linux-11076708_latest.zip

# Move them to the expected location
mv cmdline-tools "$HOME/Android/Sdk/cmdline-tools/latest"
```

(Prefer a newer version? The current link is on [developer.android.com/studio](https://developer.android.com/studio#command-line-tools-only). Installing Android Studio instead also works; it creates the same folders.)

### 3. Set environment variables

Add the following to your `~/.bashrc` (or `~/.zshrc`):

```bash
# Java 17 (adjust the path for your distro: readlink -f "$(which java)")
export JAVA_HOME="/usr/lib/jvm/java-17-openjdk-amd64"

# Android SDK
export ANDROID_HOME="$HOME/Android/Sdk"
export ANDROID_SDK_ROOT="$ANDROID_HOME"
export PATH="$PATH:$ANDROID_HOME/cmdline-tools/latest/bin:$ANDROID_HOME/platform-tools"
```

Then reload your shell:

```bash
source ~/.bashrc
```

### 4. Install the required SDK packages

```bash
yes | sdkmanager --licenses
sdkmanager \
  "platform-tools" \
  "platforms;android-36" \
  "build-tools;36.0.0" \
  "ndk;27.1.12297006" \
  "cmake;3.22.1"
```

### 5. Verify the toolchain

```bash
adb --version
sdkmanager --list_installed
```

### 6. Prepare your phone

1. **Settings → About phone**: tap **Build number** 7 times to enable Developer options.
2. **Settings → System → Developer options**: enable **USB debugging**.
3. Connect the phone with a USB cable and accept the **"Allow USB debugging?"** prompt.
4. Check that it is detected:

```bash
adb devices
# Should show something like: XXXXXXXX   device
```

- `unauthorized` → accept the prompt on the phone (or revoke authorizations in Developer options and reconnect).
- `no permissions` → install the udev rules (`sudo apt install android-sdk-platform-tools-common`), then unplug and replug.
- Samsung phones: turn off **Auto Blocker** (it blocks USB debugging and can switch itself back on in the middle of a build).

### 7. Build and run

```bash
npx expo run:android --device
```

On a fresh clone the `android/` folder does not exist (it is generated and git-ignored), so the first run creates it, compiles the native code and installs the app on the phone. **The first build takes 5 to 20 minutes.** It then starts Metro and opens the app with hot reload.

For a standalone APK that runs without a computer (the JS bundle is embedded):

```bash
npx expo run:android --device --variant release
```

> **Tip:** wireless debugging (optional). With the phone connected by USB run `adb tcpip 5555`, then `adb connect <phone-ip>:5555` and unplug the cable.

---

## Day-to-day development

After the first build, you only need:

```bash
npm start
```

and open the **TriareApp** development build already installed on the phone (not Expo Go). Editing `.ts` / `.tsx` files hot-reloads.

### When do I need to rebuild?

The **rebuild command is always the same**:

```bash
npx expo run:android --device
```

| What changed | What to do |
|---|---|
| `.ts` / `.tsx` code, styles, texts | Nothing: hot reload (or press `r` in the Metro terminal) |
| `npm install` / `npm ci` brought a **library with native code** (for example `react-native-ble-plx`) or the Expo SDK version changed | Rebuild: `npx expo run:android --device` |
| `app.json` plugins, permissions, package name, icon | Regenerate the native project and rebuild: `npx expo prebuild --clean` then `npx expo run:android --device` |
| The app crashes on start after pulling, or the build fails with strange native errors | Clean build: `npx expo prebuild --clean`, then (Linux/macOS) `cd android && ./gradlew clean && cd ..` or (Windows) `cd android; .\gradlew.bat clean; cd ..`, then `npx expo run:android --device` |
| Only `package.json` scripts, docs, tests | Nothing |

`android/` is generated and git-ignored, so deleting it and running the build again is always safe.

### Check that BLE works end to end

Power the board, open the app, start the scan, connect, and on the Speed tab press **Read DevEUI**. Getting an 8-byte DevEUI back proves the whole chain (scan → connect → services → GATT write/read → firmware reply). The wire format is documented in [BLE_PROTOCOL.md](BLE_PROTOCOL.md).

### Troubleshooting

| Symptom | Cause and fix |
|---|---|
| `Cannot read property 'createClient' of null` | You opened the app in **Expo Go**. Use the development build instead |
| `Unsupported class file major version 69` or `BUG! exception in phase 'semantic analysis'` | Gradle is running on JDK 25. Install JDK 17 and set `JAVA_HOME` |
| `JAVA_HOME is not set and no 'java' command could be found` | Install JDK 17 and set `JAVA_HOME` / `PATH` (step 3) |
| `Failed to install the following Android SDK packages as some licences have not been accepted` | Run `yes \| sdkmanager --licenses` |
| `SDK location not found` | `ANDROID_HOME` is not set in the terminal you are using. Open a new terminal after changing variables |
| `adb: device not found` right after `BUILD SUCCESSFUL` | The phone lost USB debugging (Samsung Auto Blocker). Re-authorize and run the same command again; the build is cached |
| The app opens but cannot reach Metro | Same Wi-Fi as the computer, or use the cable: `adb reverse tcp:8081 tcp:8081` |
| The board never shows up in the scan | Android 12+: allow **Nearby devices**; Android 11 and older: turn on **Location**. Check the board is powered and advertising |
| `Not enough system resources` while building on Windows | See [WINDOWS_DEV_SETUP.md](WINDOWS_DEV_SETUP.md) (antivirus exclusions and Gradle workers) |

---

## Scripts

| Script | Command | Description |
|---|---|---|
| Start dev server | `npm start` | Starts Metro for the development build |
| Android | `npm run android` | Builds the app and installs it on a connected device (same as `npx expo run:android`) |
| iOS | `npm run ios` | Builds for iOS (needs a Mac; not validated) |
| Web | `npm run web` | Browser preview. **No BLE**, layout checks only |
| Lint | `npm run lint` | Runs ESLint |
| Type-check | `npm run typecheck` | Runs `tsc --noEmit` (strict TypeScript) |
| Test | `npm test` | Runs all tests (no hardware needed) |
| Test (unit) | `npm run test:unit` | Runs unit tests only |
| Test (integration) | `npm run test:integration` | Runs integration tests only |
| Test (watch) | `npm run test:watch` | Runs tests in watch mode |
| Test (coverage) | `npm run test:coverage` | Generates a coverage report |

Every commit runs `npm run lint` and `npm test` (Husky pre-commit) and validates the message (commitlint). Run both yourself before committing to avoid surprises.

---

## Documentation

| File | What is in it |
|---|---|
| [WINDOWS_DEV_SETUP.md](WINDOWS_DEV_SETUP.md) | Step-by-step setup on Windows, with the usual gotchas |
| [ARCHITECTURE.md](ARCHITECTURE.md) | Folder layout, BLE layers, state management, languages (English / pt-BR) |
| [BLE_PROTOCOL.md](BLE_PROTOCOL.md) | GATT profile, opcodes, frame layouts, NACK, status events, telemetry stream |
| [CONTRIBUTING.md](CONTRIBUTING.md) | Branches, Conventional Commits, pull requests, releases |
| `triare_host_ble.py` | Reference host script (Python + bleak) for talking to the board from a PC |
| `triare_bench_resist.py` | Interactive bench session for the physiotherapy modes (stays connected, logs a CSV) |

---

## Contributing

Please read [CONTRIBUTING.md](CONTRIBUTING.md) before creating branches, commits, or pull requests.

It covers:

- How to set up the project
- Branch naming conventions
- Commit message format (Conventional Commits)
- Pull request workflow
- How the automated release pipeline works

---

## Tech stack

- [React Native](https://reactnative.dev/) 0.81 (New Architecture enabled)
- [Expo](https://expo.dev/) SDK 54 with a development build (`expo-dev-client`)
- [Expo Router](https://expo.github.io/router/) (file-based routing)
- [react-native-ble-plx](https://github.com/dotintent/react-native-ble-plx) (Bluetooth Low Energy)
- [TypeScript](https://www.typescriptlang.org/) (strict mode)
- [Jest](https://jestjs.io/) with `jest-expo`
- [semantic-release](https://semantic-release.gitbook.io/) (automated releases)
- [Husky](https://typicode.github.io/husky/) + [commitlint](https://commitlint.js.org/) (commit validation)
