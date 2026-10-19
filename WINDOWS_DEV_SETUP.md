# Running TriareApp on Windows (Development Build)

> Complements [`README.md`](README.md), whose "Run on an Android device"
> section documents the **Linux** path. This guide has the same goal
> (`npx expo run:android --device`) on **Windows**.

Versions this guide was checked against: Expo SDK 54, React Native 0.81.5
(New Architecture), Gradle 8.14.3, `react-native-ble-plx` 3.5.x.

## Why Expo Go cannot be used

The app talks to the TRIARE tricycle over Bluetooth Low Energy through
`react-native-ble-plx`. That library depends on **native code** (Java/Kotlin on
Android) to reach the phone's BLE radio.

Expo Go is a generic app prebuilt by Expo that only contains a fixed set of
native modules, and BLE is not one of them. When the app tries to create the
`BleManager`, it crashes with:

```
ERROR [TypeError: Cannot read property 'createClient' of null]
```

The native bridge (`NativeModules.BleClientManager`) simply does not exist
inside Expo Go. The `react-native-ble-plx` config plugin declared in
`app.json` only takes effect when the app is **built with that module
included**, so you need your own **development build**.

> The same reasoning applies to the Android emulator and the web target: neither
> has a real BLE radio that the TRIARE board can talk to. Use a physical
> Android phone.

## Two ways to produce that build

| Path | How | When to use it |
|---|---|---|
| **Cloud (EAS Build)** | `eas build --profile development --platform android` | Quick setup, no local Android SDK. Free builds have a monthly limit. |
| **Local** | `npx expo run:android --device` | Unlimited and faster builds after the initial setup. Needs the Android SDK and a JDK on your machine. **This guide covers this path.** |

The `development` profile already exists in `eas.json`
(`developmentClient: true`), so the cloud option works unchanged if the local
path is not viable on your machine.

## What you will install

- **Git** and **Node.js / npm** (to run the project and the Expo CLI)
- **Android Studio** (brings the Android SDK; it also bundles a JDK, but we
  use a separate JDK 17 — see step 4)
- **Windows environment variables** pointing to the SDK and to Java
- **USB debugging** enabled and authorized on the phone

---

## 0. Install Git and Node.js (npm comes with it)

