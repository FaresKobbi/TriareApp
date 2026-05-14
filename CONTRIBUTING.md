# Contributing to TRIARE

TRIARE is a React Native / Expo application for controlling a motorized tricycle via Bluetooth. This guide explains everything you need to know to contribute to the project.

---

## Table of Contents

- [Project setup](#project-setup)
- [Branch workflow](#branch-workflow)
- [Branch naming convention](#branch-naming-convention)
- [Working on a feature](#working-on-a-feature)
- [Commit message convention](#commit-message-convention)
- [Pull request workflow](#pull-request-workflow)
- [Release workflow](#release-workflow)
- [Troubleshooting](#troubleshooting)
- [Summary for contributors](#summary-for-contributors)

---

## Project setup

### Prerequisites

Make sure the following tools are installed on your machine:

- [Node.js](https://nodejs.org/) (the project CI uses Node 22 — use the same version locally to avoid surprises)
- [npm](https://www.npmjs.com/) (comes with Node.js)
- [Git](https://git-scm.com/)
- [Expo Go](https://expo.dev/go) on your physical device, **or** an Android/iOS emulator

### Clone and install

```bash
git clone https://github.com/FaresKobbi/TriareApp.git
cd TriareApp
npm ci
```

> **Why `npm ci` instead of `npm install`?**
> `npm ci` installs dependencies exactly as specified in `package-lock.json`. This ensures everyone on the team uses the same dependency versions. Use `npm install` only when you intentionally want to add or update a package.

### Start the development server

```bash
npm start
```

This runs `expo start`, which gives you options to open the app in:

- **Expo Go** (scan the QR code on your phone)
- **Android emulator** (`npm run android`)
- **iOS simulator** (`npm run ios`)
- **Web browser** (`npm run web`)

### After pulling changes

If `package.json` or `package-lock.json` changed since your last pull, reinstall dependencies:

```bash
git pull origin dev
npm ci
```

---

## Branch workflow

The project uses the following branch structure:

```
main
  └── dev
        └── feat/* / fix/* / chore/* / test/*
```

| Branch | Purpose |
|---|---|
| `main` | Stable, release-ready code. The automated release pipeline runs here. |
| `dev` | Development integration branch. All work is merged here first. |
| `feat/*` | New features |
| `fix/*` | Bug fixes |
| `chore/*` | Maintenance, tooling, configuration, dependencies |
| `test/*` | Adding or improving tests |

**Important rules:**

- Never commit directly to `main`.
- Never commit directly to `dev`.
- Always branch off from `dev`.
- Releases happen only from `main`.

---

## Branch naming convention

Use lowercase letters, hyphens, and a descriptive name.

```
feat/bluetooth-device-selection
feat/motor-speed-control
fix/bluetooth-reconnection-error
fix/motor-stop-button-state
chore/setup-release-pipeline
chore/update-dependencies
test/add-bluetooth-service-tests
```

---

## Working on a feature

Here is the full workflow from start to finish:

```bash
# 1. Switch to dev and pull the latest changes
git switch dev
git pull origin dev

# 2. Create your branch from dev
git switch -c feat/my-feature

# 3. Work on the code...

# 4. Stage and commit your changes
git add .
git commit -m "feat: add my feature"

# 5. Push your branch to the remote repository
git push 
   # If pushing this branch for the first time, do this first:
git push --set-upstream origin feat/my-feature
```

Then open a **Pull Request from `feat/my-feature` into `dev`** on GitHub.

---

## Commit message convention

The project uses **Conventional Commits**. Every commit message must follow this format:

```
type(optional scope): short description
```

The `type` is mandatory. The `scope` is optional and describes what part of the app is affected (e.g., `bluetooth`, `motor`, `ui`).

### Commit types

| Type | When to use | Triggers a release? |
|---|---|---|
| `feat` | A new feature for the user | ✅ Minor version (`1.0.0 → 1.1.0`) |
| `fix` | A bug fix | ✅ Patch version (`1.0.0 → 1.0.1`) |
| `docs` | Documentation changes only | ❌ No |
| `style` | Formatting, whitespace — no logic change | ❌ No |
| `refactor` | Code restructuring without behavior change | ❌ No |
| `perf` | Performance improvement | ❌ No |
| `test` | Adding or updating tests | ❌ No |
| `chore` | Maintenance, dependencies, tooling | ❌ No |
| `ci` | CI/CD and GitHub Actions changes | ❌ No |
| `build` | Build system or dependency-related changes | ❌ No |
| `revert` | Reverts a previous commit | Depends on what is reverted |

### Examples

```bash
feat: add bluetooth device selection screen
feat(motor): add variable speed control
fix: prevent crash when bluetooth disconnects
fix(ui): correct motor stop button state
docs: update setup instructions
style: format AppButton component
refactor: isolate bluetooth connection service
perf: reduce screen re-rendering
test: add motor control unit tests
chore: update Expo dependencies
ci: add automated release pipeline
revert: revert bluetooth connection screen
```

### Breaking changes

If your change is not backward-compatible, it is a **breaking change**. Breaking changes trigger a **major version release** (`1.0.0 → 2.0.0`).

You can indicate a breaking change in two ways:

**Option 1 — exclamation mark after the type:**

```bash
feat!: change bluetooth command protocol
```

**Option 2 — `BREAKING CHANGE` footer in the commit body:**

```
feat: change bluetooth command protocol

BREAKING CHANGE: the command frame format is no longer compatible with previous versions.
```

### How commits affect the version

| Commit type | Version change | Example |
|---|---|---|
| `fix` | Patch | `1.0.0 → 1.0.1` |
| `feat` | Minor | `1.0.0 → 1.1.0` |
| `feat!` or `BREAKING CHANGE` | Major | `1.0.0 → 2.0.0` |
| `docs`, `style`, `chore`, `test`, `ci`, `refactor` | None | No release |

### Commit validation (Husky + commitlint)

Commit messages are **validated automatically** before every commit using [Husky](https://typicode.github.io/husky/) and [commitlint](https://commitlint.js.org/).

If your commit message does not follow the convention, the commit will be rejected.

**Invalid examples (will be rejected):**

```
added stuff
update files
changes
wip
```

**Valid examples (will be accepted):**

```
feat: add motor speed control
fix: handle bluetooth disconnection
docs: update contributing guide
ci: configure semantic release
```

> **Note:** Two Husky hooks are active on every commit:
> - **`pre-commit`** — runs `npm run lint`. If the linter reports errors, the commit is blocked.
> - **`commit-msg`** — runs `commitlint`. If the commit message format is invalid, the commit is blocked.

---

## Pull request workflow

1. Push your branch to the remote repository (see [Working on a feature](#working-on-a-feature)).
2. Open a Pull Request on GitHub from your branch into `dev`.
3. **Set the PR title following the Conventional Commits format** (see below).
4. Add a description explaining what the PR does and why.
5. Request a review from a team member.
6. Address any review feedback by pushing additional commits to the same branch.
7. Once approved, the PR can be merged into `dev`.

### PR title convention

**The PR title must follow the same Conventional Commits format as commit messages:**

```
type(optional scope): short description
```

**Examples:**

```
feat(bluetooth): add device selection screen
fix(motor): prevent crash when disconnecting
chore: update Expo dependencies
docs: update setup instructions
```

> **Why does this matter?**
> GitHub has no server-side check that enforces the Conventional Commits format on commit messages. The only local check is the `commit-msg` Husky hook on your machine. When merging a Pull Request on GitHub, the **merge commit message is set from the PR title**. If the PR title does not follow the convention, the merge commit will not be recognized by `semantic-release`, and the release may not be triggered or may produce an incorrect version.

### Merge commit message

When merging a PR on GitHub, **use the PR title as the merge commit message**. Do not change it to something generic like `Merge pull request #12`.

The merge commit is what `semantic-release` reads to decide the next version. An incorrect message means the release will be wrong or skipped entirely.

**Correct merge commit message:**

```
feat(bluetooth): add device selection screen
```

**Incorrect merge commit message:**

```
Merge pull request #12 from feat/bluetooth-device-selection
```

### Releasing to production

When `dev` is stable and the team is ready for a release:

1. Open a Pull Request from `dev` into `main`.
2. Set the PR title to a Conventional Commits message that reflects the scope of the release (e.g., `feat: release bluetooth control feature`).
3. Review and approve the PR.
4. Merge into `main`, keeping the PR title as the merge commit message.
5. The automated release pipeline runs automatically (see [Release workflow](#release-workflow)).

---

## Release workflow

The project uses **[semantic-release](https://semantic-release.gitbook.io/)** to automate versioning and releases.

### What triggers a release

A release is triggered automatically when commits are **pushed or merged into `main`**.

Merging into `dev` does **not** create a release.

### What the release pipeline does

The release workflow is defined in [`.github/workflows/release.yml`](.github/workflows/release.yml) and runs on GitHub Actions. Here is what happens step by step:

1. **Checks out the repository** with full Git history.
2. **Sets up Node.js 22** with npm caching.
3. **Installs dependencies** using `npm ci`.
4. **Runs `semantic-release`**, which:
   - Analyzes all commits since the last release tag.
   - Determines the next version number automatically (`fix` → patch, `feat` → minor, breaking change → major).
   - Generates or updates `CHANGELOG.md`.
   - Creates source archives:
     - `dist/v<version>.zip`
     - `dist/v<version>.tar.gz`
   - Commits the updated `CHANGELOG.md`, `package.json`, and `package-lock.json` back to the repository with the message `chore(release): <version> [skip ci]`.
   - Creates a Git tag (e.g., `v1.0.0`, `v1.1.0`).
   - Creates a GitHub Release with:
     - Auto-generated release notes
     - The `.zip` archive as an attached asset ("Source archive ZIP")
     - The `.tar.gz` archive as an attached asset ("Source archive TAR.GZ")

### Permissions required

The workflow uses the built-in `GITHUB_TOKEN` secret, which is automatically available in GitHub Actions. No manual configuration is needed for the token.

### Important rules

- **Do not manually edit `CHANGELOG.md`** — it is fully managed by semantic-release.
- **Do not manually bump the version** in `package.json` — semantic-release handles this.
- **Do not create release tags manually** — let the pipeline do it.

---

## Code style and linting

The project uses **ESLint** with the [`eslint-config-expo`](https://docs.expo.dev/guides/using-eslint/) configuration.

Run the linter with:

```bash
npm run lint
```

This uses the Expo ESLint preset, which covers React Native and TypeScript best practices.

> **`npm run lint` runs automatically on every commit** via the `pre-commit` Husky hook. If the linter finds errors, the commit will be blocked until you fix them.

You can also run it manually at any time:

```bash
npm run lint
```

> **Note:** Lint warnings do not block commits — only errors do. However, try to keep the codebase warning-free.

### TypeScript

The project uses TypeScript with strict mode enabled (`"strict": true` in `tsconfig.json`). Make sure your code compiles without errors.

---

## Testing

> **Tests are not configured yet.** There is no test runner or test script in `package.json` at this stage of the project. This is planned for later.

---

## Troubleshooting

### My commit was rejected — what do I do?

Read the error message in the terminal carefully. If it mentions `commitlint`, your commit message does not follow the Conventional Commits format.

Fix the message using `git commit --amend` or by using the correct format in your next commit:

```bash
# Wrong
git commit -m "added stuff"

# Correct
git commit -m "feat: add motor speed control screen"
```

### Husky hooks are not running

Make sure you ran `npm ci` (or `npm install`) after cloning the repository. The `prepare` script in `package.json` installs the Husky hooks automatically:

```json
"prepare": "husky"
```

If hooks are still not running:

```bash
npx husky
```

### My commit was blocked by a lint error

If `npm run lint` fails during a commit, the terminal will show which file and rule caused the error.

Fix the reported issue, then stage the fix and retry the commit:

```bash
# Fix the issue in your editor, then:
git add <file>
git commit -m "fix: correct lint error in ..."
```

If you need to skip the hook temporarily (not recommended):

```bash
git commit --no-verify -m "your message"
```

> Only use `--no-verify` if you have a very good reason. It bypasses **both** the lint check and the commit message check.

### The release did not trigger

- Check that you pushed or merged to `main`, not `dev`.
- Check the **Actions** tab on GitHub to see if the workflow ran and if there were any errors.
- If no commits since the last release contain `feat` or `fix` types, semantic-release will not create a new release (this is expected behavior).

### Dependency issues after pulling

If you see unexpected errors after pulling, reinstall dependencies:

```bash
npm ci
```

---

## Summary for contributors

| Step | Command |
|---|---|
| Clone the project | `git clone <repository-url>` |
| Install dependencies | `npm ci` |
| Start the dev server | `npm start` |
| Create a new branch | `git checkout -b feat/my-feature` |
| Commit with convention | `git commit -m "feat: short description"` |
| Push your branch | `git push origin feat/my-feature` |
| Open a Pull Request | From your branch → `dev` on GitHub |
| Lint check (manual) | `npm run lint` |
| Lint check (automatic) | Runs on every `git commit` via Husky |
| Release | Merge `dev` → `main` (automated) |

**Quick commit type reference:**

- `feat:` → new feature
- `fix:` → bug fix
- `docs:` → documentation
- `chore:` → maintenance / tooling
- `ci:` → CI/CD
- `refactor:` → code restructuring
- `test:` → tests
- `style:` → formatting only
