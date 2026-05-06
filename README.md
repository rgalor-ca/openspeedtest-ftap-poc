# FTAP OpenSpeedTest POC

FTAP OpenSpeedTest POC is a hybrid mobile proof of concept built with Ionic Angular and Capacitor. It provides a polished FTAP mobile shell for running a basic speed test through a self-hosted OpenSpeedTest server.

This POC is based on the open-source OpenSpeedTest project:

[https://github.com/openspeedtest/Speed-Test](https://github.com/openspeedtest/Speed-Test)

Important: this is not an Ookla product and should not be branded as Ookla. It is an FTAP POC that uses OpenSpeedTest as the open-source speed-test engine.

## Live Links

| Item | Link or Path |
| --- | --- |
| GitHub repository | [https://github.com/rgalor-ca/openspeedtest-ftap-poc](https://github.com/rgalor-ca/openspeedtest-ftap-poc) |
| GitHub Pages app | [https://rgalor-ca.github.io/openspeedtest-ftap-poc/](https://rgalor-ca.github.io/openspeedtest-ftap-poc/) |
| Local app | `http://127.0.0.1:4200/` |
| Local OpenSpeedTest server | `http://127.0.0.1:3000/` |
| Android emulator OpenSpeedTest URL | `http://10.0.2.2:3000` |
| Debug APK | `FTAP-OpenSpeedTest-POC-debug.apk` |

## What This POC Includes

- Hybrid app built with Ionic Angular and Capacitor.
- Android APK artifact committed in the repository.
- Docker Compose server for OpenSpeedTest.
- GitHub Pages deployment for remote UI access.
- Dark mode by default, with a light/dark toggle.
- One-screen responsive UI with no app-level scrolling across tested mobile, tablet, and desktop viewports.
- Editable and saved OpenSpeedTest server URL.
- Basic start, restart, stop, reload, loading, loaded, and error states.
- Local browser flow, Android emulator flow, and GitHub Pages flow.
- Full documentation with architecture, workflows, edge cases, validation, and troubleshooting.

## Current Screenshots

### Local Browser

![FTAP OpenSpeedTest POC local browser screenshot](docs/images/local-browser-ftap-poc.png)

### Android Emulator

![FTAP OpenSpeedTest POC Android emulator screenshot](docs/images/android-emulator-loaded.png)

## High-Level Architecture

```mermaid
flowchart LR
  User["User"]
  App["FTAP OpenSpeedTest POC<br>Ionic Angular UI"]
  Web["Local Browser<br>Angular dev server"]
  Native["Android APK<br>Capacitor WebView"]
  Server["OpenSpeedTest Server<br>Docker container"]
  Pages["GitHub Pages<br>Hosted static app"]

  User --> App
  App --> Web
  App --> Native
  App --> Pages
  Web -->|"iframe http://127.0.0.1:3000/?Run"| Server
  Native -->|"iframe http://10.0.2.2:3000/?Run"| Server
  Pages -->|"iframe public HTTPS server/?Run"| Server
```

## Runtime Workflow

```mermaid
sequenceDiagram
  participant U as User
  participant A as FTAP App
  participant S as OpenSpeedTest Server

  U->>A: Enter or confirm server URL
  U->>A: Tap Start test
  A->>A: Validate http or https URL
  A->>A: Show starting status immediately
  A->>S: Load OpenSpeedTest iframe with Run parameter
  S-->>A: Return OpenSpeedTest test UI
  A->>A: Show loaded status
  U->>S: Run the speed test inside the embedded OpenSpeedTest UI
```

## Tech Stack

| Area | Technology |
| --- | --- |
| Hybrid mobile framework | Ionic Angular |
| Native runtime | Capacitor |
| Web framework | Angular |
| Android project | Capacitor Android and Gradle |
| Speed-test engine | OpenSpeedTest Docker image |
| Local server | Docker Compose |
| Hosted web app | GitHub Pages |
| Package manager | npm |

## Repository Structure

```text
.
|-- .github/workflows/pages.yml       GitHub Pages deployment workflow
|-- android/                          Capacitor Android project
|-- docs/
|   |-- DOCUMENTATION.md              Full technical and validation documentation
|   `-- images/                       Browser and emulator screenshots
|-- public/                           Static web assets
|-- src/                              Ionic Angular application source
|-- capacitor.config.ts               Capacitor app id, name, web dir, and WebView settings
|-- docker-compose.yml                Local OpenSpeedTest Docker server
|-- FTAP-OpenSpeedTest-POC-debug.apk  Debug Android APK artifact
|-- package.json                      Scripts and dependencies
`-- README.md                         Project overview and quick start
```

## Prerequisites

- Node.js and npm.
- Docker Desktop.
- Android Studio or Android SDK.
- Java from Android Studio JBR or a compatible JDK.
- Android emulator or physical Android device for APK testing.

## Quick Start

1. Install dependencies.

```bash
npm install
```

2. Start the OpenSpeedTest Docker server.

```bash
docker compose up -d
```

3. Confirm the server responds.

```text
http://127.0.0.1:3000/
```

4. Start the Ionic Angular app.

```bash
npm start
```

5. Open the local app.

```text
http://127.0.0.1:4200/
```

6. Use the right server URL for your environment.

| Environment | Server URL |
| --- | --- |
| Local Chrome on the same computer | `http://127.0.0.1:3000` |
| Android emulator on the same Windows host | `http://10.0.2.2:3000` |
| Physical phone on same Wi-Fi | `http://<host-lan-ip>:3000` |
| GitHub Pages remote user | Public HTTPS OpenSpeedTest server URL |

## Docker Server

The Compose stack is explicitly named `ftap-openspeedtest-poc` so Docker Desktop shows the project with the FTAP POC name.

```yaml
name: ftap-openspeedtest-poc

services:
  openspeedtest:
    image: openspeedtest/latest
    container_name: openspeedtest
    restart: unless-stopped
    ports:
      - '3000:3000'
      - '3001:3001'
```

Useful commands:

```bash
docker compose up -d
docker compose ps
docker compose logs -f
docker compose down
```

## Build Web App

```bash
npm run build
```

Expected output:

```text
dist/ftap-openspeedtest-poc/browser
```

## Build GitHub Pages Version

```bash
npm run build:pages
```

This uses the required GitHub Pages base path:

```text
/openspeedtest-ftap-poc/
```

## Build Android APK

PowerShell:

```powershell
$env:JAVA_HOME='C:\Program Files\Android\Android Studio\jbr'
$env:Path="$env:JAVA_HOME\bin;$env:Path"
npm run build
npx cap sync android
Push-Location android
.\gradlew.bat assembleDebug
Pop-Location
Copy-Item -LiteralPath 'android\app\build\outputs\apk\debug\app-debug.apk' -Destination 'FTAP-OpenSpeedTest-POC-debug.apk' -Force
```

## Install APK On Android Emulator

```powershell
adb install -r FTAP-OpenSpeedTest-POC-debug.apk
adb shell monkey -p com.ftap.openspeedtestpoc -c android.intent.category.LAUNCHER 1
```

Inside the emulator, use:

```text
http://10.0.2.2:3000
```

Why: `127.0.0.1` inside the emulator points to the emulator itself. `10.0.2.2` is Android emulator networking for the Windows host machine.

## GitHub Pages Deployment

GitHub Pages deploys on every push to `main` through `.github/workflows/pages.yml`.

```mermaid
flowchart LR
  Push["Push to main"]
  Checkout["Checkout"]
  Node["Setup Node 24"]
  Install["npm ci"]
  Build["npm run build:pages"]
  Artifact["Upload Pages artifact"]
  Deploy["Deploy GitHub Pages"]
  Site["Hosted FTAP POC"]

  Push --> Checkout --> Node --> Install --> Build --> Artifact --> Deploy --> Site
```

The hosted app is static. It can render the shell remotely, but the speed-test iframe still needs a reachable OpenSpeedTest server URL. For public remote access, use HTTPS.

## URL Rules And Edge Cases

| Case | Expected Behavior |
| --- | --- |
| Empty URL | App rejects it and does not start the iframe |
| Missing protocol | App rejects it and asks for `http://` or `https://` |
| Unsupported protocol such as `ftp://` | App rejects it |
| Local browser with `127.0.0.1:3000` | Works when Docker server is running locally |
| Android emulator with `127.0.0.1:3000` | Fails because that points to the emulator |
| Android emulator with `10.0.2.2:3000` | Works when Docker server is running on Windows |
| GitHub Pages with private LAN URL | Usually fails for remote users because the URL is not public |
| GitHub Pages with HTTP server | Browser may block mixed content from HTTPS page |
| Stop while loading | App clears the iframe and returns to idle |
| Restart after loaded | App reloads the iframe with a fresh timestamp |

## Validation Summary

Current validation covers:

- Dependency install with `npm install`.
- Production web build with `npm run build`.
- GitHub Pages build with `npm run build:pages`.
- Docker server health at `http://127.0.0.1:3000/`.
- Local app health at `http://127.0.0.1:4200/`.
- Responsive viewport checks at phone, tablet, and desktop sizes.
- Capacitor sync with `npx cap sync android`.
- Android debug APK build with Gradle.
- APK metadata check for package id and app label.
- Emulator install and launch of `com.ftap.openspeedtestpoc/.MainActivity`.
- Source scan for old naming and branding leftovers.

## Security Notes

The POC intentionally allows local HTTP traffic so Docker, LAN, and emulator testing are straightforward.

Before production:

- Serve the OpenSpeedTest server over HTTPS.
- Restrict Capacitor navigation to trusted domains.
- Remove broad `allowNavigation: ['*']`.
- Sign a release APK with a release keystore.
- Do not distribute the debug APK as a production artifact.

## Full Documentation

Read the detailed documentation for architecture, process flows, diagrams, testing matrix, edge cases, troubleshooting, and release steps:

[docs/DOCUMENTATION.md](docs/DOCUMENTATION.md)
