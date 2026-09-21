# SrceenSharingApp

[![Open in Bolt](https://bolt.new/static/open-in-bolt.svg)](https://bolt.new/~/sb1-41jtrfd1)

## Local development

Install dependencies and start the Vite server:

```bash
npm install
npm run dev
```

Copy `.env.example` to `.env` and set `VITE_SUPABASE_URL` and
`VITE_SUPABASE_ANON_KEY`. These variables must also be configured in the
deployment provider before building; Vite embeds `VITE_*` values into the
production bundle.

Screen sharing uses Supabase Realtime for signaling and WebRTC for media. A
TURN server is optional for local testing, but production deployments should
set `VITE_TURN_URL`, `VITE_TURN_USERNAME`, and `VITE_TURN_CREDENTIAL` so
viewers behind restrictive NATs or firewalls can connect.

### Mobile screen sharing

The mobile browser must support `getDisplayMedia` and the app must be opened
over HTTPS. Mobile system-audio capture is not requested because many mobile
browsers reject the whole screen-capture request when audio is included. If
the browser does not support screen capture, use the latest Chrome on Android
or Safari on iOS 17.2 or later.
## Native Android companion

The web app is the browser viewer. An optional native Android host is under
[`android/`](./android/).

The Android app captures the device display with `MediaProjection`, publishes
the screen as a native WebRTC video track, and uses the same Supabase Realtime
signaling contract as the web host:

- channel: `room-{roomCode}`
- broadcast event: `signal`
- messages: `viewer-join`, `host-ready`, `offer`, `answer`, `ice`, and
  `viewer-leave`

The Android host sends `host-ready`, accepts `viewer-join`, and creates one
WebRTC peer connection per browser viewer.

### Configure and build

Install Android Studio (including the Android SDK and JDK 17), then create
`android/local.properties` with the normal `sdk.dir` entry plus credentials:

```properties
sdk.dir=C:\\Users\\you\\AppData\\Local\\Android\\Sdk
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-public-key
```

Credentials are read into `BuildConfig` at build time and are not committed.
From the repository root:

```powershell
cd android
.\gradlew.bat assembleDebug
```

Install the resulting `app/build/outputs/apk/debug/app-debug.apk`, enter the
same room code shown in the browser, tap **Start sharing**, and approve the
Android screen-capture prompt. A foreground notification remains visible while
capture is active.

The first build requires network access to download Gradle, AndroidX Compose,
OkHttp, and the WebRTC native dependency. The checked-in module intentionally
does not include a Gradle wrapper; Android Studio can generate/supply the
wrapper for environments that require it.
