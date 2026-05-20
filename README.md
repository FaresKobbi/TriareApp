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
