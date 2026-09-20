# Screen Sharing App

[![Open in Bolt](https://bolt.new/static/open-in-bolt.svg)](https://bolt.new/~/sb1-41jtrfd1)

## Production requirements

This app uses Supabase Realtime for signaling and WebRTC for the media stream.
Configure these environment variables in the hosting provider before deploying:

```text
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-public-anon-or-publishable-key
VITE_TURN_URL=turns:your-turn-server.example.com:5349
VITE_TURN_USERNAME=your-turn-username
VITE_TURN_CREDENTIAL=your-turn-credential
```

The deployed site must use HTTPS. A TURN server is required for reliable use on
hostel, university, hospital, corporate, or guest Wi-Fi because those networks
may block direct peer-to-peer WebRTC traffic or isolate clients from each other.
STUN-only mode is suitable only for networks where direct ICE connectivity is
allowed.

For a local two-device test, run `npm run dev -- --host 0.0.0.0`, open the host
on `http://localhost:5173`, and open the viewer from the host machine's LAN IP.
