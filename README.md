# FTAP OpenSpeedTest POC

FTAP OpenSpeedTest POC is a hybrid mobile POC built with Ionic Angular + Capacitor. The app embeds a self-hosted OpenSpeedTest server URL and starts the basic speed-test flow with the OpenSpeedTest `Run` URL parameter.

## Recommended POC Backend

Use the official OpenSpeedTest Docker image so the mobile app talks to a server that already follows the project requirements for download, upload, latency, and static-file serving.

```bash
docker compose up -d
```

Equivalent direct Docker command:

```bash
docker run --restart=unless-stopped --name openspeedtest -d -p 3000:3000 -p 3001:3001 openspeedtest/latest
```

For local browser testing, use:

```text
http://localhost:3000
```

For a real phone on the same network, use the computer or server LAN IP:

```text
http://192.168.0.13:3000
```

For the Android emulator on this machine, use:

```text
http://10.0.2.2:3000
```

## Run The App

```bash
npm install
npm start
```

Open `http://localhost:4200`.

## Capacitor

Build the web assets:

```bash
npm run build
```

Add and sync a native platform:

```bash
npm run cap:add:android
npm run cap:open:android
```

iOS requires macOS/Xcode:

```bash
npm run cap:add:ios
npm run cap:open:ios
```

## Notes

- This is based on OpenSpeedTest, an open-source speed-test alternative. It should not be branded as an Ookla product.
- The POC intentionally wraps the OpenSpeedTest server page instead of reimplementing the measurement engine in a separate browser origin.
- `server.cleartext` is enabled in `capacitor.config.ts` for HTTP LAN testing. Use HTTPS and narrow `allowNavigation` before production release.