1. Install [Git for Windows](https://git-scm.com/download/win) with the default
   options. The project uses Husky and commitlint, which run through Git hooks.
2. Download the **LTS** version of Node.js from [nodejs.org](https://nodejs.org/).
   The project CI uses **Node 22**, so Node 22 LTS is the safest choice; the
   "Current" release is usually too recent and brings nothing here.
3. Run the `.msi` installer with the default options (leave "add to PATH"
   checked; it is selected by default).
4. Close and reopen the terminal, then check:
   ```powershell
   node -v
   npm -v
   ```

### Gotcha: PowerShell blocks `npm.ps1`

On Windows, `npm` is installed as a PowerShell script (`npm.ps1`), and
PowerShell blocks script execution by default. This is a system security
policy, not a Node problem. The error looks like this:
```
npm : File C:\Program Files\nodejs\npm.ps1 cannot be loaded because
running scripts is disabled on this system.
```
(On a Portuguese-language Windows the message is
`O arquivo ... npm.ps1 não pode ser carregado porque a execução de scripts foi
desabilitada neste sistema.`)

**Fix:** open PowerShell **as Administrator** (right-click the icon → "Run as
administrator") and run:
```powershell
Set-ExecutionPolicy RemoteSigned -Scope CurrentUser
```
Confirm with `Y` when asked. This allows local scripts (such as `npm.ps1`) and
digitally signed scripts, while still blocking unsigned scripts from unknown
sources. It is the standard recommended setting for development machines, not a
security hole. Close and reopen the terminal (it no longer needs to be admin)
and run `npm -v` again.

Alternative, if you prefer not to change that policy: run `npm`/`npx` from the
**Command Prompt (cmd)** instead of PowerShell, since `cmd` has no such
restriction. You will have to switch terminals whenever you use `npm`/`npx`.

5. Clone the repository and install the dependencies from the project folder
   (`TriareApp`):
   ```powershell
   git clone https://github.com/FaresKobbi/TriareApp.git
   cd TriareApp
   npm ci
   ```
   `npm ci` installs exactly what `package-lock.json` says, so everyone on the
   team gets the same versions (see `CONTRIBUTING.md`). Use `npm install` only
   when you intentionally add or update a package.

### Recommended: enable long paths

React Native's native build (New Architecture, Reanimated, codegen) creates very
deep folder structures, and Windows limits paths to 260 characters by default.
If the build fails with messages about file names or paths being too long, enable
long paths once (PowerShell as Administrator) and reopen the terminal:
```powershell
New-ItemProperty -Path "HKLM:\SYSTEM\CurrentControlSet\Control\FileSystem" `
  -Name "LongPathsEnabled" -Value 1 -PropertyType DWORD -Force
git config --system core.longpaths true
```
Keeping the project in a short path such as `C:\dev\TriareApp` also helps.

---

## 1. Install Android Studio

Download it from
[developer.android.com/studio](https://developer.android.com/studio) and install
in **Standard** mode. This automatically downloads the Android SDK, the
`platform-tools` and an embedded JDK (**JBR**, JetBrains Runtime), so you can
skip the manual `cmdline-tools` download that the Linux-oriented `README.md`
describes.

## 2. Confirm the SDK packages

In Android Studio: **More Actions → SDK Manager**.

- **SDK Platforms** tab: at least one recent Android version checked.
- **SDK Tools** tab: `Android SDK Platform-Tools` and `Android SDK Build-Tools`
  checked.
- Note the path shown at the top of the window (**Android SDK Location**),
  something like:
  ```
  C:\Users\<your-user>\AppData\Local\Android\Sdk
  ```

The project's Android build (Expo SDK 54 template) uses the same components the
Linux section of `README.md` lists: platform `android-36`, build-tools
`36.0.0`, NDK `27.1.12297006` and CMake `3.22.1`. Gradle downloads whatever is
missing by itself **as long as the SDK licenses are accepted** (the Standard
setup wizard accepts them). If you prefer to avoid surprises during the first
build, install them up front: in the SDK Tools tab tick **Show Package
Details** and select those versions.

> If a build stops with `Failed to install the following Android SDK packages
> as some licences have not been accepted`, install **Android SDK
> Command-line Tools (latest)** in the SDK Tools tab, then run
> `sdkmanager --licenses` from `%ANDROID_HOME%\cmdline-tools\latest\bin` and
> accept everything.

## 3. Set the SDK environment variables

Start menu → **"Edit the system environment variables"** → **Environment
Variables...**. In the **user** variables section add:

| Variable | Value |
|---|---|
| `ANDROID_HOME` | `C:\Users\<your-user>\AppData\Local\Android\Sdk` |
| `ANDROID_SDK_ROOT` | same path as above |

Also edit the existing **`Path`** variable and add:
```
%ANDROID_HOME%\platform-tools
%ANDROID_HOME%\cmdline-tools\latest\bin
```

Close **all** open terminals/VS Code windows and open a new PowerShell to test:
```powershell
adb --version
```

> The `cmdline-tools\latest` folder may not exist by default (Android Studio does
> not install it automatically). That does not stop `adb` from working; it would
> only be needed to use `sdkmanager` from the command line.

## 4. Set JAVA_HOME

The error you usually get at this stage:
```
ERROR: JAVA_HOME is not set and no 'java' command could be found in your PATH.
```

> ⚠️ **Do not use Android Studio's embedded Java (`jbr`) for this.** Recent
> Android Studio versions can ship a JBR that is already on **Java 25**, which is
> too new for the Gradle used by this project (8.14.3, which officially supports
> up to Java 24). It breaks the build with:
> ```
> BUG! exception in phase 'semantic analysis' in source unit '_BuildScript_'
> Unsupported class file major version 69
> ```
> The fix is to install a separate **JDK 17** (LTS) just for Gradle. The same
> applies on Linux: `README.md` says "JDK 17+", but use 17 (anything from 17 to
> 24 works, 25 does not).

1. Download **JDK 17 (Eclipse Temurin)** from
   [adoptium.net/temurin/releases/?version=17](https://adoptium.net/temurin/releases/?version=17):
   Operating System **Windows**, Architecture **x64**, Package Type **JDK**.
   Install with the default `.msi` options.
2. Note the install path, something like:
   ```
   C:\Program Files\Eclipse Adoptium\jdk-17.0.20.8-hotspot
   ```
   (the build number may differ; use the real path generated on your machine)

Add a **user** variable:

| Variable | Value |
|---|---|
| `JAVA_HOME` | `C:\Program Files\Eclipse Adoptium\jdk-17.0.20.8-hotspot` |

And add to `Path`:
```
%JAVA_HOME%\bin
```

Close and reopen the terminal, then check:
```powershell
java -version
```
It must show `openjdk version "17.0.x"` — **not** 21+ or 25.

## 5. Enable USB debugging on the phone

1. **Settings → About phone** → tap **"Build number"** 7 times to enable
   Developer options.
2. **Settings → System → Developer options** → turn on **"USB debugging"**.
3. Connect the phone with a USB cable (it must carry data, not only charge).
4. Accept the **"Allow USB debugging?"** prompt, ticking "Always allow from this
   computer".

### Gotcha: Samsung "Auto Blocker"

On recent Samsung devices (One UI 6/7), **Auto Blocker** blocks USB
installation/debugging by default, and the authorization prompt may not even
appear.

Fix: Settings → search for **"auto blocker"** → **Auto Blocker** → turn off the
USB-debugging security option (or the whole feature, temporarily). Then unplug
and replug the cable — the authorization prompt should appear (sometimes as a
silent notification in the status bar instead of an on-screen popup).

> ⚠️ Auto Blocker can **re-enable itself** after a while, even while a build is
> running. In that case `adb` loses the connection halfway and the command only
> fails when it tries to install the APK, with an error like
> `adb.exe: device '<id>' not found`, even after a `BUILD SUCCESSFUL`. You do not
> need to rebuild: authorize again (turn the blocker off, replug the cable,
> confirm with `adb devices`) and run `npx expo run:android --device` again.
> The build is already cached, so this second attempt only reinstalls the APK
> and is fast. If this keeps happening during a work session, consider turning
> Auto Blocker off entirely while you are developing and turning it back on
> afterwards.

### Verify

```powershell
adb devices
```
The phone must be listed with status **`device`** (not `unauthorized`, not
empty). If nothing shows up:
```powershell
adb kill-server
adb start-server
adb devices
```
If it still does not appear, revoke the authorizations under **Developer
options → Revoke USB debugging authorizations** and reconnect the cable from
scratch. Some phone brands also need their own USB driver on Windows (for
example the Samsung USB driver) before `adb` can see the device.

## 6. Run the build

From the project root:
```powershell
npx expo run:android --device
```

If there is more than one device it asks which one to use. On a fresh clone the
`android/` folder does not exist (it is generated and git-ignored), so the first
run also creates it (a "prebuild" step) before compiling. The first build
downloads Gradle dependencies and compiles the native code, which can take 5 to
20 minutes. When it finishes, the app is installed and opened on the phone,
already connected to Metro.

### Gotcha: Windows "not enough system resources" error during the build

After compiling almost everything (it can happen close to the end, with most
tasks already done), the build may fail with something like:

```
Failed to transform react-android-0.81.5-debug.aar ...
Not enough system resources are available to complete the requested service
```
(Portuguese Windows: `Não existem recursos de sistema suficientes para concluir
o serviço solicitado`.)

This is **not a code bug**. It is the Windows `ERROR_NO_SYSTEM_RESOURCES` error,
which happens when Gradle tries to extract several large `.aar` files in
parallel and the system runs out of handles. The two most common causes are the
antivirus scanning every file during extraction and Gradle using too many
workers for the available resources.

**Fix:**

1. Add exclusions in **Windows Defender** (Settings → Privacy & security →
   Windows Security → Virus & threat protection → Manage settings → Exclusions →
   Add an exclusion → Folder) for:
   - the project folder (for example `C:\PROJETOS-UFC\TRIARE-GERAL\TriareApp`)
   - `C:\Users\<your-user>\.gradle`
   - `%ANDROID_HOME%` (the SDK folder)

   If you use an antivirus other than Defender, exclude the same folders there.

2. Create (or edit) `C:\Users\<your-user>\.gradle\gradle.properties` (the file
   **does not exist by default** — create a new `.txt` file in the `.gradle`
   folder and rename it, removing the `.txt` extension) with:
   ```properties
   org.gradle.workers.max=2
   org.gradle.parallel=false
   org.gradle.jvmargs=-Xmx2048m
   ```
   Settings in this user-level file take precedence over the project's
   `android/gradle.properties`, which enables parallel builds.

3. Run the build again. Gradle already caches what it compiled up to the point
   of failure, so this attempt is usually faster.

## After the first build

For day-to-day work (editing `.tsx`/`.ts`) just run:
```powershell
npm start
```
with normal hot reload. You only need to run `npx expo run:android --device`
again when something **native** changes (a new library with a native module, a
change to `app.json` plugins/permissions, etc.).

## How to confirm it worked

When the app opens on the phone, the real TriareApp screen should appear (the
pairing screen), not a white screen or a `createClient` error.

> If a black menu appears on top ("This is the developer menu...") it is not an
> error — it is the **Expo/React Native developer menu**, which opens on its own
> when you shake the phone or touch the screen with three fingers for a moment
> (easy to trigger by accident). Tap **Continue** to close it and keep using the
> app normally.

To confirm that BLE works end to end, not just that the app opens: power the
WBA65 board, use "Scan for devices" (or the raw diagnostic screen, if the app
has one) and try to read the **DevEUI** (command `GET_DEVEUI`, opcode `0x01`). A
real response in the format `[0x01, 8× DevEUI bytes]` (as documented in
[`BLE_PROTOCOL.md`](BLE_PROTOCOL.md)) confirms the whole cycle — scan → connect
→ discover services → GATT write/read → firmware response — and not just that
the app compiled.

## Security

USB debugging is standard practice among Android developers. The real risk is
leaving it on permanently and plugging the phone into computers you do not know,
which is not the case here (your own laptop, explicit fingerprint
authorization). You can turn it off after the working day if you prefer.
