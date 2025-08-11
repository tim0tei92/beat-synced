# BeatSynced — One Image → Beat‑Reactive Video

**What it is:** A working site where you upload a single image and a song, it detects beats on-device, and the server renders a beat-reactive video (Ken Burns zoom + flash-on-beat) and muxes your song — no external AI keys needed. Swap the renderer later for an AI video API without changing the UI.

## Quickstart (Local)

1) Install dependencies
```bash
npm i
```

2) Make sure **ffmpeg** is installed and available on your PATH
```bash
ffmpeg -version
```
If not, install it (macOS: `brew install ffmpeg`, Ubuntu: `sudo apt-get install -y ffmpeg`).

3) Run dev
```bash
npm run dev
```
Open http://localhost:3000 — upload one image + one audio, click **Detect Beats**, then **Generate**. After a short render, click **Download Video**.

> Note: Jobs are tracked in-memory, so they reset on server restart.

## One-click style Deploy

### Railway (recommended for the API because it allows long ffmpeg processes)

1. Create a new **Railway** project and select “Deploy from GitHub”. Push this folder to a GitHub repo first.
2. Use the included **Dockerfile**. Railway will build it and expose port 3000.
3. Once deployed, you’ll get a public URL.

### Vercel
Vercel is great for the UI, but serverless functions may time out during long ffmpeg renders. For production, pair Vercel (UI) + Railway (API).

## Swap in a Hosted AI Video Model (optional)

Replace the ffmpeg section in `/app/api/generate/route.ts` with a call to your provider (Pika/Runway/Replicate/etc.). Keep the request/response contract so the UI continues to work.

- Send: `beats[]` (seconds), `frameRate`, `resolution`, `prompt`, `negativePrompt`, `intensity`, `styleStrength`, `seed`, `duration`, URLs for image+audio.
- When the provider returns the silent video, **mux** with the original audio using ffmpeg and return a download URL.

## Tech

- Next.js App Router
- WebAudio (client) for onset/beat estimation
- Node + ffmpeg worker
- In-memory job store (swap for Redis in prod)

## Notes

- This is a functional MVP. For real production:
  - Use Redis/Upstash for jobs.
  - Store uploads/outputs on S3/R2 and return signed URLs.
  - Run the renderer as a background worker (Railway/Fly/EC2).
