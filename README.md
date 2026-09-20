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
