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
