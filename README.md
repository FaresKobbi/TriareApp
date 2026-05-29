# TRIARE

A React Native / Expo mobile application for controlling a motorized tricycle via Bluetooth.

> **Status:** Prototype stage. Current scope includes Bluetooth connection, motor control, speed adjustment, motor stop, and pedal resistance zone configuration.

---

## Get started

### Install dependencies


```bash
npm install
```

### Start the development server

```bash
npm start
```

You can then open the app in:

- **Expo Go** — scan the QR code on your phone
- **Android emulator** — `npm run android`
- **iOS simulator** — `npm run ios`
- **Web browser** — `npm run web`

---

## Run on an Android device

You can build and run the app locally on a physical Android device over USB — no Expo cloud, no emulator needed.

### Prerequisites

- **Node.js** and **npm** (already used by the project)
- **Java JDK 17+** (`java -version` to check)

### 1. Install the Android SDK command-line tools

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

### 2. Set environment variables

Add the following to your `~/.bashrc` (or `~/.zshrc`):

```bash
# Android SDK
export ANDROID_HOME="$HOME/Android/Sdk"
export ANDROID_SDK_ROOT="$ANDROID_HOME"
export PATH="$PATH:$ANDROID_HOME/cmdline-tools/latest/bin:$ANDROID_HOME/platform-tools"
```

Then reload your shell:

```bash
source ~/.bashrc
```

### 3. Install the required SDK packages

```bash
yes | sdkmanager --licenses
sdkmanager \
  "platform-tools" \
  "platforms;android-36" \
  "build-tools;36.0.0" \
  "ndk;27.1.12297006" \
  "cmake;3.22.1"
```

### 4. Verify the toolchain

```bash
adb --version
sdkmanager --list_installed
```

### 5. Prepare your phone

1. Go to **Settings → About phone** and tap **Build number** 7 times to enable Developer Options.
2. Go to **Settings → System → Developer options** and enable **USB debugging**.
3. Connect the phone to your computer via USB.
4. Accept the **"Allow USB debugging?"** prompt on the phone.
5. Confirm the device is detected:

```bash
adb devices
# Should show something like: XXXXXXXX   device
```

### 6. Build and run

**Option A — Development build (with hot reload):**

```bash
npx expo run:android --device
```

This compiles the app, installs it on your phone, and starts Metro for live reloading. First build takes several minutes.

**Option B — Standalone APK (runs without a computer):**

```bash
npx expo run:android --device --variant release
```

This embeds the JS bundle into the APK so the app runs offline — no Metro server needed.

> **Tip:** For wireless debugging (optional), after a USB connection run `adb tcpip 5555` then `adb connect <phone-ip>:5555` and unplug the cable.

---

## Scripts

| Script | Command | Description |
|---|---|---|
| Start dev server | `npm start` | Starts Expo development server |
| Android | `npm run android` | Opens app on Android emulator |
| iOS | `npm run ios` | Opens app on iOS simulator |
| Web | `npm run web` | Opens app in browser |
| Lint | `npm run lint` | Runs ESLint |
| Test | `npm test` | Runs all tests |
| Test (unit) | `npm run test:unit` | Runs unit tests only |
| Test (integration) | `npm run test:integration` | Runs integration tests only |
| Test (watch) | `npm run test:watch` | Runs tests in watch mode |
| Test (coverage) | `npm run test:coverage` | Generates a coverage report |

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

- [React Native](https://reactnative.dev/)
- [Expo](https://expo.dev/) (SDK 54, with New Architecture enabled)
- [Expo Router](https://expo.github.io/router/) (file-based routing)
- [TypeScript](https://www.typescriptlang.org/) (strict mode)
- [semantic-release](https://semantic-release.gitbook.io/) (automated releases)
- [Husky](https://typicode.github.io/husky/) + [commitlint](https://commitlint.js.org/) (commit validation)
